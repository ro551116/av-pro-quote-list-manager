import React, { useState } from 'react';
import { Project, Category, Subcontract } from '../types';
import { CATEGORIES } from '../constants';
import { formatCurrency, formatDate, calcClientTotal, calcCostTotal, calcBaseSubtotal, calcChargeAmount, calcGrandSubtotal } from '../utils/helpers';
import { ArrowLeft, FileDown, ArrowRightLeft, Loader2 } from 'lucide-react';

// Declare html2pdf for TypeScript
declare var html2pdf: any;

interface PrintLayoutProps {
  type: 'quote' | 'list' | 'subcontract';
  project: Project;
  subcontract?: Subcontract;
  onBack: () => void;
  onSwitchType?: () => void;
}

export const PrintLayout: React.FC<PrintLayoutProps> = ({ type, project, subcontract, onBack, onSwitchType }) => {
  const isQuote = type === 'quote';
  const isList = type === 'list';
  const isSubcontract = type === 'subcontract';
  const [isGenerating, setIsGenerating] = useState(false);

  const visibleItems = isSubcontract
    ? project.items.filter(item => subcontract?.itemIds.includes(item.id))
    : isQuote
      ? project.items.filter(item => !item.internalOnly)
      : project.items;

  const charges = project.periodCharges || [];
  const baseSubtotal = calcBaseSubtotal(project.items);

  const subtotal = charges.length > 0
    ? calcGrandSubtotal(baseSubtotal, charges)
    : baseSubtotal;
  const tax = subtotal * project.taxRate;
  const total = subtotal + tax;

  const costSubtotal = visibleItems.reduce((acc, item) => acc + calcCostTotal(item), 0);
  const costTax = Math.round(costSubtotal * project.taxRate);
  const costTotal = costSubtotal + costTax;

  const typeLabel = isQuote ? '報價單' : isList ? '器材清單' : '發包單';
  const nextLabel = isQuote ? '器材清單' : isList ? '報價單' : '';

  const handleDownloadPDF = () => {
    const isMobileOrTablet = window.innerWidth < 1024;

    if (isMobileOrTablet) {
      window.print();
      return;
    }

    setIsGenerating(true);
    const element = document.getElementById('printable-content');

    const opt = {
      margin:       5,
      filename:     `${project.name}_${typeLabel}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };

    setTimeout(() => {
        if (typeof html2pdf !== 'undefined') {
            html2pdf().set(opt).from(element).save().then(() => {
                setIsGenerating(false);
            }).catch((err: any) => {
                console.error('PDF Generation Error:', err);
                setIsGenerating(false);
                alert('PDF 生成失敗，將開啟系統列印視窗');
                window.print();
            });
        } else {
            window.print();
            setIsGenerating(false);
        }
    }, 100);
  };

  // Continuous numbering counter
  let itemCounter = 0;

  return (
    <div className="flex flex-col h-full bg-slate-100 print:bg-white print:block print:h-auto">
      {/* Print Control Bar */}
      <div className="bg-white p-4 border-b border-slate-200 flex justify-between items-center shadow-sm z-30 sticky top-0 no-print">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-slate-800 leading-none">
              預覽: {typeLabel}{isSubcontract && subcontract ? ` — ${subcontract.vendorName || '未命名廠商'}` : ''}
            </h2>
            <span className="text-xs text-slate-400 mt-1">
              {isQuote && '包含金額與條款'}
              {isList && '顯示內部細項、出庫勾選框'}
              {isSubcontract && '發包至協力廠商，含成本金額'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onSwitchType && !isSubcontract && (
            <button
              onClick={onSwitchType}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium transition-all border border-slate-200 hidden md:flex"
            >
              <ArrowRightLeft size={16} />
              切換為{nextLabel}
            </button>
          )}

          <button
            onClick={handleDownloadPDF}
            disabled={isGenerating}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-primary-500/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />}
            <span className="hidden md:inline">{isGenerating ? '生成中...' : '下載 PDF'}</span>
            <span className="md:hidden">存成 PDF</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center bg-slate-200 print:p-0 print:m-0 print:bg-white print:overflow-visible">
        <div className="bg-white shadow-xl print:shadow-none w-full max-w-[210mm] min-h-[297mm] print:min-h-0 print:w-full print:max-w-none relative font-serif">

           <div id="printable-content" className="w-full h-auto p-[10mm] md:p-[15mm] bg-white text-black box-border flex flex-col">

              {/* --- Header Style "EIR" --- */}
              <div className="flex justify-center mb-4">
                 <div className="relative h-16 md:h-20 flex items-center justify-center">
                     <img
                         src="/logo.png"
                         alt="Company Logo"
                         className="h-full w-auto object-contain"
                         onError={(e) => {
                             e.currentTarget.style.display = 'none';
                             if (e.currentTarget.nextElementSibling) {
                                 (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
                             }
                         }}
                     />
                     <div className="hidden relative border-[3px] border-black px-3 py-1 rounded-xl">
                         <h1 className="text-5xl font-serif font-extrabold tracking-widest text-black transform scale-x-125">
                             EIR
                         </h1>
                     </div>
                 </div>
              </div>

              {/* Green Title Bar */}
              <div className="bg-[#8bf136] text-center text-xl font-bold py-1 border-t-2 border-b-2 border-black mb-4 print:bg-[#8bf136] print:print-color-adjust-exact">
                 宇珅活動有限公司{typeLabel}
              </div>

              {/* Info Grid */}
              {isSubcontract && subcontract ? (
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-6 px-2 text-[13px] font-medium leading-relaxed">
                   <div className="space-y-1">
                       <div className="flex">
                          <span className="w-[70px] text-justify-last text-justify inline-block after:content-[''] after:inline-block after:w-full">協力廠商</span>
                          <span className="px-1">:</span>
                          <span className="flex-1 font-bold">{subcontract.vendorName}</span>
                       </div>
                       <div className="flex">
                          <span className="w-[70px] text-justify-last text-justify inline-block after:content-[''] after:inline-block after:w-full">統一編號</span>
                          <span className="px-1">:</span>
                          <span className="flex-1">{subcontract.vendorTaxId}</span>
                       </div>
                       <div className="flex">
                          <span className="w-[70px] text-justify-last text-justify inline-block after:content-[''] after:inline-block after:w-full">聯繫人</span>
                          <span className="px-1">:</span>
                          <span className="flex-1">{subcontract.vendorContact}</span>
                       </div>
                       <div className="flex">
                          <span className="w-[70px] text-justify-last text-justify inline-block after:content-[''] after:inline-block after:w-full">電話</span>
                          <span className="px-1">:</span>
                          <span className="flex-1">{subcontract.vendorPhone}</span>
                       </div>
                   </div>
                   <div className="space-y-1">
                       <div className="flex">
                          <span className="w-[70px] text-justify-last text-justify inline-block after:content-[''] after:inline-block after:w-full">活動名稱</span>
                          <span className="px-1">:</span>
                          <span className="flex-1 font-bold">{project.name}</span>
                       </div>
                       <div className="flex">
                          <span className="w-[70px] text-justify-last text-justify inline-block after:content-[''] after:inline-block after:w-full">活動地點</span>
                          <span className="px-1">:</span>
                          <span className="flex-1">{project.location}</span>
                       </div>
                       <div className="flex">
                          <span className="w-[70px] text-justify-last text-justify inline-block after:content-[''] after:inline-block after:w-full">進撤場日期</span>
                          <span className="px-1">:</span>
                          <span className="flex-1">{project.moveInDate} ~ {project.moveOutDate}</span>
                       </div>
                       <div className="flex">
                          <span className="w-[70px] text-justify-last text-justify inline-block after:content-[''] after:inline-block after:w-full">交台時間</span>
                          <span className="px-1">:</span>
                          <span className="flex-1">{subcontract.handoverTime}</span>
                       </div>
                   </div>
                </div>
              ) : (
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-6 px-2 text-[13px] font-medium leading-relaxed">
                 {/* Left Column */}
                 <div className="space-y-1">
                     <div className="flex">
                        <span className="w-[70px] text-justify-last text-justify inline-block after:content-[''] after:inline-block after:w-full">客戶名稱</span>
                        <span className="px-1">:</span>
                        <span className="flex-1 font-bold">{project.client}</span>
                     </div>
                     <div className="flex">
                        <span className="w-[70px] text-justify-last text-justify inline-block after:content-[''] after:inline-block after:w-full">活動名稱</span>
                        <span className="px-1">:</span>
                        <span className="flex-1 font-bold">{project.name}</span>
                     </div>
                     <div className="flex">
                        <span className="w-[70px] text-justify-last text-justify inline-block after:content-[''] after:inline-block after:w-full">聯繫人</span>
                        <span className="px-1">:</span>
                        <span className="flex-1">{project.contact}</span>
                     </div>
                     <div className="flex">
                        <span className="w-[70px] text-justify-last text-justify inline-block after:content-[''] after:inline-block after:w-full">電話</span>
                        <span className="px-1">:</span>
                        <span className="flex-1">{project.phone}</span>
                     </div>
                     <div className="flex">
                        <span className="w-[70px] text-justify-last text-justify inline-block after:content-[''] after:inline-block after:w-full">統一編號</span>
                        <span className="px-1">:</span>
                        <span className="flex-1">{project.taxId}</span>
                     </div>
                 </div>

                 {/* Right Column */}
                 <div className="space-y-1">
                     <div className="flex">
                        <span className="w-[70px] text-justify-last text-justify inline-block after:content-[''] after:inline-block after:w-full">活動地點</span>
                        <span className="px-1">:</span>
                        <span className="flex-1">{project.location}</span>
                     </div>
                     <div className="flex">
                        <span className="w-[70px] text-justify-last text-justify inline-block after:content-[''] after:inline-block after:w-full">進場日期</span>
                        <span className="px-1">:</span>
                        <span className="flex-1">{project.moveInDate || `${project.date} 09:00`}</span>
                     </div>
                     <div className="flex">
                        <span className="w-[70px] text-justify-last text-justify inline-block after:content-[''] after:inline-block after:w-full">活動日期</span>
                        <span className="px-1">:</span>
                        <span className="flex-1">{project.date} {project.activityTime}</span>
                     </div>
                     <div className="flex">
                        <span className="w-[70px] text-justify-last text-justify inline-block after:content-[''] after:inline-block after:w-full">撤場日期</span>
                        <span className="px-1">:</span>
                        <span className="flex-1">{project.moveOutDate || `${project.date} 18:00`}</span>
                     </div>
                     <div className="flex">
                        <span className="w-[70px] text-justify-last text-justify inline-block after:content-[''] after:inline-block after:w-full">檔期</span>
                        <span className="px-1">:</span>
                        <span className="flex-1 font-bold">
                          {charges.length > 0
                            ? `${charges.length} 天 (${charges.map(c => c.label).filter(Boolean).join('+')})`
                            : `${project.period || 1} 天`
                          }
                        </span>
                     </div>
                 </div>
              </div>
              )}

              {/* Sales Info Row (not for subcontract) */}
              {!isSubcontract && <div className="flex flex-wrap justify-between px-2 mb-4 text-[13px] border-b-2 border-transparent">
                  <div className="flex gap-2">
                      <span className="w-[40px] text-justify-last text-justify inline-block after:content-[''] after:inline-block after:w-full">業務</span>
                      <span>聯繫人</span>
                      <span className="font-bold ml-2">林宇珅</span>
                  </div>
                  <div className="flex gap-2">
                      <span>電話</span>
                      <span className="font-bold ml-2">0912-345-678</span>
                  </div>
                  <div className="flex gap-2">
                      <span>製表日期</span>
                      <span className="font-mono ml-2">{new Date().toLocaleDateString('zh-TW', {year: '2-digit', month: '2-digit', day: '2-digit'}).replace(/\//g, '')}</span>
                  </div>
                  <div className="flex gap-2">
                      <span>單號</span>
                      <span className="font-mono ml-2 font-bold">{project.id.substring(0,6).toUpperCase()}</span>
                  </div>
              </div>}

              {/* --- Table Sections --- */}
              <div className="w-full mb-2">
                {CATEGORIES.map((cat) => {
                  const catItems = visibleItems.filter(i => i.category === cat.id);
                  if (catItems.length === 0) return null;

                  return (
                    <div key={cat.id} className="mb-4">
                      <div className="font-bold border-t-2 border-black border-l border-r bg-gray-100 px-2 py-1 text-sm print:bg-gray-100 print:print-color-adjust-exact">
                          {cat.label}
                      </div>

                      <table className="w-full text-[13px] table-fixed border-collapse border border-black">
                          <thead className="bg-white text-center">
                              <tr>
                                  <th className="border border-black py-1 w-[5%] font-medium">編號</th>
                                  {isQuote && (
                                    <>
                                        <th className="border border-black py-1 w-[28%] font-medium">品名</th>
                                        <th className="border border-black py-1 w-[8%] font-medium">數量</th>
                                        <th className="border border-black py-1 w-[8%] font-medium">單位</th>
                                        <th className="border border-black py-1 w-[13%] font-medium">單價</th>
                                        <th className="border border-black py-1 w-[15%] font-medium">金額</th>
                                        <th className="border border-black py-1 w-[23%] font-medium">備註</th>
                                    </>
                                  )}
                                  {isList && (
                                    <>
                                        <th className="border border-black py-1 w-[38%] font-medium">品項 / 詳細內容</th>
                                        <th className="border border-black py-1 w-[10%] font-medium">數量</th>
                                        <th className="border border-black py-1 w-[8%] font-medium text-xs">出庫</th>
                                        <th className="border border-black py-1 w-[8%] font-medium text-xs">回庫</th>
                                        <th className="border border-black py-1 w-[28%] font-medium">備註</th>
                                    </>
                                  )}
                                  {isSubcontract && (
                                    <>
                                        <th className="border border-black py-1 w-[35%] font-medium">品名</th>
                                        <th className="border border-black py-1 w-[10%] font-medium">數量</th>
                                        <th className="border border-black py-1 w-[10%] font-medium">單位</th>
                                        <th className="border border-black py-1 w-[40%] font-medium">備註</th>
                                    </>
                                  )}
                              </tr>
                          </thead>
                          <tbody>
                              {catItems.map((item) => {
                                itemCounter++;
                                return (
                                  <tr key={item.id} className="break-inside-avoid">
                                      <td className="border border-black py-2 text-center align-top font-mono">
                                          {itemCounter}
                                      </td>

                                      {isQuote && (
                                        <>
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
                                            <td className="border border-black py-2 px-2 text-right align-top font-mono">
                                                {formatCurrency(item.price)}
                                            </td>
                                            <td className="border border-black py-2 px-2 text-right align-top font-mono font-bold">
                                                {formatCurrency(calcClientTotal(item))}
                                            </td>
                                            <td className="border border-black py-2 px-2 align-top text-xs">
                                                {item.note}
                                            </td>
                                        </>
                                      )}
                                      {isList && (
                                        <>
                                            <td className="border border-black py-2 px-2 align-top">
                                                <div className="font-bold text-sm">{item.name}</div>
                                                {item.subItems && item.subItems.length > 0 && (
                                                    <ul className="list-disc list-inside text-xs text-slate-700 mt-1 leading-tight">
                                                        {item.subItems.map((sub, i) => (
                                                            <li key={i}>{sub}</li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </td>
                                            <td className="border border-black py-2 px-2 text-center align-top font-bold">
                                                {item.quantity} {item.unit}
                                            </td>
                                            <td className="border border-black py-2 px-2 align-top bg-white">
                                                <div className="w-5 h-5 border border-black mx-auto mt-1 bg-white"></div>
                                            </td>
                                            <td className="border border-black py-2 px-2 align-top bg-white">
                                                <div className="w-5 h-5 border border-black mx-auto mt-1 bg-white"></div>
                                            </td>
                                            <td className="border border-black py-2 px-2 align-top text-xs">
                                                {item.note}
                                            </td>
                                        </>
                                      )}
                                      {isSubcontract && (
                                        <>
                                            <td className="border border-black py-2 px-2 align-top font-bold">
                                                {item.name}
                                            </td>
                                            <td className="border border-black py-2 px-2 text-center align-top">
                                                {item.quantity}
                                            </td>
                                            <td className="border border-black py-2 px-2 text-center align-top">
                                                {item.unit}
                                            </td>
                                            <td className="border border-black py-2 px-2 align-top text-xs">
                                                {item.note}
                                            </td>
                                        </>
                                      )}
                                  </tr>
                                );
                              })}
                          </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>

              {/* --- Period Charges Section (Quote only) --- */}
              {isQuote && charges.length > 0 && (
                <div className="w-full mb-2">
                  <div className="font-bold border-t-2 border-black border-l border-r bg-gray-100 px-2 py-1 text-sm print:bg-gray-100 print:print-color-adjust-exact">
                    檔期費用
                  </div>
                  <table className="w-full text-[13px] table-fixed border-collapse border border-black">
                    <thead className="bg-white text-center">
                      <tr>
                        <th className="border border-black py-1 w-[60%] font-medium text-left px-2">項目</th>
                        <th className="border border-black py-1 w-[40%] font-medium text-right px-2">金額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {charges.map((charge) => (
                        <tr key={charge.id} className="break-inside-avoid">
                          <td className="border border-black py-2 px-2 font-bold">
                            {charge.label}
                            {charge.type === 'rate' && (
                              <span className="text-gray-500 font-normal ml-1">({Math.round(charge.value * 100)}%)</span>
                            )}
                          </td>
                          <td className="border border-black py-2 px-2 text-right font-mono font-bold">
                            {formatCurrency(calcChargeAmount(charge, baseSubtotal))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* --- Totals & Footer --- */}
              <div className="break-inside-avoid mt-auto">
                 {isQuote && (
                    <>
                        <div className="flex justify-between items-end mb-6">
                            <div className="flex items-center gap-2 pl-4">
                                <div className="relative w-[75px] h-[75px]">
                                    <img
                                        src="/large-stamp.png"
                                        alt="大章"
                                        className="absolute inset-0 w-full h-full object-contain mix-blend-multiply opacity-90 print:opacity-100 z-10"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            if (e.currentTarget.nextElementSibling) {
                                                (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                                            }
                                        }}
                                    />
                                    <div className="hidden w-full h-full border-[3px] border-red-600 text-red-600 items-center justify-center transform -rotate-2 opacity-90 print:opacity-100 bg-white">
                                        <span className="text-[15px] font-bold leading-tight" style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}>宇珅活動<br/>有限公司</span>
                                    </div>
                                </div>
                                <div className="relative w-[75px] h-[75px]">
                                    <img
                                        src="/small-stamp.png"
                                        alt="小章"
                                        className="absolute inset-0 w-full h-full object-contain mix-blend-multiply opacity-90 print:opacity-100 z-10"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            if (e.currentTarget.nextElementSibling) {
                                                (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                                            }
                                        }}
                                    />
                                    <div className="hidden w-full h-full border-[3px] border-red-600 text-red-600 items-center justify-center transform rotate-3 opacity-90 print:opacity-100 bg-white">
                                        <span className="text-[18px] font-bold leading-tight" style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}>林宇<br/>珅印</span>
                                    </div>
                                </div>
                            </div>

                            <div className="w-[280px] border border-black text-sm">
                                <div className="flex justify-between px-3 py-1 border-b border-black">
                                    <span>未稅合計</span>
                                    <span className="font-mono">{formatCurrency(subtotal)}</span>
                                </div>
                                <div className="flex justify-between px-3 py-1 border-b border-black">
                                    <span>稅金</span>
                                    <span className="font-mono">{formatCurrency(tax)}</span>
                                </div>
                                <div className="flex justify-between px-3 py-1 font-bold bg-gray-50 print:bg-gray-50 print:print-color-adjust-exact">
                                    <span>合計</span>
                                    <span className="font-mono text-lg">{formatCurrency(total)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="border border-black flex min-h-[140px]">
                            <div className="w-[40px] md:w-[50px] border-r border-black flex items-center justify-center bg-gray-50 print:bg-gray-50 print:print-color-adjust-exact">
                                <span className="writing-vertical-lr text-lg font-bold tracking-[0.3em] py-4">簽名處</span>
                            </div>
                            <div className="flex-1 p-4 text-[13px] leading-7 flex items-center relative">
                                <div className="z-10 relative">
                                    請確認後簽名或蓋章回傳本公司，此報價單簽認即視同合約書，若有任何疑問請與承辦業務確認，本估價單有效期限 15 天。
                                </div>
                            </div>
                            <div className="w-[180px] md:w-[200px] border-l border-black relative overflow-hidden flex items-center justify-center p-2">
                                <img
                                    src="/invoice-stamp.png"
                                    alt="發票章"
                                    className="w-[140px] h-auto object-contain mix-blend-multiply opacity-90 print:opacity-100"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        if (e.currentTarget.nextElementSibling) {
                                            (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
                                        }
                                    }}
                                />
                                <div className="hidden border-[3px] border-blue-800 text-blue-800 rounded-lg p-2 text-center w-[150px] relative transform -rotate-3 select-none opacity-90 print:opacity-100">
                                    <div className="text-[10px] font-bold border-b border-blue-800 pb-1 mb-1 tracking-tighter">宇珅活動有限公司</div>
                                    <div className="text-[10px] font-bold tracking-widest scale-x-90">統一發票專用章</div>
                                    <div className="text-xl font-mono font-bold my-1 tracking-widest">52347411</div>
                                    <div className="text-[10px] font-bold tracking-widest scale-x-90">負責人: 林宇珅</div>
                                    <div className="absolute bottom-1 right-2 text-[8px]">新北市</div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-6 mt-6 px-2">
                           <div className="text-center">
                              <p className="font-bold text-sm mb-8">業務 (Sales)</p>
                              <div className="border-b border-black"></div>
                           </div>
                           <div className="text-center">
                              <p className="font-bold text-sm mb-8">客戶簽名 (Client Signature)</p>
                              <div className="border-b border-black"></div>
                           </div>
                           <div className="text-center">
                              <p className="font-bold text-sm mb-8">日期 (Date)</p>
                              <div className="border-b border-black"></div>
                           </div>
                        </div>
                    </>
                 )}

                 {isList && (
                    <div className="grid grid-cols-3 gap-8 mt-8 border-t-2 border-black pt-8">
                        <div className="text-center">
                            <p className="text-sm font-bold mb-8">備貨人員 (Prepared By)</p>
                            <div className="border-b border-black w-3/4 mx-auto"></div>
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-bold mb-8">客戶點收 (Received By)</p>
                            <div className="border-b border-black w-3/4 mx-auto"></div>
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-bold mb-8">歸還檢查 (Checked By)</p>
                            <div className="border-b border-black w-3/4 mx-auto"></div>
                        </div>
                    </div>
                 )}

                 {isSubcontract && (
                    <>
                        <div className="flex justify-end mb-6">
                            <div className="w-[280px] border border-black text-sm">
                                <div className="flex justify-between px-3 py-1 border-b border-black">
                                    <span>未稅合計</span>
                                    <span className="font-mono">{formatCurrency(costSubtotal)}</span>
                                </div>
                                <div className="flex justify-between px-3 py-1 border-b border-black">
                                    <span>5% 稅金</span>
                                    <span className="font-mono">{formatCurrency(costTax)}</span>
                                </div>
                                <div className="flex justify-between px-3 py-1 font-bold bg-gray-50 print:bg-gray-50 print:print-color-adjust-exact">
                                    <span>合計</span>
                                    <span className="font-mono text-lg">{formatCurrency(costTotal)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8 mt-8 border-t-2 border-black pt-8">
                            <div className="text-center">
                                <p className="text-sm font-bold mb-2">承辦公司</p>
                                <p className="text-xs text-gray-500 mb-6">宇珅活動有限公司</p>
                                <div className="border-b border-black w-3/4 mx-auto"></div>
                                <p className="text-xs text-gray-400 mt-1">簽章</p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-bold mb-2">協力廠商</p>
                                <p className="text-xs text-gray-500 mb-6">{subcontract?.vendorName || '_______________'}</p>
                                <div className="border-b border-black w-3/4 mx-auto"></div>
                                <p className="text-xs text-gray-400 mt-1">簽章</p>
                            </div>
                        </div>
                    </>
                 )}

                 <div className="text-center text-xs mt-4 font-medium text-gray-500">
                     (23578)新北市中和區秀峰里景平路71-7號2樓之5
                 </div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};
