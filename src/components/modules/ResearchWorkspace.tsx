import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { TARGETS_CATALOG } from '../../data/targetsCatalog';
import {
  Plus,
  Trash2,
  Download,
  Upload,
  Bookmark,
  Calendar,
  Layers,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { ObservatoryPageHeader } from '../ui/ObservatoryPrimitives';

export const ResearchWorkspace: React.FC = () => {
  const {
    t,
    language,
    savedResearch,
    addResearchNote,
    deleteResearchNote,
    toggleSaveTarget,
    exportWorkspaceJson,
    importWorkspaceJson,
    setSelectedTarget,
    setActiveModule,
  } = useApp();

  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteTag, setNewNoteTag] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || !newNoteContent.trim()) return;

    const tags = newNoteTag
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    addResearchNote(newNoteTitle.trim(), newNoteContent.trim(), tags);
    setNewNoteTitle('');
    setNewNoteContent('');
    setNewNoteTag('');
  };

  const handleDownloadExport = () => {
    const jsonStr = exportWorkspaceJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SPHEREx_ATLAS_Research_Workspace_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = importWorkspaceJson(content);
      if (success) {
        setImportStatus('Workspace imported successfully.');
        setTimeout(() => setImportStatus(null), 3500);
      } else {
        setImportStatus('Failed to import: invalid workspace JSON format.');
      }
    };
    reader.readAsText(file);
  };

  const savedTargetObjects = TARGETS_CATALOG.filter((tgt) =>
    savedResearch.savedTargets.includes(tgt.id)
  );

  return (
    <div className="space-y-6 pb-12">
      <ObservatoryPageHeader
        kicker="INVESTIGATOR LOGBOOK & SAVED COLLECTIONS"
        title={t('workspaceTitle')}
        subtitle={t('workspaceSubtitle')}
        metadata={[
          `${savedTargetObjects.length} Saved Targets`,
          `${savedResearch.notes.length} Notes`,
          'LocalStorage Persistent',
        ]}
        actions={
          <>
            <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0D162E] hover:bg-[#132042] text-slate-200 border border-slate-700/80 text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap">
              <Upload size={14} />
              <span>{t('importWorkspace')}</span>
              <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
            </label>

            <button
              onClick={handleDownloadExport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap"
            >
              <Download size={14} />
              <span>{t('exportWorkspace')}</span>
            </button>
          </>
        }
      />

      {importStatus && (
        <div className="p-3 rounded-xl bg-cyan-950/50 border border-cyan-700/70 text-cyan-200 text-xs flex items-center gap-2 font-mono">
          <CheckCircle2 size={15} />
          <span>{importStatus}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Saved Targets & Collections */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="p-4 rounded-2xl cosmic-glass space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Bookmark size={13} className="text-cyan-400" />
                <span>{t('savedTargetsList')}</span>
              </h2>
              <span className="text-[11px] font-mono text-cyan-300 font-semibold tabular-nums">
                {savedTargetObjects.length}
              </span>
            </div>

            {savedTargetObjects.length === 0 ? (
              <p className="text-xs text-slate-400">
                No targets saved yet. Select any object in Targets &amp; Objects to bookmark it here.
              </p>
            ) : (
              <div className="divide-y divide-slate-800/70 max-h-72 overflow-y-auto">
                {savedTargetObjects.map((tgt) => (
                  <div
                    key={tgt.id}
                    className="py-2.5 flex items-center justify-between text-xs gap-2"
                  >
                    <button
                      onClick={() => {
                        setSelectedTarget(tgt);
                        setActiveModule('targets');
                      }}
                      className="text-left rtl:text-right truncate flex-1 hover:text-cyan-300 transition-colors"
                    >
                      <span className="font-semibold text-white block truncate">{tgt.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {tgt.category.replace('_', ' ')}
                      </span>
                    </button>

                    <button
                      onClick={() => toggleSaveTarget(tgt.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                      title="Remove target"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 rounded-2xl cosmic-glass space-y-3">
            <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers size={13} className="text-cyan-400" />
              <span>Curated Research Collections</span>
            </h3>

            <div className="divide-y divide-slate-800/70">
              {savedResearch.collections.map((col) => (
                <div key={col.id} className="py-3 first:pt-1 last:pb-1 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-cyan-300">
                      {language === 'ar' ? col.nameAr : col.nameEn}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                      {col.targetIds.length} items
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {language === 'ar' ? col.descriptionAr : col.descriptionEn}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Right: Logbook Composer & Notes Stream */}
        <section className="lg:col-span-8 space-y-4">
          <div className="p-5 rounded-2xl cosmic-glass space-y-3">
            <h2 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Plus size={13} className="text-cyan-400" />
              <span>{t('createNewNote')}</span>
            </h2>

            <form onSubmit={handleCreateNote} className="space-y-3">
              <input
                type="text"
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                placeholder={t('noteTitle')}
                className="w-full bg-[#060A16] border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/70 transition-colors"
              />

              <textarea
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                rows={3}
                placeholder={t('noteContent')}
                className="w-full bg-[#060A16] border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/70 leading-relaxed resize-none transition-colors"
              />

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newNoteTag}
                  onChange={(e) => setNewNoteTag(e.target.value)}
                  placeholder="Tags (comma separated, e.g. Ices, Array 4, Column Density)"
                  className="flex-1 bg-[#060A16] border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/70 font-mono transition-colors"
                />

                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap"
                >
                  {t('saveNote')}
                </button>
              </div>
            </form>
          </div>

          <div className="p-5 rounded-2xl cosmic-glass space-y-3">
            <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <FileText size={13} className="text-cyan-400" />
              <span>Investigator Notes ({savedResearch.notes.length})</span>
            </h3>

            {savedResearch.notes.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">{t('noNotesYet')}</p>
            ) : (
              <div className="divide-y divide-slate-800/70">
                {savedResearch.notes.map((note) => (
                  <article key={note.id} className="py-4 first:pt-2 last:pb-1 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-display font-bold text-white text-sm">{note.title}</h4>
                      <button
                        onClick={() => deleteResearchNote(note.id)}
                        className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                        title={t('deleteNote')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {note.content}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10px] font-mono text-slate-400 tabular-nums">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar size={11} />
                        <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                      </span>

                      <div className="flex flex-wrap gap-1.5">
                        {note.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-[#060A16] text-cyan-300 border border-slate-800"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
