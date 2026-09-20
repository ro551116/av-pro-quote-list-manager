import { EquipmentItem, PeriodCharge, Project, RentalPeriod, StageItem, StagePricing, WorkStage } from '../types';
import { DEFAULT_VALID_DAYS } from '../constants';

export const generateId = (): string => crypto.randomUUID();

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 0 }).format(amount);
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(dateString);
  return new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
};

export const formatQuoteValidity = (project: {
  validDays?: number;
  validUntil?: string;
}): string => {
  const until = (project.validUntil || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    return `本估價單有效期至 ${formatDate(until)}`;
  }
  const days = Number(project.validDays);
  const n = Number.isFinite(days) && days > 0 ? Math.floor(days) : DEFAULT_VALID_DAYS;
  return `本估價單有效期限 ${n} 天`;
};

export const formatQuoteTerms = (
  project: { validDays?: number; validUntil?: string; paymentMethod?: string },
  options?: { includeAttachment?: boolean },
): string => {
  const payment = (project.paymentMethod || '').trim();
  const parts = [
    '請確認後簽名或蓋章回傳本公司，此報價單簽認即視同合約書，若有任何疑問請與承辦業務確認',
    formatQuoteValidity(project),
  ];
  if (payment) parts.push(`付款方式：${payment}`);
  if (options?.includeAttachment) parts.push('詳細品項請參閱附件');
  return `${parts.join('，')}。`;
};

export const formatDateRange = (startDate?: string, endDate?: string): string => {
  if (!startDate) return '';
  if (!endDate || endDate === startDate) return formatDate(startDate);
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
};

export const formatPeriodChargeLabel = (charge: PeriodCharge): string => {
  const dateRange = formatDateRange(charge.startDate, charge.endDate);
  if (!dateRange) return charge.label;
  return charge.label ? `${charge.label} (${dateRange})` : dateRange;
};

/** 客報總價 = 數量 × 單價（單日） */
export const calcClientTotal = (item: EquipmentItem): number => {
  return item.quantity * item.price;
};

/** 成本總價 = 數量 × 成本單價（單日） */
export const calcCostTotal = (item: EquipmentItem): number => {
  return item.quantity * (item.costPrice || 0);
};

/** 利潤率% = (客報總價 - 成本總價) / 客報總價 × 100（單日） */
export const calcProfitMargin = (item: EquipmentItem): number => {
  const client = calcClientTotal(item);
  const cost = calcCostTotal(item);
  if (client === 0) return 0;
  return ((client - cost) / client) * 100;
};

/** 單日器材總價 = Σ calcClientTotal(非internalOnly項目) */
export const calcBaseSubtotal = (items: EquipmentItem[]): number => {
  return items
    .filter(item => !item.internalOnly)
    .reduce((sum, item) => sum + calcClientTotal(item), 0);
};

/** 單筆檔期費用金額 */
export const calcChargeAmount = (charge: PeriodCharge, baseSubtotal: number): number => {
  if (charge.type === 'rate') {
    return Math.round(baseSubtotal * charge.value);
  }
  return charge.value;
};

/** 檔期合計 = Σ calcChargeAmount(每筆charge) */
export const calcGrandSubtotal = (baseSubtotal: number, charges: PeriodCharge[]): number => {
  return charges.reduce((sum, charge) => sum + calcChargeAmount(charge, baseSubtotal), 0);
};

export const calcStageItemTotal = (item: StageItem): number =>
  item.internalOnly ? 0 : item.quantity * item.duration * item.price;

export const calcStageItemCost = (item: StageItem): number =>
  item.quantity * item.duration * item.costPrice;

export const calcWorkStage = (stage: WorkStage) => {
  let detailSubtotal = 0;
  let costSubtotal = 0;
  for (const item of stage.items) {
    detailSubtotal += calcStageItemTotal(item);
    costSubtotal += calcStageItemCost(item);
  }
  return {
    detailSubtotal,
    subtotal: stage.pricingMode === 'fixed' ? stage.fixedAmount : detailSubtotal,
    costSubtotal,
  };
};

export const calcRentalPeriod = (items: EquipmentItem[], period: RentalPeriod): number => {
  if (period.type === 'fixed') return period.value * period.units;
  const selected = new Set(period.itemIds);
  let base = 0;
  for (const item of items) {
    if (!item.internalOnly && item.category !== 'crew' && selected.has(item.id)) {
      base += calcClientTotal(item);
    }
  }
  return Math.round(base * period.value * period.units);
};

