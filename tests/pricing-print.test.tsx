import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Project } from '../types';
import { calculateProject } from '../utils/helpers';
import {
  StagePricingCompactTable,
  StagePricingCostTable,
  StagePricingQuoteEquipmentTable,
  StagePricingQuoteScheduleTable,
} from '../components/StagePricingPrint';

const quote = (): Project => ({
  id: 'print', name: 'quote', client: '', date: '', location: '', contact: '',
  taxRate: 0.05, updatedAt: 0, items: [],
  pricing: {
    version: 1,
    rental: { mode: 'itemized', fixedAmount: 0, periods: [], stageId: 'event' },
    stages: ['setup', 'event'].map(id => ({
      id, name: id, pricingMode: 'itemized', fixedAmount: 0, displayMode: 'summary', items: [],
    })),
  },
});

test('a rental package without reference equipment still appears on the payable quote', () => {
  const project = quote();
  project.pricing!.rental.mode = 'fixed';
  project.pricing!.rental.fixedAmount = 1234;
  const detailed = renderToStaticMarkup(<StagePricingQuoteScheduleTable project={project} nextIndex={() => 1} />);
  const compact = renderToStaticMarkup(<StagePricingCompactTable project={project} />);
  assert.match(detailed, /\$1,234/);
  assert.match(compact, /\$1,234/);
});

test('summary stages do not expose staff details or actual costs; internal-only lines stay private in detailed mode', () => {
  const project = quote();
  const stage = project.pricing!.stages[0];
  stage.pricingMode = 'fixed';
  stage.fixedAmount = 30000;
  stage.items = [
    { id: 'public', kind: 'labor', name: 'PUBLIC_STAFF', quantity: 1, unit: '人', duration: 1, durationUnit: '天', price: 32000, costPrice: 9876, note: '' },
    { id: 'private', kind: 'other', name: 'PRIVATE_STAFF', quantity: 1, unit: '人', duration: 1, durationUnit: '天', price: 8888, costPrice: 8765, note: '', internalOnly: true },
  ];
  const summary = renderToStaticMarkup(<StagePricingQuoteScheduleTable project={project} nextIndex={() => 1} />);
  assert.match(summary, /\$30,000/);
  assert.doesNotMatch(summary, /PUBLIC_STAFF|PRIVATE_STAFF|\$9,876|\$8,765/);
  stage.displayMode = 'detailed';
  const detailed = renderToStaticMarkup(<StagePricingQuoteScheduleTable project={project} nextIndex={() => 1} />);
  assert.match(detailed, /PUBLIC_STAFF/);
  assert.match(detailed, /\$30,000/);
  assert.doesNotMatch(detailed, /PRIVATE_STAFF|\$9,876|\$8,765|\$8,888/);
});

// Read customer-visible amount cells, not internal component fields.
const amounts = (html: string): number[] =>
  [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].flatMap(row => {
    const lastCell = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].at(-1)?.[1] || '';
    const money = lastCell.match(/(-?)\$([\d,]+)/);
    return money ? [Number(money[2].replaceAll(',', '')) * (money[1] ? -1 : 1)] : [];
  });

