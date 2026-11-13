import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { OBSERVATIONS_TIMELINE } from '../../data/missionData';
import { TARGETS_CATALOG } from '../../data/targetsCatalog';
import { ObservationRecord } from '../../types/astronomy';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Calendar,
  Database,
  ArrowRight,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import {
  createSyntheticFitsBuffer,
  parseFitsBuffer,
  renderFitsToCanvas,
  SyntheticDatasetType,
} from '../../services/fitsEngine';
import {
  ObservatoryPageHeader,
  ProvenanceNotice,
} from '../ui/ObservatoryPrimitives';

const TARGET_EPOCH_RECORDS: Record<string, ObservationRecord[]> = {
  'target-barnards-star': [
    {
      id: 'OBS-BARNARD-EP1',
      surveyPass: 'Multi-Epoch Archive',
      targetRegion: "Barnard's Star (Epoch 2020.5)",
      ra: 269.4521,
      dec: 4.6934,
      dateStart: '2020-06-15',
      dateEnd: '2020-06-15',
      exposureSec: 3600,
      instrument: 'NEOWISE-R W1 (3.4 µm)',
      band: 'W1 (3.4 µm)',
      detectorsActive: [1, 2],
      dataProductLevel: 'Calibrated Archive',
      irsaArchiveId: 'IRSA_WISE_BARNARD_2020',
      status: 'Completed',
      dataStatus: 'SIMULATED DEMO DATA',
      isSimulatedOrDemo: true,
      coverageOverlapCount: 24,
      sciencePillar: 'Time-Domain Astrophysics',
      hasMovingTargetCandidate: true,
      motionNote: 'High Proper Motion Benchmark: Initial 2020 baseline position (PA 355.9°)',
      fitsUrl: 'barnard_star_epoch1',
    },
    {
      id: 'OBS-BARNARD-EP2',
      surveyPass: 'Multi-Epoch Archive',
      targetRegion: "Barnard's Star (Epoch 2024.5)",
      ra: 269.4521,
      dec: 4.7048,
      dateStart: '2024-06-15',
      dateEnd: '2024-06-15',
      exposureSec: 3600,
      instrument: 'NEOWISE-R / SPHEREx Baseline',
      band: 'Array 4 (3.4 µm)',
      detectorsActive: [3, 4],
      dataProductLevel: 'Calibrated Archive',
      irsaArchiveId: 'IRSA_WISE_BARNARD_2024',
      status: 'Completed',
      dataStatus: 'SIMULATED DEMO DATA',
      isSimulatedOrDemo: true,
      coverageOverlapCount: 28,
      sciencePillar: 'Time-Domain Astrophysics',
      hasMovingTargetCandidate: true,
      motionNote: 'Proper Motion Detected: 41.4 arcsec cumulative displacement over 4.0 years (+6.7 pixels northward)',
      fitsUrl: 'barnard_star_epoch2',
    },
  ],
  'target-wise-0855': [
    {
      id: 'OBS-WISE0855-EP1',
      surveyPass: 'Multi-Epoch Archive',
      targetRegion: 'WISE J0855-0714 (Epoch 2021.2)',
      ra: 133.7951,
      dec: -7.2452,
      dateStart: '2021-03-20',
      dateEnd: '2021-03-20',
      exposureSec: 5400,
      instrument: 'WISE Cryogenic Survey W2 (4.6 µm)',
      band: 'W2 (4.6 µm)',
      detectorsActive: [2, 3],
      dataProductLevel: 'Calibrated Archive',
      irsaArchiveId: 'IRSA_WISE_0855_2021',
      status: 'Completed',
      dataStatus: 'SIMULATED DEMO DATA',
      isSimulatedOrDemo: true,
      coverageOverlapCount: 16,
      sciencePillar: 'Interstellar Ices',
      hasMovingTargetCandidate: true,
      motionNote: 'Coldest sub-brown dwarf baseline position (T ~ 250 K)',
      fitsUrl: 'wise0855_epoch1',
    },
    {
      id: 'OBS-WISE0855-EP2',
      surveyPass: 'Multi-Epoch Archive',
      targetRegion: 'WISE J0855-0714 (Epoch 2024.2)',
      ra: 133.7883,
      dec: -7.2446,
      dateStart: '2024-03-20',
      dateEnd: '2024-03-20',
      exposureSec: 5400,
      instrument: 'NEOWISE-R Reactivated W2 (4.6 µm)',
      band: 'W2 (4.6 µm)',
      detectorsActive: [2, 3],
      dataProductLevel: 'Calibrated Archive',
      irsaArchiveId: 'IRSA_WISE_0855_2024',
      status: 'Completed',
      dataStatus: 'SIMULATED DEMO DATA',
      isSimulatedOrDemo: true,
      coverageOverlapCount: 18,
      sciencePillar: 'Interstellar Ices',
      hasMovingTargetCandidate: true,
      motionNote: 'Extreme Sub-Brown Dwarf Motion: 24.6 arcsec shift westward (-3.9 pixels in RA across 3 years)',
      fitsUrl: 'wise0855_epoch2',
    },
  ],
  'target-r-draconis': [
    {
      id: 'OBS-RDRA-MAX',
      surveyPass: 'Survey 1',
      targetRegion: 'R Draconis (Mira Maximum Phase)',
      ra: 248.1675,
      dec: 66.755,
      dateStart: '2025-05-10',
      dateEnd: '2025-05-10',
      exposureSec: 2700,
      instrument: 'SPHEREx LVF Array 3',
      band: 'Array 3 (2.17 µm Ks band)',
      detectorsActive: [3],
      dataProductLevel: 'Level 2 (Calibrated Images)',
      irsaArchiveId: 'SPHEREx_RDRA_MAX_2025',
      status: 'Completed',
      dataStatus: 'SIMULATED DEMO DATA',
      isSimulatedOrDemo: true,
      coverageOverlapCount: 42,
      sciencePillar: 'Time-Domain Astrophysics',
      hasMovingTargetCandidate: false,
      motionNote: 'Mira Maximum: Peak pulsating infrared flux of 820 MJy/sr at central position',
      fitsUrl: 'r_draconis_max',
    },
    {
      id: 'OBS-RDRA-MIN',
      surveyPass: 'Survey 2',
      targetRegion: 'R Draconis (Mira Minimum Phase)',
      ra: 248.1675,
      dec: 66.755,
      dateStart: '2025-09-12',
      dateEnd: '2025-09-12',
      exposureSec: 2700,
      instrument: 'SPHEREx LVF Array 3',
      band: 'Array 3 (2.17 µm Ks band)',
      detectorsActive: [3],
      dataProductLevel: 'Level 2 (Calibrated Images)',
      irsaArchiveId: 'SPHEREx_RDRA_MIN_2025',
      status: 'Completed',
      dataStatus: 'SIMULATED DEMO DATA',
      isSimulatedOrDemo: true,
      coverageOverlapCount: 48,
      sciencePillar: 'Time-Domain Astrophysics',
      hasMovingTargetCandidate: false,
      motionNote: 'Mira Minimum: Pulsation decline to 85 MJy/sr (~10x amplitude variation; zero spatial motion)',
      fitsUrl: 'r_draconis_min',
    },
  ],
  'target-rw-aurigae': [
    {
      id: 'OBS-RWAUR-BRIGHT',
      surveyPass: 'Survey 1',
      targetRegion: 'RW Aurigae (Normal Bright Phase)',
      ra: 76.9563,
      dec: 30.4014,
      dateStart: '2024-11-01',
      dateEnd: '2024-11-01',
      exposureSec: 3000,
      instrument: 'SPHEREx LVF Array 4',
      band: 'Array 4 (3.4 µm)',
      detectorsActive: [4],
      dataProductLevel: 'Level 2 (Calibrated Images)',
      irsaArchiveId: 'SPHEREx_RWAUR_BRIGHT',
      status: 'Completed',
      dataStatus: 'SIMULATED DEMO DATA',
      isSimulatedOrDemo: true,
      coverageOverlapCount: 14,
      sciencePillar: 'Interstellar Ices',
      hasMovingTargetCandidate: false,
      motionNote: 'Unocculted T Tauri accretion state (Flux: 460 MJy/sr)',
      fitsUrl: 'rw_aurigae_bright',
    },
    {
      id: 'OBS-RWAUR-DIM',
      surveyPass: 'Survey 2',
      targetRegion: 'RW Aurigae (Dust Occultation Event)',
      ra: 76.9563,
      dec: 30.4014,
      dateStart: '2025-01-20',
      dateEnd: '2025-01-20',
      exposureSec: 3000,
      instrument: 'SPHEREx LVF Array 4',
      band: 'Array 4 (3.4 µm)',
      detectorsActive: [4],
      dataProductLevel: 'Level 2 (Calibrated Images)',
      irsaArchiveId: 'SPHEREx_RWAUR_DIM',
      status: 'Completed',
      dataStatus: 'SIMULATED DEMO DATA',
      isSimulatedOrDemo: true,
      coverageOverlapCount: 16,
      sciencePillar: 'Interstellar Ices',
      hasMovingTargetCandidate: false,
      motionNote: 'Circumstellar Dust Streamer Occultation: 3.8x flux dimming (Flux: 120 MJy/sr)',
      fitsUrl: 'rw_aurigae_dim',
    },
  ],
  'target-epsilon-indi-b': [
    {
      id: 'OBS-EPSIND-EP1',
      surveyPass: 'Multi-Epoch Archive',
      targetRegion: 'Epsilon Indi B (Epoch 2020.8)',
      ra: 331.0438,
      dec: -56.7828,
      dateStart: '2020-10-15',
      dateEnd: '2020-10-15',
      exposureSec: 3600,
      instrument: 'SPHEREx LVF Array 4',
      band: 'Array 4 (3.32 µm CH4)',
      detectorsActive: [4],
      dataProductLevel: 'Calibrated Archive',
      irsaArchiveId: 'SPHEREx_EPSIND_2020',
      status: 'Completed',
      dataStatus: 'SIMULATED DEMO DATA',
      isSimulatedOrDemo: true,
      coverageOverlapCount: 30,
      sciencePillar: 'Time-Domain Astrophysics',
      hasMovingTargetCandidate: true,
      motionNote: 'T-dwarf binary baseline epoch (pm = 4.70"/yr)',
      fitsUrl: 'epsilon_indi_epoch1',
    },
    {
      id: 'OBS-EPSIND-EP2',
      surveyPass: 'Multi-Epoch Archive',
      targetRegion: 'Epsilon Indi B (Epoch 2024.8)',
      ra: 331.0482,
      dec: -56.7856,
      dateStart: '2024-10-15',
      dateEnd: '2024-10-15',
      exposureSec: 3600,
      instrument: 'SPHEREx LVF Array 4',
      band: 'Array 4 (3.32 µm CH4)',
      detectorsActive: [4],
      dataProductLevel: 'Calibrated Archive',
      irsaArchiveId: 'SPHEREx_EPSIND_2024',
      status: 'Completed',
      dataStatus: 'SIMULATED DEMO DATA',
      isSimulatedOrDemo: true,
      coverageOverlapCount: 34,
      sciencePillar: 'Time-Domain Astrophysics',
      hasMovingTargetCandidate: true,
      motionNote: 'Brown dwarf binary proper motion: 18.8 arcsec cumulative shift over 4.0 years',
      fitsUrl: 'epsilon_indi_epoch2',
    },
  ],
};

