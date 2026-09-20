import React from 'react';
import type { Project } from '../types';
import { CATEGORIES } from '../constants';
import {
  formatCurrency,
  calcClientTotal,
  calcCostTotal,
  calcStageItemTotal,
  calcStageItemCost,
  calcWorkStage,
  calcRentalPeriod,
  formatDateRange,
} from '../utils/helpers';

interface QuoteEquipmentProps {
  project: Project;
  rentalSubtotal: number;
  nextIndex: () => number;
}

/**
 * Customer Quote Equipment Section (New Stage Pricing)
 * Renders reference equipment specification list with NO double billing.
 * - 'itemized': standard billable equipment rows summing to rentalSubtotal.
 * - 'fixed': equipment list marked as specification reference + explicit fixed rental billing row.
 * - 'periods': equipment list marked as reference + actual period charges billed once (percentages hidden).
 */
export const StagePricingQuoteEquipmentTable: React.FC<QuoteEquipmentProps> = ({
  project,
  rentalSubtotal,
  nextIndex,
}) => {
  if (!project.pricing) return null;
  const { rental } = project.pricing;
  const equipmentItems = project.items.filter(
    item => !item.internalOnly && item.category !== 'crew'
  );

  if (equipmentItems.length === 0 && rentalSubtotal === 0) return null;

  const isFixed = rental.mode === 'fixed';
  const isPeriods = rental.mode === 'periods';
  const isItemized = rental.mode === 'itemized';

  return (
    <div className="w-full mb-4">
      {/* Notice banner for fixed or periods mode */}
      {isFixed && (
        <div className="bg-slate-50 border border-black px-3 py-1.5 mb-2 text-xs text-slate-700 flex justify-between items-center print:bg-slate-50 print:print-color-adjust-exact">
          <span className="font-bold">器材租賃清單（整檔固定租金計費）</span>
          <span className="text-slate-500">下方各器材品項單價與金額為規格參考，本案以整檔固定租金計價</span>
        </div>
      )}
      {isPeriods && (
        <div className="bg-slate-50 border border-black px-3 py-1.5 mb-2 text-xs text-slate-700 flex justify-between items-center print:bg-slate-50 print:print-color-adjust-exact">
          <span className="font-bold">器材清單（依檔期計費）</span>
          <span className="text-slate-500">下方器材品項金額為基準參考，實際租賃費用依下方租賃檔期計價</span>
        </div>
      )}

      {/* Equipment Category Tables */}
      {CATEGORIES.map(cat => {
        const catItems = equipmentItems.filter(i => i.category === cat.id);
        if (catItems.length === 0) return null;

        return (
          <div key={cat.id} className="mb-3">
            <div className="font-bold border-t-2 border-black border-l border-r bg-gray-100 px-2 py-1 text-sm print:bg-gray-100 print:print-color-adjust-exact flex justify-between items-center">
              <span>{cat.label}</span>
              {(isFixed || isPeriods) && (
                <span className="text-xs font-normal text-slate-500">規格參考</span>
              )}
            </div>

            <table className="w-full text-[13px] table-fixed border-collapse border border-black">
              <thead className="bg-white text-center">
                <tr>
                  <th className="border border-black py-1 w-[5%] font-medium">編號</th>
                  <th className="border border-black py-1 w-[28%] font-medium">品名</th>
                  <th className="border border-black py-1 w-[8%] font-medium">數量</th>
                  <th className="border border-black py-1 w-[8%] font-medium">單位</th>
                  <th className="border border-black py-1 w-[13%] font-medium">
                    {isFixed || isPeriods ? '單價 (參考)' : '單價'}
                  </th>
                  <th className="border border-black py-1 w-[15%] font-medium">
                    {isFixed ? '金額 (參考)' : isPeriods ? '基準金額' : '金額'}
                  </th>
                  <th className="border border-black py-1 w-[23%] font-medium">備註</th>
                </tr>
              </thead>
              <tbody>
                {catItems.map(item => (
                  <tr key={item.id} className="break-inside-avoid">
                    <td className="border border-black py-2 text-center align-top font-mono">
                      {nextIndex()}
                    </td>
                    <td className="border border-black py-2 px-2 align-top font-bold">
                      {item.name}
                      {item.subItems && item.subItems.length > 0 && (
                        <div className="text-gray-500 text-xs mt-1 font-normal">如附件</div>
                      )}
                    </td>
                    <td className="border border-black py-2 px-2 text-center align-top">
                      {item.quantity}
                    </td>
                    <td className="border border-black py-2 px-2 text-center align-top">
                      {item.unit}
                    </td>
                    <td className="border border-black py-2 px-2 text-right align-top font-mono text-slate-700">
                      {formatCurrency(item.price)}
                    </td>
                    <td className="border border-black py-2 px-2 text-right align-top font-mono font-bold">
                      {formatCurrency(calcClientTotal(item))}
                    </td>
                    <td className="border border-black py-2 px-2 align-top text-xs">
                      {item.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {/* Billable rental charge row when fixed */}
      {isFixed && (
        <div className="border-2 border-black bg-gray-50 p-2.5 mb-4 flex justify-between items-center print:bg-gray-50 print:print-color-adjust-exact">
          <div>
            <span className="font-bold text-sm">器材租賃費用（整檔固定約定）</span>
            <span className="text-xs text-gray-500 ml-2">※ 上列品項單價與金額為規格參考，本案以整檔固定租金計價</span>
          </div>
          <div className="text-right font-mono font-bold text-base">
            {formatCurrency(rental.fixedAmount)}
          </div>
        </div>
      )}

      {/* Billable rental charges table when periods */}
      {isPeriods && rental.periods.length > 0 && (
        <div className="mb-4">
          <div className="font-bold border-t-2 border-black border-l border-r bg-gray-100 px-2 py-1 text-sm print:bg-gray-100 print:print-color-adjust-exact flex justify-between items-center">
            <span>器材租賃計費項目</span>
            <span className="text-xs font-normal text-gray-600">依約定檔期收費</span>
          </div>
          <table className="w-full text-[13px] table-fixed border-collapse border border-black">
            <thead className="bg-white text-center">
              <tr>
                <th className="border border-black py-1 w-[8%] font-medium">編號</th>
                <th className="border border-black py-1 w-[47%] font-medium text-left px-2">租賃檔期項目</th>
                <th className="border border-black py-1 w-[15%] font-medium">天數 / 次數</th>
                <th className="border border-black py-1 w-[30%] font-medium text-right px-2">租金金額</th>
              </tr>
            </thead>
            <tbody>
              {rental.periods.map((period, idx) => {
                const periodAmt = calcRentalPeriod(project.items, period);
                const dateRange = formatDateRange(period.startDate, period.endDate);
                return (
                  <tr key={period.id || idx} className="break-inside-avoid">
                    <td className="border border-black py-2 text-center font-mono">
                      {nextIndex()}
                    </td>
                    <td className="border border-black py-2 px-2 font-bold">
                      {period.label}
                      {dateRange && (
                        <span className="text-xs font-normal text-gray-600 ml-1">({dateRange})</span>
                      )}
                    </td>
                    <td className="border border-black py-2 px-2 text-center font-mono">
                      {period.units} {period.units > 0 ? '天/次' : ''}
                    </td>
                    <td className="border border-black py-2 px-2 text-right font-mono font-bold">
                      {formatCurrency(periodAmt)}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-gray-50 border-t-2 border-black font-bold print:bg-gray-50 print:print-color-adjust-exact">
                <td colSpan={3} className="border border-black py-2 px-2 text-right">
                  器材租賃小計（未稅）
                </td>
                <td className="border border-black py-2 px-2 text-right font-mono text-sm">
                  {formatCurrency(rentalSubtotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Subtotal note for itemized rental */}
      {isItemized && (
        <div className="flex justify-end mb-4">
          <div className="border border-black bg-gray-50 px-3 py-1 text-xs font-bold print:bg-gray-50 print:print-color-adjust-exact">
            器材租賃小計（未稅）: <span className="font-mono text-sm ml-1">{formatCurrency(rentalSubtotal)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

interface QuoteStagesProps {
  project: Project;
  nextIndex: () => number;
}

/**
 * Customer Quote Stages Section (New Stage Pricing)
 * Renders each stage according to displayMode and pricingMode.
 * - summary: single row with stage name, schedule, note, and agreed/subtotal amount.
 * - detailed + fixed: line details shown as reference specifications, stage agreed fixed price billed.
 * - detailed + itemized: line details billed directly, summing to stage subtotal.
 * - Empty no-staff stages with 0 fixed amount and no note are omitted.
 * - internalOnly items hidden. Summary stages with 0 charge do not invent fees.
 */
export const StagePricingQuoteStagesTable: React.FC<QuoteStagesProps> = ({
  project,
  nextIndex,
}) => {
  if (!project.pricing) return null;
  const { stages } = project.pricing;

  return (
    <div className="w-full mb-2">
      {stages.map(stage => {
        const visibleItems = stage.items.filter(item => !item.internalOnly);
        const stageTotals = calcWorkStage(stage);
        const isEmpty = stage.items.length === 0;
        const hasNonzeroFixed = stage.pricingMode === 'fixed' && stage.fixedAmount !== 0;
        const hasMeaningfulNote = Boolean(stage.note && stage.note.trim().length > 0);

        // Empty no-staff stage without fee or note is omitted from financial quote
        if (isEmpty && !hasNonzeroFixed && !hasMeaningfulNote) {
          return null;
        }
        // If all items are internalOnly and stage price is 0, do not invent a charged row
        if (visibleItems.length === 0 && !hasNonzeroFixed && !hasMeaningfulNote) {
          return null;
        }

        const stageSchedule = [
          formatDateRange(stage.startDate, stage.endDate),
          stage.time,
        ]
          .filter(Boolean)
          .join(' ');

        // Summary displayMode
        if (stage.displayMode === 'summary') {
          return (
            <div key={stage.id} className="mb-4">
              <div className="font-bold border-t-2 border-black border-l border-r bg-gray-100 px-2 py-1 text-sm print:bg-gray-100 print:print-color-adjust-exact flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span>【{stage.name}】階段</span>
                  {stageSchedule && (
                    <span className="text-xs font-normal text-slate-600">（{stageSchedule}）</span>
                  )}
                </div>
                {stage.note && (
                  <span className="text-xs font-normal text-slate-500">{stage.note}</span>
                )}
              </div>

              <table className="w-full text-[13px] table-fixed border-collapse border border-black">
                <thead className="bg-white text-center">
                  <tr>
                    <th className="border border-black py-1 w-[8%] font-medium">編號</th>
                    <th className="border border-black py-1 w-[40%] font-medium text-left px-2">工程與服務項目</th>
                    <th className="border border-black py-1 w-[8%] font-medium">數量</th>
                    <th className="border border-black py-1 w-[8%] font-medium">單位</th>
                    <th className="border border-black py-1 w-[16%] font-medium text-right px-2">單價</th>
                    <th className="border border-black py-1 w-[20%] font-medium text-right px-2">金額</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="break-inside-avoid">
                    <td className="border border-black py-2 text-center font-mono">
                      {nextIndex()}
                    </td>
                    <td className="border border-black py-2 px-2 font-bold">
                      {stage.name} 階段工程與執行費用
                      {stage.note && (
                        <div className="text-xs text-gray-500 font-normal mt-0.5">{stage.note}</div>
                      )}
                    </td>
                    <td className="border border-black py-2 px-2 text-center">1</td>
                    <td className="border border-black py-2 px-2 text-center">式</td>
                    <td className="border border-black py-2 px-2 text-right font-mono">
                      {formatCurrency(stageTotals.subtotal)}
                    </td>
                    <td className="border border-black py-2 px-2 text-right font-mono font-bold">
                      {formatCurrency(stageTotals.subtotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        }

        // Detailed displayMode
        const isFixedStage = stage.pricingMode === 'fixed';

        return (
          <div key={stage.id} className="mb-4">
            <div className="font-bold border-t-2 border-black border-l border-r bg-gray-100 px-2 py-1 text-sm print:bg-gray-100 print:print-color-adjust-exact flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span>【{stage.name}】階段工項明細</span>
                {stageSchedule && (
                  <span className="text-xs font-normal text-slate-600">（{stageSchedule}）</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isFixedStage && (
                  <span className="text-xs font-normal text-slate-500">※ 固定總價計費</span>
                )}
                {stage.note && (
                  <span className="text-xs font-normal text-slate-500">{stage.note}</span>
                )}
              </div>
            </div>

            <table className="w-full text-[13px] table-fixed border-collapse border border-black">
              <thead className="bg-white text-center">
                <tr>
                  <th className="border border-black py-1 w-[5%] font-medium">編號</th>
                  <th className="border border-black py-1 w-[28%] font-medium text-left px-2">工項 / 內容</th>
                  <th className="border border-black py-1 w-[8%] font-medium">數量</th>
                  <th className="border border-black py-1 w-[8%] font-medium">單位</th>
                  <th className="border border-black py-1 w-[10%] font-medium">工期/天數</th>
                  <th className="border border-black py-1 w-[12%] font-medium text-right px-2">
                    {isFixedStage ? '單價 (參考)' : '單價'}
                  </th>
                  <th className="border border-black py-1 w-[13%] font-medium text-right px-2">
                    {isFixedStage ? '金額 (參考)' : '金額'}
                  </th>
                  <th className="border border-black py-1 w-[16%] font-medium text-left px-2">備註</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.length === 0 ? (
                  <tr className="break-inside-avoid">
                    <td colSpan={8} className="border border-black py-2 px-2 text-center text-slate-500 text-xs">
                      {isFixedStage ? '本階段無個別細項，依約定總價計費' : '本階段無人力或其他加計費用'}
                    </td>
                  </tr>
                ) : (
                  visibleItems.map(item => (
                    <tr key={item.id} className="break-inside-avoid">
                      <td className="border border-black py-2 text-center align-top font-mono">
                        {nextIndex()}
                      </td>
                      <td className="border border-black py-2 px-2 align-top font-bold">
                        {item.name}
                        {item.subItems && item.subItems.length > 0 && (
                          <div className="text-gray-500 text-xs mt-1 font-normal">如附件</div>
                        )}
                      </td>
                      <td className="border border-black py-2 px-2 text-center align-top">
                        {item.quantity}
                      </td>
                      <td className="border border-black py-2 px-2 text-center align-top">
                        {item.unit}
                      </td>
                      <td className="border border-black py-2 px-2 text-center align-top font-mono">
                        {item.duration} {item.durationUnit}
                      </td>
                      <td className="border border-black py-2 px-2 text-right align-top font-mono text-slate-700">
                        {formatCurrency(item.price)}
                      </td>
                      <td className="border border-black py-2 px-2 text-right align-top font-mono font-bold">
                        {formatCurrency(calcStageItemTotal(item))}
                      </td>
                      <td className="border border-black py-2 px-2 align-top text-xs">
                        {item.note}
                      </td>
                    </tr>
                  ))
                )}

                {/* Subtotal / Agreed Row */}
                {isFixedStage ? (
                  <tr className="bg-gray-50 border-t-2 border-black font-bold print:bg-gray-50 print:print-color-adjust-exact">
                    <td colSpan={6} className="border border-black py-2 px-3 text-right">
                      【{stage.name}】階段約定總價（未稅）
                    </td>
                    <td className="border border-black py-2 px-2 text-right font-mono text-sm">
                      {formatCurrency(stage.fixedAmount)}
                    </td>
                    <td className="border border-black py-2 px-2 text-xs font-normal text-slate-500">
                      ※ 本階段以約定總價計費
                    </td>
                  </tr>
                ) : (
                  <tr className="bg-gray-50 border-t-2 border-black font-bold print:bg-gray-50 print:print-color-adjust-exact">
                    <td colSpan={6} className="border border-black py-2 px-3 text-right">
                      【{stage.name}】階段小計（未稅）
                    </td>
                    <td className="border border-black py-2 px-2 text-right font-mono text-sm">
                      {formatCurrency(stageTotals.subtotal)}
                    </td>
                    <td className="border border-black py-2 px-2"></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
};

interface CompactProps {
  project: Project;
  rentalSubtotal: number;
}

/**
 * Compact Quote Mode Summary Table (Cover Page)
 * Shows actual rental subtotal and stage subtotal lines ONCE.
 */
export const StagePricingCompactTable: React.FC<CompactProps> = ({
  project,
  rentalSubtotal,
}) => {
  if (!project.pricing) return null;
  const { rental, stages } = project.pricing;

  const rows: {
    title: string;
    content: string;
    amount: number;
    note: string;
  }[] = [];

  // Rental Line (billed once)
  if (rentalSubtotal !== 0 || project.items.some(item => !item.internalOnly && item.category !== 'crew')) {
    const rentalNote =
      rental.mode === 'fixed'
        ? '整檔固定租金'
        : rental.mode === 'periods'
        ? '檔期租金合計'
        : '品項租賃合計';

    rows.push({
      title: '器材租賃費用',
      content: '如附件',
      amount: rentalSubtotal,
      note: rentalNote,
    });
  }

  // Stage Lines (each stage billed once)
  for (const stage of stages) {
    const totals = calcWorkStage(stage);
    const hasVisible = stage.items.some(i => !i.internalOnly);
    const isFixedNonzero = stage.pricingMode === 'fixed' && stage.fixedAmount !== 0;
    const hasNote = Boolean(stage.note && stage.note.trim().length > 0);

    // Skip empty no-charge stages
    if (!hasVisible && !isFixedNonzero && !hasNote) continue;

    const schedule = [
      formatDateRange(stage.startDate, stage.endDate),
      stage.time,
      stage.note,
    ]
      .filter(Boolean)
      .join(' · ');

    rows.push({
      title: `${stage.name} 階段費用`,
      content: '如附件',
      amount: totals.subtotal,
      note: schedule,
    });
  }

  return (
    <div className="w-full mb-2">
      <table className="w-full text-[13px] table-fixed border-collapse border border-black">
        <thead className="bg-white text-center">
          <tr>
            <th className="border border-black py-1 w-[8%] font-medium">編號</th>
            <th className="border border-black py-1 w-[30%] font-medium">品項</th>
            <th className="border border-black py-1 w-[14%] font-medium">內容</th>
            <th className="border border-black py-1 w-[20%] font-medium">價格</th>
            <th className="border border-black py-1 w-[28%] font-medium">備註</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="break-inside-avoid">
              <td className="border border-black py-2 text-center align-middle font-mono">
                {idx + 1}
              </td>
              <td className="border border-black py-2 px-2 align-middle font-bold">
                {row.title}
              </td>
              <td className="border border-black py-2 px-2 text-center align-middle text-gray-600">
                {row.content}
              </td>
              <td className="border border-black py-2 px-2 text-right align-middle font-mono font-bold">
                {formatCurrency(row.amount)}
              </td>
              <td className="border border-black py-2 px-2 align-middle text-xs text-slate-600">
                {row.note}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface CostProps {
  project: Project;
  rentalSubtotal: number;
  stagesSubtotal: number;
  subtotal: number;
  costSubtotal: number;
  tax: number;
  total: number;
  costTax: number;
  costTotal: number;
}

/**
 * Cost Report Table (New Stage Pricing)
 * - All stage line costs included independent of displayMode, rental rates, or fixed prices.
 * - Avoids fictional per-resource revenue profits when fixed or rate rental or fixed stage pricing applies.
 * - Correct whole-project margin calculated and displayed.
 */
export const StagePricingCostTable: React.FC<CostProps> = ({
  project,
  rentalSubtotal,
  stagesSubtotal,
  subtotal,
  costSubtotal,
  tax,
  total,
  costTax,
  costTotal,
}) => {
  if (!project.pricing) return null;
  const { rental, stages } = project.pricing;

  const isFixedRental = rental.mode === 'fixed';
  const isPeriodsRental = rental.mode === 'periods';
  const isItemizedRental = rental.mode === 'itemized';

  let equipmentCostSubtotal = 0;
  for (const item of project.items) {
    equipmentCostSubtotal += calcCostTotal(item);
  }

  let stagesCostSubtotal = 0;
  for (const stage of stages) {
    stagesCostSubtotal += calcWorkStage(stage).costSubtotal;
  }

  const grossProfit = subtotal - costSubtotal;
  const grossProfitRate = subtotal > 0 ? (grossProfit / subtotal) * 100 : 0;

  let itemCounter = 0;

  return (
    <div className="w-full mb-4">
      {/* 1. Equipment Rental Section */}
      <div className="mb-6">
        <div className="font-bold border-t-2 border-black border-l border-r bg-slate-800 text-white px-2 py-1 text-sm print:bg-slate-800 print:text-white print:print-color-adjust-exact flex justify-between items-center">
          <span>器材租賃成本明細</span>
          <span className="text-xs font-normal text-slate-200">
            計費模式：{isFixedRental ? '整檔固定金額' : isPeriodsRental ? '檔期租賃計費' : '器材明細加總'}
          </span>
        </div>

        <table className="w-full text-[13px] table-fixed border-collapse border border-black">
          <thead className="bg-white text-center">
            <tr>
              <th className="border border-black py-1 w-[5%] font-medium">編號</th>
              <th className="border border-black py-1 w-[25%] font-medium text-left px-2">品名</th>
              <th className="border border-black py-1 w-[8%] font-medium">數量</th>
              {isItemizedRental ? (
                <>
                  <th className="border border-black py-1 w-[10%] font-medium text-right px-2">客報單價</th>
                  <th className="border border-black py-1 w-[12%] font-medium text-right px-2">客報金額</th>
                  <th className="border border-black py-1 w-[10%] font-medium text-right px-2">成本單價</th>
                  <th className="border border-black py-1 w-[12%] font-medium text-right px-2">成本金額</th>
                  <th className="border border-black py-1 w-[11%] font-medium text-right px-2">利潤</th>
                  <th className="border border-black py-1 w-[7%] font-medium">利潤率</th>
                </>
              ) : (
                <>
                  <th className="border border-black py-1 w-[12%] font-medium text-right px-2">參考單價</th>
                  <th className="border border-black py-1 w-[14%] font-medium text-right px-2">參考金額</th>
                  <th className="border border-black py-1 w-[12%] font-medium text-right px-2">成本單價</th>
                  <th className="border border-black py-1 w-[14%] font-medium text-right px-2">成本金額</th>
                  <th className="border border-black py-1 w-[10%] font-medium text-left px-2">備註</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {project.items.map(item => {
              itemCounter++;
              const clientTot = item.internalOnly || item.category === 'crew' ? 0 : calcClientTotal(item);
              const costTot = calcCostTotal(item);
              const profit = clientTot - costTot;
              const margin = clientTot > 0 ? (profit / clientTot) * 100 : 0;

              return (
                <tr key={item.id} className="break-inside-avoid">
                  <td className="border border-black py-1.5 text-center align-top font-mono">
                    {itemCounter}
                  </td>
                  <td className="border border-black py-1.5 px-2 align-top font-bold">
                    {item.name}
                    {item.internalOnly && (
                      <span className="ml-1 text-xs bg-slate-200 text-slate-700 px-1 py-0.5 rounded font-normal">
                        內部專用
                      </span>
                    )}
                  </td>
                  <td className="border border-black py-1.5 px-2 text-center align-top">
                    {item.quantity} {item.unit}
                  </td>
                  {isItemizedRental ? (
                    <>
                      <td className="border border-black py-1.5 px-2 text-right align-top font-mono">
                        {formatCurrency(item.price)}
                      </td>
                      <td className="border border-black py-1.5 px-2 text-right align-top font-mono font-bold">
                        {formatCurrency(clientTot)}
                      </td>
                      <td className="border border-black py-1.5 px-2 text-right align-top font-mono">
                        {formatCurrency(item.costPrice || 0)}
                      </td>
                      <td className="border border-black py-1.5 px-2 text-right align-top font-mono">
                        {formatCurrency(costTot)}
                      </td>
                      <td className="border border-black py-1.5 px-2 text-right align-top font-mono font-bold">
                        {formatCurrency(profit)}
                      </td>
                      <td
                        className={`border border-black py-1.5 px-2 text-center align-top font-bold ${
                          margin >= 30 ? 'text-emerald-700' : margin >= 10 ? 'text-amber-700' : 'text-red-600'
                        }`}
                      >
                        {margin.toFixed(0)}%
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="border border-black py-1.5 px-2 text-right align-top font-mono text-slate-500">
                        {formatCurrency(item.price)}
                      </td>
                      <td className="border border-black py-1.5 px-2 text-right align-top font-mono text-slate-500">
                        {formatCurrency(clientTot)}
                      </td>
                      <td className="border border-black py-1.5 px-2 text-right align-top font-mono">
                        {formatCurrency(item.costPrice || 0)}
                      </td>
                      <td className="border border-black py-1.5 px-2 text-right align-top font-mono font-bold">
                        {formatCurrency(costTot)}
                      </td>
                      <td className="border border-black py-1.5 px-2 align-top text-xs text-slate-500">
                        {item.internalOnly ? '內部器材' : '規格參考'}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t-2 border-black font-bold print:bg-slate-50 print:print-color-adjust-exact text-[13px]">
              <td colSpan={3} className="border border-black py-2 px-3 text-right">
                器材租賃收入合計（未稅）
              </td>
              <td
                colSpan={isItemizedRental ? 3 : 2}
                className="border border-black py-2 px-3 text-left font-mono text-sm text-slate-900"
              >
                {formatCurrency(rentalSubtotal)}
              </td>
              <td className="border border-black py-2 px-2 text-right">成本合計</td>
              <td
                colSpan={2}
                className="border border-black py-2 px-2 text-right font-mono text-sm text-slate-900"
              >
                {formatCurrency(equipmentCostSubtotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 2. Stages Cost Sections (all stage line items shown, independent of displayMode) */}
      <div className="mb-6">
        <div className="font-bold border-t-2 border-black border-l border-r bg-slate-800 text-white px-2 py-1 text-sm print:bg-slate-800 print:text-white print:print-color-adjust-exact">
          各階段工項成本分析（顯示全數實際工項成本）
        </div>

        {stages.map(stage => {
          const stageTotals = calcWorkStage(stage);
          const isFixedStage = stage.pricingMode === 'fixed';
          const stageProfit = stageTotals.subtotal - stageTotals.costSubtotal;
          const stageMargin =
            stageTotals.subtotal > 0
              ? (stageProfit / stageTotals.subtotal) * 100
              : 0;

          const schedule = [
            formatDateRange(stage.startDate, stage.endDate),
            stage.time,
            stage.note,
          ]
            .filter(Boolean)
            .join(' · ');

          return (
            <div key={stage.id} className="mb-4 border border-black">
              <div className="font-bold bg-slate-100 px-3 py-1.5 text-xs border-b border-black flex justify-between items-center print:bg-slate-100 print:print-color-adjust-exact">
                <div>
                  <span className="text-sm font-bold">【{stage.name}】階段</span>
                  {schedule && (
                    <span className="text-slate-600 font-normal ml-2">（{schedule}）</span>
                  )}
                </div>
                <div className="text-slate-700">
                  階段計價：{isFixedStage ? `固定金額 (${formatCurrency(stage.fixedAmount)})` : '明細加總'}
                </div>
              </div>

              <table className="w-full text-[13px] table-fixed border-collapse">
                <thead className="bg-white text-center border-b border-black">
                  <tr>
                    <th className="border-r border-black py-1 w-[5%] font-medium">編號</th>
                    <th className="border-r border-black py-1 w-[25%] font-medium text-left px-2">工項名稱</th>
                    <th className="border-r border-black py-1 w-[8%] font-medium">數量</th>
                    <th className="border-r border-black py-1 w-[8%] font-medium">單位</th>
                    <th className="border-r border-black py-1 w-[10%] font-medium">工期/天數</th>
                    {isFixedStage ? (
                      <>
                        <th className="border-r border-black py-1 w-[12%] font-medium text-right px-2">參考單價</th>
                        <th className="border-r border-black py-1 w-[11%] font-medium text-right px-2">成本單價</th>
                        <th className="border-r border-black py-1 w-[13%] font-medium text-right px-2">成本金額</th>
                        <th className="py-1 w-[8%] font-medium text-left px-2">備註</th>
                      </>
                    ) : (
                      <>
                        <th className="border-r border-black py-1 w-[9%] font-medium text-right px-2">客報金額</th>
                        <th className="border-r border-black py-1 w-[9%] font-medium text-right px-2">成本單價</th>
                        <th className="border-r border-black py-1 w-[9%] font-medium text-right px-2">成本金額</th>
                        <th className="border-r border-black py-1 w-[9%] font-medium text-right px-2">利潤</th>
                        <th className="py-1 w-[8%] font-medium">利潤率</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {stage.items.length === 0 ? (
                    <tr>
                      <td colSpan={isFixedStage ? 9 : 10} className="py-2 text-center text-slate-500 text-xs">
                        {isFixedStage ? `本階段無登錄細項，約定收入：${formatCurrency(stage.fixedAmount)}` : '本階段未安排人力或其他費用'}
                      </td>
                    </tr>
                  ) : (
                    stage.items.map((item, idx) => {
                      const lineClientTot = calcStageItemTotal(item);
                      const lineCostTot = calcStageItemCost(item);
                      const lineProfit = lineClientTot - lineCostTot;
                      const lineMargin =
                        lineClientTot > 0 ? (lineProfit / lineClientTot) * 100 : 0;

                      return (
                        <tr key={item.id} className="border-b border-black last:border-b-0 break-inside-avoid">
                          <td className="border-r border-black py-1.5 text-center font-mono">{idx + 1}</td>
                          <td className="border-r border-black py-1.5 px-2 font-bold">
                            {item.name}
                            {item.internalOnly && (
                              <span className="ml-1 text-xs bg-slate-200 text-slate-700 px-1 py-0.5 rounded font-normal">
                                內部成本
                              </span>
                            )}
                          </td>
                          <td className="border-r border-black py-1.5 px-2 text-center">{item.quantity}</td>
                          <td className="border-r border-black py-1.5 px-2 text-center">{item.unit}</td>
                          <td className="border-r border-black py-1.5 px-2 text-center font-mono">
                            {item.duration} {item.durationUnit}
                          </td>
                          {isFixedStage ? (
                            <>
                              <td className="border-r border-black py-1.5 px-2 text-right font-mono text-slate-500">
                                {formatCurrency(item.price)}
                              </td>
                              <td className="border-r border-black py-1.5 px-2 text-right font-mono">
                                {formatCurrency(item.costPrice)}
                              </td>
                              <td className="border-r border-black py-1.5 px-2 text-right font-mono font-bold">
                                {formatCurrency(lineCostTot)}
                              </td>
                              <td className="py-1.5 px-2 text-xs text-slate-500">{item.note}</td>
                            </>
                          ) : (
                            <>
                              <td className="border-r border-black py-1.5 px-2 text-right font-mono font-bold">
                                {formatCurrency(lineClientTot)}
                              </td>
                              <td className="border-r border-black py-1.5 px-2 text-right font-mono">
                                {formatCurrency(item.costPrice)}
                              </td>
                              <td className="border-r border-black py-1.5 px-2 text-right font-mono">
                                {formatCurrency(lineCostTot)}
                              </td>
                              <td className="border-r border-black py-1.5 px-2 text-right font-mono font-bold">
                                {formatCurrency(lineProfit)}
                              </td>
                              <td
                                className={`py-1.5 px-2 text-center font-bold ${
                                  lineMargin >= 30
                                    ? 'text-emerald-700'
                                    : lineMargin >= 10
                                    ? 'text-amber-700'
                                    : 'text-red-600'
                                }`}
                              >
                                {lineMargin.toFixed(0)}%
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-black font-bold text-xs print:bg-slate-50 print:print-color-adjust-exact">
                    <td colSpan={5} className="py-2 px-3 text-right">
                      階段收入：<span className="font-mono text-sm">{formatCurrency(stageTotals.subtotal)}</span>
                    </td>
                    <td colSpan={isFixedStage ? 2 : 3} className="py-2 px-3 text-right">
                      階段成本：<span className="font-mono text-sm">{formatCurrency(stageTotals.costSubtotal)}</span>
                    </td>
                    <td colSpan={2} className="py-2 px-3 text-right text-emerald-800">
                      階段毛利：<span className="font-mono text-sm">{formatCurrency(stageProfit)}</span> ({stageMargin.toFixed(1)}%)
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })}
      </div>

      {/* 3. Project-wide Cost and Profit Summary */}
      <div className="w-full mb-4">
        <table className="w-full text-[13px] border-collapse border-2 border-black">
          <tbody>
            <tr className="border border-black bg-slate-50 print:bg-slate-50 print:print-color-adjust-exact">
              <td className="py-2 px-3 font-bold w-[50%]">器材租賃收入（未稅）</td>
              <td className="py-2 px-3 text-right font-mono font-bold">{formatCurrency(rentalSubtotal)}</td>
            </tr>
            <tr className="border border-black">
              <td className="py-2 px-3 font-bold">器材成本合計（未稅）</td>
              <td className="py-2 px-3 text-right font-mono">{formatCurrency(equipmentCostSubtotal)}</td>
            </tr>
            <tr className="border border-black bg-slate-50 print:bg-slate-50 print:print-color-adjust-exact">
              <td className="py-2 px-3 font-bold">各階段工程收入（未稅）</td>
              <td className="py-2 px-3 text-right font-mono font-bold">{formatCurrency(stagesSubtotal)}</td>
            </tr>
            <tr className="border border-black">
              <td className="py-2 px-3 font-bold">各階段成本合計（未稅）</td>
              <td className="py-2 px-3 text-right font-mono">{formatCurrency(stagesCostSubtotal)}</td>
            </tr>
            <tr className="border-t-2 border-black">
              <td className="py-2 px-3 font-bold text-base">專案客報合計（未稅）</td>
              <td className="py-2 px-3 text-right font-mono font-bold text-base">{formatCurrency(subtotal)}</td>
            </tr>
            <tr className="border border-black">
              <td className="py-2 px-3 font-bold text-base">專案成本合計（未稅）</td>
              <td className="py-2 px-3 text-right font-mono font-bold text-base">{formatCurrency(costSubtotal)}</td>
            </tr>
            <tr className="border border-black bg-emerald-50 print:bg-emerald-50 print:print-color-adjust-exact">
              <td className="py-2 px-3 font-bold text-emerald-800 text-base">專案毛利（未稅）</td>
              <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800 text-base">
                {formatCurrency(grossProfit)} <span className="text-xs">({grossProfitRate.toFixed(1)}%)</span>
              </td>
            </tr>
            <tr className="border border-black">
              <td className="py-2 px-3 font-bold">客報含稅 ({(project.taxRate * 100).toFixed(0)}%)</td>
              <td className="py-2 px-3 text-right font-mono font-bold">{formatCurrency(total)}</td>
            </tr>
            <tr className="border border-black">
              <td className="py-2 px-3 font-bold">成本含稅</td>
              <td className="py-2 px-3 text-right font-mono">{formatCurrency(costTotal)}</td>
            </tr>
            <tr className="border border-black bg-emerald-100 print:bg-emerald-100 print:print-color-adjust-exact">
              <td className="py-2 px-3 font-bold text-emerald-900 text-base">專案淨利（含稅）</td>
              <td className="py-2 px-3 text-right font-mono font-bold text-emerald-900 text-lg">
                {formatCurrency(total - costTotal)}
              </td>
            </tr>
            {project.negotiatedPrice != null && project.negotiatedPrice > 0 && (
              <>
                <tr className="border border-black bg-amber-50 print:bg-amber-50 print:print-color-adjust-exact">
                  <td className="py-2 px-3 font-bold text-amber-800">議價後金額（含稅）</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-amber-800">
                    {formatCurrency(project.negotiatedPrice)}
                  </td>
                </tr>
                <tr className="border border-black bg-amber-100 print:bg-amber-100 print:print-color-adjust-exact">
                  <td className="py-2 px-3 font-bold text-amber-900 text-base">議價後淨利</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-amber-900 text-lg">
                    {formatCurrency(project.negotiatedPrice - costTotal)}{' '}
                    <span className="text-xs">
                      ({costTotal > 0
                        ? (((project.negotiatedPrice - costTotal) / project.negotiatedPrice) * 100).toFixed(1)
                        : 0}
                      %)
                    </span>
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
