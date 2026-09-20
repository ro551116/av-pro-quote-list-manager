import assert from 'node:assert/strict';
import test from 'node:test';
import type { EquipmentItem, Project, StageItem, WorkStage } from '../types';
import {
  calculateProject, calcRentalPeriod, calcWorkStage, cloneStagePricing,
  convertToStagePricing, createStagePricing, getProjectResources,
  assignEquipmentToStage, deleteScheduleRow, getScheduleRows, updateScheduleStage,
} from '../utils/helpers';

const equipment = (id: string, price: number, costPrice = 0): EquipmentItem => ({
  id, name: id, category: 'audio', quantity: 1, unit: '式', price, costPrice, note: '',
});
const project = (): Project => ({
  id: 'quote', name: '展覽', client: '', date: '2026-10-06', location: '', contact: '',
  items: [equipment('audio', 8000, 2000)], taxRate: 0.05, updatedAt: 0,
});
const labor = (id: string): StageItem => ({
  id, kind: 'labor', name: '施工人員', quantity: 4, unit: '人', duration: 2,
  durationUnit: '天', price: 4000, costPrice: 2500, note: '',
});
const stage = (): WorkStage => ({
  id: 'setup', name: '進場', pricingMode: 'fixed', fixedAmount: 30000,
  displayMode: 'summary', items: [labor('crew')],
});
const emptyStage = (id: string): WorkStage => ({
  id, name: id, pricingMode: 'itemized', fixedAmount: 0, displayMode: 'summary', items: [],
});

test('empty schedules omit placeholder fees without hiding free customer equipment', () => {
  const quote = project();
  quote.items = [];
  quote.pricing = createStagePricing();
  assert.deepEqual(getScheduleRows(quote), []);

  quote.items.push({ ...equipment('internal', 1000, 500), internalOnly: true });
  assert.deepEqual(getScheduleRows(quote), []);
  assert.equal(calculateProject(quote).costSubtotal, 500);

  quote.items.push(equipment('complimentary', 0));
  const rows = getScheduleRows(quote);
  assert.deepEqual(rows.map(row => [row.wholeEquipment, row.total]), [[true, 0]]);
  assert.equal(calculateProject(quote).subtotal, 0);
});

test('selected rental periods exclude people, hidden equipment and duplicate selections', () => {
  const quote = project();
  quote.items.push({ ...equipment('person', 5000, 3000), category: 'crew' });
  quote.items.push({ ...equipment('hidden', 9000, 500), internalOnly: true });
  const period = {
    id: 'days', label: '活動', type: 'rate' as const, value: 0.5, units: 3,
    startDate: '2026-10-06', endDate: '2026-10-20',
    itemIds: ['audio', 'audio', 'person', 'hidden', 'deleted'],
  };
  assert.equal(calcRentalPeriod(quote.items, period), 12000);
  assert.equal(calcRentalPeriod(quote.items, { ...period, type: 'fixed', value: 600 }), 1800);
  assert.equal(calcRentalPeriod(quote.items, { ...period, itemIds: [] }), 0);
});

test('package overrides line revenue while actual staffing costs ignore display and pricing choices', () => {
  const setup = stage();
  setup.items.push({ ...labor('internal'), quantity: 1, duration: 1, costPrice: 1000, internalOnly: true });
  assert.deepEqual(calcWorkStage(setup), { detailSubtotal: 32000, subtotal: 30000, costSubtotal: 21000 });
  assert.deepEqual(calcWorkStage({ ...setup, displayMode: 'detailed' }), calcWorkStage(setup));
  assert.deepEqual(calcWorkStage({ ...setup, pricingMode: 'itemized' }), {
    detailSubtotal: 32000, subtotal: 32000, costSubtotal: 21000,
  });
});

