import React, { useState, useEffect } from 'react';
import { Project, ViewMode, Subcontract, PeriodCharge, SalesPerson, Customer } from './types';
import { INITIAL_ITEMS } from './constants';
import { generateId } from './utils/helpers';

/** Migrate old period (number of days) to periodCharges array */
const migratePeriodToCharges = (period: number): PeriodCharge[] => {
  const charges: PeriodCharge[] = [];
  for (let i = 0; i < period; i++) {
    charges.push({
      id: generateId(),
      label: i === 0 ? '活動日' : `第${i + 1}天`,
      type: 'rate',
      value: 1.0,
    });
  }
  return charges;
};
import { ProjectCard } from './components/ProjectCard';
import { ProjectEditor } from './components/ProjectEditor';
import { PrintLayout } from './components/PrintLayout';
import { CustomerManager } from './components/CustomerManager';
import { PlusCircle, Search, Trash2, Settings, Users } from 'lucide-react';

const DEFAULT_SALESPEOPLE: SalesPerson[] = [
  { id: 'default', name: '林宇珅', phone: '0912-345-678' },
];

const ensureOk = async (response: Response) => {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `HTTP ${response.status}`);
  }
  return response;
};

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentSubcontractId, setCurrentSubcontractId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');

  // Salespeople settings
  const [salespeople, setSalespeople] = useState<SalesPerson[]>(DEFAULT_SALESPEOPLE);
  const [showSettings, setShowSettings] = useState(false);
  const [editingSalespeople, setEditingSalespeople] = useState<SalesPerson[]>(DEFAULT_SALESPEOPLE);

  // State for delete confirmation modal
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  // Fetch settings on mount
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then((data: Record<string, string>) => {
        if (data.salespeople) {
          try {
            const parsed = JSON.parse(data.salespeople) as SalesPerson[];
            if (parsed.length > 0) {
              setSalespeople(parsed);
              setEditingSalespeople(parsed);
            }
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const saveSettings = async () => {
    const filtered = editingSalespeople.filter(s => s.name.trim());
    setSalespeople(filtered);
    setShowSettings(false);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salespeople: JSON.stringify(filtered) }),
      });
      await ensureOk(response);
    } catch (err) {
      console.error('Failed to save settings', err);
    }
  };

  // Fetch customers and projects together so customer matching is ready before editing.
  useEffect(() => {
    Promise.all([
      fetch('/api/customers').then(ensureOk).then(res => res.json() as Promise<Customer[]>),
      fetch('/api/projects').then(ensureOk).then(res => res.json() as Promise<Project[]>),
    ])
      .then(([customerData, data]) => {
        setCustomers(customerData.map(customer => ({
          ...customer,
          taxId: customer.taxId || '',
          contact: customer.contact || '',
          phone: customer.phone || '',
          email: customer.email || '',
          address: customer.address || '',
          note: customer.note || '',
        })));

        // Migration logic: Ensure new fields exist for old projects
        const migratedData = data.map(p => ({
            ...p,
            customerId: p.customerId || '',
            phone: p.phone || '',
            taxId: p.taxId || '',
            activityTime: p.activityTime || '',
            moveInDate: p.moveInDate || `${p.date} 09:00`,
            moveOutDate: p.moveOutDate || `${p.date} 18:00`,
            period: p.period ?? 1,
            periodCharges: p.periodCharges || migratePeriodToCharges(p.period ?? 1),
            subcontracts: p.subcontracts || [],
            items: p.items.map(item => {
                // Migrate old category IDs
                const catMap: Record<string, string> = { video: 'projection', manpower: 'crew', photography: 'projection', livestream: 'led', print: 'stage' };
                const category = catMap[item.category] || item.category;
                return {
                    ...item,
                    category: category as any,
                    days: item.days ?? 1,
                    costPrice: item.costPrice ?? 0,
                    subItems: Array.isArray(item.subItems) ? item.subItems : (typeof item.subItems === 'string' && item.subItems ? (item.subItems as string).split('\n') : [])
                };
            })
        }));
        setProjects(migratedData);
        setIsLoading(false);

        // Handle URL query params for direct project navigation
        // e.g. ?pid=<id>&view=quote|list|cost
        const params = new URLSearchParams(window.location.search);
        const pid = params.get('pid');
        const view = params.get('view');
        if (pid && migratedData.find(p => p.id === pid)) {
          setCurrentProjectId(pid);
          if (view === 'list') setViewMode('preview_list');
          else if (view === 'cost') setViewMode('preview_cost');
          else setViewMode('preview_quote');
        }
      })
      .catch(err => {
        console.error('Failed to fetch initial data', err);
        setIsLoading(false);
      });
  }, []);

  const buildNewProject = (customer?: Customer, sourceProject?: Project): Project => {
    const today = new Date().toISOString().split('T')[0];
    const idMap = new Map<string, string>();
    const items = sourceProject
      ? sourceProject.items.map(item => {
          const nextId = generateId();
          idMap.set(item.id, nextId);
          return {
            ...item,
            id: nextId,
            subItems: Array.isArray(item.subItems) ? [...item.subItems] : [],
          };
        })
      : INITIAL_ITEMS.map(i => ({ ...i, id: generateId(), costPrice: 0 }));

    return {
      id: generateId(),
      name: sourceProject ? `${sourceProject.name} - 複製` : '新專案 (New Project)',
      customerId: customer?.id,
      client: customer?.name || '',
      date: today,
      activityTime: sourceProject?.activityTime || '13:00-17:00',
      location: sourceProject?.location || '',
      contact: customer?.contact || '',
      phone: customer?.phone || '',
      taxId: customer?.taxId || '',
      moveInDate: `${today} 09:00`,
      moveOutDate: `${today} 18:00`,
      period: sourceProject?.period ?? 1,
      periodCharges: sourceProject?.periodCharges
        ? sourceProject.periodCharges.map(charge => ({ ...charge, id: generateId() }))
        : [{ id: generateId(), label: '活動日', type: 'rate' as const, value: 1.0 }],
      items,
      subcontracts: sourceProject?.subcontracts?.map(subcontract => ({
        ...subcontract,
        id: generateId(),
        itemIds: subcontract.itemIds.map(id => idMap.get(id)).filter((id): id is string => !!id),
      })) || [],
      taxRate: sourceProject?.taxRate ?? 0.05,
      salesId: sourceProject?.salesId,
      compactQuote: sourceProject?.compactQuote,
      updatedAt: Date.now()
    };
  };

  const persistNewProject = async (newProject: Project) => {
    setProjects(prev => [newProject, ...prev]);
    setCurrentProjectId(newProject.id);
    setViewMode('editor');

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject)
      });
      await ensureOk(response);
    } catch (error) {
      console.error('Failed to save new project', error);
      setProjects(prev => prev.filter(p => p.id !== newProject.id));
      setViewMode('dashboard');
      setCurrentProjectId(null);
    }
  };

  const handleCreateProject = async () => {
    await persistNewProject(buildNewProject());
  };

  const handleCreateProjectForCustomer = async (customer: Customer, sourceProject?: Project) => {
    await persistNewProject(buildNewProject(customer, sourceProject));
  };

  const syncCustomerFromProject = async (project: Project): Promise<Project> => {
    const clientName = project.client.trim();
    if (!clientName) return project;

    const existingCustomer =
      (project.customerId ? customers.find(customer => customer.id === project.customerId) : undefined) ||
      customers.find(customer => customer.name.trim().toLowerCase() === clientName.toLowerCase());

    const customerToSave: Customer = {
      id: existingCustomer?.id || generateId(),
      name: clientName,
      taxId: project.taxId || existingCustomer?.taxId || '',
      contact: project.contact || existingCustomer?.contact || '',
      phone: project.phone || existingCustomer?.phone || '',
      email: existingCustomer?.email || '',
      address: existingCustomer?.address || '',
      note: existingCustomer?.note || '',
      updatedAt: Date.now(),
    };

    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerToSave),
      });
      await ensureOk(response);
    } catch (error) {
      console.error('Failed to sync customer from project', error);
      return existingCustomer ? { ...project, customerId: existingCustomer.id } : { ...project, customerId: '' };
    }

    setCustomers(prev => {
      const exists = prev.some(customer => customer.id === customerToSave.id);
      if (exists) return prev.map(customer => customer.id === customerToSave.id ? customerToSave : customer);
      return [customerToSave, ...prev];
    });

    return { ...project, customerId: customerToSave.id };
  };

  const handleSaveProject = async (updatedProject: Project) => {
    const syncedProject = await syncCustomerFromProject(updatedProject);
    const projectToSave = { ...syncedProject, updatedAt: Date.now() };
    const previousProjects = projects;
    setProjects(prev => prev.map(p => p.id === projectToSave.id ? projectToSave : p));
    setViewMode('dashboard');
    setCurrentProjectId(null);

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectToSave)
      });
      await ensureOk(response);
    } catch (error) {
      console.error('Failed to update project', error);
      setProjects(previousProjects);
    }
  };

  const handleDeleteProject = (id: string) => {
    setProjectToDelete(id);
  };

  const handleSaveCustomer = async (customer: Customer) => {
    const customerToSave = { ...customer, updatedAt: Date.now() };
    const previousCustomers = customers;
    setCustomers(prev => {
      const exists = prev.some(c => c.id === customerToSave.id);
      if (exists) return prev.map(c => c.id === customerToSave.id ? customerToSave : c);
      return [customerToSave, ...prev];
    });

    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerToSave),
      });
      await ensureOk(response);
    } catch (error) {
      console.error('Failed to save customer', error);
      setCustomers(previousCustomers);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    const previousCustomers = customers;
    setCustomers(prev => prev.filter(c => c.id !== id));
    try {
      const response = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      await ensureOk(response);
    } catch (error) {
      console.error('Failed to delete customer', error);
      setCustomers(previousCustomers);
    }
  };

  const confirmDelete = async () => {
    if (projectToDelete) {
      const idToDelete = projectToDelete;
      const deletedProject = projects.find(p => p.id === idToDelete);
      setProjects(prev => prev.filter(p => p.id !== idToDelete));
      setProjectToDelete(null);

      try {
        const response = await fetch(`/api/projects/${idToDelete}`, {
          method: 'DELETE'
        });
        await ensureOk(response);
      } catch (error) {
        console.error('Failed to delete project', error);
        if (deletedProject) {
          setProjects(prev => [deletedProject, ...prev]);
        }
      }
    }
  };

  const getActiveProject = () => projects.find(p => p.id === currentProjectId)!;

  const getActiveSubcontract = (): Subcontract | undefined => {
    const proj = getActiveProject();
    return proj?.subcontracts?.find(s => s.id === currentSubcontractId);
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.client.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Render Logic
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="flex flex-col items-center text-slate-500">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
          <p>載入專案資料中...</p>
        </div>
      </div>
    );
  }

  if (viewMode === 'editor' && currentProjectId) {
    return <ProjectEditor project={getActiveProject()} customers={customers} salespeople={salespeople} onSave={handleSaveProject} onCancel={() => setViewMode('dashboard')} />;
  }

  if (viewMode === 'customers') {
    return (
      <CustomerManager
        customers={customers}
        projects={projects}
        onSave={handleSaveCustomer}
        onDelete={handleDeleteCustomer}
        onCreateProject={handleCreateProjectForCustomer}
        onBack={() => setViewMode('dashboard')}
      />
    );
  }

  // Quote / List toggle
  if ((viewMode === 'preview_quote' || viewMode === 'preview_list') && currentProjectId) {
    return (
      <PrintLayout
        type={viewMode === 'preview_quote' ? 'quote' : 'list'}
        project={getActiveProject()}
        salespeople={salespeople}
        onBack={() => setViewMode('dashboard')}
        onSwitchType={() => setViewMode(prev => prev === 'preview_quote' ? 'preview_list' : 'preview_quote')}
      />
    );
  }

  // Cost / Profit preview
  if (viewMode === 'preview_cost' && currentProjectId) {
    return (
      <PrintLayout
        type="cost"
        project={getActiveProject()}
        salespeople={salespeople}
        onBack={() => setViewMode('dashboard')}
      />
    );
  }

  // Subcontract preview
  if (viewMode === 'preview_subcontract' && currentProjectId && currentSubcontractId) {
    const sub = getActiveSubcontract();
    if (sub) {
      return (
        <PrintLayout
          type="subcontract"
          project={getActiveProject()}
          salespeople={salespeople}
          subcontract={sub}
          onBack={() => { setViewMode('dashboard'); setCurrentSubcontractId(null); }}
        />
      );
    }
  }

  return (
    <div className="flex flex-col h-screen print:h-auto print:overflow-visible bg-slate-50 text-slate-900 relative">
      {/* Dashboard Header */}
      <header className="bg-white border-b border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm z-10 no-print">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
            AV Pro <span className="text-primary-600">Manager</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1">專業器材租賃與報價系統</p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="搜尋專案..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-100 border border-slate-200 rounded-full pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none transition-all placeholder-slate-400 text-slate-800"
            />
          </div>
          <button
            onClick={() => { setEditingSalespeople(salespeople); setShowSettings(true); }}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
            title="設定"
          >
            <Settings size={20} />
          </button>
          <button
            onClick={() => setViewMode('customers')}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2 rounded-full font-bold transition-colors whitespace-nowrap"
          >
            <Users size={18} /> 客戶管理
          </button>
          <button
            onClick={handleCreateProject}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-5 py-2 rounded-full font-bold transition-colors shadow-lg shadow-primary-500/20 whitespace-nowrap"
          >
            <PlusCircle size={18} /> 新增專案
          </button>
        </div>
      </header>

      {/* Project Grid */}
      <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
        {filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <div className="bg-white p-8 rounded-full mb-4 shadow-sm border border-slate-100">
              <Search size={48} className="opacity-30" />
            </div>
            <p className="text-xl font-bold text-slate-600">尚無專案資料</p>
            <p className="text-sm mt-2">點擊右上角「新增專案」開始建立報價單</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProjects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={(id) => { setCurrentProjectId(id); setViewMode('editor'); }}
                onDelete={handleDeleteProject}
                onViewQuote={(id) => { setCurrentProjectId(id); setViewMode('preview_quote'); }}
                onViewList={(id) => { setCurrentProjectId(id); setViewMode('preview_list'); }}
                onViewCost={(id) => { setCurrentProjectId(id); setViewMode('preview_cost'); }}
                onViewSubcontract={(projectId, subcontractId) => {
                  setCurrentProjectId(projectId);
                  setCurrentSubcontractId(subcontractId);
                  setViewMode('preview_subcontract');
                }}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer Status */}
      <footer className="bg-white border-t border-slate-200 py-3 px-6 text-xs text-slate-400 flex justify-between no-print">
        <span>專案總數: {projects.length}</span>
        <span>系統狀態: 正常 (已儲存)</span>
      </footer>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full border border-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
                <Settings size={20} />
              </div>
              <h3 className="text-xl font-bold text-slate-800">業務人員管理</h3>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {editingSalespeople.map((sp, idx) => (
                <div key={sp.id} className="flex items-center gap-2 bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={sp.name}
                      onChange={e => {
                        const arr = [...editingSalespeople];
                        arr[idx] = { ...arr[idx], name: e.target.value };
                        setEditingSalespeople(arr);
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="姓名"
                    />
                    <input
                      type="text"
                      value={sp.phone}
                      onChange={e => {
                        const arr = [...editingSalespeople];
                        arr[idx] = { ...arr[idx], phone: e.target.value };
                        setEditingSalespeople(arr);
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm text-slate-800 focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="電話"
                    />
                  </div>
                  <button
                    onClick={() => setEditingSalespeople(prev => prev.filter((_, i) => i !== idx))}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="刪除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setEditingSalespeople(prev => [...prev, { id: generateId(), name: '', phone: '' }])}
              className="w-full mt-3 py-2 text-sm font-bold text-primary-600 hover:bg-primary-50 border border-dashed border-primary-300 rounded-lg transition-colors"
            >
              + 新增業務
            </button>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition-colors"
              >
                取消
              </button>
              <button
                onClick={saveSettings}
                className="flex-1 px-4 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-bold shadow-lg shadow-primary-500/20 transition-colors"
              >
                儲存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full scale-100 animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                <Trash2 size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">確認刪除專案?</h3>
              <p className="text-slate-500 mb-6 text-sm">
                您確定要刪除 <span className="font-bold text-slate-700">{projects.find(p => p.id === projectToDelete)?.name}</span> 嗎？<br/>此動作無法復原。
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setProjectToDelete(null)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-lg shadow-red-600/20 transition-colors"
                >
                  刪除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
