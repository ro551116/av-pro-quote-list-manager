import assert from 'node:assert/strict';
import test from 'node:test';
import type { EquipmentItem, Project, StageItem, WorkStage } from '../types';
import {
  calculateProject, calcRentalPeriod, calcWorkStage, cloneStagePricing,
  convertToStagePricing, createStagePricing, getProjectResources,
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
      const [unallocated, setup] = converted.pricing!.stages;
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