test('rental is billed once, empty event staffing is free, and teardown costs remain independent', () => {
  const quote = project();
  quote.pricing = createStagePricing();
  quote.pricing.rental = {
    mode: 'periods', fixedAmount: 0, periods: [
      { id: 'day1', label: '首日', type: 'rate', value: 1, units: 1, itemIds: ['audio'] },
      { id: 'day2', label: '次日', type: 'rate', value: 0.5, units: 1, itemIds: ['audio'] },
    ],
  };
  quote.pricing.stages = [stage(), {
    id: 'event', name: '活動不留人', pricingMode: 'itemized', fixedAmount: 99999,
    displayMode: 'detailed', items: [],
  }, {
    id: 'teardown', name: '撤場', pricingMode: 'itemized', fixedAmount: 0,
    displayMode: 'detailed', items: [
      { ...labor('teardown-crew'), quantity: 6, duration: 1, price: 3000, costPrice: 2000 },
      { ...labor('truck'), kind: 'transport', name: '貨車', quantity: 2, unit: '趟', duration: 1, durationUnit: '次', price: 2000, costPrice: 1500 },
    ],
  }];
  const totals = calculateProject(quote);
  assert.deepEqual(totals, {
    rentalSubtotal: 12000, stagesSubtotal: 52000, subtotal: 64000,
    costSubtotal: 37000, tax: 3200, total: 67200, costTax: 1850, costTotal: 38850,
  });
  quote.pricing.rental.mode = 'fixed';
  quote.pricing.rental.fixedAmount = 10000;
  assert.equal(calculateProject(quote).subtotal, 62000);
  assert.equal(calculateProject(quote).costSubtotal, 37000);
  quote.pricing.rental.mode = 'itemized';
  assert.equal(calculateProject(quote).subtotal, 60000);
  assert.equal(calculateProject(quote).costSubtotal, 37000);
});

test('explicit historical conversion preserves all quote and cost totals without changing the source', () => {
  const original = project();
  original.items.push({ ...equipment('old-crew', 4000, 2500), quantity: 4, category: 'crew', days: 7 });
  original.items.push({ ...equipment('internal', 1000, 400), internalOnly: true, category: 'crew' });
  original.subcontracts = [{ id: 'sub', vendorName: '施工商', vendorTaxId: '', vendorContact: '', vendorPhone: '', handoverTime: '', itemIds: ['old-crew'] }];
  for (const charges of [undefined, [], [{ id: 'fixed', label: '包價', type: 'fixed' as const, value: 0 }], [{ id: 'fixed', label: '折扣包價', type: 'fixed' as const, value: 3000 }], [{ id: 'rate', label: '活動', type: 'rate' as const, value: 1.5 }, { id: 'fixed', label: '運費', type: 'fixed' as const, value: 500 }]]) {
    const legacy = { ...original, periodCharges: charges };
    const before = structuredClone(legacy);
    const converted = convertToStagePricing(legacy);
    const previous = calculateProject(legacy);
    const next = calculateProject(converted);
    for (const key of ['subtotal', 'costSubtotal', 'tax', 'total', 'costTax', 'costTotal'] as const) {
      assert.equal(next[key], previous[key], `${key} must survive conversion`);
    }
    assert.deepEqual(legacy, before);
    assert.equal(converted.items.some(item => item.category === 'crew'), false);
    const assigned = getProjectResources(converted).filter(item => converted.subcontracts![0].itemIds.includes(item.id));
    assert.equal(assigned.length, 1);
    assert.equal(assigned[0].quantity * assigned[0].costPrice!, 10000);
    if (previous.subtotal >= 16000) {
      const [unallocated] = converted.pricing!.stages;
      const setup = emptyStage('manual-setup');
      converted.pricing!.stages.push(setup);
      setup.items.push(...unallocated.items);
      unallocated.items = [];
      assert.equal(calculateProject(converted).subtotal, previous.subtotal, 'assigning converted staff must not leave a duplicate package fee');
    }
  }
});

