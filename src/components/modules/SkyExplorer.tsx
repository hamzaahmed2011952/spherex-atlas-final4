import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { AstroTarget } from '../../types/astronomy';
import { TARGETS_CATALOG } from '../../data/targetsCatalog';
import {
  Search,
  MapPin,
  Crosshair,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ArrowRight,
  Database,
} from 'lucide-react';
import {
  ObservatoryPageHeader,
  ProvenanceNotice,
} from '../ui/ObservatoryPrimitives';

export const SkyExplorer: React.FC = () => {
  const {
    t,
    setSelectedTarget,
    setActiveModule,
    setTimelineTarget,
    setArchiveObservations,
    setArchiveSearchMeta,
    fetchRemoteFits,
    setActiveFitsImage,
  } = useApp();

  const [projection, setProjection] = useState<'globe' | 'allsky'>('allsky');
  const [crosshairRa, setCrosshairRa] = useState<number>(83.82);
  const [crosshairDec, setCrosshairDec] = useState<number>(-5.39);
  const [fov, setFov] = useState<number>(0.5);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [coordInput, setCoordInput] = useState<string>('83.82, -5.39');
  const [coordError, setCoordError] = useState<string | null>(null);
  const [showFootprint, setShowFootprint] = useState<boolean>(true);
  const [showGalacticPlane, setShowGalacticPlane] = useState<boolean>(true);
  const [hoveredTarget] = useState<AstroTarget | null>(null);

  const [tapStatus, setTapStatus] = useState<{
    connected: boolean;
    latencyMs?: number;
    verifiedTables?: string[];
    error?: string;
  } | null>(null);
  const [archiveLoading, setArchiveLoading] = useState<boolean>(false);
  const [archiveResult, setArchiveResult] = useState<any | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiveTimeout, setArchiveTimeout] = useState<boolean>(false);
  const [loadingFitsId, setLoadingFitsId] = useState<string | null>(null);
  const [releaseFilter, setReleaseFilter] = useState<'all' | 'dr1' | 'qr3' | 'qr2'>('all');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const archiveAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/archive/status', { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!controller.signal.aborted) {
          setTapStatus(data);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setTapStatus({ connected: false, error: err.message || 'Status check failed' });
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (archiveAbortRef.current) {
      archiveAbortRef.current.abort();
      archiveAbortRef.current = null;
    }
  }, [crosshairRa, crosshairDec, fov]);

  const handleQueryArchive = async () => {
    if (
      isNaN(crosshairRa) ||
      isNaN(crosshairDec) ||
      crosshairRa < 0 ||
      crosshairRa >= 360 ||
      crosshairDec < -90 ||
      crosshairDec > 90
    ) {
      setArchiveError('Invalid coordinates: RA must be 0°–360°, Dec must be -90°–+90°');
      return;
    }

    if (archiveAbortRef.current) {
      archiveAbortRef.current.abort();
    }
    const controller = new AbortController();
    archiveAbortRef.current = controller;

    setArchiveLoading(true);
    setArchiveError(null);
    setArchiveTimeout(false);
    setArchiveResult(null);
    try {
      const res = await fetch('/api/archive/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          ra: crosshairRa,
          dec: crosshairDec,
          fov,
          releaseFilter,
          cutoutSizeDeg: 0.04,
          targetName:
            hoveredTarget?.name ||
            TARGETS_CATALOG.find(
              (tgt) => Math.abs(tgt.ra - crosshairRa) < 0.25 && Math.abs(tgt.dec - crosshairDec) < 0.25
            )?.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 504 || data?.archiveTimeout) {
          setArchiveTimeout(true);
        }
        setArchiveObservations([]);
        setArchiveSearchMeta(null);
        throw new Error(data?.error || `Archive server returned ${res.status}`);
      }
      setArchiveResult(data);
      const obsList = Array.isArray(data.observations) ? data.observations : [];
      setArchiveObservations(obsList);
      setArchiveSearchMeta({
        spherexAvailable: Boolean(data.spherexAvailable),
        dataStatus: data.dataStatus || (obsList.length > 0 ? 'REAL ARCHIVE DATA' : 'UNAVAILABLE DATA'),
        source: data.source || 'NASA/IPAC IRSA TAP (spherex.obscore)',
        notice: data.notice || '',
        ra: crosshairRa,
        dec: crosshairDec,
        radiusDeg: data.radiusDeg ?? fov / 2,
        queryTimeMs: data.queryTimeMs,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setArchiveError(err.message || 'Failed to query archive');
      setArchiveObservations([]);
      setArchiveSearchMeta(null);
    } finally {
      if (archiveAbortRef.current === controller) {
        setArchiveLoading(false);
      }
    }
  };

  const handleLoadFitsInLab = async (obs: any) => {
    const targetUrl = obs.cutoutUrl || obs.accessUrl;
    if (!targetUrl) return;
    setLoadingFitsId(obs.id);
    setArchiveError(null);
    try {
      const hdu = await fetchRemoteFits(targetUrl, undefined, {
        ra: Number.isFinite(obs.ra) ? obs.ra : crosshairRa,
        dec: Number.isFinite(obs.dec) ? obs.dec : crosshairDec,
        size: 0.04,
      });
      setActiveFitsImage(hdu);
      setActiveModule('fits');
    } catch (err: any) {
      setArchiveError(err.message || 'Failed to load FITS product');
    } finally {
      setLoadingFitsId(null);
    }
  };

  const handleCoordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCoordError(null);
    const raw = coordInput.trim();

    const matchedTgt = TARGETS_CATALOG.find(
      (tgt) =>
        tgt.name.toLowerCase().includes(raw.toLowerCase()) ||
        tgt.canonicalName.toLowerCase().includes(raw.toLowerCase())
    );

    if (matchedTgt) {
      setCrosshairRa(matchedTgt.ra);
      setCrosshairDec(matchedTgt.dec);
      setSelectedTarget(matchedTgt);
      return;
    }

    const decRegex = /^([0-9.\-+]+)[,\s]+([0-9.\-+]+)$/;
    const decMatch = raw.match(decRegex);
    if (decMatch) {
      const ra = parseFloat(decMatch[1]);
      const dec = parseFloat(decMatch[2]);
      if (isNaN(ra) || isNaN(dec) || ra < 0 || ra >= 360 || dec < -90 || dec > 90) {
        setCoordError('Invalid coordinates: RA must be 0°–360°, Dec must be -90°–+90°');
        return;
      }
      setCrosshairRa(ra);
      setCrosshairDec(dec);
      return;
    }

    const sexaRegex =
      /([0-9]+)h\s*([0-9]+)m\s*([0-9.]+)s[,\s]+([+\-]?[0-9]+)[°d\s]+([0-9]+)['m\s]+([0-9.]+)/i;
    const sexaMatch = raw.match(sexaRegex);
    if (sexaMatch) {
      const h = parseFloat(sexaMatch[1]);
      const m = parseFloat(sexaMatch[2]);
      const s = parseFloat(sexaMatch[3]);
      const decD = parseFloat(sexaMatch[4]);
      const decM = parseFloat(sexaMatch[5]);
      const decS = parseFloat(sexaMatch[6]);

      const ra = (h + m / 60 + s / 3600) * 15;
      const decSign = decD < 0 || raw.includes('-') ? -1 : 1;
      const dec = decSign * (Math.abs(decD) + decM / 60 + decS / 3600);

      setCrosshairRa(ra);
      setCrosshairDec(dec);
      return;
    }

    setCoordError('Use "83.82, -5.39" or target name (e.g. Orion)');
  };

  const formatRaHms = (raDeg: number) => {
    const hours = (raDeg / 15 + 24) % 24;
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    const s = ((hours - h - m / 60) * 3600).toFixed(1);
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${s}s`;
  };

  const formatDecDms = (decDeg: number) => {
    const sign = decDeg < 0 ? '-' : '+';
    const abs = Math.abs(decDeg);
    const d = Math.floor(abs);
    const m = Math.floor((abs - d) * 60);
    const s = ((abs - d - m / 60) * 3600).toFixed(1);
    return `${sign}${String(d).padStart(2, '0')}° ${String(m).padStart(2, '0')}' ${s}"`;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, width / 2);
    bgGrad.addColorStop(0, '#091128');
    bgGrad.addColorStop(0.7, '#050814');
    bgGrad.addColorStop(1, '#020409');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const project = (ra: number, dec: number): [number, number] => {
      if (projection === 'allsky') {
        const x = width - (ra / 360) * width;
        const y = height / 2 - (dec / 90) * ((height / 2) * 0.9);
        return [x, y];
      } else {
        const centerRa = crosshairRa;
        const centerDec = crosshairDec;

        const lambda = (ra - centerRa) * (Math.PI / 180);
        const phi = dec * (Math.PI / 180);
        const phi0 = centerDec * (Math.PI / 180);

        const cosC = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(lambda);
        const radius = Math.min(width, height) * 0.42 * zoomLevel;

        if (cosC < 0) return [-9999, -9999];

        const x = width / 2 + radius * Math.cos(phi) * Math.sin(lambda);
        const y =
          height / 2 -
          radius * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(lambda));
        return [x, y];
      }
    };

    if (projection === 'globe') {
      const radius = Math.min(width, height) * 0.42 * zoomLevel;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.28)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = 'rgba(8, 16, 38, 0.45)';
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);

    for (let r = 0; r < 360; r += 30) {
      ctx.beginPath();
      let started = false;
      for (let d = -80; d <= 80; d += 5) {
        const [x, y] = project(r, d);
        if (x !== -9999) {
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();
    }

    for (let d = -60; d <= 60; d += 30) {
      ctx.beginPath();
      let started = false;
      for (let r = 0; r <= 360; r += 10) {
        const [x, y] = project(r, d);
        if (x !== -9999) {
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
    ctx.lineWidth = 1.5;
    let startedEq = false;
    for (let r = 0; r <= 360; r += 5) {
      const [x, y] = project(r, 0);
      if (x !== -9999) {
        if (!startedEq) {
          ctx.moveTo(x, y);
          startedEq = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
    }
    ctx.stroke();

    if (showGalacticPlane) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 1.75;
      let startedGal = false;
      for (let l = 0; l <= 360; l += 4) {
        const rad = l * (Math.PI / 180);
        const decG = 27.128 * (Math.PI / 180);
        const raG = 192.859 * (Math.PI / 180);
        const l0 = 32.932 * (Math.PI / 180);

        const sinDec = Math.cos(decG) * Math.sin(rad - l0);
        const dec = Math.asin(sinDec) * (180 / Math.PI);
        const yCoord = Math.cos(rad - l0);
        const xCoord = -Math.sin(decG) * Math.sin(rad - l0);
        const ra = ((Math.atan2(yCoord, xCoord) + raG) * (180 / Math.PI) + 360) % 360;

        const [px, py] = project(ra, dec);
        if (px !== -9999) {
          if (!startedGal) {
            ctx.moveTo(px, py);
            startedGal = true;
          } else {
            ctx.lineTo(px, py);
          }
        }
      }
      ctx.stroke();
    }

    if (showFootprint) {
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.45)';
      ctx.lineWidth = 2;

      ctx.beginPath();
      let startedSwath = false;
      for (let dec = -88; dec <= 88; dec += 4) {
        const scanRa = (crosshairRa + 90 * Math.sin(dec * (Math.PI / 180) * 0.5) + 360) % 360;
        const [px, py] = project(scanRa, dec);
        if (px !== -9999) {
          if (!startedSwath) {
            ctx.moveTo(px, py);
            startedSwath = true;
          } else {
            ctx.lineTo(px, py);
          }
        }
      }
      ctx.stroke();

      const poles = [
        { ra: 270.0, dec: 66.56, label: 'NEP Deep Field' },
        { ra: 90.0, dec: -66.56, label: 'SEP Deep Field' },
      ];

      poles.forEach((p) => {
        const [px, py] = project(p.ra, p.dec);
        if (px !== -9999) {
          ctx.beginPath();
          ctx.arc(px, py, 14 * zoomLevel, 0, Math.PI * 2);
          ctx.strokeStyle = '#22D3EE';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = 'rgba(34, 211, 238, 0.16)';
          ctx.fill();

          ctx.fillStyle = '#67E8F9';
          ctx.font = '10px JetBrains Mono';
          ctx.fillText(p.label, px + 18, py + 4);
        }
      });
    }

    TARGETS_CATALOG.forEach((tgt) => {
      const [tx, ty] = project(tgt.ra, tgt.dec);
      if (tx === -9999) return;

      const isCrosshair = Math.abs(tgt.ra - crosshairRa) < 2 && Math.abs(tgt.dec - crosshairDec) < 2;

      ctx.beginPath();
      ctx.arc(tx, ty, isCrosshair ? 6 : 4, 0, Math.PI * 2);

      if (tgt.category === 'ice_target') {
        ctx.fillStyle = '#22D3EE';
      } else if (tgt.category === 'deep_field') {
        ctx.fillStyle = '#60A5FA';
      } else if (tgt.category === 'starburst_galaxy') {
        ctx.fillStyle = '#F59E0B';
      } else {
        ctx.fillStyle = '#34D399';
      }

      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = isCrosshair ? '#FFFFFF' : '#94A3B8';
      ctx.font = isCrosshair ? 'bold 11px "IBM Plex Sans", sans-serif' : '10px "IBM Plex Sans", sans-serif';
      ctx.fillText(tgt.name.split('/')[0].trim(), tx + 8, ty - 6);
    });

    const [cx, cy] = project(crosshairRa, crosshairDec);
    if (cx !== -9999) {
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx - 24, cy);
      ctx.lineTo(cx - 6, cy);
      ctx.moveTo(cx + 6, cy);
      ctx.lineTo(cx + 24, cy);
      ctx.moveTo(cx, cy - 24);
      ctx.lineTo(cx, cy - 6);
      ctx.moveTo(cx, cy + 6);
      ctx.lineTo(cx, cy + 24);
      ctx.stroke();
    }
  }, [projection, crosshairRa, crosshairDec, zoomLevel, showFootprint, showGalacticPlane]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (projection === 'allsky') {
      const ra = Number((((rect.width - x) / rect.width) * 360).toFixed(2));
      const dec = Number((((rect.height / 2 - y) / ((rect.height / 2) * 0.9)) * 90).toFixed(2));

      setCrosshairRa(Math.min(359.99, Math.max(0, ra)));
      setCrosshairDec(Math.min(90, Math.max(-90, dec)));
      setCoordInput(`${ra}, ${dec}`);

      const nearest = TARGETS_CATALOG.find((tgt) => Math.hypot(tgt.ra - ra, tgt.dec - dec) < 6);
      if (nearest) {
        setSelectedTarget(nearest);
      }
    }
  };

  const handleSelectQuickTarget = (target: AstroTarget) => {
    setCrosshairRa(target.ra);
    setCrosshairDec(target.dec);
    setCoordInput(`${target.ra}, ${target.dec}`);
    setSelectedTarget(target);
  };

  return (
    <div className="space-y-6 pb-12">
      <ObservatoryPageHeader
        kicker="ALL-SKY ARCHIVE DISCOVERY · IRSA TAP"
        title={t('skyExplorerTitle')}
        subtitle={t('skyExplorerSubtitle')}
        metadata={['ICRS J2000', '98.2° Sun-Synchronous Orbit', 'spherex.obscore']}
        actions={
          <>
            <div className="flex rounded-lg bg-[#090F20] p-0.5 border border-slate-800">
              <button
                onClick={() => setProjection('allsky')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  projection === 'allsky' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t('projectionAllSky')}
              </button>
              <button
                onClick={() => setProjection('globe')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  projection === 'globe' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t('projectionGlobe')}
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-[#090F20] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs">
              <span className="text-[11px] font-mono text-slate-400">FOV:</span>
              <select
                value={fov}
                onChange={(e) => setFov(Number(e.target.value))}
                className="bg-transparent text-cyan-300 font-mono text-xs font-semibold focus:outline-none cursor-pointer"
              >
                <option value={0.05} className="bg-[#0B1122] text-white">0.05° (3.0&apos;)</option>
                <option value={0.1} className="bg-[#0B1122] text-white">0.10° (6.0&apos;)</option>
                <option value={0.25} className="bg-[#0B1122] text-white">0.25° (15.0&apos;)</option>
                <option value={0.5} className="bg-[#0B1122] text-white">0.50° (Standard)</option>
                <option value={1.0} className="bg-[#0B1122] text-white">1.00° (60.0&apos;)</option>
                <option value={3.5} className="bg-[#0B1122] text-white">3.50° (SPHEREx LVF)</option>
              </select>
            </div>

            <button
              onClick={() => setShowFootprint(!showFootprint)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                showFootprint
                  ? 'bg-[#101C3A] text-cyan-300 border-cyan-500/45'
                  : 'bg-[#090F20] text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              Scan Swath
            </button>

            <button
              onClick={() => setShowGalacticPlane(!showGalacticPlane)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                showGalacticPlane
                  ? 'bg-[#181510] text-amber-300 border-amber-500/45'
                  : 'bg-[#090F20] text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              Galactic Plane
            </button>
          </>
        }
      />

      {/* Quick Challenge Coordinates Strip */}
      <div className="px-4 py-3 rounded-xl bg-[#090F20] border border-slate-800/90 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Crosshair size={13} className="text-cyan-400" />
          <span>Benchmark Coordinates</span>
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'target-barnards-star', name: "Barnard's Star", ra: 269.4521, dec: 4.6934 },
            { id: 'target-wise-0855', name: 'WISE 0855', ra: 133.7951, dec: -7.2452 },
            { id: 'target-r-draconis', name: 'R Draconis', ra: 248.1675, dec: 66.755 },
            { id: 'target-rw-aurigae', name: 'RW Aurigae', ra: 76.9563, dec: 30.4014 },
            { id: 'target-epsilon-indi-b', name: 'Eps Indi B', ra: 331.0438, dec: -56.7828 },
          ].map((ct) => {
            const isNear = Math.abs(crosshairRa - ct.ra) < 0.2 && Math.abs(crosshairDec - ct.dec) < 0.2;
            return (
              <button
                key={ct.id}
                onClick={() => {
                  setCrosshairRa(ct.ra);
                  setCrosshairDec(ct.dec);
                  setCoordInput(`${ct.ra}, ${ct.dec}`);
                  const matched = TARGETS_CATALOG.find((item) => item.id === ct.id);
                  if (matched) setSelectedTarget(matched);
                }}
                className={`px-2.5 py-1 rounded-md font-mono text-[11px] transition-colors border whitespace-nowrap ${
                  isNear
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold'
                    : 'bg-[#060A16] text-slate-300 border-slate-800 hover:border-slate-600 hover:text-white'
                }`}
              >
                {ct.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Asymmetric Split Instrument Console: Search Bench (4 cols) + Celestial Projection Viewport (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: IRSA Query & Search Bench */}
        <aside className="lg:col-span-4 space-y-4">
          {/* Coordinate Slew Box */}
          <div className="p-4 rounded-2xl cosmic-glass space-y-3">
            <h2 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Search size={13} className="text-cyan-400" />
              <span>{t('searchCoordinates')}</span>
            </h2>

            <form onSubmit={handleCoordSubmit} className="flex gap-2">
              <input
                type="text"
                value={coordInput}
                onChange={(e) => setCoordInput(e.target.value)}
                placeholder="83.82, -5.39 or Orion"
                className="flex-1 min-w-0 bg-[#050A18] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-lg bg-[#0D162E] hover:bg-[#132042] border border-slate-700/80 text-cyan-300 text-xs font-semibold transition-colors whitespace-nowrap"
              >
                Slew
              </button>
            </form>

            {coordError && <p className="text-[11px] text-rose-400 font-mono">{coordError}</p>}
          </div>

          {/* Live NASA/IPAC IRSA Archive Query Bench */}
          <div className="p-4 rounded-2xl cosmic-glass space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono font-bold text-cyan-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Database size={13} />
                <span>IRSA TAP / SIA2 Archive</span>
              </span>
              {tapStatus && (
                <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5 tabular-nums">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      tapStatus.connected ? 'bg-emerald-400' : 'bg-rose-400'
                    }`}
                  />
                  <span>{tapStatus.connected ? 'ONLINE' : 'OFFLINE'}</span>
                  {tapStatus.latencyMs !== undefined && <span>· {tapStatus.latencyMs}ms</span>}
                </span>
              )}
            </div>

            <div className="p-3 rounded-lg bg-[#050A18]/90 border border-slate-800/80 text-[11px] font-mono text-slate-300 space-y-1.5 tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-400">Cone Center:</span>
                <span className="text-white">
                  {crosshairRa.toFixed(3)}°, {crosshairDec.toFixed(3)}°
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Radius / FOV:</span>
                <span className="text-cyan-300">
                  r = {(fov / 2).toFixed(2)}° ({fov}°)
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/70">
                <span className="text-slate-400">Release:</span>
                <div className="flex gap-1">
                  {(['all', 'dr1', 'qr3', 'qr2'] as const).map((rel) => (
                    <button
                      key={rel}
                      type="button"
                      onClick={() => setReleaseFilter(rel)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        releaseFilter === rel
                          ? 'bg-cyan-500 text-slate-950'
                          : 'bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      {rel}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleQueryArchive}
              disabled={archiveLoading}
              className="w-full py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
            >
              {archiveLoading ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-950/20 border-t-slate-950 animate-spin" />
                  <span>Querying IRSA TAP...</span>
                </>
              ) : (
                <>
                  <Search size={14} />
                  <span>Query NASA Archive</span>
                </>
              )}
            </button>

            {archiveError && (
              <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/80 text-[11px] text-rose-300 font-mono space-y-2">
                <div>{archiveError}</div>
                {archiveTimeout && (
                  <button
                    onClick={handleQueryArchive}
                    className="px-2.5 py-1 rounded bg-rose-900/80 hover:bg-rose-800 text-rose-100 text-[10px] font-bold"
                  >
                    Retry Query
                  </button>
                )}
              </div>
            )}

            {archiveResult && (
              <div className="p-3.5 rounded-xl bg-[#060A16] border border-slate-800 space-y-2.5 text-xs font-mono">
                <div className="flex items-center justify-between gap-2">
                  <ProvenanceNotice
                    status={
                      archiveResult.dataStatus ||
                      (archiveResult.count > 0 ? 'REAL ARCHIVE DATA' : 'UNAVAILABLE DATA')
                    }
                    compact
                  />
                  <span className="text-cyan-300 font-bold tabular-nums">
                    {archiveResult.count} obs
                  </span>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {archiveResult.notice}
                </p>

                {Array.isArray(archiveResult.observations) && archiveResult.observations.length > 0 && (
                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-800/70 border-t border-slate-800/80 pt-1">
                    {archiveResult.observations.slice(0, 8).map((obs: any) => (
                      <div key={obs.id} className="py-2.5 flex items-center justify-between gap-2 text-[11px]">
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-cyan-300 font-semibold truncate">{obs.obsId || obs.id}</span>
                            {obs.productStages?.releaseTag && (
                              <span className="px-1 py-0.2 rounded bg-cyan-950/70 border border-cyan-500/30 text-[9px] text-cyan-300 font-bold">
                                {obs.productStages.releaseTag}
                              </span>
                            )}
                          </div>
                          <div className="text-slate-400 tabular-nums">
                            {obs.dateStart ? obs.dateStart.slice(0, 10) : 'Unknown date'} · {obs.band || 'LVF'}
                          </div>
                          <div className="flex flex-wrap gap-1 text-[9px]">
                            <span className="px-1 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-700/40">
                              Record
                            </span>
                            {obs.productStages?.imageProductAvailable && (
                              <span className="px-1 rounded bg-sky-950/60 text-sky-300 border border-sky-700/40">
                                FITS URL
                              </span>
                            )}
                            {obs.productStages?.cutoutAvailable && (
                              <span className="px-1 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/40">
                                MEF Cutout
                              </span>
                            )}
                          </div>
                        </div>
                        {(obs.cutoutUrl || obs.accessUrl) && (
                          <button
                            onClick={() => handleLoadFitsInLab(obs)}
                            disabled={loadingFitsId === obs.id}
                            className="shrink-0 px-2.5 py-1.5 rounded bg-[#0D162E] hover:bg-[#142244] border border-cyan-500/35 text-cyan-200 font-semibold"
                          >
                            {loadingFitsId === obs.id ? 'Loading...' : obs.cutoutUrl ? 'Cutout → Lab' : 'Load FITS'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 gap-1.5">
                  <button
                    onClick={() => {
                      const matched = TARGETS_CATALOG.find(
                        (item) => Math.abs(item.ra - crosshairRa) < 0.25 && Math.abs(item.dec - crosshairDec) < 0.25
                      );
                      if (matched) {
                        setSelectedTarget(matched);
                        setTimelineTarget(matched);
                      }
                      setActiveModule('timeline');
                    }}
                    className="w-full py-1.5 rounded-lg bg-[#0D162E] hover:bg-[#132042] text-cyan-300 border border-slate-700/80 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>Observation Timeline</span>
                    <ArrowRight size={13} className="rtl:rotate-180" />
                  </button>

                  <button
                    onClick={() => setActiveModule('comparison')}
                    className="w-full py-1.5 rounded-lg bg-[#0D162E] hover:bg-[#132042] text-slate-300 border border-slate-800 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>Difference Comparison Lab</span>
                    <ArrowRight size={13} className="rtl:rotate-180" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Preset Catalog Slew */}
          <div className="p-4 rounded-2xl cosmic-glass space-y-2.5">
            <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <MapPin size={13} className="text-cyan-400" />
              <span>{t('presetTargets')}</span>
            </h3>

            <div className="divide-y divide-slate-800/70 max-h-52 overflow-y-auto">
              {TARGETS_CATALOG.map((tgt) => {
                const isSelected = Math.abs(tgt.ra - crosshairRa) < 1 && Math.abs(tgt.dec - crosshairDec) < 1;
                return (
                  <button
                    key={tgt.id}
                    onClick={() => handleSelectQuickTarget(tgt)}
                    className={`w-full text-left rtl:text-right py-2 px-1 text-xs transition-colors flex items-center justify-between gap-2 ${
                      isSelected ? 'text-cyan-300 font-bold' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <span className="truncate">{tgt.name.split('/')[0]}</span>
                    <span className="text-[10px] font-mono text-slate-400 tabular-nums shrink-0">
                      {tgt.ra.toFixed(1)}°, {tgt.dec.toFixed(1)}°
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Right: Celestial Canvas Viewport */}
        <section className="lg:col-span-8 rounded-2xl cosmic-glass p-3 sm:p-4 space-y-3">
          {/* Top Crosshair HUD Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#050915] border border-slate-800/80 text-xs font-mono tabular-nums">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                <Crosshair size={13} />
                <span>CROSSHAIR</span>
              </span>
              <span className="text-slate-200">
                RA {crosshairRa.toFixed(2)}° ({formatRaHms(crosshairRa)})
              </span>
              <span className="text-slate-600 hidden sm:inline">·</span>
              <span className="text-slate-200">
                Dec {crosshairDec.toFixed(2)}° ({formatDecDms(crosshairDec)})
              </span>
            </div>

            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Click map to relocate crosshair
            </span>
          </div>

          {/* High-Contrast Sky Viewport */}
          <div className="w-full relative flex items-center justify-center rounded-xl bg-[#02040A] border border-slate-800/80 overflow-hidden min-h-[460px]">
            <canvas
              ref={canvasRef}
              width={920}
              height={540}
              onClick={handleCanvasClick}
              className="w-full h-auto cursor-crosshair block"
            />

            <div className="absolute bottom-3 right-3 rtl:right-auto rtl:left-3 flex flex-col gap-1 bg-[#070C1B]/95 border border-slate-800 p-1 rounded-lg">
              <button
                onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
                className="p-1.5 rounded bg-[#0D162E] text-slate-300 hover:text-cyan-300"
                title="Zoom In"
              >
                <ZoomIn size={15} />
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))}
                className="p-1.5 rounded bg-[#0D162E] text-slate-300 hover:text-cyan-300"
                title="Zoom Out"
              >
                <ZoomOut size={15} />
              </button>
              <button
                onClick={() => setZoomLevel(1.0)}
                className="p-1.5 rounded bg-[#0D162E] text-slate-300 hover:text-cyan-300"
                title="Reset View"
              >
                <RotateCcw size={15} />
              </button>
            </div>
          </div>

          {/* Legend & Quick Handoff Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 px-1 text-[11px] font-mono text-slate-400">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400" /> Interstellar Ices
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400" /> Deep Field
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> Starburst
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Exoplanet Hosts
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveModule('fits')}
                className="text-cyan-300 hover:text-cyan-200 font-semibold"
              >
                Open in FITS Lab →
              </button>
              <button
                onClick={() => setActiveModule('spectra')}
                className="text-slate-300 hover:text-white font-semibold"
              >
                102-Band Spectrum →
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