test('linked equipment and work share payable period totals in both quote formats without double billing', () => {
  const project = quote();
  project.items = [
    { id: 'speaker', category: 'audio', name: 'PUBLIC_EQUIPMENT', quantity: 2, unit: '台', price: 300, costPrice: 123456, note: '', subItems: [] },
    { id: 'hidden-equipment', category: 'audio', name: 'PRIVATE_EQUIPMENT', quantity: 1, unit: '台', price: 345678, costPrice: 456789, note: '', subItems: [], internalOnly: true },
  ];
  const [setup, event] = project.pricing!.stages;
  setup.pricingMode = 'fixed';
  setup.fixedAmount = 90;
  setup.displayMode = 'detailed';
  setup.items = [{ id: 'packaged', kind: 'labor', name: 'PACKAGED_WORK', quantity: 1, unit: '式', duration: 1, durationUnit: '次', price: 900, costPrice: 0, note: '' }];
  event.displayMode = 'detailed';
  event.items = [{ id: 'work', kind: 'labor', name: 'EVENT_WORK', quantity: 3, unit: '人', duration: 2, durationUnit: '天', price: 10, costPrice: 234567, note: '' }];
  project.pricing!.rental.fixedAmount = 9999;
  project.pricing!.rental.periods = [
    { id: 'rate', label: 'SELECTED_EQUIPMENT', type: 'rate', value: 0.5, units: 2, itemIds: ['speaker', 'hidden-equipment'], stageId: event.id },
    { id: 'fixed', label: 'FIXED_EQUIPMENT', type: 'fixed', value: 125, units: 1, itemIds: [], stageId: event.id },
    { id: 'orphan', label: 'UNASSIGNED_FEE', type: 'fixed', value: 33, units: 1, itemIds: [] },
    { id: 'discount', label: 'ADJUSTMENT', type: 'fixed', value: -5, units: 1, itemIds: [], stageId: 'missing-owner' },
  ];
  const reference = renderToStaticMarkup(<StagePricingQuoteEquipmentTable project={project} nextIndex={() => 1} />);
  assert.match(reference, /PUBLIC_EQUIPMENT/);
  assert.doesNotMatch(reference, /PRIVATE_EQUIPMENT|\$123,456|\$345,678|\$456,789/);

  for (const mode of ['periods', 'fixed', 'itemized'] as const) {
    project.pricing!.rental.mode = mode;
    const before = structuredClone(project);
    const detailed = renderToStaticMarkup(<StagePricingQuoteScheduleTable project={project} nextIndex={() => 1} />);
    const compact = renderToStaticMarkup(<StagePricingCompactTable project={project} />);
    const groups = [...detailed.matchAll(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/g)].map(group => group[1]);
    const groupTotals = groups.map(group => {
      const values = amounts(group);
      const subtotal = values.at(-1)!;
      assert.equal(values.slice(0, -1).reduce((sum, value) => sum + value, 0), subtotal);
      return subtotal;
    });
    assert.equal(groupTotals.reduce((sum, value) => sum + value, 0), calculateProject(project).subtotal);
    assert.deepEqual(amounts(compact), groupTotals);
    assert.deepEqual(project, before, 'Printing must not migrate or modify stored data');
    const customerText = (detailed + compact).replace(/<[^>]*>/g, '');
    assert.doesNotMatch(customerText, /PRIVATE_EQUIPMENT|\$123,456|\$234,567|\$345,678|\$456,789|%/);
    if (mode === 'periods') {
      assert.deepEqual(groupTotals, [90, 785, 33, -5]);
      assert.match(groups[1], /SELECTED_EQUIPMENT/);
      assert.match(groups[1], /FIXED_EQUIPMENT/);
      assert.match(groups[1], /EVENT_WORK/);
      assert.doesNotMatch(groups[0], /SELECTED_EQUIPMENT|FIXED_EQUIPMENT|EVENT_WORK/);
    } else {
      assert.equal(groups.length, 2, 'Dormant period fees and empty stages stay absent');
      assert.doesNotMatch(detailed + compact, /SELECTED_EQUIPMENT|FIXED_EQUIPMENT|UNASSIGNED_FEE|ADJUSTMENT/);
    }
  }
});