test('copied quote prices use remapped equipment selections and independently editable stages', () => {
  const original = project();
  original.pricing = createStagePricing();
  original.pricing.rental = { mode: 'periods', fixedAmount: 0, periods: [
    { id: 'rental', label: '租期', type: 'rate', value: 0.75, units: 2, itemIds: ['audio'] },
  ] };
  original.pricing.stages = [stage()];
  const idMap = new Map([['audio', 'copied-audio']]);
  const copy = { ...original, items: [{ ...original.items[0], id: 'copied-audio' }], pricing: cloneStagePricing(original.pricing, idMap) };
  assert.deepEqual(calculateProject(copy), calculateProject(original));
  assert.equal(getProjectResources(copy).some(item => item.id === 'crew'), false);
  copy.pricing.stages[0].fixedAmount = 100;
  copy.pricing.stages[0].items[0].costPrice = 10;
  assert.equal(calculateProject(original).subtotal, 42000);
  assert.equal(calculateProject(original).costSubtotal, 22000);
  assert.equal(calculateProject(copy).subtotal, 12100);
  assert.equal(calculateProject(copy).costSubtotal, 2080);
});

test('schedule row totals match calculateProject across modes with orphan visibility, fractional amounts and source immutability', () => {
  const quote = project();
  quote.items = [
    { ...equipment('speaker', 123.5, 45.25), quantity: 2 },
    { ...equipment('cable', 50, 10), quantity: 3 },
  ];
  quote.pricing = createStagePricing();
  quote.pricing.stages = [emptyStage('setup'), emptyStage('event')];
  const eventStageId = quote.pricing.stages[1].id;

  // 1. Itemized mode with valid stage link
  quote.pricing.rental = {
    mode: 'itemized',
    fixedAmount: 0,
    periods: [],
    stageId: eventStageId,
  };
  const before1 = structuredClone(quote);
  const rows1 = getScheduleRows(quote);
  assert.deepEqual(quote, before1, 'getScheduleRows must not mutate input');
  const expected1 = calculateProject(quote).subtotal;
  const sum1 = rows1.reduce((s, r) => s + r.total, 0);
  assert.equal(sum1, expected1);
  const eventRow1 = rows1.find(r => r.key === `stage:${eventStageId}`);
  assert.equal(eventRow1?.wholeEquipment, true);
  assert.equal(eventRow1?.equipmentSubtotal, 123.5 * 2 + 50 * 3);
  assert.equal(rows1.some(r => r.key === 'whole-equipment'), false);

  // 2. Itemized mode with invalid / missing stage link shows orphan whole-equipment
  quote.pricing.rental.stageId = 'nonexistent-stage';
  const rows2 = getScheduleRows(quote);
  const expected2 = calculateProject(quote).subtotal;
  const sum2 = rows2.reduce((s, r) => s + r.total, 0);
  assert.equal(sum2, expected2);
  const orphanWhole = rows2.find(r => r.key === 'whole-equipment');
  assert.ok(orphanWhole);
  assert.equal(orphanWhole.wholeEquipment, true);
  assert.equal(orphanWhole.equipmentSubtotal, 123.5 * 2 + 50 * 3);
  assert.equal(orphanWhole.stage, undefined);

  // 3. Periods mode: assigned and orphan periods, no dormant whole fee
  quote.pricing.rental = {
    mode: 'periods',
    fixedAmount: 999999, // dormant
    periods: [
      { id: 'p1', label: '進場期', type: 'fixed', value: 333.5, units: 2, itemIds: [], stageId: quote.pricing.stages[0].id },
      { id: 'p2', label: '孤兒檔期', type: 'rate', value: 0.5, units: 1, itemIds: ['speaker'], stageId: undefined },
      { id: 'p3', label: '無效檔期', type: 'fixed', value: 100, units: 1, itemIds: [], stageId: 'ghost' },
    ],
  };
  const rows3 = getScheduleRows(quote);
  const expected3 = calculateProject(quote).subtotal;
  const sum3 = rows3.reduce((s, r) => s + r.total, 0);
  assert.equal(sum3, expected3);
  assert.equal(rows3.some(r => r.key === 'whole-equipment'), false);
  const orphanP2 = rows3.find(r => r.key === 'period:p2');
  const orphanP3 = rows3.find(r => r.key === 'period:p3');
  assert.ok(orphanP2);
  assert.ok(orphanP3);
  assert.equal(orphanP2.equipmentSubtotal, Math.round((123.5 * 2) * 0.5 * 1));
  assert.equal(orphanP3.equipmentSubtotal, 100);

  // 4. Fixed mode with negative amount and stage fixed override
  quote.pricing.rental = {
    mode: 'fixed',
    fixedAmount: -500.5,
    periods: [{ id: 'dormant-p', label: '休眠', type: 'fixed', value: 10000, units: 1, itemIds: [] }],
    stageId: quote.pricing.stages[0].id,
  };
  quote.pricing.stages[0].pricingMode = 'fixed';
  quote.pricing.stages[0].fixedAmount = 2000;
  const rows4 = getScheduleRows(quote);
  const expected4 = calculateProject(quote).subtotal;
  const sum4 = rows4.reduce((s, r) => s + r.total, 0);
  assert.equal(sum4, expected4);
  const stage0Row = rows4.find(r => r.key === `stage:${quote.pricing.stages[0].id}`);
  assert.equal(stage0Row?.equipmentSubtotal, -500.5);
  assert.equal(stage0Row?.workSubtotal, 2000);
  assert.equal(stage0Row?.total, 1499.5);
  assert.equal(rows4.some(r => r.key === 'period:dormant-p'), false);

  // 5. Fixed mode with unassigned 0 fee suppresses the placeholder orphan row
  quote.pricing.rental = {
    mode: 'fixed',
    fixedAmount: 0,
    stageId: undefined,
    periods: [],
  };
  const rows5 = getScheduleRows(quote);
  assert.equal(rows5.some(r => r.key === 'whole-equipment'), false, 'unassigned fixed 0 whole fee placeholder must be suppressed');
  const sum5 = rows5.reduce((s, r) => s + r.total, 0);
  assert.equal(sum5, calculateProject(quote).subtotal);
});