/** One source of truth for cards, editor, quote and cost reports. */
export const calculateProject = (project: Project) => {
  let rentalSubtotal = 0;
  let stagesSubtotal = 0;
  let costSubtotal = 0;
  for (const item of project.items) costSubtotal += calcCostTotal(item);
  if (project.pricing) {
    const { rental, stages } = project.pricing;
    if (rental.mode === 'fixed') rentalSubtotal = rental.fixedAmount;
    else if (rental.mode === 'periods') {
      for (const period of rental.periods) rentalSubtotal += calcRentalPeriod(project.items, period);
    } else {
      for (const item of project.items) {
        if (!item.internalOnly && item.category !== 'crew') rentalSubtotal += calcClientTotal(item);
      }
    }
    for (const stage of stages) {
      const totals = calcWorkStage(stage);
      stagesSubtotal += totals.subtotal;
      costSubtotal += totals.costSubtotal;
    }
  } else {
    const base = calcBaseSubtotal(project.items);
    rentalSubtotal = project.periodCharges?.length
      ? calcGrandSubtotal(base, project.periodCharges)
      : base;
  }
  const subtotal = rentalSubtotal + stagesSubtotal;
  const tax = subtotal * project.taxRate;
  const costTax = Math.round(costSubtotal * project.taxRate);
  return {
    rentalSubtotal, stagesSubtotal, subtotal, costSubtotal, tax,
    total: subtotal + tax, costTax, costTotal: costSubtotal + costTax,
  };
};

export const createStagePricing = (): StagePricing => ({
  version: 1,
  rental: { mode: 'itemized', fixedAmount: 0, periods: [] },
  stages: ['進場', '活動', '撤場'].map(name => ({
    id: generateId(), name, pricingMode: 'itemized', fixedAmount: 0,
    displayMode: 'summary', items: [],
  })),
});

/** Explicit conversion preserves quote and cost totals; never run while loading a quote. */
export const convertToStagePricing = (project: Project): Project => {
  if (project.pricing) return project;
  const originalSubtotal = calculateProject(project).subtotal;
  const crew = project.items.filter(item => item.category === 'crew');
  const crewSubtotal = calcBaseSubtotal(crew);
  const allocatedCrew = Math.min(Math.max(originalSubtotal, 0), crewSubtotal);
  const pricing = createStagePricing();
  pricing.rental = {
    mode: 'fixed', fixedAmount: originalSubtotal - allocatedCrew,
    startDate: project.date, endDate: project.eventEndDate || project.date, periods: [],
  };
  if (crew.length) {
    pricing.stages.unshift({
      id: generateId(), name: '原工作團隊（請分配階段）',
      pricingMode: allocatedCrew === crewSubtotal ? 'itemized' : 'fixed',
      fixedAmount: allocatedCrew, displayMode: 'detailed',
      items: crew.map(item => ({
        ...item, kind: 'labor' as const, duration: 1, durationUnit: '次',
        costPrice: item.costPrice ?? 0,
        subItems: item.subItems ? [...item.subItems] : [],
      })),
    });
  }
  const { periodCharges, period, ...rest } = project;
  return { ...rest, items: project.items.filter(item => item.category !== 'crew'), pricing };
};

/** Include stage resources in equipment/subcontract lists without adding them to rental billing. */
export const getProjectResources = (project: Project): EquipmentItem[] => {
  if (!project.pricing) return project.items;
  return [
    ...project.items,
    ...project.pricing.stages.flatMap(stage => stage.items.map(item => ({
      id: item.id,
      category: item.category || (item.kind === 'equipment' ? 'stage' : 'crew'),
      name: item.name, quantity: item.quantity, unit: item.unit,
      price: item.price * item.duration, costPrice: item.costPrice * item.duration,
      internalOnly: item.internalOnly, subItems: item.subItems,
      note: [stage.name, formatDateRange(stage.startDate, stage.endDate), stage.time,
        `${item.duration} ${item.durationUnit}`, item.note].filter(Boolean).join(' · '),
    }))),
  ];
};

/** Remap every item reference when reusing a quote for a different project. */
export const cloneStagePricing = (pricing: StagePricing, idMap: Map<string, string>): StagePricing => {
  const stages = pricing.stages.map(stage => ({
    ...stage, id: generateId(),
    items: stage.items.map(item => {
      const id = generateId();
      idMap.set(item.id, id);
      return { ...item, id, subItems: item.subItems ? [...item.subItems] : [] };
    }),
  }));
  return {
    ...pricing, stages,
    rental: {
      ...pricing.rental,
      periods: pricing.rental.periods.map(period => ({
        ...period, id: generateId(),
        itemIds: period.itemIds.map(id => idMap.get(id)).filter((id): id is string => !!id),
      })),
    },
  };
};
