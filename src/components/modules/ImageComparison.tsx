import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Sparkles,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Layers,
  Crosshair,
  Database,
  Loader2,
  AlertTriangle,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import {
  createSyntheticFitsBuffer,
  parseFitsBuffer,
  renderFitsToCanvas,
  computeImageDifference,
  ImageDiffResult,
  SyntheticDatasetType,
} from '../../services/fitsEngine';
import {
  FitsImageHDU,
  GaiaCrossMatchSource,
  StretchAlgorithm,
  ColormapPalette,
  CandidateDetection,
} from '../../types/astronomy';
import {
  MetricReadout,
  ObservatoryPageHeader,
  ProvenanceNotice,
} from '../ui/ObservatoryPrimitives';

interface ComparisonPair {
  id: string;
  name: string;
  targetCategory: 'proper_motion' | 'pulsation' | 'dust_occultation' | 'cross_band';
  labelA: string;
  labelB: string;
  dateA: string;
  dateB: string;
  typeA: SyntheticDatasetType;
  typeB: SyntheticDatasetType;
  scientificContextEn: string;
  scientificContextAr: string;
}

interface EpochFrame {
  id: string;
  label: string;
  dateLabel: string;
  band: string;
  ra?: number;
  dec?: number;
  hdu: FitsImageHDU;
  isSimulated: boolean;
}

interface CandidateGaiaState {
  loading: boolean;
  error?: string;
  sources?: GaiaCrossMatchSource[];
}

const COMPARISON_PAIRS: ComparisonPair[] = [
  {
    id: 'pair-barnard',
    name: "Barnard's Star (10.3\"/yr Proper Motion)",
    targetCategory: 'proper_motion',
    labelA: "Barnard's Star (Epoch 2020.5)",
    labelB: "Barnard's Star (Epoch 2024.5)",
    dateA: '2020-06-15',
    dateB: '2024-06-15',
    typeA: 'barnard_star_epoch1',
    typeB: 'barnard_star_epoch2',
    scientificContextEn:
      'Synthetic benchmark modeling a dipolar PSF residual: a flux deficit at the 2020 position alongside a positive flux excess at the 2024 position, illustrating candidate spatial displacement (+10.3 arcsec/yr) rather than intrinsic photometric variability.',
    scientificContextAr:
      'نموذج اصطناعي مرجعي يوضح نمطاً ثنائي القطب للحركة الذاتية: عجز في التدفق بموقع 2020 وفائض موجب بموقع 2024، كنموذج لإزاحة مكانية مرشحة بدلاً من تغير سطوعي.',
  },
  {
    id: 'pair-wise0855',
    name: 'WISE 0855 (Coldest Sub-Brown Dwarf)',
    targetCategory: 'proper_motion',
    labelA: 'WISE J0855-0714 (Epoch 2021.2)',
    labelB: 'WISE J0855-0714 (Epoch 2024.2)',
    dateA: '2021-03-20',
    dateB: '2024-03-20',
    typeA: 'wise0855_epoch1',
    typeB: 'wise0855_epoch2',
    scientificContextEn:
      'Synthetic simulation of sub-brown dwarf with T ~ 250 K exhibiting westward proper motion (8.19 arcsec/yr). Difference subtraction highlights the displacement between consecutive 3-year epochs against stationary background field stars.',
    scientificContextAr:
      'محاكاة اصطناعية لقزم شبه بني بحرارة 250 كلفن يُظهر حركة ذاتية غربية (8.19 ثانية قوسية/سنة). يُبرز الطرح الإزاحة عبر فترة 3 سنوات مقارنة بنجوم الخلفية الثابتة.',
  },
  {
    id: 'pair-r-draconis',
    name: 'R Draconis (Extreme Mira Variable)',
    targetCategory: 'pulsation',
    labelA: 'R Draconis (Mira Maximum Phase)',
    labelB: 'R Draconis (Mira Minimum Phase)',
    dateA: '2025-05-10',
    dateB: '2025-09-12',
    typeA: 'r_draconis_max',
    typeB: 'r_draconis_min',
    scientificContextEn:
      'Demonstrates synthetic modeling of time-domain stellar pulsation. The difference map exhibits a single, symmetric central residual peak with zero spatial dipole, consistent with simulated candidate flux variability with zero proper motion.',
    scientificContextAr:
      'يوضح محاكاة اصطناعية للنبض النجمي عبر الزمن. تُظهر خريطة الطرح ذروة متبقية مركزية متناظرة أحادية دون إزاحة مكانية ثنائية القطب، بما يتسق مع تغير ضوئي مرشح دون حركة ذاتية.',
  },
  {
    id: 'pair-rw-aurigae',
    name: 'RW Aurigae (Accretion & Dust Occultation)',
    targetCategory: 'dust_occultation',
    labelA: 'RW Aurigae (Normal Bright State)',
    labelB: 'RW Aurigae (Circumstellar Dust Dimming)',
    dateA: '2024-11-01',
    dateB: '2025-01-20',
    typeA: 'rw_aurigae_bright',
    typeB: 'rw_aurigae_dim',
    scientificContextEn:
      'Circumstellar dust streamer occultation. The difference image reveals substantial flux attenuation (3.8x decrease) caused by opaque tidal dust streams obscuring the central T Tauri star without positional shift.',
    scientificContextAr:
      'احتجاب بأشرطة الغبار المحيطة بالنجم. تُظهر صورة الطرح انخفاضاً كبيراً في التدفق (3.8 أضعاف) ناتجاً عن غبار المد والجزر المعتم الذي يحجب النجم الشاب دون تغير موضعه.',
  },
  {
    id: 'pair-epsilon-indi',
    name: 'Epsilon Indi B (Binary Brown Dwarf)',
    targetCategory: 'proper_motion',
    labelA: 'Epsilon Indi B (Epoch 2020.8)',
    labelB: 'Epsilon Indi B (Epoch 2024.8)',
    dateA: '2020-10-15',
    dateB: '2024-10-15',
    typeA: 'epsilon_indi_epoch1',
    typeB: 'epsilon_indi_epoch2',
    scientificContextEn:
      'Nearby T-dwarf binary brown dwarf system. Multi-epoch subtraction isolates its 4.70 arcsec/yr proper motion displacement vector over a 4-year baseline.',
    scientificContextAr:
      'نظام ثنائي من الأقزام البنية القريبة. يعزل طرح الصور عبر الحقب إزاحة حركته الذاتية البالغة 4.70 ثانية قوسية/سنة عبر 4 سنوات.',
  },
  {
    id: 'pair-ices-deep',
    name: 'Cross-Band: Orion Ice (3.05 µm) vs COSMOS NIR',
    targetCategory: 'cross_band',
    labelA: 'Orion KL Ice Band (3.05 µm)',
    labelB: 'COSMOS Deep NIR (2.0 µm)',
    dateA: '2025-06-02',
    dateB: '2025-07-08',
    typeA: 'orion_ice',
    typeB: 'cosmos_nir',
    scientificContextEn:
      'Cross-wavelength band comparison highlighting dense interstellar water ice absorption and filamentary nebulosity in Orion against the diffuse extragalactic background light in COSMOS.',
    scientificContextAr:
      'مقارنة متعددة الأطوال الموجية تبرز امتصاص جليد الماء والسدم الخيطية في الجبار مقابل الضوء الخلفي خارج المجري في حقل كوزموس.',
  },
];