test('linking, reassignment and updating orphan fees preserve quote and cost totals with stable resource IDs', () => {
  const quote = project();
  quote.pricing = createStagePricing();
  quote.pricing.stages = [emptyStage('setup')];
  quote.pricing.stages[0].items.push(labor('stage-labor'));
  quote.pricing.rental = {
    mode: 'periods',
    fixedAmount: 0,
    periods: [
      { id: 'p1', label: '展期', type: 'rate', value: 1, units: 2, itemIds: ['audio'], stageId: undefined },
    ],
  };

  const initialTotals = calculateProject(quote);
  const initialResourceIds = getProjectResources(quote).map(r => r.id);
  const before = structuredClone(quote);

  // 1. Assign orphan period to first stage
  const targetStageId = quote.pricing.stages[0].id;
  const assigned = assignEquipmentToStage(quote, 'period:p1', targetStageId);
  assert.deepEqual(quote, before, 'assignEquipmentToStage must not mutate input');
  assert.deepEqual(calculateProject(assigned), initialTotals);
  assert.deepEqual(getProjectResources(assigned).map(r => r.id), initialResourceIds);
  assert.equal(assigned.pricing!.rental.periods[0].stageId, targetStageId);

  // 2. Updating via old period key resolves to existing linked stage rather than duplicating
  const updatedStage = updateScheduleStage(assigned, 'period:p1', s => ({ ...s, note: '已排定' }));
  assert.equal(updatedStage.pricing!.stages.length, quote.pricing.stages.length, 'must not create duplicate stage');
  assert.equal(updatedStage.pricing!.stages[0].note, '已排定');
  assert.deepEqual(calculateProject(updatedStage), initialTotals);

  // 3. Updating an orphan period creates itemized stage with zero work lines (billed exactly once)
  const quoteWithOrphan = {
    ...quote,
    pricing: {
      ...quote.pricing,
      rental: {
        ...quote.pricing.rental,
        periods: [{ id: 'p2', label: '新進場', type: 'fixed' as const, value: 5000, units: 1, itemIds: [], stageId: undefined }],
      },
    },
  };
  const orphanTotals = calculateProject(quoteWithOrphan);
  const staged = updateScheduleStage(quoteWithOrphan, 'period:p2', s => ({ ...s, note: '備註' }));
  assert.equal(staged.pricing!.stages.length, quoteWithOrphan.pricing.stages.length + 1);
  const newStage = staged.pricing!.stages[staged.pricing!.stages.length - 1];
  assert.equal(newStage.items.length, 0);
  assert.equal(newStage.pricingMode, 'itemized');
  assert.equal(newStage.fixedAmount, 0);
  assert.equal(staged.pricing!.rental.periods[0].stageId, newStage.id);
  assert.deepEqual(calculateProject(staged), orphanTotals);

  // 4. Assigning whole-equipment works directly from raw rental state even when fixed 0 unassigned
  const quoteFixedZero = {
    ...quote,
    pricing: {
      ...quote.pricing,
      rental: {
        mode: 'fixed' as const,
        fixedAmount: 0,
        stageId: undefined,
        periods: [],
      },
    },
  };
  const reassignedZero = assignEquipmentToStage(quoteFixedZero, 'whole-equipment', targetStageId);
  assert.equal(reassignedZero.pricing!.rental.stageId, targetStageId);
  const zeroRows = getScheduleRows(reassignedZero);
  const targetRow = zeroRows.find(r => r.key === `stage:${targetStageId}`);
  assert.equal(targetRow?.wholeEquipment, true);
  assert.equal(targetRow?.equipmentSubtotal, 0);

  // 5. Stale or invalid keys are safe no-ops
  const noop = updateScheduleStage(quote, 'nonexistent', s => ({ ...s, name: 'should-not-apply' }));
  assert.deepEqual(noop, quote);
});

