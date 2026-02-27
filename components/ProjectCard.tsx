import React, { useState, useRef, useEffect } from 'react';
import { Project } from '../types';
import { formatDate, formatCurrency, calcBaseSubtotal, calcGrandSubtotal } from '../utils/helpers';
import { Edit, Trash2, FileText, List, Send, ChevronDown } from 'lucide-react';

interface ProjectCardProps {
  project: Project;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onViewQuote: (id: string) => void;
  onViewList: (id: string) => void;
  onViewSubcontract: (projectId: string, subcontractId: string) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onEdit, onDelete, onViewQuote, onViewList, onViewSubcontract }) => {
  const [showSubMenu, setShowSubMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const baseSubtotal = calcBaseSubtotal(project.items);
  const charges = project.periodCharges || [];
  const totalAmount = charges.length > 0
    ? calcGrandSubtotal(baseSubtotal, charges)
    : baseSubtotal;

  const subs = project.subcontracts || [];

  // Close menu on outside click
  useEffect(() => {
    if (!showSubMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowSubMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSubMenu]);

  const handleSubcontractClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (subs.length === 0) return;
    if (subs.length === 1) {
      onViewSubcontract(project.id, subs[0].id);
    } else {
      setShowSubMenu(prev => !prev);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:border-primary-300 hover:shadow-lg transition-all shadow-sm group flex flex-col h-full">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800 mb-1 line-clamp-1" title={project.name}>{project.name}</h3>
          <p className="text-slate-500 text-sm">{project.client || '未填寫客戶'} • {formatDate(project.date)}</p>
        </div>
      </div>

      <div className="flex-1 mb-4">
         <div className="inline-block bg-slate-50 text-slate-700 text-sm font-mono font-bold py-1 px-3 rounded border border-slate-200">
          {formatCurrency(totalAmount)}
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-auto">
        {/* Row 1: document buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onViewQuote(project.id); }}
            className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-sm transition-colors"
          >
            <FileText size={14} /> 報價單
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onViewList(project.id); }}
            className="flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 py-2 rounded-lg text-sm transition-colors"
          >
            <List size={14} /> 器材單
          </button>
          {/* Subcontract button with dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={handleSubcontractClick}
              disabled={subs.length === 0}
              className={`w-full flex items-center justify-center gap-1 py-2 rounded-lg text-sm transition-colors border ${
                subs.length === 0
                  ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                  : 'bg-white hover:bg-amber-50 text-amber-700 border-amber-300'
              }`}
              title={subs.length === 0 ? '請先在編輯器中新增發包單' : ''}
            >
              <Send size={14} />
              <span>發包</span>
              {subs.length > 0 && (
                <span className="bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {subs.length}
                </span>
              )}
              {subs.length > 1 && <ChevronDown size={12} />}
            </button>

            {/* Dropdown */}
            {showSubMenu && subs.length > 1 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
                {subs.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSubMenu(false);
                      onViewSubcontract(project.id, sub.id);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 border-b border-slate-100 last:border-b-0 transition-colors"
                  >
                    <div className="font-bold text-slate-700 truncate">{sub.vendorName || '未命名廠商'}</div>
                    <div className="text-[10px] text-slate-400">{sub.itemIds.length} 個項目</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Row 2: action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(project.id); }}
            className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg text-sm transition-colors"
          >
            <Edit size={16} /> 編輯
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
            className="flex items-center justify-center gap-2 bg-white hover:bg-red-50 text-red-600 border border-red-100 hover:border-red-200 py-2 rounded-lg text-sm transition-colors"
          >
            <Trash2 size={16} /> 刪除
          </button>
        </div>
      </div>
    </div>
  );
};