export const ImageComparison: React.FC = () => {
  const {
    t,
    language,
    archiveObservations,
    selectedTarget,
    fetchRemoteFits,
    setArchiveObservations,
    setArchiveSearchMeta,
  } = useApp();

  const [sourceMode, setSourceMode] = useState<'benchmark' | 'live_archive'>('benchmark');
  const [selectedPairId, setSelectedPairId] = useState<string>('pair-barnard');
  const [mode, setMode] = useState<'flipbook' | 'difference' | 'curtain' | 'sideBySide' | 'blend'>(
    'flipbook'
  );

  // Playback & Display Controls (WiseView style)
  const [frames, setFrames] = useState<EpochFrame[]>([]);
  const [flipIndex, setFlipIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [stretch, setStretch] = useState<StretchAlgorithm>('asinh');
  const [palette, setPalette] = useState<ColormapPalette>('inferno');
  const [brightness, setBrightness] = useState<number>(0);
  const [contrast, setContrast] = useState<number>(1.0);

  // Pair Indices for Difference / Curtain / Blend
  const [frameAIdx, setFrameAIdx] = useState<number>(0);
  const [frameBIdx, setFrameBIdx] = useState<number>(1);
  const [curtainPos, setCurtainPos] = useState<number>(50);
  const [blendOpacity, setBlendOpacity] = useState<number>(50);

  // Live IRSA Loading State
  const [liveLoading, setLiveLoading] = useState<boolean>(false);
  const [liveProgress, setLiveProgress] = useState<string>('');
  const [liveError, setLiveError] = useState<string | null>(null);

  // Diff & Candidate Cross-Match State
  const [diffResult, setDiffResult] = useState<ImageDiffResult | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [gaiaResults, setGaiaResults] = useState<Record<string, CandidateGaiaState>>({});

  const flipCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasARef = useRef<HTMLCanvasElement | null>(null);
  const canvasBRef = useRef<HTMLCanvasElement | null>(null);
  const curtainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const diffCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const activePair =
    COMPARISON_PAIRS.find((p) => p.id === selectedPairId) || COMPARISON_PAIRS[0];

  // Load benchmark frames whenever in benchmark mode
  useEffect(() => {
    if (sourceMode !== 'benchmark') return;
    try {
      const bufA = createSyntheticFitsBuffer(activePair.typeA);
      const hduA = parseFitsBuffer(bufA, {
        dataStatus: 'SIMULATED DEMO DATA',
        isSimulatedOrDemo: true,
        provenance: 'SPHEREx ATLAS Synthetic Comparison Pair (Demo)',
      });
      const bufB = createSyntheticFitsBuffer(activePair.typeB);
      const hduB = parseFitsBuffer(bufB, {
        dataStatus: 'SIMULATED DEMO DATA',
        isSimulatedOrDemo: true,
        provenance: 'SPHEREx ATLAS Synthetic Comparison Pair (Demo)',
      });

      const nextFrames: EpochFrame[] = [
        {
          id: `${activePair.id}-a`,
          label: activePair.labelA,
          dateLabel: activePair.dateA,
          band: String(hduA.headerCards.find((c) => c.key === 'FILTER')?.value || 'IR Benchmark'),
          ra: hduA.wcs?.crval1,
          dec: hduA.wcs?.crval2,
          hdu: hduA,
          isSimulated: true,
        },
        {
          id: `${activePair.id}-b`,
          label: activePair.labelB,
          dateLabel: activePair.dateB,
          band: String(hduB.headerCards.find((c) => c.key === 'FILTER')?.value || 'IR Benchmark'),
          ra: hduB.wcs?.crval1,
          dec: hduB.wcs?.crval2,
          hdu: hduB,
          isSimulated: true,
        },
      ];
      setFrames(nextFrames);
      setFlipIndex(0);
      setFrameAIdx(0);
      setFrameBIdx(1);
      setGaiaResults({});
      setDiffError(null);
    } catch (e: any) {
      console.error('Failed to load comparison dataset pair:', e);
    }
  }, [sourceMode, activePair]);

  // Sequential Live IRSA Multi-Epoch Stack Loader (respects IRSA rate limits)
  const loadLiveIrsaStack = async (queryNepIfEmpty = false) => {
    setSourceMode('live_archive');
    setIsPlaying(false);
    setLiveLoading(true);
    setLiveError(null);
    setLiveProgress('Preparing IRSA SPHEREx observation list...');
    setGaiaResults({});

    try {
      let candidates = (archiveObservations || []).filter(
        (o) => !o.isSimulatedOrDemo && (o.cutoutUrl || o.accessUrl)
      );

      if (candidates.length < 2 && queryNepIfEmpty) {
        const qRa = selectedTarget?.ra ?? 270.0;
        const qDec = selectedTarget?.dec ?? 66.5607;
        setLiveProgress(`Querying IRSA TAP near RA ${qRa.toFixed(2)}°, Dec ${qDec.toFixed(2)}°...`);
        const searchRes = await fetch('/api/archive/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ra: qRa,
            dec: qDec,
            fov: 0.25,
            targetName: selectedTarget?.name,
          }),
        });
        const searchJson = await searchRes.json();
        if (searchRes.ok && Array.isArray(searchJson.observations)) {
          setArchiveObservations(searchJson.observations);
          setArchiveSearchMeta({
            spherexAvailable: Boolean(searchJson.spherexAvailable),
            dataStatus: searchJson.dataStatus || 'REAL ARCHIVE DATA',
            source: searchJson.source || 'NASA/IPAC IRSA TAP',
            notice: searchJson.notice || '',
            ra: qRa,
            dec: qDec,
            radiusDeg: 0.125,
            queryTimeMs: searchJson.queryTimeMs,
          });
          candidates = searchJson.observations.filter(
            (o: any) => !o.isSimulatedOrDemo && (o.cutoutUrl || o.accessUrl)
          );
        }
      }

      if (candidates.length === 0) {
        setLiveError(
          'No real SPHEREx archive FITS cutouts are loaded for the current coordinates. Query Sky Explorer (e.g., North Ecliptic Pole 270.0°, +66.56°) first or click "Query Active Target Live Stack".'
        );
        setLiveLoading(false);
        return;
      }

      // Sort chronologically and take up to 5 frames sequentially
      const sorted = [...candidates]
        .sort((a, b) => (a.dateStart || '').localeCompare(b.dateStart || ''))
        .slice(0, 5);

      const fetchedFrames: EpochFrame[] = [];
      const controller = new AbortController();

      for (let i = 0; i < sorted.length; i++) {
        const obs = sorted[i];
        setLiveProgress(`Retrieving cutout ${i + 1} / ${sorted.length} (${obs.band || obs.id})...`);
        const url = obs.cutoutUrl || obs.accessUrl!;
        try {
          const hdu = await fetchRemoteFits(url, controller.signal, {
            ra: obs.ra,
            dec: obs.dec,
            size: 0.04,
          });
          fetchedFrames.push({
            id: obs.id,
            label: `${obs.band || obs.instrument} (${obs.productStages?.releaseTag || 'IRSA'})`,
            dateLabel: obs.dateStart ? obs.dateStart.slice(0, 10) : 'Unknown Date',
            band: obs.band || 'SPHEREx LVF',
            ra: obs.ra,
            dec: obs.dec,
            hdu,
            isSimulated: false,
          });
        } catch (frameErr: any) {
          console.warn('Skipping frame during stack load:', obs.id, frameErr?.message);
        }
      }

      if (fetchedFrames.length === 0) {
        setLiveError('Unable to decode any remote FITS cutouts from IRSA for this stack.');
      } else {
        setFrames(fetchedFrames);
        setFlipIndex(0);
        setFrameAIdx(0);
        setFrameBIdx(Math.min(1, fetchedFrames.length - 1));
      }
    } catch (err: any) {
      setLiveError(err?.message || 'Failed to load live IRSA multi-epoch stack.');
    } finally {
      setLiveLoading(false);
      setLiveProgress('');
    }
  };

  const frameA = frames[frameAIdx] || frames[0] || null;
  const frameB = frames[frameBIdx] || frames[Math.min(1, frames.length - 1)] || null;
  const activeFlipFrame = frames[flipIndex] || frames[0] || null;

  // Chronological Flipbook playback loop
  useEffect(() => {
    if (!isPlaying || mode !== 'flipbook' || frames.length <= 1) return;
    const intervalMs = Math.max(180, Math.round(900 / playbackSpeed));
    const timer = setInterval(() => {
      setFlipIndex((prev) => (prev + 1) % frames.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isPlaying, mode, playbackSpeed, frames.length]);

  // Render active Flipbook frame
  useEffect(() => {
    if (mode !== 'flipbook' || !activeFlipFrame || !flipCanvasRef.current) return;
    const hdu = activeFlipFrame.hdu;
    renderFitsToCanvas(
      hdu,
      flipCanvasRef.current,
      hdu.min,
      hdu.max * 0.9,
      stretch,
      palette,
      contrast,
      brightness
    );
  }, [mode, activeFlipFrame, stretch, palette, contrast, brightness]);

  // Compute Difference Image when frames change
  useEffect(() => {
    if (!frameA || !frameB || frameA.id === frameB.id) {
      setDiffResult(null);
      setDiffError(
        frameA && frameB && frameA.id === frameB.id
          ? 'Select two distinct epochs (Frame A ≠ Frame B) to compute image difference.'
          : null
      );
      return;
    }
    try {
      const diff = computeImageDifference(frameA.hdu, frameB.hdu);
      setDiffResult(diff);
      setDiffError(null);
    } catch (err: any) {
      setDiffResult(null);
      setDiffError(err?.message || 'Incompatible images for subtraction.');
    }
  }, [frameA, frameB]);

  // Render Frame A, Frame B, and Difference canvas
  useEffect(() => {
    if (frameA && canvasARef.current) {
      renderFitsToCanvas(
        frameA.hdu,
        canvasARef.current,
        frameA.hdu.min,
        frameA.hdu.max * 0.9,
        stretch,
        palette,
        contrast,
        brightness
      );
    }
    if (frameB && canvasBRef.current) {
      renderFitsToCanvas(
        frameB.hdu,
        canvasBRef.current,
        frameB.hdu.min,
        frameB.hdu.max * 0.9,
        stretch,
        palette,
        contrast,
        brightness
      );
    }
  }, [frameA, frameB, mode, stretch, palette, contrast, brightness]);

  useEffect(() => {
    if (diffResult && diffCanvasRef.current && mode === 'difference') {
      const hdu = diffResult.diffHdu;
      renderFitsToCanvas(
        hdu,
        diffCanvasRef.current,
        hdu.min * 0.8,
        hdu.max * 0.8,
        'linear',
        'coolwarm',
        contrast,
        brightness
      );
    }
  }, [diffResult, mode, contrast, brightness]);

  useEffect(() => {
    const canvas = curtainCanvasRef.current;
    if (!canvas || !frameA || !frameB || !canvasARef.current || !canvasBRef.current) return;
    if (mode !== 'curtain' && mode !== 'blend') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 480;
    canvas.height = 480;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (mode === 'curtain') {
      ctx.drawImage(canvasARef.current, 0, 0, width, height);
      const splitX = (curtainPos / 100) * width;
      ctx.save();
      ctx.beginPath();
      ctx.rect(splitX, 0, width - splitX, height);
      ctx.clip();
      ctx.drawImage(canvasBRef.current, 0, 0, width, height);
      ctx.restore();

      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, height);
      ctx.stroke();
    } else {
      ctx.globalAlpha = 1.0;
      ctx.drawImage(canvasARef.current, 0, 0, width, height);
      ctx.globalAlpha = blendOpacity / 100;
      ctx.drawImage(canvasBRef.current, 0, 0, width, height);
      ctx.globalAlpha = 1.0;
    }
  }, [mode, curtainPos, blendOpacity, frameA, frameB, stretch, palette, contrast, brightness]);

  const handleCandidateGaiaCrossMatch = async (cand: CandidateDetection) => {
    if (cand.ra === undefined || cand.dec === undefined) return;
    setGaiaResults((prev) => ({
      ...prev,
      [cand.id]: { loading: true },
    }));
    try {
      const url = `/api/catalog/gaia-crossmatch?ra=${cand.ra.toFixed(6)}&dec=${cand.dec.toFixed(
        6
      )}&radiusArcsec=20&epochYear=2025.5`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        setGaiaResults((prev) => ({
          ...prev,
          [cand.id]: {
            loading: false,
            error: data?.error || `HTTP ${res.status}`,
          },
        }));
        return;
      }
      setGaiaResults((prev) => ({
        ...prev,
        [cand.id]: {
          loading: false,
          sources: Array.isArray(data.matches)
            ? data.matches
            : Array.isArray(data.sources)
            ? data.sources
            : [],
        },
      }));
    } catch (err: any) {
      setGaiaResults((prev) => ({
        ...prev,
        [cand.id]: { loading: false, error: err?.message || 'Gaia DR3 query failed' },
      }));
    }
  };

  const liveArchiveEligibleCount = useMemo(
    () =>
      (archiveObservations || []).filter(
        (o) => !o.isSimulatedOrDemo && (o.cutoutUrl || o.accessUrl)
      ).length,
    [archiveObservations]
  );

  const currentProvenanceStatus =
    sourceMode === 'live_archive' ? 'REAL ARCHIVE DATA' : 'SIMULATED DEMO DATA';

  return (
    <div className="space-y-6 pb-12">
      <ObservatoryPageHeader
        kicker="WISEVIEW TIME-DOMAIN FLIPBOOK & WCS DIFFERENCE ENGINE"
        title={t('comparisonTitle')}
        subtitle="Chronological blink playback, bilinear WCS frame resampling, difference subtraction (I_A − I_B), >3.5σ candidate extraction, and live Gaia DR3 cross-matching."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Data Source Toggle: Benchmark vs Live IRSA Stack */}
            <div className="flex rounded-lg cosmic-panel p-0.5 text-xs font-semibold">
              <button
                onClick={() => {
                  setSourceMode('benchmark');
                  setIsPlaying(false);
                }}
                className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                  sourceMode === 'benchmark'
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Benchmark Demos
              </button>
              <button
                onClick={() => loadLiveIrsaStack(liveArchiveEligibleCount === 0)}
                disabled={liveLoading}
                className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap inline-flex items-center gap-1.5 ${
                  sourceMode === 'live_archive'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-cyan-300 hover:text-white'
                }`}
              >
                {liveLoading ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />}
                <span>
                  Live IRSA Stack ({liveArchiveEligibleCount > 0 ? liveArchiveEligibleCount : 'Query'})
                </span>
              </button>
            </div>

            {sourceMode === 'benchmark' && (
              <select
                value={selectedPairId}
                onChange={(e) => setSelectedPairId(e.target.value)}
                className="bg-[#090F20] border border-cyan-500/30 rounded-lg px-3 py-1.5 text-xs text-cyan-200 font-mono font-semibold focus:outline-none focus:border-cyan-500"
              >
                {COMPARISON_PAIRS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        }
      />

      {/* Mode Switcher Bar */}
      <div className="cosmic-glass rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap rounded-lg bg-[#050814]/80 border border-slate-800 p-0.5 text-xs font-semibold">
          {(
            [
              { id: 'flipbook', label: 'Flipbook Blink' },
              { id: 'difference', label: 'Difference + Candidates' },
              { id: 'curtain', label: 'Curtain' },
              { id: 'sideBySide', label: 'Side-by-Side' },
              { id: 'blend', label: 'Blend' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                mode === m.id ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {diffResult?.compatibility?.alignmentApplied && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-cyan-950/70 border border-cyan-500/40 text-cyan-200 text-[11px] font-mono font-semibold">
              <Layers size={12} />
              <span>{t('wcsAlignedBadge')}</span>
            </span>
          )}
          <ProvenanceNotice status={currentProvenanceStatus} compact />
        </div>
      </div>

      {/* Live Loader Banner */}
      {(liveLoading || liveError) && (
        <div
          className={`p-4 rounded-xl border font-mono text-xs flex items-center gap-2.5 ${
            liveError
              ? 'bg-rose-950/50 border-rose-500/40 text-rose-200'
              : 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
          }`}
        >
          {liveLoading ? (
            <Loader2 size={15} className="animate-spin shrink-0" />
          ) : (
            <AlertTriangle size={15} className="shrink-0" />
          )}
          <span>{liveError || liveProgress}</span>
        </div>
      )}

      {/* Main Darkroom Stage */}
      <section className="rounded-2xl cosmic-glass p-5 space-y-5">
        {mode === 'flipbook' && activeFlipFrame ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className="text-cyan-300 font-bold">{t('flipbookTitle')}:</span>
                <span className="text-white">{activeFlipFrame.label}</span>
              </div>
              <span className="text-slate-400 tabular-nums">
                Frame {flipIndex + 1} / {frames.length} · {activeFlipFrame.dateLabel}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-8 relative rounded-xl border border-slate-800/90 bg-[#03050C] overflow-hidden flex items-center justify-center min-h-[420px]">
                <canvas
                  ref={flipCanvasRef}
                  className="max-h-[430px] w-auto image-rendering-pixelated"
                />

                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-[#050814]/90 border border-cyan-500/35 text-[11px] font-mono text-cyan-200 tabular-nums">
                  Epoch {flipIndex + 1}/{frames.length} · {activeFlipFrame.dateLabel}
                </div>
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-[#050814]/90 border border-slate-700 text-[11px] font-mono text-slate-300">
                  {activeFlipFrame.band}
                </div>
              </div>

              {/* WiseView Display & Transport Panel */}
              <div className="lg:col-span-4 space-y-4 p-4 rounded-xl bg-[#050916]/85 border border-slate-800/80">
                <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-300">
                  <Sliders size={13} />
                  <span>Flipbook Controls</span>
                </div>

                {/* Transport Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setIsPlaying(false);
                      setFlipIndex((prev) => (prev - 1 + frames.length) % frames.length);
                    }}
                    disabled={frames.length <= 1}
                    className="p-2 rounded-lg bg-[#0D162E] hover:bg-[#132042] disabled:opacity-40 text-slate-200 border border-slate-800"
                    title="Previous Frame"
                  >
                    <SkipBack size={14} />
                  </button>
                  <button
                    onClick={() => setIsPlaying((p) => !p)}
                    disabled={frames.length <= 1}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 ${
                      isPlaying
                        ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                        : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                    }`}
                  >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    <span>{isPlaying ? 'Pause Blink' : 'Play Flipbook'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsPlaying(false);
                      setFlipIndex((prev) => (prev + 1) % frames.length);
                    }}
                    disabled={frames.length <= 1}
                    className="p-2 rounded-lg bg-[#0D162E] hover:bg-[#132042] disabled:opacity-40 text-slate-200 border border-slate-800"
                    title="Next Frame"
                  >
                    <SkipForward size={14} />
                  </button>
                </div>

                {/* Scrubber */}
                <div className="space-y-1 tabular-nums">
                  <div className="flex justify-between text-[11px] font-mono text-slate-400">
                    <span>Epoch Timeline</span>
                    <span className="text-cyan-300">{activeFlipFrame.dateLabel}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, frames.length - 1)}
                    value={flipIndex}
                    disabled={frames.length <= 1}
                    onChange={(e) => {
                      setIsPlaying(false);
                      setFlipIndex(Number(e.target.value));
                    }}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                {/* Speed Control */}
                <div className="space-y-1">
                  <span className="text-[11px] font-mono text-slate-400 block">Blink Speed</span>
                  <div className="grid grid-cols-4 gap-1 bg-[#090F20] p-0.5 rounded-lg border border-slate-800 text-[11px] font-mono">
                    {[0.5, 1, 2, 4].map((spd) => (
                      <button
                        key={spd}
                        onClick={() => setPlaybackSpeed(spd)}
                        className={`py-1 rounded transition-colors ${
                          playbackSpeed === spd
                            ? 'bg-cyan-500 text-slate-950 font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stretch & Colormap */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 block mb-1">Stretch</label>
                    <select
                      value={stretch}
                      onChange={(e) => setStretch(e.target.value as StretchAlgorithm)}
                      className="w-full bg-[#090F20] border border-slate-700/80 rounded-md px-2 py-1 text-[11px] text-white font-mono"
                    >
                      <option value="asinh">asinh</option>
                      <option value="linear">linear</option>
                      <option value="log">log</option>
                      <option value="sqrt">sqrt</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 block mb-1">Palette</label>
                    <select
                      value={palette}
                      onChange={(e) => setPalette(e.target.value as ColormapPalette)}
                      className="w-full bg-[#090F20] border border-slate-700/80 rounded-md px-2 py-1 text-[11px] text-white font-mono"
                    >
                      <option value="inferno">inferno</option>
                      <option value="grayscale">grayscale</option>
                      <option value="cyan">cyan</option>
                      <option value="viridis">viridis</option>
                      <option value="magma">magma</option>
                    </select>
                  </div>
                </div>

                {/* Brightness & Contrast */}
                <div className="space-y-2 pt-1 tabular-nums text-[11px] font-mono">
                  <div>
                    <div className="flex justify-between text-slate-400 mb-0.5">
                      <span>Contrast</span>
                      <span className="text-cyan-300">{contrast.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={2.5}
                      step={0.05}
                      value={contrast}
                      onChange={(e) => setContrast(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-slate-400 mb-0.5">
                      <span>Brightness</span>
                      <span className="text-cyan-300">{brightness.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={-0.35}
                      max={0.35}
                      step={0.02}
                      value={brightness}
                      onChange={(e) => setBrightness(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                </div>

                {/* Clickable Frame List */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">
                    Loaded Frames ({frames.length})
                  </span>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {frames.map((f, idx) => (
                      <button
                        key={f.id}
                        onClick={() => {
                          setIsPlaying(false);
                          setFlipIndex(idx);
                        }}
                        className={`w-full text-left rtl:text-right px-2.5 py-1.5 rounded-md border text-[11px] font-mono transition-colors ${
                          idx === flipIndex
                            ? 'bg-cyan-950/60 border-cyan-500/60 text-cyan-200'
                            : 'bg-[#090F20] border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="flex justify-between gap-2">
                          <span className="truncate font-semibold">
                            #{idx + 1} · {f.label}
                          </span>
                          <span className="shrink-0 tabular-nums">{f.dateLabel}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : mode === 'difference' ? (
          <div className="space-y-4">
            {/* Frame A vs Frame B selector when more than 2 frames */}
            {frames.length >= 2 && (
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono pb-2 border-b border-slate-800/80">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-cyan-300 font-bold">Epoch A:</span>
                  <select
                    value={frameAIdx}
                    onChange={(e) => setFrameAIdx(Number(e.target.value))}
                    className="bg-[#060A16] border border-slate-700 rounded-md px-2 py-1 text-slate-200"
                  >
                    {frames.map((f, i) => (
                      <option key={f.id} value={i}>
                        #{i + 1}: {f.label} ({f.dateLabel})
                      </option>
                    ))}
                  </select>
                  <span className="text-amber-300 font-bold ms-2">Epoch B:</span>
                  <select
                    value={frameBIdx}
                    onChange={(e) => setFrameBIdx(Number(e.target.value))}
                    className="bg-[#060A16] border border-slate-700 rounded-md px-2 py-1 text-slate-200"
                  >
                    {frames.map((f, i) => (
                      <option key={f.id} value={i}>
                        #{i + 1}: {f.label} ({f.dateLabel})
                      </option>
                    ))}
                  </select>
                </div>
                <span className="text-[11px] text-slate-400">
                  Residual: I_diff = I_A − I_B (Coolwarm)
                </span>
              </div>
            )}

            {diffError ? (
              <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs font-mono">
                {diffError}
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-4">
                <div className="relative rounded-xl border border-slate-800/90 bg-[#03050C] overflow-hidden flex items-center justify-center min-h-[420px] w-full max-w-2xl">
                  <canvas
                    ref={diffCanvasRef}
                    className="max-h-[420px] w-auto image-rendering-pixelated"
                  />

                  {diffResult &&
                    diffResult.candidateCentroids.map((cand, idx) => (
                      <div
                        key={idx}
                        className="absolute pointer-events-none flex flex-col items-center"
                        style={{
                          left: `${(cand.x / diffResult.diffHdu.naxis1) * 100}%`,
                          top: `${(1 - cand.y / diffResult.diffHdu.naxis2) * 100}%`,
                          transform: 'translate(-50%, -50%)',
                        }}
                      >
                        <div className="w-6 h-6 rounded-full border-2 border-cyan-400/90 flex items-center justify-center">
                          <div className="w-1 h-1 rounded-full bg-cyan-300" />
                        </div>
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#050814]/95 text-cyan-200 border border-cyan-500/40 whitespace-nowrap mt-1">
                          {cand.type === 'moving_candidate' ? 'Δ Pos (>3.5σ)' : 'Δ Flux'}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : mode === 'sideBySide' && frameA && frameB ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#03050C] border border-slate-800/90 flex flex-col items-center">
              <div className="w-full flex justify-between text-xs font-mono text-cyan-300 mb-3">
                <span className="truncate">EPOCH A: {frameA.label}</span>
                <span className="text-slate-400 shrink-0">{frameA.dateLabel}</span>
              </div>
              <canvas
                ref={canvasARef}
                className="max-h-[380px] w-auto rounded-lg border border-slate-900 image-rendering-pixelated"
              />
            </div>

            <div className="p-4 rounded-xl bg-[#03050C] border border-slate-800/90 flex flex-col items-center">
              <div className="w-full flex justify-between text-xs font-mono text-amber-300 mb-3">
                <span className="truncate">EPOCH B: {frameB.label}</span>
                <span className="text-slate-400 shrink-0">{frameB.dateLabel}</span>
              </div>
              <canvas
                ref={canvasBRef}
                className="max-h-[380px] w-auto rounded-lg border border-slate-900 image-rendering-pixelated"
              />
            </div>
          </div>
        ) : frameA && frameB ? (
          <div className="flex flex-col items-center space-y-4">
            <canvas ref={canvasARef} className="hidden" />
            <canvas ref={canvasBRef} className="hidden" />

            <div className="relative rounded-xl border border-slate-800/90 overflow-hidden bg-[#03050C]">
              <canvas
                ref={curtainCanvasRef}
                className="max-h-[440px] w-auto image-rendering-pixelated cursor-ew-resize"
              />

              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-[#050814]/90 text-cyan-300 font-mono text-[11px] border border-cyan-500/35">
                A: {frameA.label}
              </div>
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-[#050814]/90 text-amber-300 font-mono text-[11px] border border-amber-500/35">
                B: {frameB.label}
              </div>
            </div>

            <div className="w-full max-w-md p-3.5 rounded-xl bg-[#060A16] border border-slate-800/80 space-y-2 tabular-nums">
              {mode === 'curtain' ? (
                <div>
                  <div className="flex justify-between text-xs font-mono text-slate-300 mb-1">
                    <span>Curtain Split Position</span>
                    <span className="text-cyan-300 font-bold">{curtainPos}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={curtainPos}
                    onChange={(e) => setCurtainPos(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
              ) : (
                <div>
                  <div className="flex justify-between text-xs font-mono text-slate-300 mb-1">
                    <span>Overlay Blend Opacity</span>
                    <span className="text-cyan-300 font-bold">{blendOpacity}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={blendOpacity}
                    onChange={(e) => setBlendOpacity(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
              )}
            </div>
          </div>
        ) : null}
      </section>

      {/* 4-Column Residual Telemetry Strip */}
      {diffResult && (() => {
        const diffUnit = String(
          diffResult.diffHdu.headerCards.find((c) => c.key === 'BUNIT')?.value || 'MJy/sr'
        );
        return (
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricReadout
              label="Mean Residual (Δμ)"
              value={diffResult.meanDiff.toFixed(2)}
              unit={diffUnit}
            />
            <MetricReadout
              label="RMS Residual (σ_Δ)"
              value={diffResult.rmsDiff.toFixed(2)}
              unit={diffUnit}
              accent="cyan"
            />
            <MetricReadout
              label="Peak Difference"
              value={diffResult.maxDiff.toFixed(1)}
              unit={diffUnit}
              accent="amber"
            />
            <MetricReadout
              label="Detections (>3.5σ)"
              value={diffResult.detections.length}
              unit={`${diffResult.candidatePixelsCount} px`}
              accent="emerald"
            />
          </section>
        );
      })()}

      {/* Candidate Findings Table + Gaia DR3 Astrometric Cross-Match */}
      {diffResult && (
        <section className="p-5 sm:p-6 rounded-2xl cosmic-glass space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-cyan-300">
              <Crosshair size={15} />
              <span>Detected Residual Candidates (&gt;3.5σ) &amp; Gaia DR3 Cross-Match</span>
            </div>
            <ProvenanceNotice status={currentProvenanceStatus} compact />
          </div>

          {diffResult.detections.length === 0 ? (
            <p className="text-xs font-mono text-slate-400">
              No discrete localized residual peaks above 3.5σ exceeded neighborhood separation thresholds in this pair.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-[#050814]/80">
              <table className="w-full text-left rtl:text-right text-xs font-mono tabular-nums">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400">
                    <th className="py-2.5 px-3">ID</th>
                    <th className="py-2.5 px-3">Pixel (x, y)</th>
                    <th className="py-2.5 px-3">Sky (RA, Dec)</th>
                    <th className="py-2.5 px-3">ΔFlux</th>
                    <th className="py-2.5 px-3">SNR (σ)</th>
                    <th className="py-2.5 px-3">Candidate Class</th>
                    <th className="py-2.5 px-3">Gaia DR3 Match</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {diffResult.detections.map((cand) => {
                    const gaiaState = gaiaResults[cand.id];
                    const topMatch = gaiaState?.sources?.[0];
                    return (
                      <tr key={cand.id} className="hover:bg-slate-900/40">
                        <td className="py-2 px-3 font-bold text-cyan-300">{cand.id}</td>
                        <td className="py-2 px-3">
                          ({cand.x.toFixed(1)}, {cand.y.toFixed(1)})
                        </td>
                        <td className="py-2 px-3 text-slate-300">
                          {cand.ra !== undefined && cand.dec !== undefined
                            ? `${cand.ra.toFixed(5)}°, ${cand.dec.toFixed(5)}°`
                            : 'No WCS'}
                        </td>
                        <td className="py-2 px-3">
                          {cand.deltaVal >= 0 ? '+' : ''}
                          {cand.deltaVal.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-amber-300 font-semibold">
                          {cand.snrSigma.toFixed(1)}σ
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] text-slate-300">
                            {cand.type} (candidate)
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          {cand.ra !== undefined && cand.dec !== undefined ? (
                            gaiaState?.loading ? (
                              <span className="inline-flex items-center gap-1 text-cyan-300 text-[11px]">
                                <Loader2 size={11} className="animate-spin" /> Querying ESA Gaia...
                              </span>
                            ) : gaiaState?.error ? (
                              <span className="text-rose-300 text-[11px]">{gaiaState.error}</span>
                            ) : gaiaState?.sources ? (
                              topMatch ? (
                                <span className="text-emerald-300 text-[11px] inline-flex items-center gap-1">
                                  <CheckCircle2 size={11} />
                                  DR3 {topMatch.sourceId.slice(-6)} · {topMatch.propagatedSeparationArcsec.toFixed(2)}&quot;
                                  {topMatch.photGMag !== null
                                    ? ` · G=${topMatch.photGMag.toFixed(1)}`
                                    : ''}
                                </span>
                              ) : (
                                <span className="text-amber-300 text-[11px]">No DR3 source &lt;20&quot;</span>
                              )
                            ) : (
                              <button
                                onClick={() => handleCandidateGaiaCrossMatch(cand)}
                                className="px-2.5 py-1 rounded bg-[#0D162E] hover:bg-[#142347] text-cyan-300 border border-cyan-500/35 text-[11px] font-semibold transition-colors"
                              >
                                {t('gaiaCrossMatchRun')}
                              </button>
                            )
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Structured Candidate Discovery Summary Box */}
          <div className="p-4 rounded-xl bg-[#050814]/85 border border-cyan-500/25 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
              <span className="text-cyan-300 font-bold uppercase tracking-wider">
                Structured Candidate Discovery Summary
              </span>
              <span className="text-slate-400">
                Provenance: <strong className="text-white">{currentProvenanceStatus}</strong>
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono tabular-nums">
              <div className="p-2.5 rounded-lg bg-[#090F20] border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">Candidate Peaks (&gt;3.5σ)</span>
                <span className="text-white font-bold">{diffResult.detections.length} isolated peaks</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#090F20] border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">Registration Method</span>
                <span className="text-cyan-300 font-bold">
                  {diffResult.compatibility.alignmentApplied
                    ? 'WCS Bilinear Resampled'
                    : 'Matched Pixel Grid'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#090F20] border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">Verification Status</span>
                <span className="text-amber-300 font-bold">Candidate Only (Requires Follow-up)</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Detections represent statistically significant flux differences above 3.5σ RMS residual. Cross-match against ESA Gaia DR3 to separate known high-proper-motion field stars from uncatalogued transients, artifacts, or moving Solar System objects.
            </p>
          </div>
        </section>
      )}

      {/* Scientific Classification & Compatibility Dossier */}
      <section className="p-5 sm:p-6 rounded-2xl cosmic-glass space-y-3">
        <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-white">
          <Sparkles size={15} className="text-cyan-400" />
          <span>Scientific Change Classification &amp; Temporal Analysis</span>
        </div>

        <p className="text-xs sm:text-[13px] text-slate-300 leading-relaxed">
          {sourceMode === 'live_archive'
            ? `Live IRSA Archive multi-epoch stack (${frames.length} SPHEREx cutout frames loaded). Residuals are measured directly from IRSA Level-2/MEF flux arrays aligned in celestial tangent-plane WCS.`
            : language === 'ar'
            ? activePair.scientificContextAr
            : activePair.scientificContextEn}
        </p>

        {diffResult?.compatibility?.warnings && diffResult.compatibility.warnings.length > 0 && (
          <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/35 text-amber-200 text-xs font-mono space-y-1">
            <div className="font-bold">Compatibility &amp; Alignment Notes:</div>
            {diffResult.compatibility.warnings.map((w, idx) => (
              <div key={idx}>• {w}</div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
