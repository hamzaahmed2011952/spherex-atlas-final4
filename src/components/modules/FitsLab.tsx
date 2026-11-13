import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  FileCode2,
  Upload,
  Download,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Sliders,
  Palette,
  Search,
  Eye,
  Info,
  AlertTriangle,
  Layers,
  Crosshair,
  Loader2,
} from 'lucide-react';
import {
  parseFitsBuffer,
  renderFitsToCanvas,
  applyStretch,
  createSyntheticFitsBuffer,
  pixelToWorldWcs,
} from '../../services/fitsEngine';
import { StretchAlgorithm, ColormapPalette, GaiaCrossMatchSource } from '../../types/astronomy';
import {
  ObservatoryPageHeader,
  ProvenanceNotice,
} from '../ui/ObservatoryPrimitives';

export const FitsLab: React.FC = () => {
  const { t, activeFitsImage, setActiveFitsImage, loadSampleFitsByName } = useApp();

  const [stretch, setStretch] = useState<StretchAlgorithm>('asinh');
  const [palette, setPalette] = useState<ColormapPalette>('inferno');
  const [minCut, setMinCut] = useState<number>(0);
  const [maxCut, setMaxCut] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(1.0);
  const [brightness, setBrightness] = useState<number>(0.0);
  const [zoom, setZoom] = useState<number>(1.15);

  const [headerFilter, setHeaderFilter] = useState<string>('');
  const [inspectPixel, setInspectPixel] = useState<{
    x: number;
    y: number;
    rawVal: number;
    normVal: number;
    ra?: number;
    dec?: number;
  } | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [, setIsProcessing] = useState<boolean>(false);
  const [activeLayerName, setActiveLayerName] = useState<string>('IMAGE');
  const [gaiaLoading, setGaiaLoading] = useState<boolean>(false);
  const [gaiaError, setGaiaError] = useState<string | null>(null);
  const [gaiaMatches, setGaiaMatches] = useState<GaiaCrossMatchSource[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const availableLayerKeys = activeFitsImage?.layerHdus ? Object.keys(activeFitsImage.layerHdus) : [];
  const displayHdu =
    (activeFitsImage?.layerHdus && activeFitsImage.layerHdus[activeLayerName]) || activeFitsImage;

  useEffect(() => {
    if (activeFitsImage?.layerHdus) {
      const keys = Object.keys(activeFitsImage.layerHdus);
      if (keys.includes('IMAGE')) setActiveLayerName('IMAGE');
      else if (keys.length > 0) setActiveLayerName(keys[0]);
    } else {
      setActiveLayerName('IMAGE');
    }
    setGaiaMatches([]);
    setGaiaError(null);
  }, [activeFitsImage]);

  useEffect(() => {
    if (displayHdu) {
      const dataMin = displayHdu.min;
      const dataMax = displayHdu.max;
      const range = dataMax - dataMin || 1;
      setMinCut(Number((dataMin + range * 0.02).toFixed(4)));
      setMaxCut(Number((dataMin + range * 0.95).toFixed(4)));
    }
  }, [displayHdu]);

  useEffect(() => {
    if (!displayHdu || !canvasRef.current) return;
    renderFitsToCanvas(
      displayHdu,
      canvasRef.current,
      minCut,
      maxCut,
      stretch,
      palette,
      contrast,
      brightness
    );
  }, [displayHdu, minCut, maxCut, stretch, palette, contrast, brightness]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const parsed = parseFitsBuffer(buffer);
        setActiveFitsImage(parsed);
      } catch (err: any) {
        setErrorMessage(`FITS parsing error: ${err.message || 'Malformed FITS header or data'}`);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read local file.');
      setIsProcessing(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const parsed = parseFitsBuffer(buffer);
        setActiveFitsImage(parsed);
      } catch (err: any) {
        setErrorMessage(`FITS parsing error: ${err.message}`);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!displayHdu || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const screenX = Math.floor((e.clientX - rect.left) * scaleX);
    const screenY = Math.floor((e.clientY - rect.top) * scaleY);

    if (
      screenX >= 0 &&
      screenX < displayHdu.naxis1 &&
      screenY >= 0 &&
      screenY < displayHdu.naxis2
    ) {
      const fitsY = displayHdu.naxis2 - 1 - screenY;
      const index = fitsY * displayHdu.naxis1 + screenX;
      const rawVal = displayHdu.data[index] ?? 0;
      const normVal = applyStretch(rawVal, minCut, maxCut, stretch, contrast, brightness);

      let ra: number | undefined;
      let dec: number | undefined;

      if (displayHdu.wcs) {
        const world = pixelToWorldWcs(displayHdu.wcs, screenX, fitsY);
        ra = world.ra;
        dec = world.dec;
      }

      setInspectPixel({
        x: screenX,
        y: fitsY,
        rawVal,
        normVal,
        ra,
        dec,
      });
    }
  };

  const handleGaiaCrossMatchField = async () => {
    if (!displayHdu?.wcs) return;
    setGaiaLoading(true);
    setGaiaError(null);
    try {
      const dateObs = displayHdu.headerCards.find((c) => c.key === 'DATE-OBS')?.value;
      const epochParam = dateObs ? `&epochDate=${encodeURIComponent(String(dateObs))}` : '';
      const res = await fetch(
        `/api/catalog/gaia-crossmatch?ra=${displayHdu.wcs.crval1}&dec=${displayHdu.wcs.crval2}&radiusArcsec=45&limit=8${epochParam}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `Gaia DR3 cross-match HTTP ${res.status}`);
      }
      setGaiaMatches(
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

  const handleDownloadActiveFits = () => {
    if (!activeFitsImage) return;
    const buffer =
      activeFitsImage.rawBuffer && activeFitsImage.rawBuffer.byteLength > 0
        ? activeFitsImage.rawBuffer
        : createSyntheticFitsBuffer('cosmos_nir');
    const blob = new Blob([buffer], { type: 'application/fits' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeFitsImage.name.replace(/\s+/g, '_')}.fits`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredCards = displayHdu
    ? displayHdu.headerCards.filter(
        (c) =>
          c.key.toLowerCase().includes(headerFilter.toLowerCase()) ||
          String(c.value).toLowerCase().includes(headerFilter.toLowerCase())
      )
    : [];

  return (
    <div className="space-y-6 pb-12">
      <ObservatoryPageHeader
        kicker="FITS DARKROOM · ARRAY PHOTOMETRY & WCS"
        title={t('fitsLabTitle')}
        subtitle={t('fitsLabSubtitle')}
        metadata={
          activeFitsImage
            ? [
                `${activeFitsImage.naxis1} × ${activeFitsImage.naxis2} px`,
                `BITPIX ${activeFitsImage.bitpix}`,
                activeFitsImage.wcs ? 'WCS Calibrated' : 'No WCS in Header',
              ]
            : ['80-Byte FITS Standard Parser']
        }
        actions={
          <>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".fits,.fit,.fts"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap"
            >
              <Upload size={14} />
              <span>{t('uploadFits')}</span>
            </button>

            <div className="flex rounded-lg bg-[#090F20] border border-slate-800 p-0.5 text-xs">
              <button
                onClick={() => loadSampleFitsByName('cosmos_nir')}
                className="px-2.5 py-1 rounded-md text-slate-300 hover:text-cyan-300 hover:bg-[#0E1730] transition-colors whitespace-nowrap"
              >
                COSMOS IR
              </button>
              <button
                onClick={() => loadSampleFitsByName('orion_ice')}
                className="px-2.5 py-1 rounded-md text-slate-300 hover:text-cyan-300 hover:bg-[#0E1730] transition-colors whitespace-nowrap"
              >
                Orion Ice
              </button>
              <button
                onClick={() => loadSampleFitsByName('nep_deep')}
                className="px-2.5 py-1 rounded-md text-slate-300 hover:text-cyan-300 hover:bg-[#0E1730] transition-colors whitespace-nowrap"
              >
                NEP Deep
              </button>
            </div>

            <button
              onClick={handleDownloadActiveFits}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0D162E] hover:bg-[#132042] text-slate-200 border border-slate-700/80 text-xs font-semibold transition-colors whitespace-nowrap"
              title={t('downloadFits')}
            >
              <Download size={14} />
              <span className="hidden sm:inline">{t('downloadFits')}</span>
            </button>
          </>
        }
      />

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-950/55 border border-rose-800 text-rose-300 text-xs flex items-center gap-2 font-mono">
          <AlertTriangle size={15} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* MEF Multi-Extension HDU Layer Bar & Data Quality Summary */}
      {activeFitsImage && (activeFitsImage.extensions?.length || 0) > 1 && (
        <section className="p-4 rounded-2xl cosmic-glass space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">
              <Layers size={14} />
              <span>{t('mefLayerTitle')}</span>
              <span className="text-slate-400 font-normal">
                ({activeFitsImage.extensions?.length} HDUs detected)
              </span>
            </div>

            {availableLayerKeys.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {availableLayerKeys.map((key) => (
                  <button
                    key={key}
                    onClick={() => setActiveLayerName(key)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold border transition-colors ${
                      activeLayerName === key
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                        : 'bg-[#050A18] text-slate-300 border-slate-700/80 hover:border-cyan-500/50'
                    }`}
                  >
                    {key}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-[11px] font-mono">
            {activeFitsImage.extensions?.map((ext) => (
              <div
                key={`${ext.index}-${ext.extname}`}
                className="px-2.5 py-1.5 rounded-lg bg-[#050A18]/90 border border-slate-800/80 flex items-center justify-between gap-1"
              >
                <span className="text-cyan-300 font-semibold truncate">{ext.extname}</span>
                <span className="text-slate-400 text-[10px]">
                  {ext.isImage2D ? `${ext.naxis1}×${ext.naxis2}` : ext.xtension}
                </span>
              </div>
            ))}
          </div>

          {activeFitsImage.qualitySummary && (
            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-800/70 text-[11px] font-mono text-slate-300 tabular-nums">
              <span className="text-cyan-300 font-semibold">{t('qualitySnrTitle')}:</span>
              <span>
                Median SNR:{' '}
                <strong className="text-emerald-300">
                  {activeFitsImage.qualitySummary.medianSnr ?? 'N/A'}
                </strong>
              </span>
              <span>
                Peak SNR:{' '}
                <strong className="text-emerald-300">
                  {activeFitsImage.qualitySummary.peakSnr ?? 'N/A'}
                </strong>
              </span>
              <span>
                Noise σ:{' '}
                <strong className="text-white">
                  {activeFitsImage.qualitySummary.medianNoiseSigma ?? 'N/A'}
                </strong>
              </span>
              <span>
                Flagged:{' '}
                <strong className="text-amber-300">
                  {activeFitsImage.qualitySummary.flaggedPixelsCount !== undefined
                    ? `${activeFitsImage.qualitySummary.flaggedPixelsCount} px (${activeFitsImage.qualitySummary.flaggedFractionPct}%)`
                    : 'N/A'}
                </strong>
              </span>
            </div>
          )}
        </section>
      )}

      {/* Scientific Darkroom Workbench: 8-col Viewport + 4-col Telemetry & Header Browser */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Darkroom Canvas + Pixel Inspector + Stretch Controls */}
        <section className="lg:col-span-8 space-y-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="rounded-2xl cosmic-glass p-4 relative flex flex-col items-center justify-center min-h-[450px] overflow-hidden"
          >
            {displayHdu && (
              <div className="w-full flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-400 pb-3 mb-2 border-b border-slate-800/70">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-cyan-300 font-semibold">{displayHdu.name}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {displayHdu.naxis1}×{displayHdu.naxis2}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">BITPIX {displayHdu.bitpix}</span>
                  <ProvenanceNotice
                    status={
                      displayHdu.isSimulatedOrDemo
                        ? 'SIMULATED DEMO DATA'
                        : displayHdu.dataStatus || 'EXTERNAL CATALOG DATA'
                    }
                    compact
                  />
                </div>
                <div className="text-[11px] text-slate-400">
                  {displayHdu.headerCards.find((c) => c.key === 'FILTER')?.value || 'Near-IR'}
                  {!displayHdu.wcs && (
                    <span className="text-amber-400/90 ms-2">· WCS Unavailable</span>
                  )}
                </div>
              </div>
            )}

            <div
              className="relative overflow-hidden flex items-center justify-center rounded-lg border border-slate-900 bg-black cursor-crosshair my-2"
              style={{
                transform: `scale(${zoom})`,
                transition: 'transform 120ms cubic-bezier(0.2, 0.8, 0.2, 1)',
              }}
            >
              <canvas
                ref={canvasRef}
                onMouseMove={handleCanvasMouseMove}
                onMouseLeave={() => setInspectPixel(null)}
                className="max-h-[380px] w-auto image-rendering-pixelated"
              />
            </div>

            <div className="absolute bottom-3 right-3 rtl:right-auto rtl:left-3 flex items-center gap-1 bg-[#070C1B]/95 border border-slate-800 p-1 rounded-lg z-10">
              <button
                onClick={() => setZoom((z) => Math.min(3.0, z + 0.2))}
                className="p-1.5 rounded bg-[#0D162E] text-slate-300 hover:text-cyan-300"
                title="Zoom In"
              >
                <ZoomIn size={14} />
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
                className="p-1.5 rounded bg-[#0D162E] text-slate-300 hover:text-cyan-300"
                title="Zoom Out"
              >
                <ZoomOut size={14} />
              </button>
              <button
                onClick={() => setZoom(1.15)}
                className="p-1.5 rounded bg-[#0D162E] text-slate-300 hover:text-cyan-300"
                title="Reset Zoom"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          {/* Live Pixel & WCS Readout Bar */}
          <div className="px-4 py-3 rounded-xl cosmic-glass font-mono text-xs flex flex-wrap items-center justify-between gap-3 text-slate-300 tabular-nums">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                <Eye size={14} />
                <span>PIXEL</span>
              </span>
              <span>
                X <strong className="text-white">{inspectPixel?.x ?? '—'}</strong>
              </span>
              <span>
                Y <strong className="text-white">{inspectPixel?.y ?? '—'}</strong>
              </span>
              <span>
                Val{' '}
                <strong className="text-cyan-300">
                  {inspectPixel ? inspectPixel.rawVal.toFixed(3) : '—'}
                </strong>{' '}
                {String(displayHdu?.headerCards.find((c) => c.key === 'BUNIT')?.value || 'MJy/sr')}
              </span>
              <span>
                Norm{' '}
                <strong className="text-emerald-300">
                  {inspectPixel ? inspectPixel.normVal.toFixed(3) : '—'}
                </strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {inspectPixel?.ra !== undefined && (
                <span className="text-[11px] text-slate-300">
                  WCS (-TAN) RA {inspectPixel.ra.toFixed(5)}° · Dec {inspectPixel.dec?.toFixed(5)}°
                </span>
              )}
              {displayHdu?.wcs && (
                <button
                  onClick={handleGaiaCrossMatchField}
                  disabled={gaiaLoading}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0D162E] hover:bg-[#142244] border border-cyan-500/40 text-cyan-300 text-[11px] font-semibold"
                >
                  {gaiaLoading ? <Loader2 size={12} className="animate-spin" /> : <Crosshair size={12} />}
                  <span>{t('gaiaCrossMatchRun')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Live Gaia DR3 Cross-Match Result Strip (when triggered) */}
          {(gaiaError || gaiaMatches.length > 0) && (
            <div className="p-4 rounded-2xl cosmic-glass space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between gap-2">
                <span className="text-cyan-300 font-bold uppercase tracking-wider">
                  {t('gaiaCrossMatchTitle')}
                </span>
                <ProvenanceNotice status="EXTERNAL CATALOG DATA" compact />
              </div>
              {gaiaError && <div className="text-rose-300">{gaiaError}</div>}
              {gaiaMatches.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left rtl:text-right text-[11px] border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-1.5 pr-3">Gaia DR3 ID</th>
                        <th className="py-1.5 pr-3">Sep (Epoch)</th>
                        <th className="py-1.5 pr-3">G mag</th>
                        <th className="py-1.5 pr-3">PM (mas/yr)</th>
                        <th className="py-1.5">Class</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 tabular-nums">
                      {gaiaMatches.map((m) => (
                        <tr key={m.sourceId}>
                          <td className="py-1.5 pr-3 text-cyan-300">{m.sourceId}</td>
                          <td className="py-1.5 pr-3 text-white">{m.propagatedSeparationArcsec.toFixed(2)}″</td>
                          <td className="py-1.5 pr-3 text-slate-200">{m.photGMag?.toFixed(2) ?? '—'}</td>
                          <td className="py-1.5 pr-3 text-slate-300">{m.totalPmMasYr?.toFixed(1) ?? '—'}</td>
                          <td className="py-1.5 text-emerald-300">{m.matchClassification}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Display Stretch & Cut-Level Calibration */}
          <div className="p-5 rounded-2xl cosmic-glass space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sliders size={13} className="text-cyan-400" />
                <span>Display Stretch &amp; Colormap Calibration</span>
              </span>
              <button
                onClick={() => {
                  setStretch('asinh');
                  setPalette('inferno');
                  setContrast(1.0);
                  setBrightness(0.0);
                }}
                className="text-xs text-cyan-300 hover:underline font-medium"
              >
                {t('resetDisplay')}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1.5">
                  {t('stretchAlgorithm')}
                </label>
                <select
                  value={stretch}
                  onChange={(e) => setStretch(e.target.value as StretchAlgorithm)}
                  className="w-full bg-[#060A16] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                >
                  <option value="asinh">{t('stretchAsinh')}</option>
                  <option value="log">{t('stretchLog')}</option>
                  <option value="sqrt">{t('stretchSqrt')}</option>
                  <option value="linear">{t('stretchLinear')}</option>
                  <option value="power">{t('stretchPower')}</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
                  <Palette size={13} className="text-cyan-400" />
                  <span>{t('colormapPalette')}</span>
                </label>
                <select
                  value={palette}
                  onChange={(e) => setPalette(e.target.value as ColormapPalette)}
                  className="w-full bg-[#060A16] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                >
                  <option value="inferno">{t('paletteInferno')}</option>
                  <option value="viridis">{t('paletteViridis')}</option>
                  <option value="magma">{t('paletteMagma')}</option>
                  <option value="heat">{t('paletteHeat')}</option>
                  <option value="cyan">{t('paletteCyan')}</option>
                  <option value="grayscale">{t('paletteGrayscale')}</option>
                  <option value="coolwarm">{t('paletteCoolwarm')}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 tabular-nums">
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>{t('minCutLevel')}</span>
                  <span className="font-mono text-cyan-300">{minCut}</span>
                </div>
                <input
                  type="range"
                  min={activeFitsImage ? activeFitsImage.min : 0}
                  max={activeFitsImage ? activeFitsImage.max * 0.8 : 100}
                  step={0.5}
                  value={minCut}
                  onChange={(e) => setMinCut(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>{t('maxCutLevel')}</span>
                  <span className="font-mono text-cyan-300">{maxCut}</span>
                </div>
                <input
                  type="range"
                  min={minCut + 0.1}
                  max={activeFitsImage ? activeFitsImage.max : 200}
                  step={0.5}
                  value={maxCut}
                  onChange={(e) => setMaxCut(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Right: Image Statistics + Intensity Histogram + Header Cards */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="p-5 rounded-2xl cosmic-glass space-y-3">
            <h2 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Info size={13} className="text-cyan-400" />
              <span>{t('imageStatistics')}</span>
            </h2>

            {displayHdu ? (
              <div className="space-y-2 text-xs font-mono tabular-nums">
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-400">{t('statDimensions')}</span>
                  <span className="text-white font-semibold">
                    {displayHdu.naxis1} × {displayHdu.naxis2}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-400">{t('statMinVal')}</span>
                  <span className="text-cyan-300">{displayHdu.min.toFixed(3)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-400">{t('statMaxVal')}</span>
                  <span className="text-cyan-300">{displayHdu.max.toFixed(3)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-400">{t('statMeanVal')}</span>
                  <span className="text-white">{displayHdu.mean.toFixed(3)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-400">{t('statStdDev')}</span>
                  <span className="text-white">{displayHdu.stdDev.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('statMedianVal')}</span>
                  <span className="text-white">{displayHdu.median.toFixed(3)}</span>
                </div>

                <div className="pt-2">
                  <span className="text-[10px] text-slate-400 block mb-1.5">
                    Pixel Intensity Distribution (64 bins)
                  </span>
                  <div className="h-12 w-full flex items-end gap-[1px] bg-[#03050C] p-1.5 rounded-lg border border-slate-800/80">
                    {displayHdu.histogram.slice(0, 64).map((cnt, i) => {
                      const maxBin = Math.max(...displayHdu.histogram) || 1;
                      const barH = Math.min(100, Math.round((cnt / maxBin) * 100));
                      return (
                        <div
                          key={i}
                          style={{ height: `${Math.max(4, barH)}%` }}
                          className="flex-1 bg-cyan-400/75 hover:bg-cyan-300 transition-colors"
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">No FITS file loaded.</p>
            )}
          </div>

          <div className="p-4 rounded-2xl cosmic-glass flex flex-col h-[420px]">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileCode2 size={13} className="text-cyan-400" />
                <span>{t('fitsHeaderCards')}</span>
              </h3>
              <span className="text-[10px] font-mono text-cyan-300 tabular-nums">
                {filteredCards.length} cards
              </span>
            </div>

            <div className="relative mb-2.5">
              <Search className="absolute left-2.5 rtl:left-auto rtl:right-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={headerFilter}
                onChange={(e) => setHeaderFilter(e.target.value)}
                placeholder={t('searchHeader')}
                className="w-full bg-[#060A16] border border-slate-800 rounded-lg px-2 pl-7 rtl:pl-2 rtl:pr-7 py-1.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/70 font-mono text-[11px]">
              {filteredCards.map((card, idx) => (
                <div key={idx} className="py-2 px-1">
                  <div className="flex justify-between gap-2">
                    <span className="text-cyan-300 font-semibold">{card.key}</span>
                    <span className="text-emerald-300 truncate">{String(card.value)}</span>
                  </div>
                  {card.comment && (
                    <div className="text-[10px] text-slate-500 truncate mt-0.5">/ {card.comment}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
