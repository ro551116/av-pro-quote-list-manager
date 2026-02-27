import React, { useState } from 'react';
import { Project, EquipmentItem, Category, Subcontract, PeriodCharge } from '../types';
import { CATEGORIES, STANDARD_EQUIPMENT_OPTIONS, ACCESSORY_SUGGESTIONS, DEFAULT_PERIOD_PRESETS, DEFAULT_DAY_LABELS } from '../constants';
import { generateId, calcClientTotal, calcProfitMargin, calcBaseSubtotal, calcChargeAmount, calcGrandSubtotal, formatCurrency } from '../utils/helpers';
import { Plus, Trash2, Save, ArrowLeft, X, PlusSquare, ChevronDown, ChevronUp, Package, Tag, ListChecks, Calendar, Clock, Send } from 'lucide-react';

interface ProjectEditorProps {
  project: Project;
  onSave: (project: Project) => void;
  onCancel: () => void;
}

export const ProjectEditor: React.FC<ProjectEditorProps> = ({ project: initialProject, onSave, onCancel }) => {
  const [project, setProject] = useState<Project>(JSON.parse(JSON.stringify(initialProject)));
  const [activeCategoryModal, setActiveCategoryModal] = useState<Category | null>(null);

  // Track expanded items for detail editing
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Input state for adding custom sub-items
  const [customSubItemInput, setCustomSubItemInput] = useState<string>('');
  const [activeInputId, setActiveInputId] = useState<string | null>(null);

  const handleInfoChange = (field: keyof Project, value: any) => {
    setProject(prev => ({ ...prev, [field]: value }));
  };

  // Helper to convert "YYYY-MM-DD HH:mm" to "YYYY-MM-DDTHH:mm" for input
  const toInputDateTime = (str?: string) => {
    if (!str) return '';
    return str.replace(' ', 'T');
  };

  // Helper to convert "YYYY-MM-DDTHH:mm" from input to "YYYY-MM-DD HH:mm"
  const fromInputDateTime = (str: string) => {
    return str.replace('T', ' ');
  };

  const toggleExpandItem = (id: string) => {
    const newSet = new Set(expandedItems);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedItems(newSet);
  };

  const addEmptyItem = (category: Category) => {
    const newItem: EquipmentItem = {
      id: generateId(),
      category,
      name: '',
      quantity: 1,
      unit: '式',
      price: 0,
      note: '',
      days: 1,
      costPrice: 0,
      subItems: [],
      internalOnly: false
    };
    setProject(prev => ({ ...prev, items: [...prev.items, newItem] }));
    setExpandedItems(prev => new Set(prev).add(newItem.id));
  };

  const addSelectedItems = (templateItem: Omit<EquipmentItem, 'id'>) => {
    const newItem: EquipmentItem = {
      ...templateItem,
      id: generateId(),
      days: templateItem.days ?? 1,
      costPrice: templateItem.costPrice ?? 0,
      subItems: templateItem.subItems || [],
      internalOnly: false
    };
    setProject(prev => ({ ...prev, items: [...prev.items, newItem] }));
  };

  const updateItem = (id: string, field: keyof EquipmentItem, value: any) => {
    setProject(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? { ...item, [field]: value } : item)
    }));
  };

  const addSubItem = (itemId: string, subItemName: string) => {
    if (!subItemName.trim()) return;
    setProject(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id === itemId) {
          const currentSubs = item.subItems || [];
          if (!currentSubs.includes(subItemName)) {
            return { ...item, subItems: [...currentSubs, subItemName] };
          }
        }
        return item;
      })
    }));
  };

  const removeSubItem = (itemId: string, indexToRemove: number) => {
    setProject(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id === itemId && item.subItems) {
          return { ...item, subItems: item.subItems.filter((_, idx) => idx !== indexToRemove) };
        }
        return item;
      })
    }));
  };

  const deleteItem = (id: string) => {
    setProject(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  };

  // --- Subcontract CRUD ---
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());

  const addSubcontract = () => {
    const newSub: Subcontract = {
      id: generateId(),
      vendorName: '',
      vendorTaxId: '',
      vendorContact: '',
      vendorPhone: '',
      handoverTime: '',
      itemIds: [],
    };
    setProject(prev => ({ ...prev, subcontracts: [...(prev.subcontracts || []), newSub] }));
    setExpandedSubs(prev => new Set(prev).add(newSub.id));
  };

  const updateSubcontract = (subId: string, field: keyof Subcontract, value: any) => {
    setProject(prev => ({
      ...prev,
      subcontracts: (prev.subcontracts || []).map(s => s.id === subId ? { ...s, [field]: value } : s)
    }));
  };

  const deleteSubcontract = (subId: string) => {
    setProject(prev => ({
      ...prev,
      subcontracts: (prev.subcontracts || []).filter(s => s.id !== subId)
    }));
  };

  const toggleSubcontractItem = (subId: string, itemId: string) => {
    setProject(prev => ({
      ...prev,
      subcontracts: (prev.subcontracts || []).map(s => {
        if (s.id !== subId) return s;
        const has = s.itemIds.includes(itemId);
        return { ...s, itemIds: has ? s.itemIds.filter(id => id !== itemId) : [...s.itemIds, itemId] };
      })
    }));
  };

  const toggleExpandSub = (subId: string) => {
    setExpandedSubs(prev => {
      const next = new Set(prev);
      if (next.has(subId)) next.delete(subId); else next.add(subId);
      return next;
    });
  };

  const itemsByCategory = (catId: Category) => project.items.filter(i => i.category === catId);

  // --- Period Charges CRUD ---
  const charges = project.periodCharges || [];

  const setCharges = (newCharges: PeriodCharge[]) => {
    setProject(prev => ({ ...prev, periodCharges: newCharges }));
  };

  const addCharge = () => {
    setCharges([...charges, { id: generateId(), label: '', type: 'rate', value: 1.0 }]);
  };

  const updateCharge = (id: string, field: keyof PeriodCharge, value: any) => {
    setCharges(charges.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const deleteCharge = (id: string) => {
    setCharges(charges.filter(c => c.id !== id));
  };

  const applyPreset = (preset: typeof DEFAULT_PERIOD_PRESETS[0]) => {
    setCharges(preset.charges.map(c => ({ ...c, id: generateId() })));
  };

  const baseSubtotal = calcBaseSubtotal(project.items);

  const getProfitColor = (item: EquipmentItem) => {
    const margin = calcProfitMargin(item);
    if (margin > 20) return 'text-emerald-600';
    if (margin > 0) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden relative text-slate-900">

      {/* --- Item Selection Modal --- */}
      {activeCategoryModal && (
        <div className="absolute inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <PlusSquare size={20} className="text-primary-500"/>
                選擇器材: {CATEGORIES.find(c => c.id === activeCategoryModal)?.label}
              </h3>
              <button
                onClick={() => setActiveCategoryModal(null)}
                className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-800"
              >
                <X size={24} />
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-2 bg-slate-50/50">
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => {
                    addEmptyItem(activeCategoryModal);
                    setActiveCategoryModal(null);
                  }}
                  className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-slate-300 hover:bg-white hover:border-primary-500 hover:shadow-md transition-all group text-left bg-white"
                >
                  <div className="p-2 bg-slate-100 rounded group-hover:bg-primary-50 text-slate-500 group-hover:text-primary-600 transition-colors">
                    <Plus size={16} />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">新增空白項目 (Add Empty)</div>
                    <div className="text-xs text-slate-500">手動輸入器材名稱與規格</div>
                  </div>
                </button>
                <div className="my-3 border-t border-slate-200 relative">
                   <span className="absolute left-1/2 -top-3 -translate-x-1/2 bg-slate-50 px-2 text-xs text-slate-400">或選擇標準器材</span>
                </div>
                {STANDARD_EQUIPMENT_OPTIONS.filter(i => i.category === activeCategoryModal).map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                       addSelectedItems(option);
                    }}
                    className="flex justify-between items-center p-3 bg-white hover:bg-primary-50/30 rounded-lg border border-slate-200 hover:border-primary-300 transition-all text-left group shadow-sm"
                  >
                    <div>
                      <div className="font-bold text-slate-800">{option.name}</div>
                      <div className="text-xs text-slate-500">{option.note}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                         <div className="text-emerald-600 font-mono text-sm font-bold">${option.price}</div>
                         <div className="text-xs text-slate-400">{option.unit}</div>
                      </div>
                      <Plus size={16} className="text-slate-300 group-hover:text-primary-500" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-white rounded-b-xl flex justify-end">
               <button onClick={() => setActiveCategoryModal(null)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg shadow-sm">
                 完成 (Done)
               </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Main Editor Header --- */}
      <div className="bg-white p-4 border-b border-slate-200 flex justify-between items-center shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-bold text-slate-800">專案編輯</h2>
        </div>
        <button
          onClick={() => onSave(project)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-primary-500/20 transition-all"
        >
          <Save size={18} /> 儲存專案
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
        {/* Project Info Section */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-100 pb-2">
            <span className="w-1.5 h-6 bg-primary-500 rounded-full"></span>
            基本資料 (對應報價單欄位)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* Column 1: Client Info */}
            <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
               <h4 className="text-sm font-bold text-slate-700 mb-2 border-b border-slate-200 pb-1">客戶資訊</h4>
               <div>
                  <label className="block text-slate-500 text-xs font-bold uppercase mb-1">客戶名稱</label>
                  <input type="text" value={project.client} onChange={e => handleInfoChange('client', e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none" placeholder="公司或客戶全名" />
               </div>
               <div>
                  <label className="block text-slate-500 text-xs font-bold uppercase mb-1">統一編號</label>
                  <input type="text" value={project.taxId || ''} onChange={e => handleInfoChange('taxId', e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none" placeholder="例如: 12345678" />
               </div>
               <div>
                  <label className="block text-slate-500 text-xs font-bold uppercase mb-1">聯絡人</label>
                  <input type="text" value={project.contact} onChange={e => handleInfoChange('contact', e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none" />
               </div>
               <div>
                  <label className="block text-slate-500 text-xs font-bold uppercase mb-1">電話</label>
                  <input type="text" value={project.phone || ''} onChange={e => handleInfoChange('phone', e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none" placeholder="手機或市話" />
               </div>
            </div>

            {/* Column 2: Event Info */}
            <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
               <h4 className="text-sm font-bold text-slate-700 mb-2 border-b border-slate-200 pb-1">活動資訊</h4>
               <div>
                  <label className="block text-slate-500 text-xs font-bold uppercase mb-1">活動名稱</label>
                  <input type="text" value={project.name} onChange={e => handleInfoChange('name', e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none" />
               </div>
               <div>
                  <label className="block text-slate-500 text-xs font-bold uppercase mb-1">活動地點</label>
                  <input type="text" value={project.location} onChange={e => handleInfoChange('location', e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none" />
               </div>
               <div>
                  <label className="block text-slate-500 text-xs font-bold uppercase mb-1">稅率 (Tax Rate)</label>
                  <div className="flex items-center gap-2">
                    <input type="number" value={project.taxRate * 100} onChange={e => handleInfoChange('taxRate', parseFloat(e.target.value) / 100)} className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none" />
                    <span className="text-slate-500 font-bold">%</span>
                  </div>
               </div>
            </div>

            {/* Column 3: Schedule */}
            <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
               <h4 className="text-sm font-bold text-slate-700 mb-2 border-b border-slate-200 pb-1">時間安排</h4>

               <div>
                  <label className="block text-slate-500 text-xs font-bold uppercase mb-1 flex items-center gap-1">
                    <Calendar size={12} /> 進場時間 (Move In)
                  </label>
                  <input
                    type="datetime-local"
                    value={toInputDateTime(project.moveInDate)}
                    onChange={e => handleInfoChange('moveInDate', fromInputDateTime(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none font-medium"
                  />
               </div>

               <div>
                  <label className="block text-slate-500 text-xs font-bold uppercase mb-1 flex items-center gap-1">
                     <Calendar size={12} /> 活動日期 (Event Date)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                        type="date"
                        value={project.date}
                        onChange={e => handleInfoChange('date', e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none font-medium"
                    />
                    <div className="relative">
                        <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={project.activityTime || ''}
                            onChange={e => handleInfoChange('activityTime', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-2 py-2 text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none font-medium"
                            placeholder="時間 (e.g. 13:00-17:00)"
                        />
                    </div>
                  </div>
               </div>

               <div>
                  <label className="block text-slate-500 text-xs font-bold uppercase mb-1 flex items-center gap-1">
                    <Calendar size={12} /> 撤場時間 (Move Out)
                  </label>
                  <input
                    type="datetime-local"
                    value={toInputDateTime(project.moveOutDate)}
                    onChange={e => handleInfoChange('moveOutDate', fromInputDateTime(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none font-medium"
                  />
               </div>
            </div>


          </div>
        </div>

        {/* Period Charges Section */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-amber-500 rounded-full"></span>
              檔期設定
            </h3>
            <button
              onClick={addCharge}
              className="flex items-center gap-1 text-sm bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg transition-colors border border-amber-200 font-bold"
            >
              <Plus size={14} /> 新增費用
            </button>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-slate-500 font-bold">快選:</span>
            {DEFAULT_PERIOD_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => applyPreset(preset)}
                className="text-xs bg-slate-100 hover:bg-primary-50 text-slate-600 hover:text-primary-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-primary-300 transition-all font-medium"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Charge Items */}
          <div className="space-y-3">
            {charges.map((charge, idx) => (
              <div key={charge.id} className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-bold text-slate-500">{idx + 1}.</span>
                  <span className="text-sm font-bold text-slate-700 flex-1">{charge.label || '未命名'}</span>
                  <button
                    onClick={() => deleteCharge(charge.id)}
                    className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  {/* Label */}
                  <div className="md:col-span-4">
                    <label className="block text-slate-500 text-[10px] font-bold uppercase mb-1">標籤</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={charge.label}
                        onChange={e => updateCharge(charge.id, 'label', e.target.value)}
                        list={`day-labels-${charge.id}`}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                        placeholder="例如: 活動日"
                      />
                      <datalist id={`day-labels-${charge.id}`}>
                        {DEFAULT_DAY_LABELS.map((l, i) => <option key={i} value={l} />)}
                      </datalist>
                    </div>
                  </div>

                  {/* Type Toggle */}
                  <div className="md:col-span-3">
                    <label className="block text-slate-500 text-[10px] font-bold uppercase mb-1">類型</label>
                    <div className="flex bg-white border border-slate-300 rounded-lg overflow-hidden">
                      <button
                        onClick={() => updateCharge(charge.id, 'type', 'rate')}
                        className={`flex-1 py-2 text-xs font-bold transition-colors ${charge.type === 'rate' ? 'bg-primary-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                      >
                        百分比
                      </button>
                      <button
                        onClick={() => updateCharge(charge.id, 'type', 'fixed')}
                        className={`flex-1 py-2 text-xs font-bold transition-colors ${charge.type === 'fixed' ? 'bg-primary-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                      >
                        固定金額
                      </button>
                    </div>
                  </div>

                  {/* Value */}
                  <div className="md:col-span-3">
                    <label className="block text-slate-500 text-[10px] font-bold uppercase mb-1">
                      {charge.type === 'rate' ? '比例' : '金額'}
                    </label>
                    <div className="flex items-center gap-1">
                      {charge.type === 'rate' ? (
                        <>
                          <input
                            type="number"
                            value={Math.round(charge.value * 100)}
                            onChange={e => updateCharge(charge.id, 'value', (parseFloat(e.target.value) || 0) / 100)}
                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none text-sm font-mono"
                            min={0}
                          />
                          <span className="text-slate-500 font-bold text-sm">%</span>
                        </>
                      ) : (
                        <input
                          type="number"
                          value={charge.value}
                          onChange={e => updateCharge(charge.id, 'value', parseFloat(e.target.value) || 0)}
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none text-sm font-mono"
                          min={0}
                          placeholder="$0"
                        />
                      )}
                    </div>
                  </div>

                  {/* Estimated Amount */}
                  <div className="md:col-span-2 text-right">
                    <label className="block text-slate-500 text-[10px] font-bold uppercase mb-1">預估</label>
                    <div className="text-sm font-mono font-bold text-emerald-600 py-2">
                      {formatCurrency(calcChargeAmount(charge, baseSubtotal))}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {charges.length === 0 && (
              <div className="text-center py-6 text-slate-400 italic border-2 border-dashed border-slate-100 rounded-lg">
                尚無檔期費用，請點擊「新增費用」或使用快選
              </div>
            )}
          </div>

          {/* Summary */}
          {charges.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center text-sm">
              <span className="text-slate-500">
                器材總價 <span className="font-mono font-bold text-slate-700">{formatCurrency(baseSubtotal)}</span>
              </span>
              <span className="text-slate-800 font-bold">
                檔期合計 <span className="font-mono text-lg text-primary-600">{formatCurrency(calcGrandSubtotal(baseSubtotal, charges))}</span>
              </span>
            </div>
          )}
        </div>

        {/* Equipment Sections */}
        {CATEGORIES.map(category => (
          <div key={category.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className={`px-6 py-4 flex justify-between items-center ${category.bg} border-b border-slate-100`}>
              <h3 className={`text-lg font-bold ${category.color} flex items-center gap-2`}>
                {category.label}
              </h3>
              <button
                onClick={() => setActiveCategoryModal(category.id)}
                className="flex items-center gap-2 text-sm bg-white hover:bg-primary-50 text-slate-700 hover:text-primary-700 hover:border-primary-300 px-4 py-2 rounded-lg transition-all border border-slate-200 shadow-sm font-bold"
              >
                <Plus size={16} /> 新增器材
              </button>
            </div>

            <div className="p-2 md:p-6">
              {/* Header Row */}
              <div className="hidden md:grid grid-cols-12 gap-4 text-xs font-bold text-slate-400 px-4 py-2 uppercase tracking-wider mb-2">
                <div className="col-span-3">器材名稱 (Item)</div>
                <div className="col-span-2">規格/備註 (Spec)</div>
                <div className="col-span-1 text-center">數量</div>
                <div className="col-span-1 text-center">單位</div>
                <div className="col-span-2 text-right">客報單價</div>
                <div className="col-span-2 text-right">成本/利潤</div>
                <div className="col-span-1 text-center">設定</div>
              </div>

              <div className="space-y-3">
                {itemsByCategory(category.id).map(item => (
                  <div key={item.id} className={`bg-slate-50 p-3 rounded-lg border transition-all group ${item.internalOnly ? 'border-dashed border-slate-300 bg-slate-100/50' : 'border-slate-200 hover:border-primary-300 hover:shadow-sm'}`}>

                    {/* Main Row */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 items-center relative">
                      {/* Internal Badge */}
                      {item.internalOnly && !expandedItems.has(item.id) && (
                        <div className="hidden md:flex absolute -left-2 top-1/2 -translate-y-1/2 -translate-x-full items-center gap-1 text-slate-400 text-[10px] writing-vertical-lr py-2">
                           <ListChecks size={12} className="rotate-90" />
                           清單
                        </div>
                      )}

                      {/* Name */}
                      <div className="col-span-3 flex items-center gap-2">
                        <div className="flex-1">
                          <div className="md:hidden text-xs text-slate-400 font-bold mb-1">器材名稱</div>
                          <input
                            type="text"
                            value={item.name}
                            onChange={e => updateItem(item.id, 'name', e.target.value)}
                            className={`w-full bg-transparent border-b border-transparent focus:border-primary-500 text-slate-800 font-medium outline-none p-1 transition-all placeholder-slate-400 ${item.internalOnly ? 'text-slate-600' : ''}`}
                            placeholder="輸入器材名稱..."
                          />
                          {!expandedItems.has(item.id) && item.subItems && item.subItems.length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                               {item.subItems.slice(0, 3).map((sub, i) => (
                                 <span key={i} className="text-[10px] bg-slate-200 text-slate-600 px-1 rounded-sm border border-slate-300">{sub}</span>
                               ))}
                               {item.subItems.length > 3 && <span className="text-[10px] text-slate-400">+{item.subItems.length - 3}</span>}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Specs */}
                      <div className="col-span-2">
                         <div className="md:hidden text-xs text-slate-400 font-bold mt-2 mb-1">規格/備註</div>
                         <input
                          type="text"
                          value={item.note || ''}
                          onChange={e => updateItem(item.id, 'note', e.target.value)}
                          className="w-full bg-transparent border-b border-transparent focus:border-primary-500 text-slate-500 text-sm outline-none p-1 transition-all placeholder-slate-300"
                          placeholder="規格..."
                        />
                      </div>

                      {/* Qty / Unit / Price / Cost */}
                      <div className="grid grid-cols-5 md:contents gap-2 mt-2 md:mt-0">
                          <div>
                              <div className="md:hidden text-xs text-slate-400 font-bold mb-1">數量</div>
                              <div className="col-span-1">
                                  <input type="number" value={item.quantity} onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)} className="w-full bg-transparent border-b border-transparent focus:border-primary-500 text-slate-800 text-center font-medium outline-none p-1" />
                              </div>
                          </div>
                          <div>
                              <div className="md:hidden text-xs text-slate-400 font-bold mb-1">單位</div>
                              <div className="col-span-1">
                                  <input type="text" value={item.unit} onChange={e => updateItem(item.id, 'unit', e.target.value)} className="w-full bg-transparent border-b border-transparent focus:border-primary-500 text-slate-500 text-center text-sm outline-none p-1" />
                              </div>
                          </div>
                          <div>
                               <div className="md:hidden text-xs text-slate-400 font-bold mb-1">客報單價</div>
                               <div className="col-span-2">
                                  {item.internalOnly ? (
                                    <div className="text-center text-xs text-slate-300 font-mono py-1 select-none">報價隱藏</div>
                                  ) : (
                                    <input type="number" value={item.price} onChange={e => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)} className="w-full bg-transparent border-b border-transparent focus:border-primary-500 text-right font-mono outline-none p-1 text-slate-800" />
                                  )}
                              </div>
                          </div>
                          <div className="col-span-2">
                               <div className="md:hidden text-xs text-slate-400 font-bold mb-1">成本/利潤</div>
                               <div className="flex flex-col items-end">
                                  <input type="number" value={item.costPrice ?? 0} onChange={e => updateItem(item.id, 'costPrice', parseFloat(e.target.value) || 0)} className="w-full bg-transparent border-b border-transparent focus:border-primary-500 text-right font-mono outline-none p-1 text-slate-800" placeholder="成本" />
                                  {item.price > 0 && (
                                    <span className={`text-[10px] font-bold mt-0.5 ${getProfitColor(item)}`}>
                                      利潤 {calcProfitMargin(item).toFixed(0)}%
                                    </span>
                                  )}
                               </div>
                          </div>
                      </div>

                      {/* Actions */}
                      <div className="col-span-1 flex justify-center items-center gap-1 mt-2 md:mt-0">
                        <button
                          onClick={() => toggleExpandItem(item.id)}
                          className={`p-1.5 rounded-full transition-colors ${expandedItems.has(item.id) || (item.subItems && item.subItems.length > 0) || item.internalOnly ? 'bg-primary-50 text-primary-600 border border-primary-100' : 'text-slate-400 hover:bg-slate-200'}`}
                          title="詳細設定 (內部清單/配件)"
                        >
                          {expandedItems.has(item.id) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="text-slate-400 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* --- Expanded Details Section --- */}
                    {expandedItems.has(item.id) && (
                      <div className="mt-3 pt-3 border-t border-slate-200 animate-in slide-in-from-top-2 duration-200">
                        <div className="flex flex-col md:flex-row gap-6">

                           {/* Left: Item Visibility Settings */}
                           <div className="md:w-1/4 space-y-3 bg-slate-100/50 p-3 rounded-lg border border-slate-200 h-fit">
                              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1 mb-2">
                                 <Package size={14} /> 顯示設定
                              </label>
                              <label className={`flex items-start gap-2 text-sm font-medium cursor-pointer select-none p-2 rounded transition-colors border ${item.internalOnly ? 'bg-primary-50 border-primary-200 text-primary-800' : 'bg-white border-transparent hover:bg-slate-100 text-slate-600'}`}>
                                <input
                                  type="checkbox"
                                  checked={!!item.internalOnly}
                                  onChange={(e) => updateItem(item.id, 'internalOnly', e.target.checked)}
                                  className="mt-1 w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-slate-300"
                                />
                                <div className="flex flex-col">
                                   <span className="flex items-center gap-2">
                                      <ListChecks size={14} className={item.internalOnly ? 'text-primary-600' : 'text-slate-400'} />
                                      僅器材單顯示
                                   </span>
                                   <span className="text-[11px] opacity-70 font-normal leading-tight mt-0.5">
                                     在報價單中隱藏此項目，僅在出庫清單中出現 (不計費)。
                                   </span>
                                </div>
                              </label>
                           </div>

                           {/* Right: Sub-items Editor (For Equipment List) */}
                           <div className="md:w-3/4 pl-0 md:pl-2">
                              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1 mb-3">
                                 <Tag size={14} /> 器材清單細項 (List Details)
                              </label>

                              <p className="text-[11px] text-slate-400 mb-2">
                                 在此輸入線材、配件等細項。這些內容將以條列式顯示於「器材清單」中，報價單則顯示為「如附件」。
                              </p>

                              {/* Input Area */}
                              <div className="flex gap-2 mb-3">
                                 <input
                                    type="text"
                                    value={activeInputId === item.id ? customSubItemInput : ''}
                                    onFocus={() => { setActiveInputId(item.id); setCustomSubItemInput(''); }}
                                    onChange={(e) => setCustomSubItemInput(e.target.value)}
                                    onKeyDown={(e) => {
                                       if (e.key === 'Enter') {
                                          addSubItem(item.id, customSubItemInput);
                                          setCustomSubItemInput('');
                                       }
                                    }}
                                    placeholder="輸入細項名稱 (例如: HDMI線 3m)..."
                                    className="flex-1 bg-white border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none shadow-sm"
                                 />
                                 <button
                                    onClick={() => {
                                       addSubItem(item.id, customSubItemInput);
                                       setCustomSubItemInput('');
                                    }}
                                    className="bg-slate-800 text-white px-4 py-2 rounded text-sm hover:bg-slate-700 font-bold"
                                 >
                                    新增
                                 </button>
                              </div>

                              {/* Selected Tags List */}
                              <div className="flex flex-col gap-1 mb-4">
                                 {item.subItems && item.subItems.length > 0 ? (
                                     <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
                                        {item.subItems.map((sub, idx) => (
                                          <div key={idx} className="flex justify-between items-center p-2 text-sm group hover:bg-slate-50">
                                              <span className="flex items-center gap-2">
                                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                                  {sub}
                                              </span>
                                              <button onClick={() => removeSubItem(item.id, idx)} className="text-slate-400 hover:text-red-500 p-1">
                                                  <X size={14} />
                                              </button>
                                          </div>
                                        ))}
                                     </div>
                                 ) : (
                                    <div className="text-sm text-slate-400 italic py-2 px-3 border border-dashed border-slate-200 rounded bg-slate-50">
                                       尚無細項內容 (請使用上方輸入框或下方快速選擇)
                                    </div>
                                 )}
                              </div>

                              {/* Quick Suggestions */}
                              <div className="bg-slate-100 p-2.5 rounded-lg border border-slate-200">
                                 <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">快速加入常用配件</p>
                                 <div className="flex flex-wrap gap-2">
                                    {ACCESSORY_SUGGESTIONS[item.category]?.map((sugg, i) => (
                                       <button
                                          key={i}
                                          onClick={() => addSubItem(item.id, sugg)}
                                          className="text-xs bg-white border border-slate-300 text-slate-600 px-2 py-1 rounded shadow-sm hover:border-primary-400 hover:text-primary-700 hover:bg-primary-50 transition-all active:scale-95"
                                       >
                                          + {sugg}
                                       </button>
                                    ))}
                                 </div>
                              </div>
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {itemsByCategory(category.id).length === 0 && (
                  <div className="text-center py-8 text-slate-400 italic border-2 border-dashed border-slate-100 rounded-lg">
                    尚未選擇器材，請點擊上方「新增器材」按鈕
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* === Subcontract Management Section === */}
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 flex justify-between items-center bg-amber-50 border-b border-amber-200">
            <h3 className="text-lg font-bold text-amber-700 flex items-center gap-2">
              <Send size={20} /> 發包單管理
            </h3>
            <button
              onClick={addSubcontract}
              className="flex items-center gap-2 text-sm bg-white hover:bg-amber-50 text-amber-700 hover:border-amber-400 px-4 py-2 rounded-lg transition-all border border-amber-300 shadow-sm font-bold"
            >
              <Plus size={16} /> 新增發包單
            </button>
          </div>

          <div className="p-4 md:p-6 space-y-4">
            {(project.subcontracts || []).length === 0 ? (
              <div className="text-center py-8 text-slate-400 italic border-2 border-dashed border-amber-100 rounded-lg">
                尚無發包單，點擊「新增發包單」建立
              </div>
            ) : (
              (project.subcontracts || []).map((sub) => (
                <div key={sub.id} className="border border-amber-200 rounded-lg overflow-hidden">
                  {/* Subcontract Header */}
                  <div
                    className="flex items-center justify-between px-4 py-3 bg-amber-50/50 cursor-pointer hover:bg-amber-50 transition-colors"
                    onClick={() => toggleExpandSub(sub.id)}
                  >
                    <div className="flex items-center gap-3">
                      {expandedSubs.has(sub.id) ? <ChevronUp size={16} className="text-amber-500" /> : <ChevronDown size={16} className="text-amber-500" />}
                      <div>
                        <span className="font-bold text-slate-800">{sub.vendorName || '未命名廠商'}</span>
                        <span className="text-xs text-slate-400 ml-2">{sub.itemIds.length} 個項目</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSubcontract(sub.id); }}
                      className="text-slate-400 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Expanded Content */}
                  {expandedSubs.has(sub.id) && (
                    <div className="p-4 border-t border-amber-200 space-y-4">
                      {/* Vendor Fields */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-slate-500 text-xs font-bold uppercase mb-1">協力廠商名稱</label>
                          <input type="text" value={sub.vendorName} onChange={e => updateSubcontract(sub.id, 'vendorName', e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none" placeholder="廠商名稱" />
                        </div>
                        <div>
                          <label className="block text-slate-500 text-xs font-bold uppercase mb-1">廠商統編</label>
                          <input type="text" value={sub.vendorTaxId} onChange={e => updateSubcontract(sub.id, 'vendorTaxId', e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none" placeholder="12345678" />
                        </div>
                        <div>
                          <label className="block text-slate-500 text-xs font-bold uppercase mb-1">聯繫人</label>
                          <input type="text" value={sub.vendorContact} onChange={e => updateSubcontract(sub.id, 'vendorContact', e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-slate-500 text-xs font-bold uppercase mb-1">廠商電話</label>
                          <input type="text" value={sub.vendorPhone} onChange={e => updateSubcontract(sub.id, 'vendorPhone', e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none" placeholder="手機或市話" />
                        </div>
                        <div>
                          <label className="block text-slate-500 text-xs font-bold uppercase mb-1">交台時間</label>
                          <input type="text" value={sub.handoverTime} onChange={e => updateSubcontract(sub.id, 'handoverTime', e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none" placeholder="例如: 2024-01-15 10:00" />
                        </div>
                      </div>

                      {/* Item Picker */}
                      <div>
                        <label className="block text-slate-500 text-xs font-bold uppercase mb-2">選擇發包項目</label>
                        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                          {CATEGORIES.map(cat => {
                            const catItems = project.items.filter(i => i.category === cat.id);
                            if (catItems.length === 0) return null;
                            return (
                              <div key={cat.id}>
                                <div className={`px-3 py-1.5 text-xs font-bold ${cat.color} ${cat.bg}`}>{cat.label}</div>
                                {catItems.map(item => (
                                  <label
                                    key={item.id}
                                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-amber-50/50 transition-colors ${sub.itemIds.includes(item.id) ? 'bg-amber-50' : ''}`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={sub.itemIds.includes(item.id)}
                                      onChange={() => toggleSubcontractItem(sub.id, item.id)}
                                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                                    />
                                    <span className="flex-1 text-sm text-slate-700">{item.name}</span>
                                    <span className="text-xs text-slate-400">{item.quantity} {item.unit}</span>
                                  </label>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="h-10"></div>
      </div>
    </div>
  );
};
