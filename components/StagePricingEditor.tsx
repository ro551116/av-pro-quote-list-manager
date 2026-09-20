import React, { useState } from 'react';
import { Project, EquipmentRental, WorkStage, StageItem, RentalPeriod, Category } from '../types';
import { CATEGORIES } from '../constants';
import {
  generateId,
  calcClientTotal,
  calcStageItemTotal,
  calcStageItemCost,
  calcWorkStage,
  calcRentalPeriod,
  calculateProject,
  formatCurrency,
  ScheduleRow,
  getScheduleRows,
  updateScheduleStage,
  assignEquipmentToStage,
  deleteScheduleRow,
} from '../utils/helpers';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

const fieldClass =
  'w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-500';
const labelClass = 'mb-1 block text-xs font-medium text-slate-600';
const actionClass =
  'inline-flex items-center justify-center gap-1 rounded-md px-2 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-slate-500 disabled:opacity-30';

interface StagePricingEditorProps {
  project: Project;
  onChange: (updater: (prev: Project) => Project) => void;
}

export const StagePricingEditor: React.FC<StagePricingEditorProps> = ({ project, onChange }) => {
  const pricing = project.pricing;

  // Category filters for period equipment checklists
  const [periodCategoryFilter, setPeriodCategoryFilter] = useState<
    Record<string, Category | 'all'>
  >({});

  if (!pricing) return null;

  const totals = calculateProject(project);
  const rows = getScheduleRows(project);
  const equipmentOwner = rows.find((row) => row.wholeEquipment);
  const eligibleRentalItems = project.items.filter((i) => !i.internalOnly && i.category !== 'crew');
  const baseRentalSubtotal = eligibleRentalItems.reduce(
    (sum, item) => sum + calcClientTotal(item),
    0
  );
  const existingStages = pricing.stages;
  const modeOwner =
    rows.find((row) => row.stage?.id === pricing.rental.stageId && row.periods.length) ||
    rows.find((row) => row.periods.length) ||
    rows[0];

  const matchesRow = (row: ScheduleRow, key: string): boolean =>
    row.key === key ||
    row.periods.some((period) => `period:${period.id}` === key) ||
    (key === 'whole-equipment' && row.wholeEquipment);

  // -------------------------------------------------------------
  // Stage & Row Operations
  // -------------------------------------------------------------
  const handleAddStage = (name = '新檔期') => {
    const newStage: WorkStage = {
      id: generateId(),
      name,
      pricingMode: 'itemized',
      fixedAmount: 0,
      displayMode: 'detailed',
      items: [],
    };
    onChange((prev) => {
      if (!prev.pricing) return prev;
      return {
        ...prev,
        pricing: {
          ...prev.pricing,
          stages: [...prev.pricing.stages, newStage],
        },
      };
    });
  };

  const handleUpdateStageMetadata = (
    rowKey: string,
    field:
      | 'name'
      | 'startDate'
      | 'endDate'
      | 'time'
      | 'note'
      | 'pricingMode'
      | 'fixedAmount'
      | 'displayMode',
    value: unknown
  ) => {
    onChange((prev) =>
      updateScheduleStage(prev, rowKey, (stage) => ({
        ...stage,
        [field]: value,
      }))
    );
  };

  const handleDeleteRow = (row: ScheduleRow) => {
    const name = row.name || '此檔期';
    if (!window.confirm(`確定要刪除「${name}」及其相關費用？此操作無法復原。`)) {
      return;
    }
    onChange((prev) => deleteScheduleRow(prev, row.key));
  };

  const handleMoveStageOrder = (stageId: string, direction: -1 | 1) => {
    onChange((prev) => {
      if (!prev.pricing) return prev;
      const stages = [...prev.pricing.stages];
      const idx = stages.findIndex((s) => s.id === stageId);
      if (idx < 0) return prev;
      const target = idx + direction;
      if (target < 0 || target >= stages.length) return prev;
      [stages[idx], stages[target]] = [stages[target], stages[idx]];
      return {
        ...prev,
        pricing: { ...prev.pricing, stages },
      };
    });
  };

  // -------------------------------------------------------------
  // Stage Line Items CRUD & Move
  // -------------------------------------------------------------
  const handleAddStageItem = (rowKey: string) => {
    const newItem: StageItem = {
      id: generateId(),
      kind: 'other',
      name: '',
      quantity: 1,
      unit: '式',
      duration: 1,
      durationUnit: '次',
      price: 0,
      costPrice: 0,
      note: '',
      internalOnly: false,
    };

    onChange((prev) =>
      updateScheduleStage(prev, rowKey, (stage) => ({
        ...stage,
        items: [...stage.items, newItem],
      }))
    );
  };

  const handleUpdateStageItem = <K extends keyof StageItem>(
    rowKey: string,
    itemId: string,
    field: K,
    value: StageItem[K]
  ) => {
    onChange((prev) =>
      updateScheduleStage(prev, rowKey, (stage) => ({
        ...stage,
        items: stage.items.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)),
      }))
    );
  };

  const handleDeleteStageItem = (stageId: string, itemId: string) => {
    onChange((prev) => {
      if (!prev.pricing) return prev;
      const nextProject = updateScheduleStage(prev, `stage:${stageId}`, (stage) => ({
        ...stage,
        items: stage.items.filter((item) => item.id !== itemId),
      }));
      return {
        ...nextProject,
        subcontracts: (nextProject.subcontracts || []).map((sub) => ({
          ...sub,
          itemIds: sub.itemIds.filter((id) => id !== itemId),
        })),
      };
    });
  };

  const handleMoveStageItemOrder = (rowKey: string, itemId: string, direction: -1 | 1) => {
    onChange((prev) =>
      updateScheduleStage(prev, rowKey, (stage) => {
        const idx = stage.items.findIndex((item) => item.id === itemId);
        if (idx < 0) return stage;
        const target = idx + direction;
        if (target < 0 || target >= stage.items.length) return stage;
        const items = [...stage.items];
        [items[idx], items[target]] = [items[target], items[idx]];
        return { ...stage, items };
      })
    );
  };

  const handleMoveStageItemToStage = (
    sourceStageId: string,
    targetStageId: string,
    itemId: string
  ) => {
    if (sourceStageId === targetStageId) return;
    const source = pricing.stages.find((stage) => stage.id === sourceStageId);
    const target = pricing.stages.find((stage) => stage.id === targetStageId);
    if (!source || !target) return;

    if (
      (source.pricingMode === 'fixed' || target.pricingMode === 'fixed') &&
      !window.confirm(
        '來源或目的檔期使用包價。移動項目不會自動調整包價，可能改變總報價；移動後請確認兩個檔期的金額。確定移動？'
      )
    ) {
      return;
    }

    onChange((prev) => {
      if (!prev.pricing) return prev;
      const sourceStage = prev.pricing.stages.find((s) => s.id === sourceStageId);
      const itemToMove = sourceStage?.items.find((i) => i.id === itemId);
      if (!itemToMove) return prev;

      return {
        ...prev,
        pricing: {
          ...prev.pricing,
          stages: prev.pricing.stages.map((stage) => {
            if (stage.id === sourceStageId) {
              return {
                ...stage,
                items: stage.items.filter((i) => i.id !== itemId),
              };
            }
            if (stage.id === targetStageId) {
              return {
                ...stage,
                items: [...stage.items, itemToMove],
              };
            }
            return stage;
          }),
        },
      };
    });
  };

  // -------------------------------------------------------------
  // Equipment Rental Configuration Handlers
  // -------------------------------------------------------------
  const setRentalMode = (mode: EquipmentRental['mode'], activeStageId?: string) => {
    onChange((prev) => {
      if (!prev.pricing) return prev;
      const currentRental = prev.pricing.rental;
      let newPeriods = currentRental.periods;

      if (mode === 'periods' && newPeriods.length === 0) {
        newPeriods = [
          {
            id: generateId(),
            stageId: activeStageId,
            label: '活動日',
            type: 'rate',
            value: 1.0,
            units: 1,
            itemIds: prev.items
              .filter((i) => !i.internalOnly && i.category !== 'crew')
              .map((i) => i.id),
          },
        ];
      }

      return {
        ...prev,
        pricing: {
          ...prev.pricing,
          rental: {
            ...currentRental,
            mode,
            stageId:
              mode !== 'periods' ? activeStageId || currentRental.stageId : currentRental.stageId,
            periods: newPeriods,
          },
        },
      };
    });
  };

  const updateRentalField = <K extends keyof EquipmentRental>(
    field: K,
    value: EquipmentRental[K]
  ) => {
    onChange((prev) => {
      if (!prev.pricing) return prev;
      return {
        ...prev,
        pricing: {
          ...prev.pricing,
          rental: {
            ...prev.pricing.rental,
            [field]: value,
          },
        },
      };
    });
  };

  const handleAddPeriodFee = (row: ScheduleRow) => {
    const newPeriod: RentalPeriod = {
      id: generateId(),
      stageId: row.stage?.id,
      label: '',
      type: 'fixed',
      value: 0,
      units: 1,
      itemIds: [],
    };
    onChange((prev) => {
      if (!prev.pricing || prev.pricing.rental.mode !== 'periods') return prev;
      const next = row.stage ? prev : updateScheduleStage(prev, row.key, (stage) => stage);
      const owner = getScheduleRows(next).find((candidate) =>
        matchesRow(candidate, row.key)
      )?.stage;
      if (!owner || !next.pricing) return prev;
      return {
        ...next,
        pricing: {
          ...next.pricing,
          rental: {
            ...next.pricing.rental,
            periods: [...next.pricing.rental.periods, { ...newPeriod, stageId: owner.id }],
          },
        },
      };
    });
  };

  const updateRentalPeriod = <K extends keyof RentalPeriod>(
    periodId: string,
    field: K,
    value: RentalPeriod[K]
  ) => {
    onChange((prev) => {
      if (!prev.pricing) return prev;
      return {
        ...prev,
        pricing: {
          ...prev.pricing,
          rental: {
            ...prev.pricing.rental,
            periods: prev.pricing.rental.periods.map((period) =>
              period.id === periodId ? { ...period, [field]: value } : period
            ),
          },
        },
      };
    });
  };

  const togglePeriodEquipment = (periodId: string, itemId: string) => {
    onChange((prev) => {
      if (!prev.pricing) return prev;
      return {
        ...prev,
        pricing: {
          ...prev.pricing,
          rental: {
            ...prev.pricing.rental,
            periods: prev.pricing.rental.periods.map((period) => {
              if (period.id !== periodId) return period;
              const has = period.itemIds.includes(itemId);
              return {
                ...period,
                itemIds: has
                  ? period.itemIds.filter((id) => id !== itemId)
                  : [...period.itemIds, itemId],
              };
            }),
          },
        },
      };
    });
  };

  const selectAllPeriodEquipment = (periodId: string, selectAll: boolean) => {
    const eligibleIds = project.items
      .filter((i) => !i.internalOnly && i.category !== 'crew')
      .map((i) => i.id);
    onChange((prev) => {
      if (!prev.pricing) return prev;
      return {
        ...prev,
        pricing: {
          ...prev.pricing,
          rental: {
            ...prev.pricing.rental,
            periods: prev.pricing.rental.periods.map((period) =>
              period.id === periodId ? { ...period, itemIds: selectAll ? eligibleIds : [] } : period
            ),
          },
        },
      };
    });
  };

  return (
    <div className="space-y-4 [&_input]:min-w-0 [&_select]:min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900">
          檔期設定{' '}
          <span className="ml-2 text-sm font-normal">合計 {formatCurrency(totals.subtotal)}</span>
        </h3>
        <button type="button" onClick={() => handleAddStage()} className={actionClass}>
          <Plus size={14} /> 新增檔期
        </button>
      </div>
      {rows.length === 0 && <p className="text-sm text-slate-600">尚無檔期，可直接新增。</p>}
      {rows.map((row, rowIdx) => {
        const stage = row.stage;
        const otherStages = pricing.stages.filter((s) => s.id !== stage?.id);
        const canSetEquipmentMode =
          row.wholeEquipment || (pricing.rental.mode === 'periods' && row.key === modeOwner?.key);
        return (
          <section
            key={
              row.wholeEquipment
                ? 'whole-equipment'
                : row.periods.length
                  ? 'period:' + row.periods[0].id
                  : row.key
            }
            aria-label={'檔期 ' + row.name}
            className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold text-slate-900">
                {row.name || '未命名檔期'}{' '}
                <span className="ml-3 tabular-nums">{formatCurrency(row.total)}</span>
              </h4>
              <div className="flex items-center gap-1">
                {stage && (
                  <>
                    <button
                      type="button"
                      aria-label={'上移檔期 ' + row.name}
                      title="上移檔期"
                      disabled={rowIdx === 0}
                      onClick={() => handleMoveStageOrder(stage.id, -1)}
                      className={actionClass}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={'下移檔期 ' + row.name}
                      title="下移檔期"
                      disabled={pricing.stages.at(-1)?.id === stage.id}
                      onClick={() => handleMoveStageOrder(stage.id, 1)}
                      className={actionClass}
                    >
                      <ArrowDown size={14} />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  aria-label={'刪除檔期 ' + row.name}
                  onClick={() => handleDeleteRow(row)}
                  className={actionClass}
                >
                  <Trash2 size={14} /> 刪除檔期
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <label className="col-span-2 lg:col-span-1">
                <span className={labelClass}>檔期名稱</span>
                <input
                  aria-label={'檔期 ' + (rowIdx + 1) + ' 名稱'}
                  value={row.name}
                  onChange={(e) => handleUpdateStageMetadata(row.key, 'name', e.target.value)}
                  className={fieldClass}
                />
              </label>
              <label>
                <span className={labelClass}>起始日期</span>
                <input
                  type="date"
                  aria-label={'檔期 ' + row.name + ' 起始日期'}
                  value={row.startDate || ''}
                  onChange={(e) => handleUpdateStageMetadata(row.key, 'startDate', e.target.value)}
                  className={fieldClass}
                />
              </label>
              <label>
                <span className={labelClass}>結束日期</span>
                <input
                  type="date"
                  aria-label={'檔期 ' + row.name + ' 結束日期'}
                  value={row.endDate || ''}
                  onChange={(e) => handleUpdateStageMetadata(row.key, 'endDate', e.target.value)}
                  className={fieldClass}
                />
              </label>
              <label>
                <span className={labelClass}>時段</span>
                <input
                  aria-label={'檔期 ' + row.name + ' 時段'}
                  value={stage?.time || ''}
                  placeholder="09:00–18:00"
                  onChange={(e) => handleUpdateStageMetadata(row.key, 'time', e.target.value)}
                  className={fieldClass}
                />
              </label>
              <label>
                <span className={labelClass}>檔期備註</span>
                <input
                  aria-label={'檔期 ' + row.name + ' 備註'}
                  value={stage?.note || ''}
                  onChange={(e) => handleUpdateStageMetadata(row.key, 'note', e.target.value)}
                  className={fieldClass}
                />
              </label>
            </div>
            {stage && (
              <div className="flex flex-wrap items-end gap-3">
                <label>
                  <span className={labelClass}>工作項目計價</span>
                  <select
                    aria-label={'檔期 ' + row.name + ' 工作項目計價'}
                    value={stage.pricingMode}
                    onChange={(e) =>
                      handleUpdateStageMetadata(row.key, 'pricingMode', e.target.value)
                    }
                    className={fieldClass}
                  >
                    <option value="itemized">明細加總</option>
                    <option value="fixed">人力與其他費用包價</option>
                  </select>
                </label>
                {stage.pricingMode === 'fixed' && (
                  <label>
                    <span className={labelClass}>包價金額（不含器材）</span>
                    <input
                      type="number"
                      min={0}
                      aria-label={'檔期 ' + row.name + ' 包價金額'}
                      value={stage.fixedAmount}
                      onChange={(e) =>
                        handleUpdateStageMetadata(
                          row.key,
                          'fixedAmount',
                          Math.max(0, parseFloat(e.target.value) || 0)
                        )
                      }
                      className={fieldClass}
                    />
                  </label>
                )}
                <label>
                  <span className={labelClass}>報價單呈現</span>
                  <select
                    aria-label={'檔期 ' + row.name + ' 報價單呈現'}
                    value={stage.displayMode}
                    onChange={(e) =>
                      handleUpdateStageMetadata(row.key, 'displayMode', e.target.value)
                    }
                    className={fieldClass}
                  >
                    <option value="detailed">展開工作明細</option>
                    <option value="summary">工作項目摘要</option>
                  </select>
                </label>
                {stage.pricingMode === 'fixed' && (
                  <p className="pb-2 text-xs text-slate-600">
                    明細 {formatCurrency(calcWorkStage(stage).detailSubtotal)}{' '}
                    僅供參考；器材費用另計。
                  </p>
                )}
              </div>
            )}
            {(canSetEquipmentMode || row.periods.length > 0 || row.wholeEquipment) && (
              <div className="space-y-3 border-t border-slate-200 pt-3">
                <div className="flex flex-wrap items-end gap-3">
                  <h5 className="mr-auto pb-2 text-sm font-semibold">
                    器材費用 {formatCurrency(row.equipmentSubtotal)}
                  </h5>
                  {canSetEquipmentMode && (
                    <label>
                      <span className={labelClass}>整單器材計費方式</span>
                      <select
                        aria-label="整單器材計費方式"
                        value={pricing.rental.mode}
                        onChange={(e) =>
                          setRentalMode(e.target.value as EquipmentRental['mode'], stage?.id)
                        }
                        className={fieldClass}
                      >
                        <option value="itemized">依器材清單加總</option>
                        <option value="fixed">整場固定包價</option>
                        <option value="periods">分檔期計費</option>
                      </select>
                    </label>
                  )}
                  {row.wholeEquipment && pricing.rental.mode === 'fixed' && (
                    <label>
                      <span className={labelClass}>整場器材包價</span>
                      <input
                        type="number"
                        min={0}
                        aria-label="整場器材固定包價"
                        value={pricing.rental.fixedAmount}
                        onChange={(e) =>
                          updateRentalField(
                            'fixedAmount',
                            Math.max(0, parseFloat(e.target.value) || 0)
                          )
                        }
                        className={fieldClass}
                      />
                    </label>
                  )}
                  {row.wholeEquipment && existingStages.length > 0 && (
                    <label>
                      <span className={labelClass}>器材費用歸屬</span>
                      <select
                        aria-label="器材費用歸屬檔期"
                        value={stage?.id || ''}
                        onChange={(e) => {
                          const id = e.target.value;
                          onChange((prev) => assignEquipmentToStage(prev, 'whole-equipment', id));
                        }}
                        className={fieldClass}
                      >
                        <option value="" disabled>
                          未歸屬，選擇檔期
                        </option>
                        {existingStages.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                {row.wholeEquipment && (
                  <p className="text-xs text-slate-600">
                    器材清單加總 {formatCurrency(baseRentalSubtotal)}
                    {pricing.rental.mode === 'fixed'
                      ? '，本檔期以包價計收。'
                      : '，隨清單數量與單價更新。'}
                  </p>
                )}
                {row.periods.map((period, pIdx) => {
                  const activeFilter = periodCategoryFilter[period.id] || 'all';
                  const filteredItems = eligibleRentalItems.filter(
                    (item) => activeFilter === 'all' || item.category === activeFilter
                  );
                  const selectedCount = eligibleRentalItems.filter((item) =>
                    period.itemIds.includes(item.id)
                  ).length;
                  return (
                    <div key={period.id} className="space-y-3 border-t border-slate-100 pt-3">
                      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 items-end">
                        <label className="col-span-2 lg:col-span-2">
                          <span className={labelClass}>器材費用名稱</span>
                          <input
                            aria-label={row.name + ' 器材費用 ' + (pIdx + 1) + ' 名稱'}
                            value={period.label}
                            placeholder="例如：活動首日"
                            onChange={(e) => updateRentalPeriod(period.id, 'label', e.target.value)}
                            className={fieldClass}
                          />
                        </label>
                        <label>
                          <span className={labelClass}>計價方式</span>
                          <select
                            aria-label={'計費段 ' + (period.label || pIdx + 1) + ' 計價類型'}
                            value={period.type}
                            onChange={(e) =>
                              updateRentalPeriod(
                                period.id,
                                'type',
                                e.target.value as 'rate' | 'fixed'
                              )
                            }
                            className={fieldClass}
                          >
                            <option value="rate">器材比例</option>
                            <option value="fixed">固定金額</option>
                          </select>
                        </label>
                        <label>
                          <span className={labelClass}>
                            {period.type === 'rate' ? '比例（%）' : '固定金額'}
                          </span>
                          <input
                            type="number"
                            min={0}
                            aria-label={
                              '計費段 ' +
                              (period.label || pIdx + 1) +
                              (period.type === 'rate' ? ' 計費比例' : ' 固定金額')
                            }
                            value={
                              period.type === 'rate' ? Math.round(period.value * 100) : period.value
                            }
                            onChange={(e) =>
                              updateRentalPeriod(
                                period.id,
                                'value',
                                (parseFloat(e.target.value) || 0) /
                                  (period.type === 'rate' ? 100 : 1)
                              )
                            }
                            className={fieldClass}
                          />
                        </label>
                        <label>
                          <span className={labelClass}>天數／次數</span>
                          <input
                            type="number"
                            min={0.1}
                            step={0.5}
                            aria-label={'計費段 ' + (period.label || pIdx + 1) + ' 計費次數'}
                            value={period.units}
                            onChange={(e) =>
                              updateRentalPeriod(
                                period.id,
                                'units',
                                Math.max(0.1, parseFloat(e.target.value) || 1)
                              )
                            }
                            className={fieldClass}
                          />
                        </label>
                        <div className="pb-2 text-right text-sm tabular-nums">
                          <span className={labelClass}>費用小計</span>
                          {formatCurrency(calcRentalPeriod(project.items, period))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                        <label>
                          <span className={labelClass}>費用起始日（選填）</span>
                          <input
                            type="date"
                            aria-label={'計費段 ' + (period.label || pIdx + 1) + ' 起始日期'}
                            value={period.startDate || ''}
                            onChange={(e) =>
                              updateRentalPeriod(period.id, 'startDate', e.target.value)
                            }
                            className={fieldClass}
                          />
                        </label>
                        <label>
                          <span className={labelClass}>費用結束日（選填）</span>
                          <input
                            type="date"
                            aria-label={'計費段 ' + (period.label || pIdx + 1) + ' 結束日期'}
                            value={period.endDate || ''}
                            onChange={(e) =>
                              updateRentalPeriod(period.id, 'endDate', e.target.value)
                            }
                            className={fieldClass}
                          />
                        </label>
                        <label>
                          <span className={labelClass}>費用歸屬檔期</span>
                          <select
                            aria-label={'計費段 ' + (period.label || pIdx + 1) + ' 歸屬檔期'}
                            value={
                              existingStages.some((s) => s.id === period.stageId)
                                ? period.stageId
                                : ''
                            }
                            onChange={(e) => {
                              const id = e.target.value;
                              onChange((prev) =>
                                assignEquipmentToStage(prev, 'period:' + period.id, id)
                              );
                            }}
                            className={fieldClass}
                          >
                            <option value="" disabled>
                              未歸屬，選擇檔期
                            </option>
                            {existingStages.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          aria-label={'刪除計費段 ' + (period.label || pIdx + 1)}
                          onClick={() =>
                            onChange((prev) => deleteScheduleRow(prev, 'period:' + period.id))
                          }
                          className={actionClass}
                        >
                          <Trash2 size={14} /> 刪除這筆費用
                        </button>
                      </div>
                      <details className="text-sm">
                        <summary
                          aria-label={'計費段 ' + (period.label || pIdx + 1) + ' 適用器材'}
                          className="w-fit cursor-pointer py-1 text-slate-700"
                        >
                          適用器材 · 已選 {selectedCount} / {eligibleRentalItems.length} 項
                          {period.type === 'fixed' ? '（固定金額不受勾選影響）' : ''}
                        </summary>
                        <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <select
                              aria-label={'計費段 ' + (period.label || pIdx + 1) + ' 類別篩選'}
                              value={activeFilter}
                              onChange={(e) =>
                                setPeriodCategoryFilter((prev) => ({
                                  ...prev,
                                  [period.id]: e.target.value as Category | 'all',
                                }))
                              }
                              className={fieldClass + ' sm:max-w-48'}
                            >
                              <option value="all">全部器材分類</option>
                              {CATEGORIES.filter((c) => c.id !== 'crew').map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              aria-label={'計費段 ' + (period.label || pIdx + 1) + ' 全選器材'}
                              onClick={() => selectAllPeriodEquipment(period.id, true)}
                              className={actionClass}
                            >
                              全選
                            </button>
                            <button
                              type="button"
                              aria-label={'計費段 ' + (period.label || pIdx + 1) + ' 全部取消'}
                              onClick={() => selectAllPeriodEquipment(period.id, false)}
                              className={actionClass}
                            >
                              全不選
                            </button>
                          </div>
                          <div className="grid sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                            {filteredItems.map((item) => (
                              <label key={item.id} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  aria-label={(period.label || '器材費用') + ' 適用 ' + item.name}
                                  checked={period.itemIds.includes(item.id)}
                                  onChange={() => togglePeriodEquipment(period.id, item.id)}
                                />
                                <span className="min-w-0 flex-1 break-words">{item.name}</span>
                                <span className="text-xs tabular-nums">
                                  {item.quantity} {item.unit} ·{' '}
                                  {formatCurrency(calcClientTotal(item))}
                                </span>
                              </label>
                            ))}
                            {filteredItems.length === 0 && (
                              <p className="text-sm text-slate-600">這個分類尚無可選器材。</p>
                            )}
                          </div>
                        </div>
                      </details>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="space-y-3 border-t border-slate-200 pt-3">
              <h5 className="text-sm font-semibold">工作項目</h5>
              {(!stage || stage.items.length === 0) && (
                <p className="text-sm text-slate-600">尚無項目，可直接新增。</p>
              )}
              {stage?.items.map((item, itemIdx) => (
                <div key={item.id} className="space-y-3 border-t border-slate-100 pt-3">
                  <div className="grid grid-cols-2 lg:grid-cols-8 gap-3 items-end">
                    <label className="col-span-2 lg:col-span-3">
                      <span className={labelClass}>項目名稱</span>
                      <input
                        aria-label={row.name + ' 項目 ' + (itemIdx + 1) + ' 名稱'}
                        value={item.name}
                        placeholder="例如：工作人員、貨車"
                        onChange={(e) =>
                          handleUpdateStageItem(row.key, item.id, 'name', e.target.value)
                        }
                        className={fieldClass}
                      />
                    </label>
                    <label>
                      <span className={labelClass}>數量</span>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          aria-label={'品項 ' + (item.name || itemIdx + 1) + ' 數量'}
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateStageItem(
                              row.key,
                              item.id,
                              'quantity',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className={fieldClass}
                        />
                        <input
                          aria-label={'品項 ' + (item.name || itemIdx + 1) + ' 數量單位'}
                          value={item.unit}
                          onChange={(e) =>
                            handleUpdateStageItem(row.key, item.id, 'unit', e.target.value)
                          }
                          className={fieldClass + ' max-w-14'}
                        />
                      </div>
                    </label>
                    <label>
                      <span className={labelClass}>工期</span>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          aria-label={'品項 ' + (item.name || itemIdx + 1) + ' 工期'}
                          value={item.duration}
                          onChange={(e) =>
                            handleUpdateStageItem(
                              row.key,
                              item.id,
                              'duration',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className={fieldClass}
                        />
                        <input
                          aria-label={'品項 ' + (item.name || itemIdx + 1) + ' 歷時單位'}
                          value={item.durationUnit}
                          onChange={(e) =>
                            handleUpdateStageItem(row.key, item.id, 'durationUnit', e.target.value)
                          }
                          className={fieldClass + ' max-w-14'}
                        />
                      </div>
                    </label>
                    <label>
                      <span className={labelClass}>客報單價</span>
                      <input
                        type="number"
                        min={0}
                        aria-label={'品項 ' + (item.name || itemIdx + 1) + ' 客報單價'}
                        value={item.price}
                        onChange={(e) =>
                          handleUpdateStageItem(
                            row.key,
                            item.id,
                            'price',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className={fieldClass}
                      />
                    </label>
                    <label>
                      <span className={labelClass}>成本單價</span>
                      <input
                        type="number"
                        min={0}
                        aria-label={'品項 ' + (item.name || itemIdx + 1) + ' 成本單價'}
                        value={item.costPrice}
                        onChange={(e) =>
                          handleUpdateStageItem(
                            row.key,
                            item.id,
                            'costPrice',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className={fieldClass}
                      />
                    </label>
                    <div className="col-span-2 lg:col-span-1 text-right text-sm tabular-nums">
                      <span className={labelClass}>
                        {stage.pricingMode === 'fixed' ? '參考小計' : '小計'}
                      </span>
                      <strong>
                        {item.internalOnly
                          ? '內部不報價'
                          : formatCurrency(calcStageItemTotal(item))}
                      </strong>
                      <span className="block text-xs text-slate-600">
                        成本 {formatCurrency(calcStageItemCost(item))}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <label>
                      <span className={labelClass}>類型</span>
                      <select
                        aria-label={'品項 ' + (item.name || itemIdx + 1) + ' 類型'}
                        value={item.kind}
                        onChange={(e) =>
                          handleUpdateStageItem(
                            row.key,
                            item.id,
                            'kind',
                            e.target.value as StageItem['kind']
                          )
                        }
                        className={fieldClass}
                      >
                        <option value="other">其他費用</option>
                        <option value="labor">人力</option>
                        <option value="transport">車載</option>
                        <option value="equipment">額外器材</option>
                      </select>
                    </label>
                    <label className="min-w-0 flex-1 basis-40">
                      <span className={labelClass}>項目備註</span>
                      <input
                        aria-label={'品項 ' + (item.name || itemIdx + 1) + ' 備註'}
                        value={item.note || ''}
                        onChange={(e) =>
                          handleUpdateStageItem(row.key, item.id, 'note', e.target.value)
                        }
                        className={fieldClass}
                      />
                    </label>
                    <label className="flex items-center gap-2 py-2 text-sm">
                      <input
                        type="checkbox"
                        aria-label={'品項 ' + (item.name || itemIdx + 1) + ' 內部項目'}
                        checked={!!item.internalOnly}
                        onChange={(e) =>
                          handleUpdateStageItem(row.key, item.id, 'internalOnly', e.target.checked)
                        }
                      />
                      內部項目（不報價）
                    </label>
                    {otherStages.length > 0 && (
                      <label>
                        <span className={labelClass}>搬移項目</span>
                        <select
                          aria-label={'品項 ' + (item.name || itemIdx + 1) + ' 移至其他檔期'}
                          value=""
                          onChange={(e) =>
                            handleMoveStageItemToStage(stage.id, e.target.value, item.id)
                          }
                          className={fieldClass}
                        >
                          <option value="" disabled>
                            選擇目的檔期
                          </option>
                          {otherStages.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={'品項 ' + (item.name || itemIdx + 1) + ' 上移'}
                        title="上移項目"
                        disabled={itemIdx === 0}
                        onClick={() => handleMoveStageItemOrder(row.key, item.id, -1)}
                        className={actionClass}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label={'品項 ' + (item.name || itemIdx + 1) + ' 下移'}
                        title="下移項目"
                        disabled={itemIdx === stage.items.length - 1}
                        onClick={() => handleMoveStageItemOrder(row.key, item.id, 1)}
                        className={actionClass}
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label={'品項 ' + (item.name || itemIdx + 1) + ' 刪除'}
                        onClick={() => handleDeleteStageItem(stage.id, item.id)}
                        className={actionClass}
                      >
                        <Trash2 size={14} /> 刪除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-label={'檔期 ' + row.name + ' 新增項目'}
                  onClick={() => handleAddStageItem(row.key)}
                  className={actionClass}
                >
                  <Plus size={14} /> 新增項目
                </button>
                {pricing.rental.mode === 'periods' && (
                  <button
                    type="button"
                    aria-label={'檔期 ' + row.name + ' 新增器材費用'}
                    onClick={() => handleAddPeriodFee(row)}
                    className={actionClass}
                  >
                    <Plus size={14} /> 新增器材費用
                  </button>
                )}
                {pricing.rental.mode !== 'periods' && !equipmentOwner && stage && (
                  <button
                    type="button"
                    onClick={() =>
                      onChange((prev) => assignEquipmentToStage(prev, 'whole-equipment', stage.id))
                    }
                    className={actionClass}
                  >
                    設定器材費用
                  </button>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
};
