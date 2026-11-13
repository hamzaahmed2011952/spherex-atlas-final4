import React from 'react';
import { useApp } from '../../context/AppContext';
import { AppModule } from '../../types/astronomy';
import {
  LayoutDashboard,
  Compass,
  FileCode2,
  Crosshair,
  Activity,
  Clock,
  SplitSquareVertical,
  Database,
  Sparkles,
  FolderKanban,
  FileCheck2,
  X,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavGroup {
  groupLabelEn: string;
  groupLabelAr: string;
  items: {
    id: AppModule;
    code: string;
    labelKey: string;
    icon: React.ReactNode;
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { activeModule, setActiveModule, t, language } = useApp();

  const navGroups: NavGroup[] = [
    {
      groupLabelEn: 'Mission Overview',
      groupLabelAr: 'نظرة عامة للمهمة',
      items: [
        { id: 'mission', code: '01', labelKey: 'navMission', icon: <LayoutDashboard size={16} /> },
        { id: 'targets', code: '02', labelKey: 'navTargets', icon: <Crosshair size={16} /> },
        { id: 'sky', code: '03', labelKey: 'navSky', icon: <Compass size={16} /> },
      ],
    },
    {
      groupLabelEn: 'Data & Spectroscopy',
      groupLabelAr: 'البيانات والتحليل الطيفي',
      items: [
        { id: 'fits', code: '04', labelKey: 'navFits', icon: <FileCode2 size={16} /> },
        { id: 'spectra', code: '05', labelKey: 'navSpectra', icon: <Activity size={16} /> },
        { id: 'datasets', code: '06', labelKey: 'navDatasets', icon: <Database size={16} /> },
      ],
    },
    {
      groupLabelEn: 'Time-Domain Analysis',
      groupLabelAr: 'التحليل الزمني والمقارنة',
      items: [
        { id: 'timeline', code: '07', labelKey: 'navTimeline', icon: <Clock size={16} /> },
        { id: 'comparison', code: '08', labelKey: 'navComparison', icon: <SplitSquareVertical size={16} /> },
      ],
    },
    {
      groupLabelEn: 'Research & Synthesis',
      groupLabelAr: 'الأبحاث والتقارير',
      items: [
        { id: 'assistant', code: '09', labelKey: 'navAssistant', icon: <Sparkles size={16} /> },
        { id: 'workspace', code: '10', labelKey: 'navWorkspace', icon: <FolderKanban size={16} /> },
        { id: 'reports', code: '11', labelKey: 'navReports', icon: <FileCheck2 size={16} /> },
      ],
    },
  ];

  const handleSelect = (modId: AppModule) => {
    setActiveModule(modId);
    if (window.innerWidth < 768) {
      onClose();
    }
  };

  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/75 z-40 md:hidden backdrop-blur-sm"
        />
      )}

      <aside
        id="primary-sidebar"
        aria-label={language === 'ar' ? 'القائمة الرئيسية' : 'Primary Navigation'}
        className={`no-print fixed md:sticky top-0 md:top-14 start-0 h-screen md:h-[calc(100vh-3.5rem)] w-64 bg-[#040816]/82 backdrop-blur-2xl border-e border-cyan-500/15 z-50 md:z-20 transition-transform duration-200 flex flex-col justify-between overflow-y-auto shrink-0 ${
          isOpen
            ? 'translate-x-0'
            : 'max-md:-translate-x-full max-md:rtl:translate-x-full max-md:pointer-events-none md:translate-x-0'
        }`}
      >
        <div>
          <div className="md:hidden flex items-center justify-between px-4 h-14 border-b border-cyan-500/15 bg-[#040917]/90">
            <span className="font-display font-bold text-sm text-white">
              SPHEREx <span className="text-cyan-400">ATLAS</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label={language === 'ar' ? 'إغلاق القائمة' : 'Close Navigation'}
              className="p-1.5 rounded-lg bg-[#091229] border border-cyan-500/25 text-slate-300 hover:text-cyan-300 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-3.5 space-y-5">
            {navGroups.map((group) => (
              <div key={group.groupLabelEn}>
                <div className="px-2.5 pb-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-cyan-400/75 font-semibold">
                  {language === 'ar' ? group.groupLabelAr : group.groupLabelEn}
                </div>
                <nav className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = activeModule === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelect(item.id)}
                        className={`w-full relative flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-start transition-all group ${
                          isActive
                            ? 'bg-gradient-to-r rtl:bg-gradient-to-l from-cyan-500/15 via-[#0D1A36] to-[#091227] text-white border border-cyan-400/40 font-semibold shadow-[0_0_18px_-6px_rgba(34,211,238,0.4)]'
                            : 'text-slate-300/85 hover:text-white hover:bg-slate-800/45 border border-transparent font-medium'
                        }`}
                      >
                        {isActive && (
                          <span className="absolute start-0 top-1.5 bottom-1.5 w-[2.5px] rounded-full bg-cyan-400" />
                        )}
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`shrink-0 transition-colors ${
                              isActive ? 'text-cyan-300' : 'text-slate-400 group-hover:text-cyan-300'
                            }`}
                          >
                            {item.icon}
                          </span>
                          <span className="truncate">{t(item.labelKey)}</span>
                        </span>
                        <span
                          className={`text-[10px] font-mono tabular-nums shrink-0 ${
                            isActive ? 'text-cyan-300' : 'text-slate-500'
                          }`}
                        >
                          {item.code}
                        </span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>
        </div>

        {/* Instrument Specification Baseline */}
        <div className="p-3.5 border-t border-cyan-500/15 bg-[#030612]/90">
          <div className="space-y-1.5 text-[11px] font-mono">
            <div className="text-[10px] text-cyan-400/80 uppercase tracking-wider font-semibold">
              {language === 'ar' ? 'خط الأساس للأداة' : 'Instrument Baseline'}
            </div>
            <div className="flex justify-between text-slate-400">
              <span>{language === 'ar' ? 'المدار' : 'Orbit'}</span>
              <span className="text-slate-200 tabular-nums" dir="ltr">700 km SSPO</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>{language === 'ar' ? 'النطاق' : 'Range'}</span>
              <span className="text-cyan-300 tabular-nums" dir="ltr">0.75–5.00 µm</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>{language === 'ar' ? 'الدقة الزاوية' : 'IFOV'}</span>
              <span className="text-slate-200 tabular-nums" dir="ltr">6.2″ / pixel</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
