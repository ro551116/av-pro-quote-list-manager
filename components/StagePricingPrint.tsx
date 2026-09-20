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
  getScheduleRows,
} from '../utils/helpers';

interface QuoteTableProps {
  project: Project;
  nextIndex: () => number;
}

// Specifications are reference-only; all payable charges appear under their period.
export const StagePricingQuoteEquipmentTable: React.FC<QuoteTableProps> = ({ project, nextIndex }) => {
  if (!project.pricing) return null;
  const items = project.items.filter(item => !item.internalOnly && item.category !== 'crew');
  if (!items.length) return null;
  return (
    <div className="mb-4">
      <div className="mb-1 text-xs text-slate-600">器材明細（規格與價格參考，實際費用統一列於下方檔期）</div>
      {CATEGORIES.map(category => {
        const categoryItems = items.filter(item => item.category === category.id);
        if (!categoryItems.length) return null;
        return (
          <div key={category.id} className="mb-2">
            <div className="border border-b-0 border-black bg-gray-100 px-2 py-1 text-sm font-bold print:print-color-adjust-exact">{category.label}</div>
            <table className="w-full table-fixed border-collapse border border-black text-[13px]">
              <thead>
                <tr>
                  <th className="border border-black py-1 w-[6%] font-medium">編號</th>
                  <th className="border border-black py-1 px-2 w-[30%] text-left font-medium">品名</th>
                  <th className="border border-black py-1 w-[12%] font-medium">數量</th>
                  <th className="border border-black py-1 px-2 w-[15%] text-right font-medium">參考單價</th>
                  <th className="border border-black py-1 px-2 w-[15%] text-right font-medium">參考金額</th>
                  <th className="border border-black py-1 px-2 w-[22%] text-left font-medium">備註</th>
                </tr>
              </thead>
              <tbody>
                {categoryItems.map(item => (
                  <tr key={item.id} className="break-inside-avoid">
                    <td className="border border-black py-1.5 text-center">{nextIndex()}</td>
                    <td className="border border-black px-2 py-1.5 font-bold">
                      {item.name}{!!item.subItems?.length && <div className="text-xs font-normal text-slate-600">如附件</div>}
                    </td>
                    <td className="border border-black px-2 py-1.5 text-center">{item.quantity} {item.unit}</td>
                    <td className="border border-black px-2 py-1.5 text-right font-mono text-slate-600">{formatCurrency(item.price)}</td>
                    <td className="border border-black px-2 py-1.5 text-right font-mono text-slate-600">{formatCurrency(calcClientTotal(item))}</td>
                    <td className="border border-black px-2 py-1.5 text-xs">{item.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
};

const getQuoteScheduleRows = (project: Project) => {
  const hasEquipment = project.items.some(item => !item.internalOnly && item.category !== 'crew');
  return getScheduleRows(project).filter(row =>
    row.periods.length > 0 || (row.wholeEquipment && (hasEquipment || row.equipmentSubtotal !== 0))
    || row.workSubtotal !== 0 || row.stage?.items.some(item => !item.internalOnly) || row.stage?.note?.trim()
  );
};

const QuoteLine: React.FC<{
  index: number;
  name: string;
  quantity: string;
  price?: number;
  amount?: number;
  note?: string;
}> = ({ index, name, quantity, price, amount, note }) => (
  <tr className="break-inside-avoid">
    <td className="border border-black py-1.5 text-center align-top">{index}</td>
    <td className="border border-black px-2 py-1.5 align-top">
      {name}{note && <div className="text-xs text-slate-600">{note}</div>}
    </td>
    <td className="border border-black px-2 py-1.5 text-center align-top">{quantity}</td>
    <td className="border border-black px-2 py-1.5 text-right align-top font-mono">{price === undefined ? '—' : formatCurrency(price)}</td>
    <td className="border border-black px-2 py-1.5 text-right align-top font-mono">{amount === undefined ? '—' : formatCurrency(amount)}</td>
  </tr>
);

export const StagePricingQuoteScheduleTable: React.FC<QuoteTableProps> = ({ project, nextIndex }) => {
  if (!project.pricing) return null;
  const rows = getQuoteScheduleRows(project);
  if (!rows.length) return null;
  return (
    <table className="w-full table-fixed border-collapse border border-black text-[13px] mb-3">
      <caption className="pb-1 text-left text-sm font-bold">檔期與項目</caption>
      <thead>
        <tr>
          <th className="border border-black py-1 w-[6%] font-medium">編號</th>
          <th className="border border-black py-1 px-2 w-[42%] text-left font-medium">項目</th>
          <th className="border border-black py-1 w-[18%] font-medium">數量／工期</th>
          <th className="border border-black py-1 px-2 w-[16%] text-right font-medium">單價</th>
          <th className="border border-black py-1 px-2 w-[18%] text-right font-medium">金額</th>
        </tr>
      </thead>
      {rows.map(row => {
        const stage = row.stage;
        const visibleItems = stage?.items.filter(item => !item.internalOnly) || [];
        const schedule = [formatDateRange(row.startDate, row.endDate), stage?.time].filter(Boolean).join(' ');
        const fixed = stage?.pricingMode === 'fixed';
        const summary = stage?.displayMode === 'summary';
        return (
          <tbody key={row.key}>
            <tr className="bg-gray-100 break-after-avoid print:print-color-adjust-exact">
              <th colSpan={5} className="border border-black px-2 py-1.5 text-left">
                {row.name}
                {schedule && <span className="ml-2 text-xs font-normal text-slate-600">{schedule}</span>}
                {stage?.note && <div className="text-xs font-normal text-slate-600">{stage.note}</div>}
              </th>
            </tr>
            {row.wholeEquipment && (
              <QuoteLine index={nextIndex()} name="器材費用" quantity="1 式"
                price={row.equipmentSubtotal} amount={row.equipmentSubtotal} />
            )}
            {row.periods.map(period => (
              <QuoteLine key={period.id} index={nextIndex()} name={period.label || '器材費用'}
                quantity={`${period.units} 次`}
                price={period.type === 'fixed' ? period.value : undefined}
                amount={calcRentalPeriod(project.items, period)}
                note={formatDateRange(period.startDate, period.endDate)} />
            ))}
            {!summary && visibleItems.map(item => (
              <QuoteLine key={item.id} index={nextIndex()} name={item.name}
                quantity={`${item.quantity} ${item.unit}${item.duration !== 1 ? ` × ${item.duration} ${item.durationUnit}` : ''}`}
                price={fixed ? undefined : item.price}
                amount={fixed ? undefined : calcStageItemTotal(item)}
                note={[item.note, item.subItems?.length ? '如附件' : '', fixed ? '含於工作項目包價' : ''].filter(Boolean).join(' · ')} />
            ))}
            {(summary || fixed) && (visibleItems.length > 0 || row.workSubtotal !== 0) && (
              <QuoteLine index={nextIndex()} name={fixed ? '工作項目包價' : '工作項目'}
                quantity="1 式" price={row.workSubtotal} amount={row.workSubtotal} />
            )}
            <tr className="break-inside-avoid font-bold">
              <td colSpan={4} className="border border-black px-2 py-1.5 text-right">檔期小計（未稅）</td>
              <td className="border border-black px-2 py-1.5 text-right font-mono">{formatCurrency(row.total)}</td>
            </tr>
          </tbody>
        );
      })}
    </table>
  );
};

export const StagePricingCompactTable: React.FC<{ project: Project }> = ({ project }) => {
  if (!project.pricing) return null;
  const rows = getQuoteScheduleRows(project);
  return (
    <table className="w-full table-fixed border-collapse border border-black text-[13px] mb-2">
      <thead>
        <tr>
          <th className="border border-black py-1 w-[8%] font-medium">編號</th>
          <th className="border border-black py-1 px-2 w-[28%] text-left font-medium">檔期</th>
          <th className="border border-black py-1 px-2 w-[42%] text-left font-medium">內容</th>
          <th className="border border-black py-1 px-2 w-[22%] text-right font-medium">金額</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.key} className="break-inside-avoid">
            <td className="border border-black py-2 text-center">{index + 1}</td>
            <td className="border border-black px-2 py-2 font-bold">{row.name}</td>
            <td className="border border-black px-2 py-2">
              如附件
              <div className="text-xs text-slate-600">
                {[formatDateRange(row.startDate, row.endDate), row.stage?.time, row.stage?.note].filter(Boolean).join(' · ')}
              </div>
            </td>
            <td className="border border-black px-2 py-2 text-right font-mono font-bold">{formatCurrency(row.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
          <span>器材成本明細</span>
          <span className="text-xs font-normal text-slate-200">
            計費模式：{isFixedRental ? '整檔固定金額' : isPeriodsRental ? '依檔期計費' : '器材明細加總'}
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
                器材收入合計（未稅）
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
              <td className="py-2 px-3 font-bold w-[50%]">器材收入（未稅）</td>
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
