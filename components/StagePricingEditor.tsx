import React, { useState } from 'react';
import { Project, StagePricing, EquipmentRental, WorkStage, StageItem, RentalPeriod, Category } from '../types';
import { CATEGORIES, DEFAULT_DAY_LABELS } from '../constants';
import {
  generateId,
  calcClientTotal,
  calcStageItemTotal,
  calcStageItemCost,
  calcWorkStage,
  calcRentalPeriod,
  calculateProject,
  formatCurrency,
} from '../utils/helpers';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Calendar,
  Package,
  Layers,
  ArrowRightLeft,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface StagePricingEditorProps {
  project: Project;
  onChange: (updater: (prev: Project) => Project) => void;
}

const STAGE_PRESETS = ['進場設定', '活動執行', '撤場復原', '彩排測試', '前置整備'];

const ITEM_KIND_LABELS: Record<StageItem['kind'], { label: string; color: string; bg: string; unit: string; durationUnit: string }> = {
  labor: { label: '人力', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', unit: '人', durationUnit: '天' },
  transport: { label: '運輸', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', unit: '趟', durationUnit: '次' },
  equipment: { label: '額外器材', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', unit: '式', durationUnit: '次' },
  other: { label: '其他費用', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', unit: '式', durationUnit: '次' },
};

export const StagePricingEditor: React.FC<StagePricingEditorProps> = ({ project, onChange }) => {
  const pricing = project.pricing;

  // Track expanded equipment pickers for rental periods
  const [expandedPeriodEquipment, setExpandedPeriodEquipment] = useState<Set<string>>(new Set());
  // Search or category filter for equipment picker inside periods
  const [periodCategoryFilter, setPeriodCategoryFilter] = useState<Record<string, Category | 'all'>>({});
  if (!pricing) return null;

  // Helper to mutate project.pricing immutably
  const updatePricing = (updater: (prevPricing: StagePricing) => StagePricing) => {
    onChange(prev => {
      if (!prev.pricing) return prev;
      return {
        ...prev,
        pricing: updater(prev.pricing),
      };
    });
  };

  // -------------------------------------------------------------
  // Rental handlers
  // -------------------------------------------------------------
  const setRentalMode = (mode: EquipmentRental['mode']) => {
    updatePricing(p => ({
      ...p,
      rental: {
        ...p.rental,
        mode,
        // If switching to periods and none exist, create an initial one
        periods: mode === 'periods' && p.rental.periods.length === 0
          ? [
              {
                id: generateId(),
                label: '活動日',
                type: 'rate',
                value: 1.0,
                units: 1,
                itemIds: project.items
                  .filter(i => !i.internalOnly && i.category !== 'crew')
                  .map(i => i.id),
              },
            ]
          : p.rental.periods,
      },
    }));
  };

  const updateRentalField = <K extends keyof EquipmentRental>(field: K, value: EquipmentRental[K]) => {
    updatePricing(p => ({
      ...p,
      rental: {
        ...p.rental,
        [field]: value,
      },
    }));
  };

  const addRentalPeriod = () => {
    const newPeriod: RentalPeriod = {
      id: generateId(),
      label: '',
      type: 'rate',
      value: 1.0,
      units: 1,
      itemIds: [], // Newly added period does not silently auto-select
    };
    updatePricing(p => ({
      ...p,
      rental: {
        ...p.rental,
        periods: [...p.rental.periods, newPeriod],
      },
    }));
  };

  const updateRentalPeriod = <K extends keyof RentalPeriod>(periodId: string, field: K, value: RentalPeriod[K]) => {
    updatePricing(p => ({
      ...p,
      rental: {
        ...p.rental,
        periods: p.rental.periods.map(period =>
          period.id === periodId ? { ...period, [field]: value } : period
        ),
      },
    }));
  };

  const deleteRentalPeriod = (periodId: string) => {
    updatePricing(p => ({
      ...p,
      rental: {
        ...p.rental,
        periods: p.rental.periods.filter(period => period.id !== periodId),
      },
    }));
  };

  const moveRentalPeriod = (periodId: string, direction: -1 | 1) => {
    updatePricing(p => {
      const idx = p.rental.periods.findIndex(period => period.id === periodId);
      if (idx < 0) return p;
      const target = idx + direction;
      if (target < 0 || target >= p.rental.periods.length) return p;
      const periods = [...p.rental.periods];
      [periods[idx], periods[target]] = [periods[target], periods[idx]];
      return {
        ...p,
        rental: { ...p.rental, periods },
      };
    });
  };

  const togglePeriodEquipment = (periodId: string, itemId: string) => {
    updatePricing(p => ({
      ...p,
      rental: {
        ...p.rental,
        periods: p.rental.periods.map(period => {
          if (period.id !== periodId) return period;
          const has = period.itemIds.includes(itemId);
          return {
            ...period,
            itemIds: has ? period.itemIds.filter(id => id !== itemId) : [...period.itemIds, itemId],
          };
        }),
      },
    }));
  };

  const selectAllPeriodEquipment = (periodId: string, selectAll: boolean) => {
    const eligibleIds = project.items
      .filter(i => !i.internalOnly && i.category !== 'crew')
      .map(i => i.id);
    updatePricing(p => ({
      ...p,
      rental: {
        ...p.rental,
        periods: p.rental.periods.map(period =>
          period.id === periodId
            ? { ...period, itemIds: selectAll ? eligibleIds : [] }
            : period
        ),
      },
    }));
  };

  // -------------------------------------------------------------
  // Stage CRUD & Move handlers
  // -------------------------------------------------------------
  const addStage = (name = '新工作階段') => {
    const newStage: WorkStage = {
      id: generateId(),
      name,
      pricingMode: 'itemized',
      fixedAmount: 0,
      displayMode: 'detailed',
      items: [],
    };
    updatePricing(p => ({
      ...p,
      stages: [...p.stages, newStage],
    }));
  };

  const updateStage = <K extends keyof WorkStage>(stageId: string, field: K, value: WorkStage[K]) => {
    updatePricing(p => ({
      ...p,
      stages: p.stages.map(stage =>
        stage.id === stageId ? { ...stage, [field]: value } : stage
      ),
    }));
  };

  const deleteStage = (stageId: string) => {
    // Also drop deleted stage items from subcontract references
    const stageToDelete = pricing.stages.find(s => s.id === stageId);
    const itemIdsToRemove = new Set(stageToDelete?.items.map(i => i.id) || []);

    onChange(prev => {
      if (!prev.pricing) return prev;
      return {
        ...prev,
        pricing: {
          ...prev.pricing,
          stages: prev.pricing.stages.filter(s => s.id !== stageId),
        },
        subcontracts: (prev.subcontracts || []).map(sub => ({
          ...sub,
          itemIds: sub.itemIds.filter(id => !itemIdsToRemove.has(id)),
        })),
      };
    });
  };

  const moveStage = (stageId: string, direction: -1 | 1) => {
    updatePricing(p => {
      const idx = p.stages.findIndex(s => s.id === stageId);
      if (idx < 0) return p;
      const target = idx + direction;
      if (target < 0 || target >= p.stages.length) return p;
      const stages = [...p.stages];
      [stages[idx], stages[target]] = [stages[target], stages[idx]];
      return { ...p, stages };
    });
  };

  // -------------------------------------------------------------
  // Stage Line Items CRUD & Move handlers
  // -------------------------------------------------------------
  const addStageItem = (stageId: string, kind: StageItem['kind'] = 'labor') => {
    const def = ITEM_KIND_LABELS[kind];

    const newItem: StageItem = {
      id: generateId(),
      kind,
      name: '',
      quantity: 1,
      unit: def.unit,
      duration: 1,
      durationUnit: def.durationUnit,
      price: 0,
      costPrice: 0,
      note: '',
      internalOnly: false,
    };

    updatePricing(p => ({
      ...p,
      stages: p.stages.map(stage =>
        stage.id === stageId
          ? { ...stage, items: [...stage.items, newItem] }
          : stage
      ),
    }));
  };

  const updateStageItem = <K extends keyof StageItem>(stageId: string, itemId: string, field: K, value: StageItem[K]) => {
    updatePricing(p => ({
      ...p,
      stages: p.stages.map(stage => {
        if (stage.id !== stageId) return stage;
        return {
          ...stage,
          items: stage.items.map(item =>
            item.id === itemId ? { ...item, [field]: value } : item
          ),
        };
      }),
    }));
  };

  const deleteStageItem = (stageId: string, itemId: string) => {
    onChange(prev => {
      if (!prev.pricing) return prev;
      return {
        ...prev,
        pricing: {
          ...prev.pricing,
          stages: prev.pricing.stages.map(stage => {
            if (stage.id !== stageId) return stage;
            return {
              ...stage,
              items: stage.items.filter(item => item.id !== itemId),
            };
          }),
        },
        subcontracts: (prev.subcontracts || []).map(sub => ({
          ...sub,
          itemIds: sub.itemIds.filter(id => id !== itemId),
        })),
      };
    });
  };

  const moveStageItemOrder = (stageId: string, itemId: string, direction: -1 | 1) => {
    updatePricing(p => ({
      ...p,
      stages: p.stages.map(stage => {
        if (stage.id !== stageId) return stage;
        const idx = stage.items.findIndex(item => item.id === itemId);
        if (idx < 0) return stage;
        const target = idx + direction;
        if (target < 0 || target >= stage.items.length) return stage;
        const items = [...stage.items];
        [items[idx], items[target]] = [items[target], items[idx]];
        return { ...stage, items };
      }),
    }));
  };

  // Crucial requirement: Move stage line between stages without recreating ID, preserving subcontracts
  const moveStageItemToStage = (sourceStageId: string, targetStageId: string, itemId: string) => {
    if (sourceStageId === targetStageId) return;
    const source = pricing.stages.find(stage => stage.id === sourceStageId);
    const target = pricing.stages.find(stage => stage.id === targetStageId);
    if (!source || !target) return;
    if ((source.pricingMode === 'fixed' || target.pricingMode === 'fixed') &&
        !window.confirm('來源或目的階段使用包價。移動項目不會自動調整包價，可能改變總報價；移動後請確認兩段金額。確定移動？')) return;
    updatePricing(p => {
      const sourceStage = p.stages.find(s => s.id === sourceStageId);
      const itemToMove = sourceStage?.items.find(i => i.id === itemId);
      if (!itemToMove) return p;

      return {
        ...p,
        stages: p.stages.map(stage => {
          if (stage.id === sourceStageId) {
            return {
              ...stage,
              items: stage.items.filter(i => i.id !== itemId),
            };
          }
          if (stage.id === targetStageId) {
            return {
              ...stage,
              items: [...stage.items, itemToMove], // Preserves exact same id & properties!
            };
          }
          return stage;
        }),
      };
    });
  };

  // Overall financial calculations
  const totals = calculateProject(project);
  const eligibleRentalItems = project.items.filter(i => !i.internalOnly && i.category !== 'crew');
  const baseRentalSubtotal = eligibleRentalItems.reduce((sum, item) => sum + calcClientTotal(item), 0);

  return (
    <div className="space-y-8">
      {/* ============================================================ */}
      {/* 1. 器材租賃計價設定 (Equipment Rental)                       */}
      {/* ============================================================ */}
      <div className="bg-white rounded-xl p-4 md:p-6 border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-6 bg-primary-500 rounded-full"></span>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Package size={18} className="text-primary-500" />
              器材租賃計價設定
            </h3>
            <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-semibold border border-primary-200">
              {pricing.rental.mode === 'itemized' && '器材清單計價'}
              {pricing.rental.mode === 'fixed' && '固定包套租金'}
              {pricing.rental.mode === 'periods' && '依檔期指定計價'}
            </span>
          </div>
          <div className="text-sm text-slate-500 font-mono">
            租賃報價小計：
            <span className="text-lg font-bold text-primary-600 ml-1">
              {formatCurrency(totals.rentalSubtotal)}
            </span>
          </div>
        </div>

        {/* Rental Mode Selector */}
        <div className="mb-5">
          <label className="block text-slate-500 text-xs font-bold uppercase mb-1.5">租賃計價模式</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setRentalMode('itemized')}
              className={`p-3 rounded-lg border text-left transition-all ${
                pricing.rental.mode === 'itemized'
                  ? 'border-primary-500 bg-primary-50/50 text-primary-900 ring-2 ring-primary-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700'
              }`}
            >
              <div className="font-bold text-sm mb-0.5 flex items-center justify-between">
                <span>整檔器材明細加總</span>
                {pricing.rental.mode === 'itemized' && <span className="text-xs text-primary-600 font-bold">● 已選</span>}
              </div>
              <div className="text-xs text-slate-500">
                按下方器材清單客報價格加總計費一次（全場租賃單筆計價）
              </div>
            </button>

            <button
              type="button"
              onClick={() => setRentalMode('fixed')}
              className={`p-3 rounded-lg border text-left transition-all ${
                pricing.rental.mode === 'fixed'
                  ? 'border-primary-500 bg-primary-50/50 text-primary-900 ring-2 ring-primary-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700'
              }`}
            >
              <div className="font-bold text-sm mb-0.5 flex items-center justify-between">
                <span>固定包套租金</span>
                {pricing.rental.mode === 'fixed' && <span className="text-xs text-primary-600 font-bold">● 已選</span>}
              </div>
              <div className="text-xs text-slate-500">
                整場合約固定器材租賃金額（覆蓋清單客報總額）
              </div>
            </button>

            <button
              type="button"
              onClick={() => setRentalMode('periods')}
              className={`p-3 rounded-lg border text-left transition-all ${
                pricing.rental.mode === 'periods'
                  ? 'border-primary-500 bg-primary-50/50 text-primary-900 ring-2 ring-primary-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700'
              }`}
            >
              <div className="font-bold text-sm mb-0.5 flex items-center justify-between">
                <span>依檔期 / 項目指定計價</span>
                {pricing.rental.mode === 'periods' && <span className="text-xs text-primary-600 font-bold">● 已選</span>}
              </div>
              <div className="text-xs text-slate-500">
                多檔期（活動日、進場日、彩排日）各別指定器材與折率或金額
              </div>
            </button>
          </div>
        </div>

        {/* Rental Date Range & Scheduling Note */}
        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
            <div>
              <label className="block text-slate-500 text-xs font-bold uppercase mb-1 flex items-center gap-1">
                <Calendar size={13} className="text-slate-400" />
                器材租賃起始日
              </label>
              <input
                aria-label="租賃起始日期"
                type="date"
                value={pricing.rental.startDate || ''}
                onChange={e => updateRentalField('startDate', e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-500 text-xs font-bold uppercase mb-1 flex items-center gap-1">
                <Calendar size={13} className="text-slate-400" />
                器材租賃結束日
              </label>
              <input
                aria-label="租賃結束日期"
                type="date"
                value={pricing.rental.endDate || ''}
                onChange={e => updateRentalField('endDate', e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
          </div>
          <div className="text-xs text-slate-500 flex items-start gap-1.5 pt-1">
            <HelpCircle size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong>日期用於排程：</strong> 費用依明細、包價或指定計費次數計算，日期跨度不會自動乘入金額。
            </span>
          </div>
        </div>

        {/* Mode-specific Rental Content */}
        {pricing.rental.mode === 'itemized' && (
          <div className="p-4 bg-emerald-50/60 rounded-lg border border-emerald-200 text-sm space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-emerald-900">整檔器材明細加總（不含人力及內部器材）</span>
              <span className="font-mono font-bold text-emerald-700 text-base">
                {formatCurrency(baseRentalSubtotal)}
              </span>
            </div>
            <div className="text-xs text-emerald-700">
              計價項目共 {eligibleRentalItems.length} 項器材。若器材客報單價或數量變更，此處小計將自動同步計算。
            </div>
          </div>
        )}

        {pricing.rental.mode === 'fixed' && (
          <div className="p-4 bg-amber-50/60 rounded-lg border border-amber-200 text-sm space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <label className="block text-amber-900 text-xs font-bold uppercase mb-1">
                  固定包套租金金額 (TWD，未稅)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold">$</span>
                  <input
                    aria-label="整檔器材包價"
                    type="number"
                    min={0}
                    value={pricing.rental.fixedAmount}
                    onChange={e => updateRentalField('fixedAmount', Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-white border border-amber-300 rounded-lg py-2 pl-8 pr-3 text-slate-800 text-base font-mono font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="text-xs text-slate-600 bg-white/70 p-3 rounded-lg border border-amber-100">
                <div className="text-slate-500 mb-1">器材清單原值對照：</div>
                <div className="font-mono text-sm font-semibold text-slate-700">
                  原器材加總 {formatCurrency(baseRentalSubtotal)}
                </div>
                <div className="text-slate-400 mt-1">
                  （清單金額僅供內部對照參考，報價以固定金額為準）
                </div>
              </div>
            </div>
          </div>
        )}

        {pricing.rental.mode === 'periods' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <div>
                <span className="text-sm font-bold text-slate-800">各檔期設定</span>
                <span className="text-xs text-slate-500 ml-2">
                  （支援分別勾選適用器材與設定折率/固定費用）
                </span>
              </div>
              <button
                type="button"
                onClick={addRentalPeriod}
                className="flex items-center justify-center gap-1 text-xs bg-primary-50 hover:bg-primary-100 text-primary-700 px-3 py-1.5 rounded-lg transition-colors border border-primary-200 font-bold self-start sm:self-auto"
              >
                <Plus size={14} /> 新增檔期費用
              </button>
            </div>

            {pricing.rental.periods.length === 0 ? (
              <div className="text-center py-6 text-slate-400 italic border-2 border-dashed border-slate-200 rounded-lg text-sm">
                尚無檔期費用，請點擊「新增檔期費用」
              </div>
            ) : (
              <div className="space-y-3">
                {pricing.rental.periods.map((period, idx) => {
                  const periodSubtotal = calcRentalPeriod(project.items, period);
                  const isExpanded = expandedPeriodEquipment.has(period.id);
                  const selectedCount = period.itemIds.length;

                  return (
                    <div key={period.id} className="bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200 space-y-3">
                      {/* Top Header: Label, Reorder, Delete, Period Subtotal */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                        <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                          <div className="flex items-center">
                            <button
                              type="button"
                              aria-label="上移檔期"
                              disabled={idx === 0}
                              onClick={() => moveRentalPeriod(period.id, -1)}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              aria-label="下移檔期"
                              disabled={idx === pricing.rental.periods.length - 1}
                              onClick={() => moveRentalPeriod(period.id, 1)}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ArrowDown size={14} />
                            </button>
                          </div>
                          <span className="text-xs font-mono font-bold text-slate-400 w-5">#{idx + 1}</span>
                          <input
                            aria-label={`租賃計費段 ${idx + 1} 名稱`}
                            type="text"
                            value={period.label}
                            onChange={e => updateRentalPeriod(period.id, 'label', e.target.value)}
                            placeholder="例如：活動日、進場日、彩排日"
                            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 text-sm font-bold focus:ring-2 focus:ring-primary-500 outline-none flex-1"
                          />
                          {/* Quick suggestions */}
                          <div className="hidden lg:flex items-center gap-1">
                            {DEFAULT_DAY_LABELS.slice(0, 3).map(preset => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => updateRentalPeriod(period.id, 'label', preset)}
                                className="text-[11px] text-slate-500 hover:text-primary-700 hover:bg-primary-50 px-1.5 py-0.5 rounded border border-slate-200"
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right font-mono">
                            <span className="text-xs text-slate-400 mr-1">本檔期：</span>
                            <span className="text-sm font-bold text-emerald-600">
                              {formatCurrency(periodSubtotal)}
                            </span>
                          </div>
                          <button
                            type="button"
                            aria-label="刪除檔期"
                            onClick={() => deleteRentalPeriod(period.id)}
                            className="text-slate-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Period Settings Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-end">
                        {/* Dates */}
                        <div className="lg:col-span-4 grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-slate-500 text-[10px] font-bold uppercase mb-1">起始日</label>
                            <input
                              aria-label={`${period.label || '租賃計費段'} 起始日期`}
                              type="date"
                              value={period.startDate || ''}
                              onChange={e => updateRentalPeriod(period.id, 'startDate', e.target.value)}
                              className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 text-[10px] font-bold uppercase mb-1">結束日</label>
                            <input
                              aria-label={`${period.label || '租賃計費段'} 結束日期`}
                              type="date"
                              value={period.endDate || ''}
                              onChange={e => updateRentalPeriod(period.id, 'endDate', e.target.value)}
                              className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                          </div>
                        </div>

                        {/* Type Toggle */}
                        <div className="lg:col-span-3">
                          <label className="block text-slate-500 text-[10px] font-bold uppercase mb-1">計價類型</label>
                          <div className="flex bg-white border border-slate-300 rounded-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={() => updateRentalPeriod(period.id, 'type', 'rate')}
                              className={`flex-1 py-1.5 text-xs font-bold transition-colors ${
                                period.type === 'rate'
                                  ? 'bg-primary-600 text-white'
                                  : 'text-slate-500 hover:bg-slate-50'
                              }`}
                            >
                              折率 (%)
                            </button>
                            <button
                              type="button"
                              onClick={() => updateRentalPeriod(period.id, 'type', 'fixed')}
                              className={`flex-1 py-1.5 text-xs font-bold transition-colors ${
                                period.type === 'fixed'
                                  ? 'bg-primary-600 text-white'
                                  : 'text-slate-500 hover:bg-slate-50'
                              }`}
                            >
                              固定金額
                            </button>
                          </div>
                        </div>

                        {/* Value Input */}
                        <div className="lg:col-span-3">
                          <label className="block text-slate-500 text-[10px] font-bold uppercase mb-1">
                            {period.type === 'rate' ? '比例 (%)' : '金額 (TWD)'}
                          </label>
                          <div className="flex items-center gap-1">
                            {period.type === 'rate' ? (
                              <>
                                <input
                                  aria-label={`${period.label || '租賃計費段'} 計費比例`}
                                  type="number"
                                  min={0}
                                  value={Math.round(period.value * 100)}
                                  onChange={e => updateRentalPeriod(period.id, 'value', (parseFloat(e.target.value) || 0) / 100)}
                                  className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none"
                                />
                                <span className="text-slate-400 text-xs font-bold">%</span>
                              </>
                            ) : (
                              <input
                                aria-label={`${period.label || '租賃計費段'} 固定金額`}
                                type="number"
                                min={0}
                                value={period.value}
                                onChange={e => updateRentalPeriod(period.id, 'value', parseFloat(e.target.value) || 0)}
                                className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none"
                                placeholder="$0"
                              />
                            )}
                          </div>
                        </div>

                        {/* Units Multiplier */}
                        <div className="lg:col-span-2">
                          <label className="block text-slate-500 text-[10px] font-bold uppercase mb-1" title="明確天數或次數乘數，非依日期自動推算">
                            單位數 (天/次)
                          </label>
                          <input
                            aria-label={`${period.label || '租賃計費段'} 計費次數`}
                            type="number"
                            min={0.1}
                            step={0.5}
                            value={period.units}
                            onChange={e => updateRentalPeriod(period.id, 'units', Math.max(0.1, parseFloat(e.target.value) || 1))}
                            className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none font-bold"
                          />
                        </div>
                      </div>

                      {/* Equipment Item Selection Collapsible for this period */}
                      <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
                        <div
                          className="flex items-center justify-between px-3 py-2 bg-slate-100/60 cursor-pointer hover:bg-slate-100 transition-colors"
                          onClick={() => {
                            setExpandedPeriodEquipment(prev => {
                              const next = new Set(prev);
                              if (next.has(period.id)) next.delete(period.id);
                              else next.add(period.id);
                              return next;
                            });
                          }}
                        >
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronUp size={15} className="text-slate-500" /> : <ChevronDown size={15} className="text-slate-500" />}
                            <span className="text-xs font-bold text-slate-700">
                              適用器材勾選：已選 {selectedCount} / {eligibleRentalItems.length} 項
                            </span>
                            {selectedCount === 0 && period.type === 'rate' && (
                              <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                尚未勾選器材（計價為 $0）
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => selectAllPeriodEquipment(period.id, true)}
                              className="text-[11px] text-primary-600 hover:text-primary-800 hover:underline font-medium"
                            >
                              全選器材
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={() => selectAllPeriodEquipment(period.id, false)}
                              className="text-[11px] text-slate-500 hover:text-slate-700 hover:underline font-medium"
                            >
                              全部取消
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-3 border-t border-slate-200 space-y-2.5 max-h-[260px] overflow-y-auto">
                            <div className="text-[11px] text-slate-400 italic">
                              * 工作團隊與內部器材已自動排除。新加入的器材預設不勾選，需在此手動確認。
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {eligibleRentalItems.map(item => {
                                const checked = period.itemIds.includes(item.id);
                                const categoryObj = CATEGORIES.find(c => c.id === item.category);
                                return (
                                  <label
                                    key={item.id}
                                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                                      checked
                                        ? 'bg-primary-50/40 border-primary-300 text-slate-800'
                                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => togglePeriodEquipment(period.id, item.id)}
                                      className="rounded text-primary-600 focus:ring-primary-500 border-slate-300"
                                    />
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${categoryObj?.bg || 'bg-slate-100'} ${categoryObj?.color || 'text-slate-600'}`}>
                                      {categoryObj?.label || item.category}
                                    </span>
                                    <span className="flex-1 truncate font-medium">{item.name}</span>
                                    <span className="font-mono text-[11px] text-slate-400">
                                      {item.quantity} {item.unit}
                                    </span>
                                    <span className="font-mono text-xs font-semibold text-slate-700">
                                      {formatCurrency(calcClientTotal(item))}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 2. 工作階段計價 (Work Stages)                               */}
      {/* ============================================================ */}
      <div className="bg-white rounded-xl p-4 md:p-6 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Layers size={18} className="text-blue-500" />
              工作階段計價 (進場 / 活動 / 撤場 / 自訂)
            </h3>
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold border border-blue-200">
              {pricing.stages.length} 個階段
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-500 font-mono">
              階段報價小計：
              <span className="text-lg font-bold text-blue-600 ml-1">
                {formatCurrency(totals.stagesSubtotal)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => addStage()}
              className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors font-bold shadow-sm"
            >
              <Plus size={14} /> 新增階段
            </button>
          </div>
        </div>

        {/* Stages List */}
        {pricing.stages.length === 0 ? (
          <div className="text-center py-10 text-slate-400 italic border-2 border-dashed border-slate-200 rounded-xl space-y-3">
            <div>尚無任何工作階段。</div>
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  STAGE_PRESETS.slice(0, 3).forEach(name => addStage(name));
                }}
                className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-200 font-bold"
              >
                + 建立標準三階段 (進場、活動、撤場)
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {pricing.stages.map((stage, stageIdx) => {
              const stageTotals = calcWorkStage(stage);
              const isCrewConversionStage = stage.name.includes('原工作團隊');

              return (
                <div
                  key={stage.id}
                  className="bg-slate-50/70 rounded-xl border border-slate-200 shadow-sm overflow-hidden"
                >
                  {/* Stage Header Banner */}
                  <div className="bg-slate-100/90 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                      <div className="flex items-center">
                        <button
                          type="button"
                          aria-label="上移階段"
                          disabled={stageIdx === 0}
                          onClick={() => moveStage(stage.id, -1)}
                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                        >
                          <ArrowUp size={15} />
                        </button>
                        <button
                          type="button"
                          aria-label="下移階段"
                          disabled={stageIdx === pricing.stages.length - 1}
                          onClick={() => moveStage(stage.id, 1)}
                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                        >
                          <ArrowDown size={15} />
                        </button>
                      </div>

                      <span className="font-mono text-xs font-bold text-slate-400">階段 {stageIdx + 1}</span>

                      <input
                        aria-label={`工作階段 ${stageIdx + 1} 名稱`}
                        type="text"
                        value={stage.name}
                        onChange={e => updateStage(stage.id, 'name', e.target.value)}
                        placeholder="例如：進場設定、活動執行、撤場復原"
                        className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-900 font-bold text-base focus:ring-2 focus:ring-blue-500 outline-none flex-1 max-w-sm"
                      />

                      {/* Stage Name Quick Presets */}
                      <div className="hidden xl:flex items-center gap-1">
                        {STAGE_PRESETS.map(preset => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => updateStage(stage.id, 'name', preset)}
                            className="text-[11px] text-slate-500 hover:text-blue-700 hover:bg-blue-50 px-1.5 py-0.5 rounded border border-slate-200"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Right Header Badges: Totals & Delete */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-3 text-xs font-mono">
                        <span className="text-slate-500">
                          細項加總: <span className="font-bold text-slate-700">{formatCurrency(stageTotals.detailSubtotal)}</span>
                        </span>
                        <span className="text-slate-500">
                          成本小計: <span className="font-bold text-slate-600">{formatCurrency(stageTotals.costSubtotal)}</span>
                        </span>
                        <span className="bg-white px-2.5 py-1 rounded-md border border-slate-200 text-blue-700 font-bold text-sm">
                          計入報價: {formatCurrency(stageTotals.subtotal)}
                        </span>
                      </div>

                      <button
                        type="button"
                        aria-label="刪除階段"
                        onClick={() => deleteStage(stage.id)}
                        className="text-slate-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Stage Conversion Guidance Notice */}
                  {isCrewConversionStage && (
                    <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                      <AlertCircle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>這是舊版專案轉換而來的「原工作團隊」階段：</strong>
                        <span> 請將人員分配至進場、活動或撤場。若此階段使用包價，移動明細不會調整包價，請同步確認金額；分配完成後可刪除此階段。</span>
                      </div>
                    </div>
                  )}

                  {/* Stage Controls & Meta */}
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-3 rounded-lg border border-slate-200 text-xs">
                      {/* Dates */}
                      <div>
                        <label className="block text-slate-500 font-bold uppercase mb-1">起始日</label>
                        <input
                          aria-label={`${stage.name} 起始日期`}
                          type="date"
                          value={stage.startDate || ''}
                          onChange={e => updateStage(stage.id, 'startDate', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-slate-800 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 font-bold uppercase mb-1">結束日</label>
                        <input
                          aria-label={`${stage.name} 結束日期`}
                          type="date"
                          value={stage.endDate || ''}
                          onChange={e => updateStage(stage.id, 'endDate', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-slate-800 outline-none"
                        />
                      </div>
                      {/* Time */}
                      <div>
                        <label className="block text-slate-500 font-bold uppercase mb-1">時段 (例如 09:00 - 18:00)</label>
                        <input
                          aria-label={`${stage.name} 時段`}
                          type="text"
                          value={stage.time || ''}
                          onChange={e => updateStage(stage.id, 'time', e.target.value)}
                          placeholder="例如: 09:00 - 18:00"
                          className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-slate-800 outline-none"
                        />
                      </div>
                      {/* Note */}
                      <div>
                        <label className="block text-slate-500 font-bold uppercase mb-1">階段備註</label>
                        <input
                          aria-label={`${stage.name} 備註`}
                          type="text"
                          value={stage.note || ''}
                          onChange={e => updateStage(stage.id, 'note', e.target.value)}
                          placeholder="例如: 需配合主辦彩排時程"
                          className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-slate-800 outline-none"
                        />
                      </div>
                    </div>

                    {/* Pricing Mode & Display Mode Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Pricing Mode */}
                      <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                        <label className="block text-slate-500 text-xs font-bold uppercase">
                          階段計價模式 (Pricing Mode)
                        </label>
                        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                          <button
                            type="button"
                            onClick={() => updateStage(stage.id, 'pricingMode', 'itemized')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                              stage.pricingMode === 'itemized'
                                ? 'bg-white text-blue-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            細項客報加總
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStage(stage.id, 'pricingMode', 'fixed')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                              stage.pricingMode === 'fixed'
                                ? 'bg-white text-blue-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            固定一口價包套
                          </button>
                        </div>

                        {stage.pricingMode === 'fixed' && (
                          <div className="pt-1">
                            <label className="block text-slate-500 text-[11px] font-bold mb-1">
                              固定包套金額 (TWD，覆蓋細項客報加總；成本仍按品項實算)
                            </label>
                            <input
                              aria-label={`${stage.name} 階段包價`}
                              type="number"
                              min={0}
                              value={stage.fixedAmount}
                              onChange={e => updateStage(stage.id, 'fixedAmount', Math.max(0, parseFloat(e.target.value) || 0))}
                              className="w-full bg-slate-50 border border-blue-300 rounded-lg p-2 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                              placeholder="0"
                            />
                          </div>
                        )}
                        <div className="text-[11px] text-slate-400">
                          {stage.pricingMode === 'itemized'
                            ? '本階段報價將按下方每筆項目之（數量 × 歷時 × 客報單價）加總計算。'
                            : `本階段細項加總為 ${formatCurrency(stageTotals.detailSubtotal)}，但報價將採固定金額 ${formatCurrency(stage.fixedAmount)}。`}
                        </div>
                      </div>

                      {/* Customer Display Mode */}
                      <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                        <label className="block text-slate-500 text-xs font-bold uppercase">
                          報價單對客呈現 (Customer Display Mode)
                        </label>
                        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                          <button
                            type="button"
                            onClick={() => updateStage(stage.id, 'displayMode', 'detailed')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                              stage.displayMode === 'detailed'
                                ? 'bg-white text-blue-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            展開明細 (Detailed)
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStage(stage.id, 'displayMode', 'summary')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                              stage.displayMode === 'summary'
                                ? 'bg-white text-blue-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            統包摘要 (Summary)
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {stage.displayMode === 'detailed'
                            ? '客戶報價單將逐行列出本階段之人力、車載與品項明細。'
                            : '客戶報價單僅顯示此階段統稱與總額一行，不向客戶展開內部個別工資與車載細項。'}
                        </div>
                      </div>
                    </div>

                    {/* Stage Line Items Section */}
                    <div className="space-y-3 pt-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                          階段工作項目明細 ({stage.items.length} 項)
                        </span>

                        {/* Quick Add Buttons for Line Items */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => addStageItem(stage.id, 'labor')}
                            className="flex items-center gap-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-200 font-medium"
                          >
                            <Plus size={13} /> + 人力
                          </button>
                          <button
                            type="button"
                            onClick={() => addStageItem(stage.id, 'transport')}
                            className="flex items-center gap-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 px-2.5 py-1 rounded-lg border border-amber-200 font-medium"
                          >
                            <Plus size={13} /> + 車載
                          </button>
                          <button
                            type="button"
                            onClick={() => addStageItem(stage.id, 'equipment')}
                            className="flex items-center gap-1 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-200 font-medium"
                          >
                            <Plus size={13} /> + 器材
                          </button>
                          <button
                            type="button"
                            onClick={() => addStageItem(stage.id, 'other')}
                            className="flex items-center gap-1 text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 px-2.5 py-1 rounded-lg border border-purple-200 font-medium"
                          >
                            <Plus size={13} /> + 其他
                          </button>
                        </div>
                      </div>

                      {/* Empty Stage State */}
                      {stage.items.length === 0 ? (
                        <div className="text-center py-6 text-slate-400 bg-white border border-dashed border-slate-200 rounded-lg text-xs space-y-1">
                          <div className="italic">
                            此階段尚無人力、車載或工作項目（若本階段不需另計工資車資，可保留為 0 元或留空）。
                          </div>
                          {stage.pricingMode === 'fixed' && stage.fixedAmount > 0 && (
                            <div className="text-blue-600 font-semibold">
                              （目前設定為固定包套金額 {formatCurrency(stage.fixedAmount)}，仍會如實計入總報價）
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {stage.items.map((item, itemIdx) => {
                            const lineTotal = calcStageItemTotal(item);
                            const lineCost = calcStageItemCost(item);
                            const otherStages = pricing.stages.filter(s => s.id !== stage.id);
                            const kindConfig = ITEM_KIND_LABELS[item.kind] || ITEM_KIND_LABELS.labor;

                            return (
                              <div
                                key={item.id}
                                className="bg-white p-3 rounded-lg border border-slate-200 space-y-2 text-xs shadow-2xs hover:border-slate-300 transition-colors"
                              >
                                {/* Line Item Header: Kind, Reorder, Move-Stage, Delete */}
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                  <div className="flex flex-wrap min-w-0 flex-1 items-center gap-1.5">
                                    <div className="flex items-center">
                                      <button
                                        type="button"
                                        aria-label="上移工作品項"
                                        disabled={itemIdx === 0}
                                        onClick={() => moveStageItemOrder(stage.id, item.id, -1)}
                                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                                      >
                                        <ArrowUp size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        aria-label="下移工作品項"
                                        disabled={itemIdx === stage.items.length - 1}
                                        onClick={() => moveStageItemOrder(stage.id, item.id, 1)}
                                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                                      >
                                        <ArrowDown size={13} />
                                      </button>
                                    </div>

                                    {/* Kind Selector */}
                                    <select
                                      aria-label={`${stage.name} ${item.name || '新項目'} 類型`}
                                      value={item.kind}
                                      onChange={e => updateStageItem(stage.id, item.id, 'kind', e.target.value as StageItem['kind'])}
                                      className={`px-2 py-1 rounded font-bold border text-xs outline-none ${kindConfig.bg} ${kindConfig.color}`}
                                    >
                                      <option value="labor">人力</option>
                                      <option value="transport">運輸</option>
                                      <option value="equipment">額外器材</option>
                                      <option value="other">其他費用</option>
                                    </select>

                                    {/* Item Name Input */}
                                    <input
                                      aria-label={`${stage.name} 項目 ${itemIdx + 1} 名稱`}
                                      type="text"
                                      value={item.name}
                                      onChange={e => updateStageItem(stage.id, item.id, 'name', e.target.value)}
                                      placeholder="品項名稱（如：音響工程師、5噸貨車）"
                                      className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800 font-bold text-xs focus:ring-2 focus:ring-blue-500 outline-none min-w-[160px] flex-1 w-full sm:w-64"
                                    />
                                  </div>

                                  {/* Right side: Move to Another Stage & Delete */}
                                  <div className="flex items-center gap-2">
                                    {otherStages.length > 0 && (
                                      <div className="flex items-center gap-1">
                                        <ArrowRightLeft size={12} className="text-slate-400" />
                                        <select
                                          aria-label={`${stage.name} ${item.name || '新項目'} 移至階段`}
                                          defaultValue=""
                                          onChange={e => {
                                            if (e.target.value) {
                                              moveStageItemToStage(stage.id, e.target.value, item.id);
                                              e.target.value = '';
                                            }
                                          }}
                                          className="text-[11px] bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-600 outline-none"
                                        >
                                          <option value="" disabled>移至其他階段...</option>
                                          {otherStages.map(os => (
                                            <option key={os.id} value={os.id}>{os.name || '未命名階段'}</option>
                                          ))}
                                        </select>
                                      </div>
                                    )}

                                    <button
                                      type="button"
                                      aria-label="刪除工作品項"
                                      onClick={() => deleteStageItem(stage.id, item.id)}
                                      className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>

                                {/* Line Item Details Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-12 gap-2 items-center">
                                  {/* Quantity & Unit */}
                                  <div className="lg:col-span-3 grid grid-cols-2 gap-1">
                                    <div>
                                      <label className="block text-slate-400 text-[10px] font-bold">數量</label>
                                      <input
                                        aria-label={`${stage.name} ${item.name || '新項目'} 數量`}
                                        type="number"
                                        min={0.1}
                                        step={0.5}
                                        value={item.quantity}
                                        onChange={e => updateStageItem(stage.id, item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                        className="w-full bg-slate-50 border border-slate-300 rounded p-1 text-xs font-mono font-bold text-slate-800 outline-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-slate-400 text-[10px] font-bold">單位</label>
                                      <input
                                        aria-label={`${stage.name} ${item.name || '新項目'} 數量單位`}
                                        type="text"
                                        value={item.unit}
                                        onChange={e => updateStageItem(stage.id, item.id, 'unit', e.target.value)}
                                        placeholder="人/輛/式"
                                        className="w-full bg-slate-50 border border-slate-300 rounded p-1 text-xs text-slate-800 outline-none"
                                      />
                                    </div>
                                  </div>

                                  {/* Duration & Duration Unit */}
                                  <div className="lg:col-span-3 grid grid-cols-2 gap-1">
                                    <div>
                                      <label className="block text-slate-400 text-[10px] font-bold">歷時</label>
                                      <input
                                        aria-label={`${stage.name} ${item.name || '新項目'} 天數或次數`}
                                        type="number"
                                        min={0.1}
                                        step={0.5}
                                        value={item.duration}
                                        onChange={e => updateStageItem(stage.id, item.id, 'duration', parseFloat(e.target.value) || 0)}
                                        className="w-full bg-slate-50 border border-slate-300 rounded p-1 text-xs font-mono font-bold text-slate-800 outline-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-slate-400 text-[10px] font-bold">歷時單位</label>
                                      <input
                                        aria-label={`${stage.name} ${item.name || '新項目'} 工期單位`}
                                        type="text"
                                        value={item.durationUnit}
                                        onChange={e => updateStageItem(stage.id, item.id, 'durationUnit', e.target.value)}
                                        placeholder="天/時/趟/次"
                                        className="w-full bg-slate-50 border border-slate-300 rounded p-1 text-xs text-slate-800 outline-none"
                                      />
                                    </div>
                                  </div>

                                  {/* Customer Unit Price */}
                                  <div className="lg:col-span-2">
                                    <label className="block text-slate-400 text-[10px] font-bold">客報單價 (TWD)</label>
                                    <input
                                      aria-label={`${stage.name} ${item.name || '新項目'} 客報單價`}
                                      type="number"
                                      min={0}
                                      value={item.price}
                                      onChange={e => updateStageItem(stage.id, item.id, 'price', parseFloat(e.target.value) || 0)}
                                      className="w-full bg-slate-50 border border-slate-300 rounded p-1 text-xs font-mono font-bold text-slate-800 outline-none"
                                    />
                                  </div>

                                  {/* Cost Unit Price */}
                                  <div className="lg:col-span-2">
                                    <label className="block text-slate-400 text-[10px] font-bold">成本單價 (TWD)</label>
                                    <input
                                      aria-label={`${stage.name} ${item.name || '新項目'} 成本單價`}
                                      type="number"
                                      min={0}
                                      value={item.costPrice}
                                      onChange={e => updateStageItem(stage.id, item.id, 'costPrice', parseFloat(e.target.value) || 0)}
                                      className="w-full bg-slate-50 border border-slate-300 rounded p-1 text-xs font-mono text-slate-700 outline-none"
                                    />
                                  </div>

                                  {/* Line Totals & Internal Flag */}
                                  <div className="lg:col-span-2 flex flex-col justify-end text-right font-mono">
                                    <div className="text-xs font-bold text-blue-700">
                                      客報 {item.internalOnly ? '$0 (內部)' : formatCurrency(lineTotal)}
                                    </div>
                                    <div className="text-[11px] text-slate-400">
                                      成本 {formatCurrency(lineCost)}
                                    </div>
                                  </div>
                                </div>

                                {/* Multiplier Hint & Note / Internal-Only checkbox */}
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
                                  <div className="flex items-center gap-2">
                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-600">
                                      計量：{item.quantity} {item.unit} × {item.duration} {item.durationUnit} = {item.quantity * item.duration} ({item.unit}·{item.durationUnit})
                                    </span>
                                    <label className="flex items-center gap-1 cursor-pointer text-slate-600 hover:text-slate-800 ml-2">
                                      <input
                                        type="checkbox"
                                        checked={!!item.internalOnly}
                                        onChange={e => updateStageItem(stage.id, item.id, 'internalOnly', e.target.checked)}
                                        className="rounded text-blue-600 border-slate-300"
                                      />
                                      <span>內部項目（不向客戶報價）</span>
                                    </label>
                                  </div>

                                  <div className="flex items-center gap-1 flex-1 sm:max-w-md justify-end">
                                    <span className="text-slate-400">備註:</span>
                                    <input
                                      aria-label={`${stage.name} ${item.name || '新項目'} 備註`}
                                      type="text"
                                      value={item.note || ''}
                                      onChange={e => updateStageItem(stage.id, item.id, 'note', e.target.value)}
                                      placeholder="規格或工作備註"
                                      className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-slate-700 text-xs outline-none flex-1"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
