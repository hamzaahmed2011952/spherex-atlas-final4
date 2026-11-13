import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { AstroTarget, GaiaCrossMatchSource } from '../../types/astronomy';
import { TARGETS_CATALOG } from '../../data/targetsCatalog';
import {
  Search,
  Bookmark,
  BookmarkCheck,
  FileCode2,
  Activity,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Compass,
  Crosshair,
  Database,
} from 'lucide-react';
import {
  ObservatoryPageHeader,
  ProvenanceNotice,
} from '../ui/ObservatoryPrimitives';

export const TargetIntelligence: React.FC = () => {
  const {
    t,
    language,
    selectedTarget,
    setSelectedTarget,
    savedResearch,
    toggleSaveTarget,
    setActiveModule,
    setArchiveObservations,
    setArchiveSearchMeta,
  } = useApp();

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [onlineQuery, setOnlineQuery] = useState<string>('');
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [resolverResult, setResolverResult] = useState<any | null>(null);
  const [resolverError, setResolverError] = useState<string | null>(null);
  const [archiveSearching, setArchiveSearching] = useState<boolean>(false);
  const [resolvedArchiveResult, setResolvedArchiveResult] = useState<any | null>(null);
  const [gaiaLoading, setGaiaLoading] = useState<boolean>(false);
  const [gaiaError, setGaiaError] = useState<string | null>(null);
  const [gaiaSources, setGaiaSources] = useState<GaiaCrossMatchSource[]>([]);
  const [targetSpherexChecking, setTargetSpherexChecking] = useState<boolean>(false);
  const [targetSpherexStatus, setTargetSpherexStatus] = useState<any | null>(null);
  const resolveAbortRef = React.useRef<AbortController | null>(null);

  useEffect(() => {
    setGaiaSources([]);
    setGaiaError(null);
    setTargetSpherexStatus(null);
  }, [selectedTarget.id]);

  const isSaved = savedResearch.savedTargets.includes(selectedTarget.id);

  const filteredTargets = TARGETS_CATALOG.filter((tgt) => {
    if (categoryFilter === 'all') return true;
    return tgt.category === categoryFilter;
  });

  const handleResolveOnline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onlineQuery.trim()) return;

    if (resolveAbortRef.current) {
      resolveAbortRef.current.abort();
    }
    const controller = new AbortController();
    resolveAbortRef.current = controller;

    setIsResolving(true);
    setResolverError(null);
    setResolverResult(null);
    setResolvedArchiveResult(null);

    try {
      const res = await fetch(
        `/api/astronomy/resolve?target=${encodeURIComponent(onlineQuery.trim())}`,
        { signal: controller.signal }
      );
      const data = await res.json();

      if (res.ok && data.found) {
        setResolverResult(data);

        const existing = TARGETS_CATALOG.find(
          (item) =>
            item.name.toLowerCase().includes(data.target.toLowerCase()) ||
            item.canonicalName.toLowerCase().includes(data.target.toLowerCase())
        );

        if (existing) {
          setSelectedTarget(existing);
        } else {
          const dynamicTarget: AstroTarget = {
            id: `target-resolved-${Date.now()}`,
            name: data.target,
            canonicalName: data.canonicalName || data.target,
            category: 'stellar_laboratory',
            ra: data.ra,
            dec: data.dec,
            raHms: data.raHms,
            decDms: data.decDms,
            spectralType: data.objectType || 'Astronomical Object',
            descriptionEn: `Astronomical object resolved via ${data.provenance || data.source}. Measured coordinates: RA ${data.raHms}, Dec ${data.decDms}.`,
            descriptionAr: `جرم فلكي تم تحليله عبر ${data.provenance || data.source}. الإحداثيات المقاسة: RA ${data.raHms}، Dec ${data.decDms}.`,
            spherexRelevanceEn: 'Subject to all-sky spectrophotometric survey pass observations across 102 channels.',
            spherexRelevanceAr: 'يخضع لمسح سفيريكس الشامل عبر 102 قناة طيفية ضوئية.',
            keyMolecules: [],
            sourceCatalog: data.source || 'CDS Sesame / SIMBAD',
          };
          setSelectedTarget(dynamicTarget);
        }
      } else {
        setResolverError(data.error || 'Failed to resolve astronomical object.');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setResolverError('Network or server error while querying astronomical name resolver.');
    } finally {
      if (resolveAbortRef.current === controller) {
        setIsResolving(false);
      }
    }
  };

  const handleSearchArchiveAtResolved = async () => {
    if (!resolverResult) return;
    setArchiveSearching(true);
    setResolvedArchiveResult(null);
    try {
      const res = await fetch('/api/archive/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ra: resolverResult.ra,
          dec: resolverResult.dec,
          fov: 0.5,
          targetName: resolverResult.target,
        }),
      });
      const data = await res.json();
      setResolvedArchiveResult(data);
      if (res.ok) {
        const obsList = Array.isArray(data.observations) ? data.observations : [];
        setArchiveObservations(obsList);
        setArchiveSearchMeta({
          spherexAvailable: Boolean(data.spherexAvailable),
          dataStatus: data.dataStatus || (obsList.length > 0 ? 'REAL ARCHIVE DATA' : 'UNAVAILABLE DATA'),
          source: data.source || 'NASA/IPAC IRSA TAP (spherex.obscore)',
          notice: data.notice || '',
          ra: resolverResult.ra,
          dec: resolverResult.dec,
          radiusDeg: data.radiusDeg ?? 0.5,
          queryTimeMs: data.queryTimeMs,
        });
      }
    } catch (err: any) {
      setResolvedArchiveResult({
        dataStatus: 'UNAVAILABLE DATA',
        count: 0,
        notice: err.message || 'Failed to query SPHEREx archive',
      });
    } finally {
      setArchiveSearching(false);
    }
  };

  const handleGaiaCrossMatchTarget = async () => {
    setGaiaLoading(true);
    setGaiaError(null);
    try {
      const res = await fetch(
        `/api/catalog/gaia-crossmatch?ra=${selectedTarget.ra}&dec=${selectedTarget.dec}&radiusArcsec=35&epochYear=2025.5&limit=8`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `Gaia DR3 query HTTP ${res.status}`);
      }
      setGaiaSources(
        Array.isArray(data.matches)
          ? data.matches
          : Array.isArray(data.sources)
          ? data.sources
          : []
      );
    } catch (err: any) {
      setGaiaError(err.message || 'Gaia DR3 cross-match failed');
    } finally {
      setGaiaLoading(false);
    }
  };

  const handleCheckTargetArchive = async () => {
    setTargetSpherexChecking(true);
    setTargetSpherexStatus(null);
    try {
      const res = await fetch('/api/archive/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ra: selectedTarget.ra,
          dec: selectedTarget.dec,
          fov: 0.25,
          targetName: selectedTarget.name,
        }),
      });
      const data = await res.json();
      setTargetSpherexStatus(data);
      if (res.ok) {
        const obsList = Array.isArray(data.observations) ? data.observations : [];
        setArchiveObservations(obsList);
        setArchiveSearchMeta({
          spherexAvailable: Boolean(data.spherexAvailable),
          dataStatus: data.dataStatus || (obsList.length > 0 ? 'REAL ARCHIVE DATA' : 'UNAVAILABLE DATA'),
          source: data.source || 'NASA/IPAC IRSA SPHEREx Archive',
          notice: data.notice || '',
          ra: selectedTarget.ra,
          dec: selectedTarget.dec,
          radiusDeg: data.radiusDeg ?? 0.125,
          queryTimeMs: data.queryTimeMs,
        });
      }
    } catch (err: any) {
      setTargetSpherexStatus({ dataStatus: 'UNAVAILABLE DATA', count: 0, notice: err.message });
    } finally {
      setTargetSpherexChecking(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <ObservatoryPageHeader
        kicker="ASTROMETRIC DOSSIER & CATALOG RESOLVER"
        title={t('targetsTitle')}
        subtitle={t('targetsSubtitle')}
        metadata={[
          `${TARGETS_CATALOG.length} Curated Objects`,
          'CDS Sesame / SIMBAD ICRS',
          'IRSA Cone Query',
        ]}
        actions={
          <button
            onClick={() => setActiveModule('sky')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0D162E] hover:bg-[#132042] text-slate-200 border border-slate-700/80 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <Compass size={14} className="text-cyan-400" />
            <span>Open Sky Explorer</span>
          </button>
        }
      />

      {/* Live Target Resolver Console */}
      <section className="p-5 rounded-2xl cosmic-glass space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-sm font-bold text-white">
              External Name Resolver (CDS Sesame / SIMBAD)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Resolve any celestial object identifier (Messier, NGC, WISE, HD, Gaia) to live J2000 coordinates.
            </p>
          </div>

          <form onSubmit={handleResolveOnline} className="flex flex-col sm:flex-row gap-2 w-full lg:w-[480px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={onlineQuery}
                onChange={(e) => setOnlineQuery(e.target.value)}
                placeholder={t('searchOnlinePlaceholder')}
                className="w-full bg-[#060A16] border border-slate-700/80 rounded-lg pl-9 rtl:pl-3 rtl:pr-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/80"
              />
            </div>
            <button
              type="submit"
              disabled={isResolving}
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              {isResolving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>{t('resolvingTarget')}</span>
                </>
              ) : (
                <span>{t('resolveAction')}</span>
              )}
            </button>
          </form>
        </div>

        {resolverError && (
          <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/80 text-xs text-rose-300 flex items-center gap-2 font-mono">
            <AlertCircle size={14} className="shrink-0" />
            <span>{resolverError}</span>
          </div>
        )}

        {resolverResult && (
          <div className="p-3.5 rounded-xl bg-[#060A16] border border-cyan-800/50 space-y-2.5 text-xs font-mono">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="shrink-0" />
                <span>
                  Resolved "{resolverResult.target}" via {resolverResult.source} · RA {resolverResult.raHms} · Dec{' '}
                  {resolverResult.decDms}
                </span>
              </div>
              <ProvenanceNotice status={resolverResult.dataStatus || 'EXTERNAL CATALOG DATA'} compact />
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleSearchArchiveAtResolved}
                disabled={archiveSearching}
                className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-400 text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors"
              >
                {archiveSearching ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>Searching SPHEREx Archive...</span>
                  </>
                ) : (
                  <>
                    <Search size={12} />
                    <span>Search SPHEREx Archive at Resolved Coordinates</span>
                  </>
                )}
              </button>

              {resolvedArchiveResult && (
                <span
                  className={`text-[11px] font-bold ${
                    resolvedArchiveResult.count > 0 ? 'text-emerald-300' : 'text-amber-300'
                  }`}
                >
                  {resolvedArchiveResult.dataStatus ||
                    (resolvedArchiveResult.count > 0 ? 'REAL ARCHIVE DATA' : 'UNAVAILABLE DATA')}
                  : {resolvedArchiveResult.count ?? 0} SPHEREx observations
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Master-Detail Target Index & Dossier */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Target Index */}
        <aside className="lg:col-span-4 space-y-3">
          <div className="flex flex-wrap gap-1 p-1.5 rounded-xl bg-[#090F20] border border-slate-800/90">
            {[
              { id: 'all', label: t('filterAll') },
              { id: 'ice_target', label: t('filterIces') },
              { id: 'deep_field', label: t('filterDeep') },
              { id: 'starburst_galaxy', label: t('filterStarburst') },
              { id: 'exoplanet_host', label: t('filterExoplanet') },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                  categoryFilter === cat.id
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl bg-[#090F20] border border-slate-800/90 divide-y divide-slate-800/70 max-h-[640px] overflow-y-auto">
            {filteredTargets.map((tgt) => {
              const isSelected = selectedTarget.id === tgt.id;
              return (
                <button
                  key={tgt.id}
                  onClick={() => setSelectedTarget(tgt)}
                  className={`w-full text-left rtl:text-right p-4 transition-colors relative block ${
                    isSelected
                      ? 'bg-[#0E1833] text-white'
                      : 'hover:bg-[#0D1428] text-slate-300'
                  }`}
                >
                  {isSelected && (
                    <span
                      className="absolute inset-y-2 left-0 rtl:left-auto rtl:right-0 w-0.5 bg-cyan-400"
                      aria-hidden="true"
                    />
                  )}
                  <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-slate-400 mb-1">
                    <span className={isSelected ? 'text-cyan-300 font-semibold' : ''}>
                      {tgt.category.replace('_', ' ')}
                    </span>
                    <span>{tgt.spectralType?.split(' ')[0] || 'Source'}</span>
                  </div>
                  <div className="font-semibold text-sm text-white truncate">{tgt.name}</div>
                  <div className="text-[11px] font-mono text-slate-400 tabular-nums mt-1 flex justify-between gap-2">
                    <span>RA {tgt.raHms || `${tgt.ra.toFixed(2)}°`}</span>
                    <span>Dec {tgt.decDms || `${tgt.dec.toFixed(2)}°`}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right: Target Scientific Dossier */}
        <section className="lg:col-span-8 rounded-2xl cosmic-glass p-6 sm:p-7 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-800/80">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-cyan-300 uppercase tracking-wider mb-1.5">
                <span>{selectedTarget.category.replace('_', ' ')}</span>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className="text-slate-400">{selectedTarget.sourceCatalog}</span>
                <ProvenanceNotice status={selectedTarget.dataStatus || 'EXTERNAL CATALOG DATA'} compact />
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {selectedTarget.name}
              </h2>
              <p className="text-xs font-mono text-slate-400 mt-1">
                Canonical Identifier: <span className="text-slate-200">{selectedTarget.canonicalName}</span>
              </p>
            </div>

            <button
              onClick={() => toggleSaveTarget(selectedTarget.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors self-start whitespace-nowrap ${
                isSaved
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/70'
                  : 'bg-[#0D162E] text-slate-200 border-slate-700/80 hover:border-cyan-500/70 hover:text-cyan-200'
              }`}
            >
              {isSaved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
              <span>{isSaved ? t('savedToWorkspace') : t('saveToWorkspace')}</span>
            </button>
          </div>

          {/* 4-Column Tabular Coordinates Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-[#060A16] border border-slate-800/80 font-mono">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">RA (J2000)</span>
              <span className="text-sm text-white font-semibold tabular-nums mt-0.5 block">
                {selectedTarget.raHms || `${selectedTarget.ra.toFixed(4)}°`}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Dec (J2000)</span>
              <span className="text-sm text-white font-semibold tabular-nums mt-0.5 block">
                {selectedTarget.decDms || `${selectedTarget.dec.toFixed(4)}°`}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Galactic l</span>
              <span className="text-sm text-cyan-300 font-semibold tabular-nums mt-0.5 block">
                {selectedTarget.l !== undefined ? `${selectedTarget.l.toFixed(2)}°` : '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Galactic b</span>
              <span className="text-sm text-cyan-300 font-semibold tabular-nums mt-0.5 block">
                {selectedTarget.b !== undefined ? `${selectedTarget.b.toFixed(2)}°` : '—'}
              </span>
            </div>
          </div>

          {/* Scientific Narrative */}
          <div className="grid grid-cols-1 gap-5">
            <div>
              <h3 className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Astrophysical Characteristics
              </h3>
              <p className="text-sm text-slate-200 leading-relaxed">
                {language === 'ar' ? selectedTarget.descriptionAr : selectedTarget.descriptionEn}
              </p>
            </div>

            <div>
              <h3 className="text-[11px] font-mono font-bold text-cyan-300 uppercase tracking-wider mb-1.5">
                SPHEREx Mission Relevance
              </h3>
              <p className="text-sm text-slate-200 leading-relaxed">
                {language === 'ar' ? selectedTarget.spherexRelevanceAr : selectedTarget.spherexRelevanceEn}
              </p>
            </div>
          </div>

          {/* Molecular Signatures & Catalog Photometry */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-[#060A16] border border-slate-800/80">
            <div>
              <span className="text-[11px] font-mono font-bold text-slate-400 uppercase block mb-2.5">
                {t('keyInfraredMolecules')}
              </span>
              {selectedTarget.keyMolecules && selectedTarget.keyMolecules.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedTarget.keyMolecules.map((mol, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 rounded bg-[#0C1429] text-cyan-300 border border-slate-700/80 text-[11px] font-mono"
                    >
                      {mol}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-slate-400 text-xs font-mono">
                  Spectral features unverified in external record
                </span>
              )}
            </div>

            <div>
              <span className="text-[11px] font-mono font-bold text-slate-400 uppercase block mb-2.5">
                {t('photometricMagnitudes')}
              </span>
              {selectedTarget.apparentMagnitude ? (
                <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
                  {selectedTarget.apparentMagnitude.j !== undefined && (
                    <div className="px-2.5 py-1.5 rounded bg-[#0C1429] border border-slate-800">
                      <span className="text-slate-400">J </span>
                      <strong className="text-white">{selectedTarget.apparentMagnitude.j}</strong>
                    </div>
                  )}
                  {selectedTarget.apparentMagnitude.h !== undefined && (
                    <div className="px-2.5 py-1.5 rounded bg-[#0C1429] border border-slate-800">
                      <span className="text-slate-400">H </span>
                      <strong className="text-white">{selectedTarget.apparentMagnitude.h}</strong>
                    </div>
                  )}
                  {selectedTarget.apparentMagnitude.ks !== undefined && (
                    <div className="px-2.5 py-1.5 rounded bg-[#0C1429] border border-slate-800">
                      <span className="text-slate-400">Ks </span>
                      <strong className="text-white">{selectedTarget.apparentMagnitude.ks}</strong>
                    </div>
                  )}
                  {selectedTarget.apparentMagnitude.w1 !== undefined && (
                    <div className="px-2.5 py-1.5 rounded bg-[#0C1429] border border-slate-800">
                      <span className="text-slate-400">W1 </span>
                      <strong className="text-cyan-300">{selectedTarget.apparentMagnitude.w1}</strong>
                    </div>
                  )}
                  {selectedTarget.apparentMagnitude.w2 !== undefined && (
                    <div className="px-2.5 py-1.5 rounded bg-[#0C1429] border border-slate-800">
                      <span className="text-slate-400">W2 </span>
                      <strong className="text-cyan-300">{selectedTarget.apparentMagnitude.w2}</strong>
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-slate-400 text-xs font-mono">Cross-match unavailable</span>
              )}
            </div>
          </div>

          {/* Live ESA Gaia DR3 & IRSA Verification Controls */}
          <div className="p-4 rounded-xl bg-[#060A16]/90 border border-slate-800/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] font-mono font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                <Crosshair size={13} />
                <span>Live External Verification (ESA Gaia DR3 &amp; IRSA)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleGaiaCrossMatchTarget}
                  disabled={gaiaLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D162E] hover:bg-[#142244] border border-cyan-500/40 text-cyan-300 text-[11px] font-semibold"
                >
                  {gaiaLoading ? <Loader2 size={12} className="animate-spin" /> : <Crosshair size={12} />}
                  <span>{t('gaiaCrossMatchRun')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCheckTargetArchive}
                  disabled={targetSpherexChecking}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D162E] hover:bg-[#142244] border border-slate-700 text-slate-200 text-[11px] font-semibold"
                >
                  {targetSpherexChecking ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />}
                  <span>Check Live SPHEREx Coverage</span>
                </button>
              </div>
            </div>

            {targetSpherexStatus && (
              <div className="p-2.5 rounded-lg bg-[#040712] border border-slate-800 text-[11px] font-mono flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-200">
                  IRSA Archive: <strong>{targetSpherexStatus.count ?? 0}</strong> matching SPHEREx products
                </span>
                <ProvenanceNotice
                  status={targetSpherexStatus.dataStatus || 'UNAVAILABLE DATA'}
                  compact
                />
              </div>
            )}

            {gaiaError && <div className="text-[11px] font-mono text-rose-300">{gaiaError}</div>}

            {gaiaSources.length > 0 && (
              <div className="overflow-x-auto border-t border-slate-800/70 pt-2">
                <table className="w-full text-left rtl:text-right text-[11px] font-mono border-collapse">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800">
                      <th className="py-1 pr-3">Gaia DR3 Source</th>
                      <th className="py-1 pr-3">Sep (J2016)</th>
                      <th className="py-1 pr-3">Sep (2025.5)</th>
                      <th className="py-1 pr-3">G Mag</th>
                      <th className="py-1 pr-3">Total PM</th>
                      <th className="py-1 pr-3">Parallax</th>
                      <th className="py-1">Class</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 tabular-nums">
                    {gaiaSources.map((src) => (
                      <tr key={src.sourceId}>
                        <td className="py-1.5 pr-3 text-cyan-300">{src.sourceId}</td>
                        <td className="py-1.5 pr-3 text-slate-400">{src.separationArcsec.toFixed(2)}″</td>
                        <td className="py-1.5 pr-3 text-white font-semibold">{src.propagatedSeparationArcsec.toFixed(2)}″</td>
                        <td className="py-1.5 pr-3 text-slate-200">{src.photGMag?.toFixed(2) ?? '—'}</td>
                        <td className="py-1.5 pr-3 text-slate-300">{src.totalPmMasYr ? `${src.totalPmMasYr.toFixed(1)} mas/yr` : '—'}</td>
                        <td className="py-1.5 pr-3 text-slate-300">{src.parallaxMas ? `${src.parallaxMas.toFixed(2)} mas` : '—'}</td>
                        <td className="py-1.5 text-emerald-300">{src.matchClassification}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Workflow Launch Actions */}
          <div className="flex flex-wrap items-center gap-2.5 pt-4 border-t border-slate-800/80">
            <button
              onClick={() => setActiveModule('fits')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap"
            >
              <FileCode2 size={14} />
              <span>{t('viewInFitsLab')}</span>
            </button>

            <button
              onClick={() => setActiveModule('spectra')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#0D162E] hover:bg-[#132042] text-slate-100 border border-slate-700/80 text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <Activity size={14} className="text-cyan-400" />
              <span>{t('viewInSpectra')}</span>
            </button>

            <button
              onClick={() => setActiveModule('assistant')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#0D162E] hover:bg-[#132042] text-slate-100 border border-slate-700/80 text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <Sparkles size={14} className="text-cyan-300" />
              <span>Ask AI About Target</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
