import React, { useState, useEffect } from 'react';
import { Project, ViewMode, Subcontract, PeriodCharge } from './types';
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
import { PlusCircle, Search, Trash2 } from 'lucide-react';

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentSubcontractId, setCurrentSubcontractId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');

  // State for delete confirmation modal
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  // Fetch projects on mount
  useEffect(() => {
    fetch('/api/projects')
      .then(res => res.json())
      .then((data: Project[]) => {
        // Migration logic: Ensure new fields exist for old projects
        const migratedData = data.map(p => ({
            ...p,
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
      })
      .catch(err => {
        console.error('Failed to fetch projects', err);
        setIsLoading(false);
      });
  }, []);

  const handleCreateProject = async () => {
    const today = new Date().toISOString().split('T')[0];
    const newProject: Project = {
      id: generateId(),
      name: '新專案 (New Project)',
      client: '',
      date: today,
      activityTime: '13:00-17:00',
      location: '',
      contact: '',
      phone: '',
      taxId: '',
      moveInDate: `${today} 09:00`,
      moveOutDate: `${today} 18:00`,
      period: 1,
      periodCharges: [{ id: generateId(), label: '活動日', type: 'rate' as const, value: 1.0 }],
      items: INITIAL_ITEMS.map(i => ({ ...i, id: generateId(), costPrice: 0 })),
      subcontracts: [],
      taxRate: 0.05,
      updatedAt: Date.now()
    };
    setProjects(prev => [newProject, ...prev]);
    setCurrentProjectId(newProject.id);
    setViewMode('editor');

    try {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject)
      });
    } catch (error) {
      console.error('Failed to save new project', error);
      setProjects(prev => prev.filter(p => p.id !== newProject.id));
      setViewMode('dashboard');
      setCurrentProjectId(null);
    }
  };

  const handleSaveProject = async (updatedProject: Project) => {
    const projectToSave = { ...updatedProject, updatedAt: Date.now() };
    const previousProjects = projects;
    setProjects(prev => prev.map(p => p.id === projectToSave.id ? projectToSave : p));
    setViewMode('dashboard');
    setCurrentProjectId(null);

    try {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectToSave)
      });
    } catch (error) {
      console.error('Failed to update project', error);
      setProjects(previousProjects);
    }
  };

  const handleDeleteProject = (id: string) => {
    setProjectToDelete(id);
  };

  const confirmDelete = async () => {
    if (projectToDelete) {
      const idToDelete = projectToDelete;
      const deletedProject = projects.find(p => p.id === idToDelete);
      setProjects(prev => prev.filter(p => p.id !== idToDelete));
      setProjectToDelete(null);

      try {
        await fetch(`/api/projects/${idToDelete}`, {
          method: 'DELETE'
        });
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
    return <ProjectEditor project={getActiveProject()} onSave={handleSaveProject} onCancel={() => setViewMode('dashboard')} />;
  }

  // Quote / List toggle
  if ((viewMode === 'preview_quote' || viewMode === 'preview_list') && currentProjectId) {
    return (
      <PrintLayout
        type={viewMode === 'preview_quote' ? 'quote' : 'list'}
        project={getActiveProject()}
        onBack={() => setViewMode('dashboard')}
        onSwitchType={() => setViewMode(prev => prev === 'preview_quote' ? 'preview_list' : 'preview_quote')}
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
