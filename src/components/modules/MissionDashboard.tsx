import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Telescope,
  Atom,
  Sparkles,
  Droplets,
  Compass,
  FileCode2,
  Activity,
  ArrowRight,
  Clock,
  SplitSquareVertical,
  Crosshair,
  Orbit,
  Database,
} from 'lucide-react';
import { DETECTOR_ARRAYS, OBSERVATIONS_TIMELINE } from '../../data/missionData';
import { TARGETS_CATALOG } from '../../data/targetsCatalog';
import { SPECTRAL_DATASETS } from '../../data/spectraData';
import {
  DeepSpaceImageFrame,
  MetricReadout,
  ProvenanceNotice,
} from '../ui/ObservatoryPrimitives';

import DEEP_SPACE_SURVEY_IMG from '../../assets/images/hero_deep_space_survey_1794557871041.jpg';
import OBSERVATORY_ORBIT_IMG from '../../assets/images/spherex_observatory_orbit_1794557871557.jpg';

export const MissionDashboard: React.FC = () => {
  const {
    t,
    language,
    setActiveModule,
    setSelectedTarget,
    savedResearch,
    recentTargetIds,
    recentActivity,
    archiveObservations,
    archiveSearchMeta,
    activeFitsImage,
  } = useApp();

  const [visualMode, setVisualMode] = useState<'survey' | 'observatory'>('survey');

  const recentTargets = recentTargetIds
    .map((id) => TARGETS_CATALOG.find((tgt) => tgt.id === id))
    .filter((tgt): tgt is NonNullable<typeof tgt> => Boolean(tgt))
    .slice(0, 4);

  return (
    <div className="space-y-8 pb-12">
      {/* Row 1: Asymmetric Hero & Featured Deep-Space Visual Stage */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Mission Command Briefing */}
        <div className="lg:col-span-7 rounded-2xl cosmic-glass p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-cyan-400/50 via-indigo-400/30 to-transparent pointer-events-none" />
          <div>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-mono text-cyan-300/90 uppercase tracking-[0.14em] mb-3">
              <span>NASA Astrophysics MIDEX</span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span>0.75–5.00 µm</span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span>102 LVF Channels</span>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-[1.15] text-balance">
              {language === 'ar'
                ? 'مرصد سفيريكس أطلس للاستكشاف الطيفي بالأشعة تحت الحمراء'
                : 'SPHEREx All-Sky Near-Infrared Research Console'}
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed mt-3.5 max-w-2xl">
              {t('missionSummary')}
            </p>
          </div>

          <div className="mt-7 pt-6 border-t border-slate-800/80 space-y-5">
            {/* Quick-Access Astronomical Exploration Tools */}
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2.5">
                {language === 'ar' ? 'أدوات الاستكشاف السريع' : 'Quick-Access Exploration Tools'}
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => setActiveModule('sky')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap"
                >
                  <Compass size={15} />
                  <span>{t('navSky')}</span>
                  <ArrowRight size={14} className="rtl:rotate-180" />
                </button>

                <button
                  onClick={() => setActiveModule('targets')}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#0D162E] hover:bg-[#132042] text-slate-100 border border-slate-700/80 text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <Crosshair size={14} className="text-cyan-400" />
                  <span>{t('navTargets')}</span>
                </button>

                <button
                  onClick={() => setActiveModule('fits')}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#0D162E] hover:bg-[#132042] text-slate-100 border border-slate-700/80 text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <FileCode2 size={14} className="text-cyan-400" />
                  <span>{t('navFits')}</span>
                </button>

                <button
                  onClick={() => setActiveModule('comparison')}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#0D162E] hover:bg-[#132042] text-slate-100 border border-slate-700/80 text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <SplitSquareVertical size={14} className="text-blue-400" />
                  <span>{t('navComparison')}</span>
                </button>

                <button
                  onClick={() => setActiveModule('assistant')}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#0D162E] hover:bg-[#132042] text-slate-100 border border-slate-700/80 text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <Sparkles size={14} className="text-cyan-300" />
                  <span>{t('navAssistant')}</span>
                </button>
              </div>
            </div>

            {/* Active Session Baseline Line */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-400 pt-2">
              <span>
                Active FITS:{' '}
                <strong className="text-slate-200">
                  {activeFitsImage ? activeFitsImage.name : 'None'}
                </strong>
              </span>
              <span>
                Archive Query:{' '}
                <strong className={archiveSearchMeta ? 'text-cyan-300' : 'text-slate-400'}>
                  {archiveSearchMeta
                    ? `${archiveObservations.length} observations (${archiveSearchMeta.dataStatus})`
                    : 'Not queried in this session'}
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Featured Deep-Space Visual Stage */}
        <div className="lg:col-span-5 rounded-2xl cosmic-glass p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 px-1.5 pb-2.5">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              {visualMode === 'survey'
                ? 'Deep-Space Infrared Visual'
                : 'SPHEREx Spacecraft Geometry'}
            </span>
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#050915] border border-slate-800">
              <button
                onClick={() => setVisualMode('survey')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                  visualMode === 'survey'
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sky Survey
              </button>
              <button
                onClick={() => setVisualMode('observatory')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                  visualMode === 'observatory'
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Observatory
              </button>
            </div>
          </div>

          <DeepSpaceImageFrame
            src={visualMode === 'survey' ? DEEP_SPACE_SURVEY_IMG : OBSERVATORY_ORBIT_IMG}
            alt={
              visualMode === 'survey'
                ? 'Deep-space near-infrared molecular filaments and extragalactic field'
                : 'SPHEREx space telescope triple-conical photon shield in terminator orbit'
            }
            kicker={visualMode === 'survey' ? 'Infrared Survey Reference' : '6 × Hawaii-2RG LVF Focal Plane'}
            caption={
              visualMode === 'survey'
                ? 'All-sky 0.75–5.00 µm spectrophotometry maps molecular ices, galactic nuclei, and cosmic inflation tracers.'
                : 'Passive cryogenic cooling behind nested photon shields enables 4 all-sky surveys from 700 km polar orbit.'
            }
            fallbackIcon={<Orbit size={36} className="text-cyan-400/70" />}
            className="flex-1 min-h-[260px]"
          />
        </div>
      </section>

      {/* Row 2: Quantitative Metrics Strip (strictly factual, no fabricated statistics) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricReadout
          label={t('statTargetsAvailable')}
          value={TARGETS_CATALOG.length}
          unit="Targets"
          footnote={`${savedResearch.savedTargets.length} saved in workspace`}
          accent="cyan"
        />
        <MetricReadout
          label={t('statSpectraMapped')}
          value={102}
          unit="Bands"
          footnote={`${SPECTRAL_DATASETS.length} reference models (SIMULATED)`}
        />
        <MetricReadout
          label="Live IRSA Products"
          value={archiveSearchMeta ? archiveObservations.length : '—'}
          unit={archiveSearchMeta ? 'Found' : 'Unqueried'}
          footnote={
            archiveSearchMeta
              ? `${archiveSearchMeta.dataStatus}`
              : 'Run IRSA search in Archive Search'
          }
          accent={archiveObservations.length > 0 ? 'emerald' : 'amber'}
        />
        <MetricReadout
          label="Research Notes"
          value={savedResearch.notes.length}
          unit="Logged"
          footnote={`${OBSERVATIONS_TIMELINE.length} baseline mission benchmarks`}
        />
      </section>

      {/* Row 2b: 7-Step Integrated Discovery Pipeline */}
      <section className="rounded-2xl cosmic-glass p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] font-mono uppercase tracking-[0.14em] text-cyan-300 font-semibold">
            {language === 'ar'
              ? 'مسار الاكتشاف الفلكي المتكامل (7 مراحل)'
              : '7-Step End-to-End Scientific Discovery Pipeline'}
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            IRSA TAP/SIA2 · IBE MEF · WCS -TAN · Flipbook · Gaia DR3
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {[
            { step: '01', title: 'Coords', mod: 'sky' as const },
            { step: '02', title: 'IRSA Query', mod: 'sky' as const },
            { step: '03', title: 'MEF Cutouts', mod: 'fits' as const },
            { step: '04', title: 'WCS Align', mod: 'comparison' as const },
            { step: '05', title: 'Flipbook', mod: 'comparison' as const },
            { step: '06', title: 'Diff & Peaks', mod: 'comparison' as const },
            { step: '07', title: 'Gaia & Report', mod: 'reports' as const },
          ].map((item) => (
            <button
              key={item.step}
              onClick={() => setActiveModule(item.mod)}
              className="p-2.5 rounded-xl bg-[#050A18]/85 border border-slate-800/90 hover:border-cyan-400/50 text-left rtl:text-right transition-all group"
            >
              <div className="text-[10px] font-mono text-cyan-400 font-bold">{item.step}</div>
              <div className="text-xs font-semibold text-slate-200 group-hover:text-white truncate mt-0.5">
                {item.title}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Row 3: Recently Accessed Targets & Recent Observation Activity */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recently Accessed Astronomical Targets */}
        <div className="lg:col-span-6 rounded-2xl cosmic-glass p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-800/80">
            <div>
              <h2 className="font-display text-base font-bold text-white">
                {language === 'ar' ? 'الأهداف الفلكية المستعرضة حديثاً' : 'Recently Accessed Targets'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {language === 'ar'
                  ? 'أهداف الجلسة الحالية بإحداثيات J2000 والتصنيف الطيفي'
                  : 'Session catalog objects with J2000 coordinates and quick inspection'}
              </p>
            </div>
            <button
              onClick={() => setActiveModule('targets')}
              className="text-xs text-cyan-300 hover:text-cyan-200 font-semibold inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>All Targets</span>
              <ArrowRight size={13} className="rtl:rotate-180" />
            </button>
          </div>

          <div className="divide-y divide-slate-800/70 mt-2">
            {recentTargets.map((tgt) => (
              <div
                key={tgt.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                    <span className="text-cyan-300">{tgt.category.replace('_', ' ')}</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{tgt.spectralType || 'Catalog Source'}</span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedTarget(tgt);
                      setActiveModule('targets');
                    }}
                    className="text-sm font-bold text-white hover:text-cyan-300 transition-colors text-left rtl:text-right mt-0.5 block truncate"
                  >
                    {tgt.name}
                  </button>
                  <div className="text-[11px] font-mono text-slate-400 tabular-nums mt-0.5">
                    RA {tgt.raHms} · Dec {tgt.decDms}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setSelectedTarget(tgt);
                      setActiveModule('targets');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#0D162E] hover:bg-[#142244] border border-slate-700/80 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
                  >
                    Inspect
                  </button>
                  <button
                    onClick={() => {
                      setSelectedTarget(tgt);
                      setActiveModule('spectra');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#0D162E] hover:bg-[#142244] border border-slate-700/80 text-xs font-medium text-cyan-300 transition-colors whitespace-nowrap"
                  >
                    Spectrum
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Observation & Archive Activity */}
        <div className="lg:col-span-6 rounded-2xl cosmic-glass p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-800/80">
              <div>
                <h2 className="font-display text-base font-bold text-white">
                  {language === 'ar' ? 'نشاط الأرصاد والجلسة الحديثة' : 'Recent Observation Activity'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {recentActivity.length > 0
                    ? 'Verified archive searches and FITS loads from this session'
                    : 'No live archive queries executed yet — showing labeled baseline mission records'}
                </p>
              </div>
              <button
                onClick={() => setActiveModule('timeline')}
                className="text-xs text-cyan-300 hover:text-cyan-200 font-semibold inline-flex items-center gap-1 whitespace-nowrap"
              >
                <span>Timeline</span>
                <ArrowRight size={13} className="rtl:rotate-180" />
              </button>
            </div>

            {recentActivity.length > 0 ? (
              <div className="divide-y divide-slate-800/70 mt-2">
                {recentActivity.slice(0, 4).map((act) => (
                  <div key={act.id} className="py-3.5 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white truncate">
                        {act.title}
                      </span>
                      <ProvenanceNotice status={act.dataStatus} compact />
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1 font-mono">
                      {act.detail}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-slate-800/70 mt-2">
                {OBSERVATIONS_TIMELINE.slice(0, 4).map((obs) => (
                  <div key={obs.id} className="py-3.5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 tabular-nums">
                        <span>{obs.dateStart}</span>
                        <span aria-hidden="true">·</span>
                        <span>{obs.band}</span>
                      </div>
                      <div className="text-sm font-semibold text-white truncate mt-0.5">
                        {obs.targetRegion}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                        RA {obs.ra.toFixed(2)}° · Dec {obs.dec.toFixed(2)}° · {obs.exposureSec}s
                      </div>
                    </div>
                    <ProvenanceNotice
                      status={obs.dataStatus || 'SIMULATED DEMO DATA'}
                      compact
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 mt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-mono text-[11px]">
              IRSA TAP: spherex.obscore
            </span>
            <button
              onClick={() => setActiveModule('sky')}
              className="inline-flex items-center gap-1.5 text-cyan-300 hover:text-cyan-200 font-semibold"
            >
              <Database size={13} />
              <span>Run Live Archive Search</span>
            </button>
          </div>
        </div>
      </section>

      {/* Row 4: Core Science Pillars & 6 LVF Detector Arrays */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-2xl cosmic-glass p-5 sm:p-6 space-y-4">
          <div className="border-b border-slate-800/80 pb-3">
            <h2 className="font-display text-base font-bold text-white">
              SPHEREx Science Pillars
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Core astrophysical objectives across all-sky spectrophotometric passes
            </p>
          </div>

          <div className="divide-y divide-slate-800/70">
            <div className="py-3.5 first:pt-1">
              <div className="flex items-center justify-between text-xs font-mono text-cyan-300 mb-1">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <Atom size={14} /> {t('pillarCosmicInflation')}
                </span>
                <span>σ(f_NL) &lt; 1</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {t('pillarCosmicInflationDesc')}
              </p>
            </div>

            <div className="py-3.5">
              <div className="flex items-center justify-between text-xs font-mono text-sky-300 mb-1">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <Telescope size={14} /> {t('pillarGalaxyEvolution')}
                </span>
                <span>EBL Fluctuations</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {t('pillarGalaxyEvolutionDesc')}
              </p>
            </div>

            <div className="py-3.5 last:pb-1">
              <div className="flex items-center justify-between text-xs font-mono text-blue-300 mb-1">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <Droplets size={14} /> {t('pillarInterstellarIces')}
                </span>
                <span>3.05 &amp; 4.27 µm</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {t('pillarInterstellarIcesDesc')}
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 rounded-2xl cosmic-glass p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800/80 mb-4">
            <div>
              <h2 className="font-display text-base font-bold text-white">
                {t('specHardware')}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                6 × Hawaii-2RG (2048 × 2048 px) Linear Variable Filter Focal Plane Assemblies
              </p>
            </div>
            <button
              onClick={() => setActiveModule('spectra')}
              className="text-xs text-cyan-300 hover:text-cyan-200 font-semibold inline-flex items-center gap-1 whitespace-nowrap"
            >
              <Activity size={13} />
              <span>Open Spectral Studio</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {DETECTOR_ARRAYS.map((arr) => (
              <div
                key={arr.array}
                className="p-3.5 rounded-xl bg-[#060A16] border border-slate-800/80 space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-cyan-300 font-bold">Array {arr.array}</span>
                  <span className="text-slate-200 tabular-nums">{arr.range}</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                  {arr.channels} bands · {arr.resolution}
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed pt-1">
                  {language === 'ar' ? arr.scienceFocusAr : arr.scienceFocusEn}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
