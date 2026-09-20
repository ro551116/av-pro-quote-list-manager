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
  let crewSubtotal = 0;
  let crewCostSubtotal = 0;
  let costSubtotal = 0;
  for (const item of project.items) {
    const cost = calcCostTotal(item);
    costSubtotal += cost;
    if (project.pricing && item.category === 'crew') {
      crewCostSubtotal += cost;
      if (!item.internalOnly) crewSubtotal += calcClientTotal(item);
    }
  }
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
  const subtotal = rentalSubtotal + crewSubtotal + stagesSubtotal;
  const tax = subtotal * project.taxRate;
  const costTax = Math.round(costSubtotal * project.taxRate);
  return {
    rentalSubtotal, stagesSubtotal, crewSubtotal, crewCostSubtotal, subtotal, costSubtotal, tax,
    total: subtotal + tax, costTax, costTotal: costSubtotal + costTax,
  };
};

export const createStagePricing = (): StagePricing => {
  return {
    version: 1,
    rental: {
      mode: 'itemized',
      fixedAmount: 0,
      periods: [],
    },
    stages: [],
  };
};

/** Explicit conversion preserves quote and cost totals; never run while loading a quote. */
export const convertToStagePricing = (project: Project): Project => {
  if (project.pricing) return project;
  const originalSubtotal = calculateProject(project).subtotal;
  const crew = project.items.filter(item => item.category === 'crew');
  const crewSubtotal = calcBaseSubtotal(crew);
  const allocatedCrew = Math.min(Math.max(originalSubtotal, 0), crewSubtotal);
  const pricing = createStagePricing();
  pricing.rental = {
    mode: 'fixed',
    fixedAmount: originalSubtotal - allocatedCrew,
    startDate: project.date,
    endDate: project.eventEndDate || project.date,
    periods: [],
  };
  if (crew.length) {
    pricing.stages.unshift({
      id: generateId(),
      name: '原工作團隊（請分配階段）',
      pricingMode: allocatedCrew === crewSubtotal ? 'itemized' : 'fixed',
      fixedAmount: allocatedCrew,
      displayMode: 'detailed',
      items: crew.map(item => ({
        ...item,
        kind: 'labor' as const,
        duration: 1,
        durationUnit: '次',
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
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      price: item.price * item.duration,
      costPrice: item.costPrice * item.duration,
      internalOnly: item.internalOnly,
      subItems: item.subItems,
      note: [
        stage.name,
        formatDateRange(stage.startDate, stage.endDate),
        stage.time,
        `${item.duration} ${item.durationUnit}`,
        item.note,
      ]
        .filter(Boolean)
        .join(' · '),
    }))),
  ];
};

/** Remap every item reference and stage/period ownership when reusing a quote for a different project. */
export const cloneStagePricing = (pricing: StagePricing, idMap: Map<string, string>): StagePricing => {
  const stageIdMap = new Map<string, string>();
  const stages = pricing.stages.map(stage => {
    const newStageId = generateId();
    stageIdMap.set(stage.id, newStageId);
    return {
      ...stage,
      id: newStageId,
      items: stage.items.map(item => {
        const id = generateId();
        idMap.set(item.id, id);
        return { ...item, id, subItems: item.subItems ? [...item.subItems] : [] };
      }),
    };
  });
  return {
    ...pricing,
    stages,
    rental: {
      ...pricing.rental,
      stageId: pricing.rental.stageId ? stageIdMap.get(pricing.rental.stageId) : undefined,
      periods: pricing.rental.periods.map(period => ({
        ...period,
        id: generateId(),
        stageId: period.stageId ? stageIdMap.get(period.stageId) : undefined,
        itemIds: period.itemIds.map(id => idMap.get(id)).filter((id): id is string => !!id),
      })),
    },
  };
};

export interface ScheduleRow {
  key: string;
  name: string;
  startDate?: string;
  endDate?: string;
  stage?: WorkStage;
  periods: RentalPeriod[];
  wholeEquipment: boolean;
  equipmentSubtotal: number;
  workSubtotal: number;
  total: number;
}

export const getScheduleRows = (project: Project): ScheduleRow[] => {
  if (!project.pricing) {
    const { rentalSubtotal } = calculateProject(project);
    return [{
      key: 'whole-equipment',
      name: '器材費用',
      startDate: project.date,
      endDate: project.eventEndDate || project.date,
      periods: [],
      wholeEquipment: true,
      equipmentSubtotal: rentalSubtotal,
      workSubtotal: 0,
      total: rentalSubtotal,
    }];
  }

  const { rental, stages } = project.pricing;
  const validStageMap = new Map<string, WorkStage>();
  for (const stage of stages) {
    validStageMap.set(stage.id, stage);
  }

  const rows: ScheduleRow[] = [];

  if (rental.mode === 'periods') {
    const stagePeriodsMap = new Map<string, RentalPeriod[]>();
    const orphanPeriods: RentalPeriod[] = [];

    for (const period of rental.periods) {
      if (period.stageId && validStageMap.has(period.stageId)) {
        const list = stagePeriodsMap.get(period.stageId) || [];
        list.push(period);
        stagePeriodsMap.set(period.stageId, list);
      } else {
        orphanPeriods.push(period);
      }
    }

    for (const stage of stages) {
      const assignedPeriods = stagePeriodsMap.get(stage.id) || [];
      let equipmentSubtotal = 0;
      for (const p of assignedPeriods) {
        equipmentSubtotal += calcRentalPeriod(project.items, p);
      }
      const workSubtotal = calcWorkStage(stage).subtotal;
      rows.push({
        key: `stage:${stage.id}`,
        name: stage.name,
        startDate: stage.startDate,
        endDate: stage.endDate,
        stage,
        periods: assignedPeriods,
        wholeEquipment: false,
        equipmentSubtotal,
        workSubtotal,
        total: equipmentSubtotal + workSubtotal,
      });
    }

    for (const orphan of orphanPeriods) {
      const fee = calcRentalPeriod(project.items, orphan);
      rows.push({
        key: `period:${orphan.id}`,
        name: orphan.label || '未命名器材費用',
        startDate: orphan.startDate,
        endDate: orphan.endDate,
        periods: [orphan],
        wholeEquipment: false,
        equipmentSubtotal: fee,
        workSubtotal: 0,
        total: fee,
      });
    }
  } else {
    let wholeFee = 0;
    let hasEquipment = false;
    if (rental.mode === 'fixed') {
      wholeFee = rental.fixedAmount;
    } else {
      for (const item of project.items) {
        if (!item.internalOnly && item.category !== 'crew') {
          hasEquipment = true;
          wholeFee += calcClientTotal(item);
        }
      }
    }

    const linkedStageId = rental.stageId && validStageMap.has(rental.stageId) ? rental.stageId : undefined;

    for (const stage of stages) {
      const isLinked = stage.id === linkedStageId;
      const equipmentSubtotal = isLinked ? wholeFee : 0;
      const workSubtotal = calcWorkStage(stage).subtotal;
      rows.push({
        key: `stage:${stage.id}`,
        name: stage.name,
        startDate: stage.startDate,
        endDate: stage.endDate,
        stage,
        periods: [],
        wholeEquipment: isLinked,
        equipmentSubtotal,
        workSubtotal,
        total: equipmentSubtotal + workSubtotal,
      });
    }

    if (!linkedStageId) {
      const isEmptyFee = rental.mode === 'fixed' ? wholeFee === 0 : !hasEquipment;
      if (!isEmptyFee) {
        rows.push({
          key: 'whole-equipment',
          name: '器材費用',
          startDate: rental.startDate,
          endDate: rental.endDate,
          periods: [],
          wholeEquipment: true,
          equipmentSubtotal: wholeFee,
          workSubtotal: 0,
          total: wholeFee,
        });
      }
    }
  }

  return rows;
};

export const updateScheduleStage = (
  project: Project,
  key: string,
  update: (stage: WorkStage) => WorkStage,
): Project => {
  if (!project.pricing) return project;

  const { pricing } = project;
  const stages = [...pricing.stages];

  if (key.startsWith('stage:')) {
    const stageId = key.slice('stage:'.length);
    const index = stages.findIndex(s => s.id === stageId);
    if (index === -1) return project;
    stages[index] = update(stages[index]);
    return {
      ...project,
      pricing: {
        ...pricing,
        stages,
      },
    };
  }

  if (key.startsWith('period:')) {
    if (pricing.rental.mode !== 'periods') return project;
    const periodId = key.slice('period:'.length);
    const periodIndex = pricing.rental.periods.findIndex(p => p.id === periodId);
    if (periodIndex === -1) return project;

    const period = pricing.rental.periods[periodIndex];
    if (period.stageId) {
      const existingStageIndex = stages.findIndex(s => s.id === period.stageId);
      if (existingStageIndex !== -1) {
        stages[existingStageIndex] = update(stages[existingStageIndex]);
        return {
          ...project,
          pricing: {
            ...pricing,
            stages,
          },
        };
      }
    }

    const newStageId = generateId();
    const newStage: WorkStage = {
      id: newStageId,
      name: period.label || '器材費用',
      startDate: period.startDate,
      endDate: period.endDate,
      pricingMode: 'itemized',
      fixedAmount: 0,
      displayMode: 'detailed',
      items: [],
    };
    stages.push(update(newStage));

    const updatedPeriods = [...pricing.rental.periods];
    updatedPeriods[periodIndex] = {
      ...period,
      stageId: newStageId,
    };

    return {
      ...project,
      pricing: {
        ...pricing,
        stages,
        rental: {
          ...pricing.rental,
          periods: updatedPeriods,
        },
      },
    };
  }

  if (key === 'whole-equipment') {
    if (pricing.rental.mode === 'periods') return project;

    if (pricing.rental.stageId) {
      const existingStageIndex = stages.findIndex(s => s.id === pricing.rental.stageId);
      if (existingStageIndex !== -1) {
        stages[existingStageIndex] = update(stages[existingStageIndex]);
        return {
          ...project,
          pricing: {
            ...pricing,
            stages,
          },
        };
      }
    }

    const newStageId = generateId();
    const newStage: WorkStage = {
      id: newStageId,
      name: '器材費用',
      startDate: pricing.rental.startDate,
      endDate: pricing.rental.endDate,
      pricingMode: 'itemized',
      fixedAmount: 0,
      displayMode: 'detailed',
      items: [],
    };
    stages.push(update(newStage));

    return {
      ...project,
      pricing: {
        ...pricing,
        stages,
        rental: {
          ...pricing.rental,
          stageId: newStageId,
        },
      },
    };
  }

  return project;
};

export const assignEquipmentToStage = (
  project: Project,
  sourceKey: string,
  targetStageId: string,
): Project => {
  if (!project.pricing) return project;

  const { pricing } = project;
  const targetStage = pricing.stages.find(s => s.id === targetStageId);
  if (!targetStage) return project;

  if (sourceKey.startsWith('period:')) {
    if (pricing.rental.mode !== 'periods') return project;
    const periodId = sourceKey.slice('period:'.length);
    const periodIndex = pricing.rental.periods.findIndex(p => p.id === periodId);
    if (periodIndex === -1) return project;

    const period = pricing.rental.periods[periodIndex];
    if (period.stageId === targetStageId) return project;

    const updatedPeriods = [...pricing.rental.periods];
    updatedPeriods[periodIndex] = { ...period, stageId: targetStageId };
    return {
      ...project,
      pricing: {
        ...pricing,
        rental: {
          ...pricing.rental,
          periods: updatedPeriods,
        },
      },
    };
  }

  if (sourceKey === 'whole-equipment') {
    if (pricing.rental.mode === 'periods') return project;
    if (pricing.rental.stageId === targetStageId) return project;

    return {
      ...project,
      pricing: {
        ...pricing,
        rental: {
          ...pricing.rental,
          stageId: targetStageId,
        },
      },
    };
  }

  if (sourceKey.startsWith('stage:')) {
    const fromStageId = sourceKey.slice('stage:'.length);
    if (fromStageId === targetStageId) return project;
    const fromStage = pricing.stages.find(s => s.id === fromStageId);
    if (!fromStage) return project;

    if (pricing.rental.mode === 'periods') {
      let changed = false;
      const updatedPeriods = pricing.rental.periods.map(p => {
        if (p.stageId === fromStageId) {
          changed = true;
          return { ...p, stageId: targetStageId };
        }
        return p;
      });
      if (!changed) return project;
      return {
        ...project,
        pricing: {
          ...pricing,
          rental: {
            ...pricing.rental,
            periods: updatedPeriods,
          },
        },
      };
    } else {
      if (pricing.rental.stageId !== fromStageId) return project;
      return {
        ...project,
        pricing: {
          ...pricing,
          rental: {
            ...pricing.rental,
            stageId: targetStageId,
          },
        },
      };
    }
  }

  return project;
};

export const deleteScheduleRow = (project: Project, key: string): Project => {
  if (!project.pricing) return project;

  const { pricing } = project;

  if (key.startsWith('stage:')) {
    const stageId = key.slice('stage:'.length);
    const stageIndex = pricing.stages.findIndex(s => s.id === stageId);
    if (stageIndex === -1) return project;

    const stageToDelete = pricing.stages[stageIndex];
    const deletedItemIds = new Set(stageToDelete.items.map(item => item.id));
    const updatedStages = pricing.stages.filter(s => s.id !== stageId);

    const updatedSubcontracts = project.subcontracts
      ? project.subcontracts.map(sub => ({
          ...sub,
          itemIds: sub.itemIds.filter(id => !deletedItemIds.has(id)),
        }))
      : undefined;

    let updatedRental = { ...pricing.rental };

    if (pricing.rental.mode === 'periods') {
      updatedRental.periods = pricing.rental.periods.filter(p => p.stageId !== stageId);
      if (updatedRental.stageId === stageId) {
        updatedRental.stageId = undefined;
      }
    } else {
      if (pricing.rental.stageId === stageId) {
        updatedRental.mode = 'fixed';
        updatedRental.fixedAmount = 0;
        updatedRental.stageId = undefined;
      }
      updatedRental.periods = pricing.rental.periods.map(p =>
        p.stageId === stageId ? { ...p, stageId: undefined } : p
      );
    }

    const result: Project = {
      ...project,
      pricing: {
        ...pricing,
        stages: updatedStages,
        rental: updatedRental,
      },
    };
    if (updatedSubcontracts !== undefined) {
      result.subcontracts = updatedSubcontracts;
    }
    return result;
  }

  if (key.startsWith('period:')) {
    if (pricing.rental.mode !== 'periods') return project;
    const periodId = key.slice('period:'.length);
    const periodExists = pricing.rental.periods.some(p => p.id === periodId);
    if (!periodExists) return project;

    return {
      ...project,
      pricing: {
        ...pricing,
        rental: {
          ...pricing.rental,
          periods: pricing.rental.periods.filter(p => p.id !== periodId),
        },
      },
    };
  }

  if (key === 'whole-equipment') {
    if (pricing.rental.mode === 'periods') return project;

    return {
      ...project,
      pricing: {
        ...pricing,
        rental: {
          ...pricing.rental,
          mode: 'fixed',
          fixedAmount: 0,
          stageId: undefined,
        },
      },
    };
  }

  return project;
};