export const ObservationTimeline: React.FC = () => {
  const {
    t,
    setActiveModule,
    timelineTarget,
    setTimelineTarget,
    setSelectedTarget,
    archiveObservations,
    setArchiveObservations,
    archiveSearchMeta,
    setArchiveSearchMeta,
    fetchRemoteFits,
  } = useApp();

  const [activeTargetId, setActiveTargetId] = useState<string>(timelineTarget?.id || 'target-barnards-star');
  const [activeObsIndex, setActiveObsIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [useDemoBenchmark, setUseDemoBenchmark] = useState<boolean>(false);
  const [fitsLoading, setFitsLoading] = useState<boolean>(false);
  const [fitsError, setFitsError] = useState<string | null>(null);
  const [targetSearching, setTargetSearching] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (timelineTarget && timelineTarget.id) {
      setActiveTargetId(timelineTarget.id);
      setActiveObsIndex(0);
      setUseDemoBenchmark(false);
    }
  }, [timelineTarget]);

  const currentTarget = TARGETS_CATALOG.find((item) => item.id === activeTargetId);

  const isArchiveMatchesTarget = React.useMemo(() => {
    if (!archiveSearchMeta || !currentTarget) return false;
    const dra = Math.abs(archiveSearchMeta.ra - currentTarget.ra);
    const ddec = Math.abs(archiveSearchMeta.dec - currentTarget.dec);
    return dra < 0.6 && ddec < 0.6;
  }, [archiveSearchMeta, currentTarget]);

  const targetArchiveObs = React.useMemo(() => {
    if (!isArchiveMatchesTarget || !archiveObservations || archiveObservations.length === 0) return [];
    return [...archiveObservations].sort((a, b) =>
      (a.dateStart || '').localeCompare(b.dateStart || '')
    );
  }, [isArchiveMatchesTarget, archiveObservations]);

  const demoObservations: ObservationRecord[] = (
    TARGET_EPOCH_RECORDS[activeTargetId] || OBSERVATIONS_TIMELINE
  ).map((obs) => ({
    ...obs,
    dataStatus: 'SIMULATED DEMO DATA',
    isSimulatedOrDemo: true,
  }));

  const currentObservations: ObservationRecord[] =
    targetArchiveObs.length > 0 && !useDemoBenchmark
      ? targetArchiveObs
      : useDemoBenchmark
      ? demoObservations
      : [];

  const activeObs = currentObservations[activeObsIndex] || currentObservations[0];

  const handleQueryCurrentTargetArchive = async () => {
    if (!currentTarget) return;
    setTargetSearching(true);
    setFitsError(null);
    try {
      const res = await fetch('/api/archive/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ra: currentTarget.ra,
          dec: currentTarget.dec,
          fov: 0.5,
          targetName: currentTarget.name,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const obsList = Array.isArray(data.observations) ? data.observations : [];
        setArchiveObservations(obsList);
        setArchiveSearchMeta({
          spherexAvailable: Boolean(data.spherexAvailable),
          dataStatus: data.dataStatus || (obsList.length > 0 ? 'REAL ARCHIVE DATA' : 'UNAVAILABLE DATA'),
          source: data.source || 'NASA/IPAC IRSA TAP (spherex.obscore)',
          notice: data.notice || '',
          ra: currentTarget.ra,
          dec: currentTarget.dec,
          radiusDeg: 0.25,
          queryTimeMs: data.queryTimeMs,
        });
        setUseDemoBenchmark(false);
        setActiveObsIndex(0);
      }
    } catch (err: any) {
      setFitsError(err.message || 'Failed to query archive for target');
    } finally {
      setTargetSearching(false);
    }
  };

  useEffect(() => {
    if (!isPlaying || currentObservations.length <= 1) return;
    const intervalMs = 1600 / playbackSpeed;
    const timer = setInterval(() => {
      setActiveObsIndex((prev) => (prev + 1) % currentObservations.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, currentObservations.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeObs) return;

    const controller = new AbortController();
    setFitsError(null);

    if ((activeObs.cutoutUrl || activeObs.accessUrl) && !activeObs.isSimulatedOrDemo) {
      setFitsLoading(true);
      const targetUrl = activeObs.cutoutUrl || activeObs.accessUrl!;
      fetchRemoteFits(targetUrl, controller.signal, {
        ra: activeObs.ra,
        dec: activeObs.dec,
        size: 0.04,
      })
        .then((hdu) => {
          if (!controller.signal.aborted) {
            renderFitsToCanvas(hdu, canvas, hdu.min, hdu.max * 0.9, 'asinh', 'inferno');
          }
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            setFitsError(err.message || 'Failed to load remote FITS product');
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setFitsLoading(false);
          }
        });
    } else {
      try {
        const datasetKey = (activeObs.fitsUrl as SyntheticDatasetType) || 'cosmos_nir';
        const buf = createSyntheticFitsBuffer(datasetKey);
        const hdu = parseFitsBuffer(buf, {
          dataStatus: 'SIMULATED DEMO DATA',
          isSimulatedOrDemo: true,
          provenance: 'SPHEREx ATLAS Benchmark Simulation (Demo)',
        });
        renderFitsToCanvas(hdu, canvas, hdu.min, hdu.max * 0.9, 'asinh', 'inferno');
      } catch (err) {
        console.error('Failed to render timeline observation canvas:', err);
      }
    }

    return () => controller.abort();
  }, [activeObs, fetchRemoteFits]);

  const handleNext = () => {
    setActiveObsIndex((prev) => (prev + 1) % currentObservations.length);
  };

  const handlePrev = () => {
    setActiveObsIndex((prev) => (prev - 1 + currentObservations.length) % currentObservations.length);
  };

  return (
    <div className="space-y-6 pb-12">
      <ObservatoryPageHeader
        kicker="TIME-DOMAIN & PROPER MOTION · EPOCH SEQUENCER"
        title={t('timelineTitle')}
        subtitle="Retrieve multi-epoch exposures across survey dates, animate proper motion versus variability, and jump across chronological passes."
        actions={
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400">Sequence:</span>
            <select
              value={activeTargetId}
              onChange={(e) => {
                setActiveTargetId(e.target.value);
                setActiveObsIndex(0);
                setIsPlaying(false);
                const found = TARGETS_CATALOG.find((item) => item.id === e.target.value);
                if (found) {
                  setSelectedTarget(found);
                  setTimelineTarget(found);
                }
              }}
              className="bg-[#090F20] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-cyan-200 font-mono font-semibold focus:outline-none focus:border-cyan-500"
            >
              <option value="target-barnards-star">Barnard&apos;s Star (10.3&quot;/yr)</option>
              <option value="target-wise-0855">WISE 0855 (8.2&quot;/yr)</option>
              <option value="target-r-draconis">R Draconis (Mira Pulsation)</option>
              <option value="target-rw-aurigae">RW Aurigae (Dust Occultation)</option>
              <option value="target-epsilon-indi-b">Epsilon Indi B (4.7&quot;/yr)</option>
              <option value="all-sky">SPHEREx Baseline Passes</option>
            </select>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Playback Stage + Interactive Epoch Filmstrip */}
        <section className="lg:col-span-8 space-y-4">
          <div className="rounded-2xl cosmic-glass p-4 sm:p-5 space-y-4">
            {!activeObs ? (
              <div className="py-16 px-6 text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-950/50 border border-amber-500/40 text-amber-300 text-xs font-mono font-semibold">
                  <AlertCircle size={14} />
                  <span>UNAVAILABLE DATA — No Real SPHEREx Archive Observations Loaded</span>
                </div>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  Query IRSA TAP directly for {currentTarget?.name || 'this region'} or load the labeled educational benchmark sequence to inspect multi-epoch proper motion and variability.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                  {currentTarget && (
                    <button
                      onClick={handleQueryCurrentTargetArchive}
                      disabled={targetSearching}
                      className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-400 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                    >
                      {targetSearching ? (
                        <>
                          <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-950/20 border-t-slate-950 animate-spin" />
                          <span>Searching Archive...</span>
                        </>
                      ) : (
                        <span>Query SPHEREx Archive</span>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => setActiveModule('sky')}
                    className="px-3.5 py-2 rounded-lg bg-[#0D162E] hover:bg-[#132042] text-slate-200 border border-slate-700/80 text-xs font-semibold transition-colors"
                  >
                    Open in Sky Explorer
                  </button>
                  <button
                    onClick={() => {
                      setUseDemoBenchmark(true);
                      setActiveObsIndex(0);
                    }}
                    className="px-3.5 py-2 rounded-lg bg-amber-950/40 hover:bg-amber-950/60 text-amber-300 border border-amber-500/40 text-xs font-semibold transition-colors"
                  >
                    Load Benchmark Simulation (Demo)
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono pb-2 border-b border-slate-800/80">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-cyan-300 font-bold">{activeObs.targetRegion}</span>
                    <span className="text-slate-600" aria-hidden="true">·</span>
                    <span className="text-emerald-300 tabular-nums">{activeObs.dateStart}</span>
                    <span className="text-slate-600" aria-hidden="true">·</span>
                    <span className="text-slate-400">{activeObs.instrument}</span>
                  </div>
                  <ProvenanceNotice
                    status={
                      activeObs.isSimulatedOrDemo
                        ? 'SIMULATED DEMO DATA'
                        : activeObs.dataStatus || 'REAL ARCHIVE DATA'
                    }
                    compact
                  />
                </div>

                {/* Canvas Stage */}
                <div className="relative rounded-xl border border-slate-800/90 bg-[#03050C] overflow-hidden flex items-center justify-center min-h-[360px]">
                  <canvas
                    ref={canvasRef}
                    className="max-h-[380px] w-auto image-rendering-pixelated"
                  />

                  {fitsLoading && (
                    <div className="absolute inset-0 bg-[#03050C]/85 flex items-center justify-center text-xs font-mono text-cyan-300">
                      Retrieving FITS product from NASA/IPAC IRSA...
                    </div>
                  )}

                  {fitsError && (
                    <div className="absolute bottom-3 left-3 right-3 p-2.5 rounded-lg bg-rose-950/90 border border-rose-500/40 text-[11px] font-mono text-rose-200">
                      {fitsError}
                    </div>
                  )}

                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-[#050814]/90 border border-slate-800 text-[11px] font-mono text-white flex items-center gap-1.5 tabular-nums">
                    <Calendar size={12} className="text-cyan-400" />
                    <span>{activeObs.dateStart}</span>
                  </div>

                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-[#050814]/90 border border-cyan-500/35 text-[11px] font-mono text-cyan-300 tabular-nums">
                    Epoch {activeObsIndex + 1} / {currentObservations.length}
                  </div>
                </div>

                {/* Clickable Chronological Epoch Filmstrip */}
                {currentObservations.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                      Chronological Epoch Track
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {currentObservations.map((obs, idx) => {
                        const isActive = idx === activeObsIndex;
                        return (
                          <button
                            key={obs.id}
                            onClick={() => {
                              setActiveObsIndex(idx);
                              setIsPlaying(false);
                            }}
                            className={`text-left rtl:text-right p-2.5 rounded-lg border transition-colors ${
                              isActive
                                ? 'bg-[#0F1B38] border-cyan-500/70 text-white'
                                : 'bg-[#060A16] border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                            }`}
                          >
                            <div className="text-[10px] font-mono tabular-nums text-cyan-300 font-semibold">
                              Epoch {idx + 1} · {obs.dateStart}
                            </div>
                            <div className="text-[11px] font-medium truncate mt-0.5">
                              {obs.band}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Transport Controls */}
            <div className="p-3 rounded-xl bg-[#060A16] border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="w-full sm:flex-1 flex items-center gap-3 tabular-nums">
                <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
                  {currentObservations.length > 0 ? activeObsIndex + 1 : 0} / {currentObservations.length}
                </span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, currentObservations.length - 1)}
                  value={activeObsIndex}
                  disabled={currentObservations.length <= 1}
                  onChange={(e) => {
                    setActiveObsIndex(Number(e.target.value));
                    setIsPlaying(false);
                  }}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handlePrev}
                  disabled={currentObservations.length <= 1}
                  className="p-2 rounded-lg bg-[#0D162E] hover:bg-[#132042] disabled:opacity-40 text-slate-200 border border-slate-800"
                  title="Previous Epoch"
                >
                  <SkipBack size={14} />
                </button>

                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  disabled={currentObservations.length <= 1}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors disabled:opacity-40 whitespace-nowrap ${
                    isPlaying
                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                  }`}
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>

                <button
                  onClick={handleNext}
                  disabled={currentObservations.length <= 1}
                  className="p-2 rounded-lg bg-[#0D162E] hover:bg-[#132042] disabled:opacity-40 text-slate-200 border border-slate-800"
                  title="Next Epoch"
                >
                  <SkipForward size={14} />
                </button>

                <div className="flex rounded-lg bg-[#090F20] border border-slate-800 p-0.5 text-[11px] font-mono ms-1">
                  {[0.5, 1.0, 2.0].map((s) => (
                    <button
                      key={s}
                      onClick={() => setPlaybackSpeed(s)}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        playbackSpeed === s
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {activeObs?.motionNote && (
            <div className="p-5 rounded-2xl cosmic-glass flex items-start gap-3">
              <Sparkles
                size={18}
                className={
                  activeObs.hasMovingTargetCandidate
                    ? 'text-amber-300 shrink-0 mt-0.5'
                    : 'text-cyan-400 shrink-0 mt-0.5'
                }
              />
              <div className="space-y-2 flex-1">
                <div className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                  {activeObs.hasMovingTargetCandidate
                    ? 'Identified Proper Motion Candidate'
                    : 'Time-Domain Flux Variability (Stationary Source)'}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-mono">
                  {activeObs.motionNote}
                </p>
                <div className="flex flex-wrap gap-2 pt-0.5">
                  <button
                    onClick={() => setActiveModule('comparison')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors"
                  >
                    <span>Open Epoch Stack in Flipbook</span>
                    <ArrowRight size={13} className="rtl:rotate-180" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Right: Observation Record Dossier */}
        <aside className="lg:col-span-4 space-y-4">
          {activeObs && (
            <div className="p-5 rounded-2xl cosmic-glass space-y-4">
              <div className="border-b border-slate-800/80 pb-3">
                <span className="text-[10px] font-mono text-cyan-300 uppercase font-bold tracking-wider block mb-1">
                  {activeObs.surveyPass} Dossier
                </span>
                <h2 className="font-display text-lg font-bold text-white">
                  {activeObs.targetRegion}
                </h2>
                <p className="text-xs font-mono text-slate-400 mt-0.5">
                  Record: {activeObs.id}
                </p>
              </div>

              <div className="space-y-2 text-xs font-mono tabular-nums">
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-400">Timestamp</span>
                  <span className="text-white font-semibold">{activeObs.dateStart}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-400">Coordinates</span>
                  <span className="text-cyan-300">
                    {activeObs.ra.toFixed(4)}°, {activeObs.dec.toFixed(4)}°
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-400">Band / Filter</span>
                  <span className="text-white">{activeObs.band}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-400">{t('totalExposure')}</span>
                  <span className="text-cyan-300 font-semibold">{activeObs.exposureSec}s</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-400">Overlap Passes</span>
                  <span className="text-emerald-300 font-semibold">
                    {activeObs.coverageOverlapCount} passes
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-400">Product Level</span>
                  <span className="text-white">{activeObs.dataProductLevel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Archive ID</span>
                  <span className="text-cyan-300 truncate max-w-[160px]">{activeObs.irsaArchiveId}</span>
                </div>
              </div>

              <div className="pt-1">
                <span className="text-[11px] font-mono text-slate-400 uppercase block mb-2">
                  LVF Detector Arrays
                </span>
                <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[11px]">
                  {[1, 2, 3, 4, 5, 6].map((arr) => {
                    const isActive = activeObs.detectorsActive?.includes(arr);
                    return (
                      <div
                        key={arr}
                        className={`py-1.5 rounded-md font-semibold border ${
                          isActive
                            ? 'bg-[#0F1B38] border-cyan-500/60 text-cyan-200'
                            : 'bg-[#060A16] border-slate-800 text-slate-500'
                        }`}
                      >
                        Array {arr}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#060A16] border border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
                <div className="flex items-center gap-1.5 text-cyan-300 font-semibold mb-1">
                  <Database size={12} />
                  <span>NASA / IPAC Infrared Science Archive</span>
                </div>
                Level 2 &amp; Level 3 calibrated images with full spatial WCS are hosted at Caltech IRSA.
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
