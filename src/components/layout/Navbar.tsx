import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Telescope,
  Languages,
  Search,
  Sparkles,
  FileText,
  Crosshair,
  Menu,
  X,
} from 'lucide-react';
import { TARGETS_CATALOG } from '../../data/targetsCatalog';

interface NavbarProps {
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, sidebarOpen }) => {
  const { language, setLanguage, t, activeModule, setActiveModule, selectedTarget, setSelectedTarget } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredTargets = searchQuery.trim()
    ? TARGETS_CATALOG.filter(
        (item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.canonicalName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleSelectSearchTarget = (target: any) => {
    setSelectedTarget(target);
    setSearchQuery('');
    setShowSearchDropdown(false);
    setActiveModule('targets');
  };

  return (
    <header className="no-print sticky top-0 z-40 h-14 bg-[#040917]/80 backdrop-blur-2xl border-b border-cyan-500/20 text-slate-100 px-3 sm:px-6 flex items-center shadow-[0_6px_28px_-12px_rgba(6,182,212,0.22)]">
      <div className="max-w-[1440px] w-full mx-auto flex items-center justify-between gap-2 sm:gap-6">
        {/* Zone 1: Mobile toggle + clean single-line Brand Wordmark */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="md:hidden p-1.5 sm:p-2 rounded-lg bg-[#091229] border border-cyan-500/25 text-slate-300 hover:text-cyan-300 transition-colors"
            aria-label={language === 'ar' ? 'تبديل قائمة التنقل' : 'Toggle Navigation'}
            aria-expanded={sidebarOpen}
            aria-controls="primary-sidebar"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <button
            type="button"
            onClick={() => setActiveModule('mission')}
            className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group text-start whitespace-nowrap shrink-0"
          >
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-indigo-600/25 border border-cyan-400/45 flex items-center justify-center text-cyan-300 group-hover:border-cyan-300 group-hover:shadow-[0_0_16px_rgba(34,211,238,0.35)] transition-all shrink-0">
              <Telescope size={15} />
            </span>
            <span className="font-display font-bold tracking-tight text-sm sm:text-base text-white group-hover:text-cyan-200 transition-colors">
              SPHEREx <span className="text-cyan-400">ATLAS</span>
            </span>
          </button>
        </div>

        {/* Zone 2: Quick Catalog Jump Search */}
        <div ref={searchContainerRef} className="relative flex-1 max-w-md hidden lg:block">
          <div className="relative">
            <Search className="absolute start-3 top-2.5 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchDropdown(true);
              }}
              onFocus={() => setShowSearchDropdown(true)}
              placeholder={t('searchOnlinePlaceholder')}
              className="w-full bg-[#080E1F] border border-slate-800 rounded-lg ps-9 pe-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/70 transition-colors"
            />
          </div>

          {showSearchDropdown && filteredTargets.length > 0 && (
            <div className="absolute top-full mt-1.5 w-full bg-[#091024] border border-slate-700/80 rounded-xl shadow-2xl py-1 z-50 max-h-64 overflow-y-auto">
              {filteredTargets.map((tgt) => (
                <button
                  key={tgt.id}
                  onClick={() => handleSelectSearchTarget(tgt)}
                  className="w-full text-left rtl:text-right px-3.5 py-2.5 text-xs hover:bg-slate-800/70 text-slate-200 flex items-center justify-between gap-3 border-b border-slate-800/60 last:border-none transition-colors"
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-white block truncate">{tgt.name}</span>
                    <span className="text-[11px] text-slate-400 font-mono block">
                      {tgt.raHms} · {tgt.decDms}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-cyan-300/90 whitespace-nowrap shrink-0">
                    {tgt.category.replace('_', ' ')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Zone 3: Active Target, Workspace Actions & Language */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={() => setActiveModule('targets')}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#090F20] border border-slate-800 text-xs text-slate-200 hover:border-cyan-500/50 transition-colors whitespace-nowrap shrink-0"
            title="Inspect Active Target"
          >
            <Crosshair size={13} className="text-cyan-400 shrink-0" />
            <span className="max-w-[130px] truncate font-mono text-[11px]">
              {selectedTarget.name.split('/')[0].trim()}
            </span>
          </button>

          <button
            onClick={() => setActiveModule('assistant')}
            className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 border ${
              activeModule === 'assistant'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                : 'bg-[#090F20] border-slate-800 text-slate-200 hover:border-cyan-500/50 hover:text-cyan-300'
            }`}
            title={t('navAssistant')}
          >
            <Sparkles size={13} className="shrink-0" />
            <span className="hidden md:inline">{language === 'ar' ? 'المساعد الذكي' : 'AI Assistant'}</span>
          </button>

          <button
            onClick={() => setActiveModule('reports')}
            className={`px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 border ${
              activeModule === 'reports'
                ? 'bg-slate-800 text-white border-cyan-500/50'
                : 'bg-[#090F20] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
            }`}
            title={t('navReports')}
          >
            <FileText size={13} className="shrink-0" />
            <span className="hidden xl:inline">{t('navReports')}</span>
          </button>

          <button
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg bg-[#090F20] border border-slate-800 text-xs font-medium text-slate-200 hover:border-cyan-500/50 hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
            title="Switch Language (English / العربية)"
          >
            <Languages size={13} className="text-cyan-400 shrink-0" />
            <span>{t('languageToggle')}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