test('standalone public, internal, and free crew entries bill once, preserve quote privacy, and reconcile in cost reports across fee modes', () => {
  const project = quote();
  project.items = [
    { id: 'speaker', category: 'audio', name: 'PUBLIC_EQUIPMENT', quantity: 2, unit: '台', price: 500, costPrice: 200, note: '', subItems: [] },
    { id: 'crew-lead', category: 'crew', name: 'PUBLIC_CREW_LEAD', quantity: 2, unit: '人', price: 3000, costPrice: 2200, note: '現場主控', subItems: ['執照'] },
    { id: 'crew-internal', category: 'crew', name: 'INTERNAL_CREW', quantity: 1, unit: '人', price: 9999, costPrice: 1500, note: '內部監製', subItems: [], internalOnly: true },
    { id: 'crew-trainee', category: 'crew', name: 'FREE_CREW_ASSISTANT', quantity: 1, unit: '人', price: 0, costPrice: 800, note: '實習助理', subItems: [] },
  ];
  const [setup, event] = project.pricing!.stages;
  setup.pricingMode = 'fixed';
  setup.fixedAmount = 4000;
  setup.displayMode = 'detailed';
  setup.items = [{ id: 'setup-labor', kind: 'labor', name: 'SETUP_HAND', quantity: 2, unit: '人', duration: 1, durationUnit: '天', price: 1500, costPrice: 1000, note: '' }];
  event.displayMode = 'detailed';
  event.items = [{ id: 'event-labor', kind: 'labor', name: 'EVENT_TECH', quantity: 1, unit: '人', duration: 1, durationUnit: '天', price: 2000, costPrice: 1200, note: '' }];

  project.pricing!.rental.fixedAmount = 6000;
  project.pricing!.rental.periods = [
    { id: 'p1', label: '活動租賃', type: 'rate', value: 1.0, units: 1, itemIds: ['speaker'], stageId: event.id },
  ];

  // Equipment reference table never duplicates crew
  const reference = renderToStaticMarkup(<StagePricingQuoteEquipmentTable project={project} nextIndex={() => 1} />);
  assert.match(reference, /PUBLIC_EQUIPMENT/);
  assert.doesNotMatch(reference, /PUBLIC_CREW_LEAD|INTERNAL_CREW|FREE_CREW_ASSISTANT/);

  for (const mode of ['periods', 'fixed', 'itemized'] as const) {
    project.pricing!.rental.mode = mode;
    const detailed = renderToStaticMarkup(<StagePricingQuoteScheduleTable project={project} nextIndex={() => 1} />);
    const compact = renderToStaticMarkup(<StagePricingCompactTable project={project} />);

    // Customer detailed and compact groups and financial consistency
    const groups = [...detailed.matchAll(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/g)].map(group => group[1]);
    const groupTotals = groups.map(group => {
      const values = amounts(group);
      const subtotal = values.at(-1)!;
      assert.equal(values.slice(0, -1).reduce((sum, value) => sum + value, 0), subtotal);
      return subtotal;
    });

    const totals = calculateProject(project);
    assert.equal(groupTotals.reduce((sum, value) => sum + value, 0), totals.subtotal);
    assert.deepEqual(amounts(compact), groupTotals);

    // Team subtotal is billed once (2 * 3000 + 1 * 0 = 6000) regardless of equipment rental mode or stage packages
    const teamGroup = groups.at(-1)!;
    assert.match(teamGroup, /工作團隊/);
    assert.match(teamGroup, /PUBLIC_CREW_LEAD/);
    assert.match(teamGroup, /FREE_CREW_ASSISTANT/);
    assert.equal(groupTotals.at(-1), 6000);

    // Privacy: customer quote never exposes internal crew or cost figures
    const customerText = (detailed + compact).replace(/<[^>]*>/g, '');
    assert.doesNotMatch(customerText, /INTERNAL_CREW|\$2,200|\$1,500|\$800|\$9,999/);

    // Cost report reconciliation: shows actual costs including internal crew separately and reconciles totals
    const costHtml = renderToStaticMarkup(
      <StagePricingCostTable
        project={project}
        rentalSubtotal={totals.rentalSubtotal}
        stagesSubtotal={totals.stagesSubtotal}
        crewSubtotal={totals.crewSubtotal}
        crewCostSubtotal={totals.crewCostSubtotal}
        subtotal={totals.subtotal}
        costSubtotal={totals.costSubtotal}
        tax={totals.tax}
        total={totals.total}
        costTax={totals.costTax}
        costTotal={totals.costTotal}
      />
    );
    assert.match(costHtml, /工作團隊成本明細/);
    assert.match(costHtml, /PUBLIC_CREW_LEAD/);
    assert.match(costHtml, /INTERNAL_CREW/);
    assert.match(costHtml, /FREE_CREW_ASSISTANT/);
    assert.match(costHtml, /內部專用/);
    assert.match(costHtml, /\$2,200/);
    assert.match(costHtml, /\$1,500/);
    assert.match(costHtml, /\$800/);
    assert.match(costHtml, /工作團隊收入（未稅）/);
    assert.match(costHtml, /工作團隊成本合計（未稅）/);
  }
});