test('cloneStagePricing remaps whole and period owner stage IDs via independent stage map', () => {
  const quote = project();
  quote.pricing = createStagePricing();
  quote.pricing.stages = [emptyStage('setup'), emptyStage('event')];
  const [s0, s1] = quote.pricing.stages;
  s0.id = 'audio'; // Stage and equipment identifiers can occupy different namespaces.
  quote.pricing.rental = {
    mode: 'periods',
    fixedAmount: 12000,
    stageId: s0.id,
    periods: [
      { id: 'p0', label: '期1', type: 'fixed', value: 1000, units: 1, itemIds: ['audio'], stageId: s1.id },
      { id: 'p1', label: '期2', type: 'fixed', value: 2000, units: 1, itemIds: ['audio'], stageId: 'unmatched' },
    ],
  };

  const idMap = new Map([['audio', 'audio-copied']]);
  const cloned = cloneStagePricing(quote.pricing, idMap);

  // New stage IDs
  const clonedStage0Id = cloned.stages[0].id;
  const clonedStage1Id = cloned.stages[1].id;
  assert.notEqual(clonedStage0Id, s0.id);
  assert.notEqual(clonedStage1Id, s1.id);

  // Whole rental stageId remapped to new stage 0
  assert.equal(cloned.rental.stageId, clonedStage0Id);

  // Period 0 remapped to new stage 1
  assert.equal(cloned.rental.periods[0].stageId, clonedStage1Id);
  // Period 1 with unmatched owner remains undefined
  assert.equal(cloned.rental.periods[1].stageId, undefined);

  assert.deepEqual(cloned.rental.periods[0].itemIds, ['audio-copied']);
  const copied = { ...quote, pricing: cloned, items: quote.items.map(item => ({ ...item, id: idMap.get(item.id) || item.id })) };
  assert.deepEqual(calculateProject(copied), calculateProject(quote));
});

