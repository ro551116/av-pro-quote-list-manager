import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Copy, Edit, FilePlus2, History, Plus, Save, Search, Trash2, X } from 'lucide-react';
import { Customer, Project } from '../types';
import { calcBaseSubtotal, calcGrandSubtotal, formatCurrency, formatDate, generateId } from '../utils/helpers';

interface CustomerManagerProps {
  customers: Customer[];
  projects: Project[];
  onSave: (customer: Customer) => void;
  onDelete: (id: string) => void;
  onCreateProject: (customer: Customer, sourceProject?: Project) => void;
  onBack: () => void;
}

const EMPTY_CUSTOMER: Customer = {
  id: '',
  name: '',
  taxId: '',
  contact: '',
  phone: '',
  email: '',
  address: '',
  note: '',
  updatedAt: 0,
};

export const CustomerManager: React.FC<CustomerManagerProps> = ({
  customers,
  projects,
  onSave,
  onDelete,
  onCreateProject,
  onBack,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    if (!historyCustomer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setHistoryCustomer(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [historyCustomer]);

  const filteredCustomers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter(customer =>
      customer.name.toLowerCase().includes(term) ||
      (customer.contact || '').toLowerCase().includes(term) ||
      (customer.phone || '').toLowerCase().includes(term) ||
      (customer.taxId || '').toLowerCase().includes(term)
    );
  }, [customers, searchTerm]);

  const startNewCustomer = () => {
    setEditingCustomer({ ...EMPTY_CUSTOMER, id: generateId(), updatedAt: Date.now() });
  };

  const updateEditingCustomer = (field: keyof Customer, value: string) => {
    setEditingCustomer(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const saveEditingCustomer = () => {
    if (!editingCustomer || !editingCustomer.name.trim()) return;
    onSave({
      ...editingCustomer,
      name: editingCustomer.name.trim(),
      updatedAt: Date.now(),
    });
    setEditingCustomer(null);
  };

  const getCustomerProjects = (customer: Customer) => {
    const customerName = customer.name.trim().toLowerCase();
    return projects
      .filter(project =>
        project.customerId === customer.id ||
        (!!customerName && project.client.trim().toLowerCase() === customerName)
      )
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  };

  const getProjectTotal = (project: Project) => {
    const baseSubtotal = calcBaseSubtotal(project.items || []);
    const charges = project.periodCharges || [];
    return charges.length > 0 ? calcGrandSubtotal(baseSubtotal, charges) : baseSubtotal;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">客戶管理</h1>
            <p className="text-slate-500 text-sm mt-1">維護客戶資料，並直接用客戶資料新增報價單</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="搜尋客戶、聯絡人、電話、統編..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-100 border border-slate-200 rounded-full pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none transition-all placeholder-slate-400 text-slate-800"
            />
          </div>
          <button
            onClick={startNewCustomer}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-5 py-2 rounded-full font-bold transition-colors shadow-lg shadow-primary-500/20 whitespace-nowrap"
          >
            <Plus size={18} /> 新增客戶
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {filteredCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <div className="bg-white p-8 rounded-full mb-4 shadow-sm border border-slate-100">
              <Search size={48} className="opacity-30" />
            </div>
            <p className="text-xl font-bold text-slate-600">尚無客戶資料</p>
            <p className="text-sm mt-2">點擊右上角「新增客戶」建立第一筆客戶</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredCustomers.map(customer => {
              const customerProjects = getCustomerProjects(customer);
              return (
                <div key={customer.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:border-primary-300 hover:shadow-lg transition-all flex flex-col gap-4">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">{customer.name}</h3>
                        <p className="text-sm text-slate-500 mt-1">{customer.contact || '未填聯絡人'}{customer.phone ? ` · ${customer.phone}` : ''}</p>
                      </div>
                      {customer.taxId && (
                        <span className="text-xs font-mono bg-slate-100 border border-slate-200 text-slate-500 px-2 py-1 rounded">
                          {customer.taxId}
                        </span>
                      )}
                    </div>
                    {(customer.email || customer.address || customer.note) && (
                      <div className="mt-3 space-y-1 text-sm text-slate-500">
                        {customer.email && <p>{customer.email}</p>}
                        {customer.address && <p>{customer.address}</p>}
                        {customer.note && <p className="text-slate-400 line-clamp-2">{customer.note}</p>}
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase">
                        <History size={14} /> 歷史訂單
                      </div>
                      {customerProjects.length > 3 ? (
                        <button
                          onClick={() => setHistoryCustomer(customer)}
                          className="text-[11px] text-primary-600 hover:text-primary-700 font-bold hover:underline"
                        >
                          全部 {customerProjects.length} 筆 →
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">{customerProjects.length} 筆</span>
                      )}
                    </div>
                    {customerProjects.length === 0 ? (
                      <div className="text-sm text-slate-400 py-2">尚無此客戶訂單紀錄</div>
                    ) : (
                      <div className="space-y-2">
                        {customerProjects.slice(0, 3).map(project => (
                          <div key={project.id} className="bg-white border border-slate-200 rounded-lg p-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-slate-700 truncate" title={project.name}>{project.name}</div>
                                <div className="text-[11px] text-slate-400">{formatDate(project.date)} · {project.items.length} 項 · {formatCurrency(getProjectTotal(project))}</div>
                              </div>
                              <button
                                onClick={() => onCreateProject(customer, project)}
                                className="shrink-0 flex items-center gap-1 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 px-2 py-1 rounded text-xs font-bold transition-colors"
                                title="用這張舊單的器材與費用建立新報價"
                              >
                                <Copy size={12} /> 沿用
                              </button>
                            </div>
                          </div>
                        ))}
                        {customerProjects.length > 3 && (
                          <button
                            onClick={() => setHistoryCustomer(customer)}
                            className="w-full text-xs text-slate-400 hover:text-primary-600 py-1 text-center hover:bg-slate-100 rounded transition-colors"
                          >
                            還有 {customerProjects.length - 3} 筆…
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-auto">
                    <button
                      onClick={() => onCreateProject(customer)}
                      className="flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-sm transition-colors"
                    >
                      <FilePlus2 size={14} /> 空白單
                    </button>
                    <button
                      onClick={() => setEditingCustomer(customer)}
                      className="flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg text-sm transition-colors"
                    >
                      <Edit size={14} /> 編輯
                    </button>
                    <button
                      onClick={() => onDelete(customer.id)}
                      className="flex items-center justify-center gap-1 bg-white hover:bg-red-50 text-red-600 border border-red-100 hover:border-red-200 py-2 rounded-lg text-sm transition-colors"
                    >
                      <Trash2 size={14} /> 刪除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {historyCustomer && (() => {
        const allProjects = getCustomerProjects(historyCustomer);
        return (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-200"
            onClick={e => { if (e.target === e.currentTarget) setHistoryCustomer(null); }}
          >
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-slate-100 flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{historyCustomer.name}</h3>
                  <p className="text-sm text-slate-500 mt-0.5">全部 {allProjects.length} 筆歷史訂單</p>
                </div>
                <button
                  onClick={() => setHistoryCustomer(null)}
                  className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
                {allProjects.map(project => (
                  <div key={project.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-800 truncate" title={project.name}>{project.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {formatDate(project.date)} · {project.items.length} 項 · {formatCurrency(getProjectTotal(project))}
                        </div>
                      </div>
                      <button
                        onClick={() => { onCreateProject(historyCustomer, project); setHistoryCustomer(null); }}
                        className="shrink-0 flex items-center gap-1 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 px-3 py-1.5 rounded text-xs font-bold transition-colors"
                        title="用這張舊單的器材與費用建立新報價"
                      >
                        <Copy size={12} /> 沿用
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-6 py-4 border-t border-slate-100">
                <button
                  onClick={() => { onCreateProject(historyCustomer); setHistoryCustomer(null); }}
                  className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-lg text-sm font-bold transition-colors"
                >
                  <FilePlus2 size={16} /> 開空白單
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {editingCustomer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-800">{customers.some(c => c.id === editingCustomer.id) ? '編輯客戶' : '新增客戶'}</h3>
              <button onClick={() => setEditingCustomer(null)} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-slate-500 text-xs font-bold uppercase mb-1">客戶名稱</label>
                <input value={editingCustomer.name} onChange={e => updateEditingCustomer('name', e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <div>
                <label className="block text-slate-500 text-xs font-bold uppercase mb-1">統一編號</label>
                <input value={editingCustomer.taxId || ''} onChange={e => updateEditingCustomer('taxId', e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <div>
                <label className="block text-slate-500 text-xs font-bold uppercase mb-1">聯絡人</label>
                <input value={editingCustomer.contact || ''} onChange={e => updateEditingCustomer('contact', e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <div>
                <label className="block text-slate-500 text-xs font-bold uppercase mb-1">電話</label>
                <input value={editingCustomer.phone || ''} onChange={e => updateEditingCustomer('phone', e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <div>
                <label className="block text-slate-500 text-xs font-bold uppercase mb-1">Email</label>
                <input value={editingCustomer.email || ''} onChange={e => updateEditingCustomer('email', e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-slate-500 text-xs font-bold uppercase mb-1">地址</label>
                <input value={editingCustomer.address || ''} onChange={e => updateEditingCustomer('address', e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-slate-500 text-xs font-bold uppercase mb-1">備註</label>
                <textarea value={editingCustomer.note || ''} onChange={e => updateEditingCustomer('note', e.target.value)} rows={3} className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditingCustomer(null)} className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition-colors">
                取消
              </button>
              <button onClick={saveEditingCustomer} disabled={!editingCustomer.name.trim()} className="flex-1 px-4 py-2.5 bg-primary-600 hover:bg-primary-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-bold shadow-lg shadow-primary-500/20 transition-colors flex items-center justify-center gap-2">
                <Save size={18} /> 儲存客戶
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
