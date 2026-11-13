import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ARCHIVE_DATASETS } from '../../data/missionData';
import { NeossatObservation } from '../../types/astronomy';
import { ExternalLink, Satellite, Search, Loader2, AlertTriangle } from 'lucide-react';
import {
  ObservatoryPageHeader,
  ProvenanceNotice,
} from '../ui/ObservatoryPrimitives';

export const MultiDatasets: React.FC = () => {
  const { t, language } = useApp();

  // CSA NEOSSat / CADC Supplementary Query State
  const [neossatMode, setNeossatMode] = useState<'target' | 'coords'>('target');
  const [neossatTarget, setNeossatTarget] = useState<string>('2024');
  const [neossatRa, setNeossatRa] = useState<string>('180.0');
  const [neossatDec, setNeossatDec] = useState<string>('20.0');
  const [neossatLoading, setNeossatLoading] = useState<boolean>(false);
  const [neossatError, setNeossatError] = useState<string | null>(null);
  const [neossatData, setNeossatData] = useState<{
    dataStatus: string;
    source: string;
    disclaimer: string;
    observations: NeossatObservation[];
    queryTimeMs?: number;
  } | null>(null);

  const handleQueryNeossat = async (e: React.FormEvent) => {
    e.preventDefault();
    setNeossatLoading(true);
    setNeossatError(null);

    try {
      const qs =
        neossatMode === 'coords'
          ? `ra=${encodeURIComponent(neossatRa)}&dec=${encodeURIComponent(neossatDec)}&radiusDeg=2.0`
          : `target=${encodeURIComponent(neossatTarget.trim())}`;
      const res = await fetch(`/api/archive/neossat?${qs}`);
      const json = await res.json();
      if (!res.ok) {
        setNeossatError(json?.error || `CADC TAP returned HTTP ${res.status}`);
        setNeossatData(null);
        return;
      }
      setNeossatData({
        dataStatus: json.dataStatus || 'EXTERNAL CATALOG DATA',
        source: json.source || 'CADC TAP — CSA NEOSSat',
        disclaimer: json.disclaimer || t('neossatDisclaimer'),
        observations: Array.isArray(json.observations) ? json.observations : [],
        queryTimeMs: json.queryTimeMs,
      });
    } catch (err: any) {
      setNeossatError(err?.message || 'Failed to query CADC NEOSSat archive');
    } finally {
      setNeossatLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <ObservatoryPageHeader
        kicker="IRSA & EXTERNAL ARCHIVE CATALOGS"
        title={t('datasetsTitle')}
        subtitle={t('datasetsSubtitle')}
        metadata={[
          `${ARCHIVE_DATASETS.length} Curated Archives`,
          'Caltech IRSA · ESA Gaia DR3 · CSA NEOSSat (CADC)',
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {ARCHIVE_DATASETS.map((ds) => (
          <article
            key={ds.id}
            className="p-5 sm:p-6 rounded-2xl cosmic-glass flex flex-col justify-between gap-4"
          >
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <ProvenanceNotice status={ds.accessStatus} compact />
                <span className="text-[11px] font-mono text-slate-400 truncate">
                  DOI: {ds.doiCitation}
                </span>
              </div>

              <div>
                <h2 className="font-display text-base font-bold text-white">{ds.name}</h2>
                <p className="text-xs font-mono text-cyan-300 mt-0.5">{ds.provider}</p>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {language === 'ar' ? ds.descriptionAr : ds.descriptionEn}
              </p>

              <div className="divide-y divide-slate-800/70 text-xs font-mono bg-[#060A16]/85 px-3.5 py-1 rounded-xl border border-slate-800/80">
                <div className="py-2 flex justify-between gap-2">
                  <span className="text-slate-400">{t('productType')}</span>
                  <span className="text-slate-200 text-right">{ds.productType}</span>
                </div>
                <div className="py-2 flex justify-between gap-2">
                  <span className="text-slate-400">{t('formatSpec')}</span>
                  <span className="text-slate-200 text-right">{ds.format}</span>
                </div>
                <div className="py-2 flex justify-between gap-2">
                  <span className="text-slate-400">{t('coverageArea')}</span>
                  <span className="text-slate-200 text-right">{ds.coverage}</span>
                </div>
                <div className="py-2 flex justify-between gap-2">
                  <span className="text-slate-400">Wavelength</span>
                  <span className="text-cyan-300 font-semibold text-right">{ds.wavelengthRange}</span>
                </div>
              </div>
            </div>

            <a
              href={ds.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 rounded-lg bg-[#0D162E] hover:bg-[#132042] text-cyan-300 border border-slate-700/80 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>{t('openOfficialArchive')}</span>
              <ExternalLink size={13} />
            </a>
          </article>
        ))}
      </div>

      {/* Strictly Isolated Supplementary Archive: CSA NEOSSat / CADC Optical Moving-Object Survey */}
      <section className="p-5 sm:p-6 rounded-2xl cosmic-glass border border-amber-500/35 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-amber-300 font-mono text-[11px] font-bold uppercase tracking-wider">
              <Satellite size={14} />
              <span>{t('neossatDisclaimer')}</span>
            </div>
            <h2 className="font-display text-lg font-bold text-white">
              {t('neossatArchiveTitle')}
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Live TAP query to the Canadian Astronomy Data Centre (CADC CAOM2) for supplementary CSA NEOSSat optical satellite &amp; moving-object exposures. Clearly segregated from NASA SPHEREx infrared data.
            </p>
          </div>
          <ProvenanceNotice status="EXTERNAL CATALOG DATA" compact />
        </div>

        <form onSubmit={handleQueryNeossat} className="flex flex-wrap items-end gap-3 text-xs">
          <div>
            <label className="text-[11px] font-mono text-slate-400 block mb-1">Query Mode</label>
            <select
              value={neossatMode}
              onChange={(e) => setNeossatMode(e.target.value as 'target' | 'coords')}
              className="bg-[#060A16] border border-slate-700/80 rounded-lg px-3 py-2 text-slate-200 font-mono"
            >
              <option value="target">Target / Asteroid Name</option>
              <option value="coords">Sky Position (RA / Dec)</option>
            </select>
          </div>

          {neossatMode === 'target' ? (
            <div className="flex-1 min-w-[200px]">
              <label className="text-[11px] font-mono text-slate-400 block mb-1">
                Target Pattern (CAOM2 NEOSSAT)
              </label>
              <input
                type="text"
                value={neossatTarget}
                onChange={(e) => setNeossatTarget(e.target.value)}
                placeholder="e.g. 2024, APOPHIS, VESTA, ORION"
                className="w-full bg-[#060A16] border border-slate-700/80 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-400"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">RA (deg)</label>
                <input
                  type="text"
                  value={neossatRa}
                  onChange={(e) => setNeossatRa(e.target.value)}
                  className="w-28 bg-[#060A16] border border-slate-700/80 rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">Dec (deg)</label>
                <input
                  type="text"
                  value={neossatDec}
                  onChange={(e) => setNeossatDec(e.target.value)}
                  className="w-28 bg-[#060A16] border border-slate-700/80 rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={neossatLoading}
            className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold inline-flex items-center gap-1.5 transition-colors"
          >
            {neossatLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            <span>Query CADC NEOSSat</span>
          </button>
        </form>

        {neossatError && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs font-mono flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{neossatError}</span>
          </div>
        )}

        {neossatData && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-amber-200/90 bg-amber-950/30 px-3 py-2 rounded-lg border border-amber-500/30">
              <span>{neossatData.disclaimer}</span>
              <span className="tabular-nums text-slate-300">
                {neossatData.observations.length} records
                {neossatData.queryTimeMs ? ` · ${neossatData.queryTimeMs} ms` : ''}
              </span>
            </div>

            {neossatData.observations.length === 0 ? (
              <p className="text-xs font-mono text-slate-400 py-2">
                No NEOSSat exposures matched this filter in CADC CAOM2.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-[#050814]/80">
                <table className="w-full text-left rtl:text-right text-xs font-mono tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400">
                      <th className="py-2 px-3">Obs ID</th>
                      <th className="py-2 px-3">Target</th>
                      <th className="py-2 px-3">RA / Dec</th>
                      <th className="py-2 px-3">Date (UTC)</th>
                      <th className="py-2 px-3">Exposure</th>
                      <th className="py-2 px-3">Instrument</th>
                      <th className="py-2 px-3">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {neossatData.observations.map((obs) => (
                      <tr key={obs.obsId} className="hover:bg-slate-900/40">
                        <td className="py-2 px-3 text-amber-300 font-semibold">{obs.obsId}</td>
                        <td className="py-2 px-3">{obs.targetName}</td>
                        <td className="py-2 px-3 text-slate-300">
                          {obs.ra !== null && obs.dec !== null
                            ? `${obs.ra.toFixed(3)}°, ${obs.dec.toFixed(3)}°`
                            : '—'}
                        </td>
                        <td className="py-2 px-3">{obs.dateStart ? obs.dateStart.slice(0, 19) : 'Unknown'}</td>
                        <td className="py-2 px-3">{obs.exposureSec !== null ? `${obs.exposureSec}s` : '—'}</td>
                        <td className="py-2 px-3 text-slate-400">{obs.instrument}</td>
                        <td className="py-2 px-3">
                          <a
                            href={obs.cadcUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-cyan-300 hover:underline"
                          >
                            <span>CADC</span>
                            <ExternalLink size={11} />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