test('explicit deletion removes associated charges and work lines without destroying equipment cost or dormant links', () => {
  const quote = project();
  quote.pricing = createStagePricing();
  quote.pricing.stages = [emptyStage('setup'), emptyStage('event')];
  const [setup, event] = quote.pricing.stages;
  setup.items.push(labor('crew-1'));
  quote.subcontracts = [
    { id: 'sub-1', vendorName: '包商', vendorTaxId: '', vendorContact: '', vendorPhone: '', handoverTime: '', itemIds: ['crew-1', 'audio'] },
  ];

  // 1. In itemized mode: deleting stage owning whole fee converts whole fee to fixed 0, preserving equipment items & cost
  quote.pricing.rental = {
    mode: 'itemized',
    fixedAmount: 0,
    stageId: setup.id,
    periods: [
      { id: 'dormant-1', label: '備用檔期', type: 'fixed', value: 8888, units: 1, itemIds: [], stageId: setup.id },
    ],
  };
  const deletedSetup = deleteScheduleRow(quote, `stage:${setup.id}`);
  assert.equal(deletedSetup.pricing!.stages.some(s => s.id === setup.id), false);
  // Whole fee is fixed 0 with cleared stageId, NOT falling back to itemized 8000!
  assert.equal(deletedSetup.pricing!.rental.mode, 'fixed');
  assert.equal(deletedSetup.pricing!.rental.fixedAmount, 0);
  assert.equal(deletedSetup.pricing!.rental.stageId, undefined);
  // Unassigned fixed 0 whole fee row is suppressed from schedule rows
  const rowsAfterDelete = getScheduleRows(deletedSetup);
  assert.equal(rowsAfterDelete.some(r => r.key === 'whole-equipment'), false);
  // Actual equipment items and costs survive untouched
  assert.equal(deletedSetup.items.length, quote.items.length);
  assert.equal(deletedSetup.items[0].costPrice, 2000);
  assert.equal(calculateProject(deletedSetup).costSubtotal, 2000);
  // Dormant period amount is preserved, but dangling stageId link is cleared
  assert.equal(deletedSetup.pricing!.rental.periods.length, 1);
  assert.equal(deletedSetup.pricing!.rental.periods[0].value, 8888);
  assert.equal(deletedSetup.pricing!.rental.periods[0].stageId, undefined);
  // Subcontract reference to deleted work line is removed, equipment item remains
  assert.deepEqual(deletedSetup.subcontracts![0].itemIds, ['audio']);

  // 2. In periods mode: deleting stage removes active linked period
  const periodsQuote = {
    ...quote,
    pricing: {
      ...quote.pricing,
      rental: {
        mode: 'periods' as const,
        fixedAmount: 0,
        periods: [
          { id: 'p-setup', label: '進場', type: 'fixed' as const, value: 3000, units: 1, itemIds: [], stageId: setup.id },
          { id: 'p-event', label: '活動', type: 'fixed' as const, value: 5000, units: 1, itemIds: [], stageId: event.id },
        ],
      },
    },
  };
  const deletedPeriodStage = deleteScheduleRow(periodsQuote, `stage:${setup.id}`);
  assert.equal(deletedPeriodStage.pricing!.rental.periods.length, 1);
  assert.equal(deletedPeriodStage.pricing!.rental.periods[0].id, 'p-event');

  // 3. Orphan row deletions
  const orphanQuote = {
    ...quote,
    pricing: {
      ...quote.pricing,
      rental: {
        mode: 'fixed' as const,
        fixedAmount: 6000,
        stageId: undefined,
        periods: [
          { id: 'p-orphan', label: '孤兒', type: 'fixed' as const, value: 1000, units: 1, itemIds: [], stageId: undefined },
        ],
      },
    },
  };
  assert.equal(deleteScheduleRow(orphanQuote, 'period:p-orphan'), orphanQuote, 'Dormant fees are not active rows');
  assert.equal(assignEquipmentToStage(orphanQuote, 'period:p-orphan', event.id), orphanQuote);
  assert.equal(updateScheduleStage(orphanQuote, 'period:p-orphan', stage => ({ ...stage, name: '錯誤搬移' })), orphanQuote);
  const activeOrphanQuote = { ...orphanQuote, pricing: { ...orphanQuote.pricing, rental: { ...orphanQuote.pricing.rental, mode: 'periods' as const } } };
  const deletedOrphanPeriod = deleteScheduleRow(activeOrphanQuote, 'period:p-orphan');
  assert.equal(deletedOrphanPeriod.pricing!.rental.periods.length, 0);

  const deletedOrphanWhole = deleteScheduleRow(orphanQuote, 'whole-equipment');
  assert.equal(deletedOrphanWhole.pricing!.rental.mode, 'fixed');
  assert.equal(deletedOrphanWhole.pricing!.rental.fixedAmount, 0);
  assert.equal(deletedOrphanWhole.pricing!.rental.stageId, undefined);
});
