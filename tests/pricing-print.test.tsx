import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Project } from '../types';
import { createStagePricing } from '../utils/helpers';
import { StagePricingCompactTable, StagePricingQuoteEquipmentTable, StagePricingQuoteStagesTable } from '../components/StagePricingPrint';

const quote = (): Project => ({
  id: 'print', name: 'quote', client: '', date: '', location: '', contact: '',
  taxRate: 0.05, updatedAt: 0, items: [], pricing: createStagePricing(),
});

test('a rental package without reference equipment still appears on the payable quote', () => {
  const project = quote();
  project.pricing!.rental.mode = 'fixed';
  project.pricing!.rental.fixedAmount = 1234;
  const detailed = renderToStaticMarkup(<StagePricingQuoteEquipmentTable project={project} rentalSubtotal={1234} nextIndex={() => 1} />);
  const compact = renderToStaticMarkup(<StagePricingCompactTable project={project} rentalSubtotal={1234} />);
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
  const summary = renderToStaticMarkup(<StagePricingQuoteStagesTable project={project} nextIndex={() => 1} />);
  assert.match(summary, /\$30,000/);
  assert.doesNotMatch(summary, /PUBLIC_STAFF|PRIVATE_STAFF|\$9,876|\$8,765/);
  stage.displayMode = 'detailed';
  const detailed = renderToStaticMarkup(<StagePricingQuoteStagesTable project={project} nextIndex={() => 1} />);
  assert.match(detailed, /PUBLIC_STAFF/);
  assert.match(detailed, /\$30,000/);
  assert.doesNotMatch(detailed, /PRIVATE_STAFF|\$9,876|\$8,765|\$8,888/);
});
