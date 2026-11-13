import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SPECTRAL_DATASETS } from '../../data/spectraData';
import { SpectralPoint } from '../../types/astronomy';
import {
  Activity,
  Info,
  FileSpreadsheet,
  FileCode,
} from 'lucide-react';
import {
  ObservatoryPageHeader,
  ProvenanceNotice,
} from '../ui/ObservatoryPrimitives';

export const SpectralStudio: React.FC = () => {
  const { t, language, selectedSpectralDataset, setSelectedSpectralDataset } = useApp();

  const [compareDatasetId, setCompareDatasetId] = useState<string>('none');
  const [hoveredPoint, setHoveredPoint] = useState<SpectralPoint | null>(null);
  const [showMolecularBands, setShowMolecularBands] = useState<boolean>(true);
  const [showErrorBars, setShowErrorBars] = useState<boolean>(true);

  const compareDataset = SPECTRAL_DATASETS.find((d) => d.id === compareDatasetId);

  const width = 860;
  const height = 400;
  const margin = { top: 30, right: 30, bottom: 50, left: 65 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const minW = 0.75;
  const maxW = 5.0;

  const allPoints = compareDataset
    ? [...selectedSpectralDataset.points, ...compareDataset.points]
    : selectedSpectralDataset.points;

  const maxFlux = Math.max(...allPoints.map((p) => p.fluxDensityMjy)) * 1.15 || 100;
  const minFlux = 0;

  const scaleX = (w: number) => margin.left + ((w - minW) / (maxW - minW)) * innerWidth;
  const scaleY = (f: number) => margin.top + innerHeight - ((f - minFlux) / (maxFlux - minFlux)) * innerHeight;

  const buildPathD = (points: SpectralPoint[]) =>
    points
      .map((p, idx) => {
        const x = scaleX(p.wavelengthMicrons);
        const y = scaleY(p.fluxDensityMjy);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');

  const MOLECULAR_FEATURES = [
    { name: 'PAH (3.30 µm)', wavelength: 3.3, color: '#F59E0B' },
    { name: 'H2O Ice (3.05 µm)', wavelength: 3.05, color: '#22D3EE' },
    { name: 'CH4 (3.32 µm)', wavelength: 3.32, color: '#34D399' },
    { name: 'Br-α (4.05 µm)', wavelength: 4.05, color: '#F472B6' },
    { name: 'CO2 Ice (4.27 µm)', wavelength: 4.27, color: '#818CF8' },
    { name: 'CO Ice (4.67 µm)', wavelength: 4.67, color: '#38BDF8' },
  ];

  const ARRAY_BOUNDS = [
    { array: 1, start: 0.75, end: 1.11, label: 'Array 1', color: 'rgba(56, 189, 248, 0.04)' },
    { array: 2, start: 1.11, end: 1.64, label: 'Array 2', color: 'rgba(99, 102, 241, 0.04)' },
    { array: 3, start: 1.64, end: 2.42, label: 'Array 3', color: 'rgba(168, 85, 247, 0.04)' },
    { array: 4, start: 2.42, end: 3.82, label: 'Array 4 (Ices)', color: 'rgba(34, 211, 238, 0.07)' },
    { array: 5, start: 3.82, end: 4.42, label: 'Array 5 (CO2)', color: 'rgba(236, 72, 153, 0.05)' },
    { array: 6, start: 4.42, end: 5.0, label: 'Array 6 (CO)', color: 'rgba(245, 158, 11, 0.05)' },
  ];

  const handleExportCsv = () => {
    const dataStatus = selectedSpectralDataset.dataStatus || 'SIMULATED DEMO DATA';
    const provenance = selectedSpectralDataset.provenance || 'SPHEREx ATLAS Spectral Model';
    let csv = `# data_status: ${dataStatus}\n# provenance: ${provenance}\nband_index,detector_array,wavelength_um,flux_density_mjy,uncertainty_mjy,data_status,provenance\n`;
    selectedSpectralDataset.points.forEach((p) => {
      csv += `${p.bandIndex},${p.detectorArray},${p.wavelengthMicrons},${p.fluxDensityMjy},${p.uncertaintyMjy},"${dataStatus}","${provenance}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SPHEREx_Spectrum_${selectedSpectralDataset.targetId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    const payload = {
      ...selectedSpectralDataset,
      dataStatus: selectedSpectralDataset.dataStatus || 'SIMULATED DEMO DATA',
      provenance: selectedSpectralDataset.provenance || 'SPHEREx ATLAS Spectral Model',
    };
    const dataStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SPHEREx_Spectrum_${selectedSpectralDataset.targetId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-12">
      <ObservatoryPageHeader
        kicker="102-BAND LVF SPECTROPHOTOMETRY · 0.75–5.00 µm"
        title={t('spectraTitle')}
        subtitle={t('spectraSubtitle')}
        actions={
          <>
            <select
              value={selectedSpectralDataset.id}
              onChange={(e) => {
                const found = SPECTRAL_DATASETS.find((d) => d.id === e.target.value);
                if (found) setSelectedSpectralDataset(found);
              }}
              className="bg-[#090F20] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-cyan-500"
            >
              {SPECTRAL_DATASETS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.targetName} ({d.category})
                </option>
              ))}
            </select>

            <select
              value={compareDatasetId}
              onChange={(e) => setCompareDatasetId(e.target.value)}
              className="bg-[#090F20] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-cyan-200 font-medium focus:outline-none focus:border-cyan-500"
            >
              <option value="none">{t('noneCompare')}</option>
              {SPECTRAL_DATASETS.filter((d) => d.id !== selectedSpectralDataset.id).map((d) => (
                <option key={d.id} value={d.id}>
                  Overlay: {d.targetName}
                </option>
              ))}
            </select>

            <div className="flex rounded-lg bg-[#090F20] border border-slate-800 p-0.5 text-xs font-semibold">
              <button
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-slate-300 hover:text-cyan-300 hover:bg-[#0D162E] transition-colors"
              >
                <FileSpreadsheet size={13} />
                <span>CSV</span>
              </button>
              <button
                onClick={handleExportJson}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-slate-300 hover:text-cyan-300 hover:bg-[#0D162E] transition-colors"
              >
                <FileCode size={13} />
                <span>JSON</span>
              </button>
            </div>
          </>
        }
      />

      {/* Main Spectral Bench */}
      <section className="p-5 sm:p-6 rounded-2xl cosmic-glass space-y-4">
        <div className="p-3.5 rounded-xl bg-[#060A16] border border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-2.5">
            <ProvenanceNotice
              status={
                selectedSpectralDataset.isSimulatedOrDemo
                  ? 'SIMULATED DATA — NOT REAL SPHEREx OBSERVATIONS'
                  : 'REAL ARCHIVE DATA'
              }
              compact
            />
            <span className="text-slate-300 text-[11px]">
              {selectedSpectralDataset.isSimulatedOrDemo
                ? 'Synthesized from radiative transfer models and catalog photometry (2MASS / WISE) to demonstrate 102-channel LVF capability.'
                : 'Direct archive spectrophotometric measurements with calibrated 1σ uncertainties.'}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div>
            <span className="text-[11px] font-mono text-cyan-300 font-semibold uppercase tracking-wider block">
              {selectedSpectralDataset.category} · {selectedSpectralDataset.resolutionPower}
            </span>
            <h2 className="font-display text-lg font-bold text-white mt-0.5">
              {language === 'ar' ? selectedSpectralDataset.titleAr : selectedSpectralDataset.titleEn}
            </h2>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-300">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showMolecularBands}
                onChange={(e) => setShowMolecularBands(e.target.checked)}
                className="accent-cyan-400"
              />
              <span>Molecular Markers</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showErrorBars}
                onChange={(e) => setShowErrorBars(e.target.checked)}
                className="accent-cyan-400"
              />
              <span>1σ Uncertainties</span>
            </label>
          </div>
        </div>

        <div className="w-full overflow-x-auto rounded-xl bg-[#03050C] border border-slate-800/80 p-2">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto min-w-[700px] select-none font-mono text-[10px]"
          >
            {ARRAY_BOUNDS.map((ab) => {
              const x1 = scaleX(ab.start);
              const x2 = scaleX(ab.end);
              return (
                <g key={ab.array}>
                  <rect x={x1} y={margin.top} width={x2 - x1} height={innerHeight} fill={ab.color} />
                  <text x={x1 + 6} y={margin.top + 14} fill="#64748B" fontSize="9" fontWeight="bold">
                    {ab.label}
                  </text>
                </g>
              );
            })}

            {[1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0].map((w) => (
              <line
                key={`grid-x-${w}`}
                x1={scaleX(w)}
                y1={margin.top}
                x2={scaleX(w)}
                y2={margin.top + innerHeight}
                stroke="rgba(255, 255, 255, 0.05)"
                strokeDasharray="2 4"
              />
            ))}

            {[0.25, 0.5, 0.75, 1.0].map((frac) => {
              const f = maxFlux * frac;
              const y = scaleY(f);
              return (
                <g key={`grid-y-${frac}`}>
                  <line
                    x1={margin.left}
                    y1={y}
                    x2={margin.left + innerWidth}
                    y2={y}
                    stroke="rgba(255, 255, 255, 0.05)"
                    strokeDasharray="2 4"
                  />
                  <text x={margin.left - 8} y={y + 3} textAnchor="end" fill="#64748B" fontSize="9">
                    {f.toFixed(0)}
                  </text>
                </g>
              );
            })}

            {showMolecularBands &&
              MOLECULAR_FEATURES.map((feat, idx) => {
                const x = scaleX(feat.wavelength);
                return (
                  <g key={idx}>
                    <line
                      x1={x}
                      y1={margin.top}
                      x2={x}
                      y2={margin.top + innerHeight}
                      stroke={feat.color}
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={x + 3}
                      y={margin.top + 28 + (idx % 3) * 12}
                      fill={feat.color}
                      fontSize="9"
                      fontWeight="bold"
                    >
                      {feat.name}
                    </text>
                  </g>
                );
              })}

            {compareDataset && (
              <g>
                <path
                  d={buildPathD(compareDataset.points)}
                  fill="none"
                  stroke="#818CF8"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
                {compareDataset.points.map((p, i) => (
                  <circle
                    key={`comp-pt-${i}`}
                    cx={scaleX(p.wavelengthMicrons)}
                    cy={scaleY(p.fluxDensityMjy)}
                    r="2"
                    fill="#818CF8"
                  />
                ))}
              </g>
            )}

            <path
              d={buildPathD(selectedSpectralDataset.points)}
              fill="none"
              stroke="#22D3EE"
              strokeWidth="2.25"
            />

            {selectedSpectralDataset.points.map((p, idx) => {
              const x = scaleX(p.wavelengthMicrons);
              const y = scaleY(p.fluxDensityMjy);
              const isHovered = hoveredPoint?.bandIndex === p.bandIndex;

              return (
                <g key={idx} onMouseEnter={() => setHoveredPoint(p)} className="cursor-pointer">
                  {showErrorBars && (
                    <line
                      x1={x}
                      y1={scaleY(p.fluxDensityMjy - p.uncertaintyMjy)}
                      x2={x}
                      y2={scaleY(p.fluxDensityMjy + p.uncertaintyMjy)}
                      stroke="rgba(34, 211, 238, 0.5)"
                      strokeWidth="1"
                    />
                  )}
                  <circle
                    cx={x}
                    cy={y}
                    r={isHovered ? 6 : 3}
                    fill={p.featureNoteEn ? '#F59E0B' : '#22D3EE'}
                    stroke="#FFFFFF"
                    strokeWidth={isHovered ? 2 : 1}
                  />
                </g>
              );
            })}

            <line
              x1={margin.left}
              y1={margin.top + innerHeight}
              x2={margin.left + innerWidth}
              y2={margin.top + innerHeight}
              stroke="#475569"
              strokeWidth="1.5"
            />
            <line
              x1={margin.left}
              y1={margin.top}
              x2={margin.left}
              y2={margin.top + innerHeight}
              stroke="#475569"
              strokeWidth="1.5"
            />

            {[0.75, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0].map((w) => (
              <text
                key={`tick-${w}`}
                x={scaleX(w)}
                y={margin.top + innerHeight + 18}
                textAnchor="middle"
                fill="#94A3B8"
              >
                {w.toFixed(2)}
              </text>
            ))}

            <text
              x={margin.left + innerWidth / 2}
              y={height - 10}
              textAnchor="middle"
              fill="#E2E8F0"
              fontSize="11"
              fontWeight="bold"
            >
              {t('wavelengthMicrons')} (0.75 – 5.00 µm)
            </text>

            <text
              x={-height / 2}
              y={18}
              transform="rotate(-90)"
              textAnchor="middle"
              fill="#E2E8F0"
              fontSize="11"
              fontWeight="bold"
            >
              {t('fluxDensity')}
            </text>
          </svg>
        </div>

        <div className="px-4 py-3 rounded-xl bg-[#060A16] border border-slate-800/80 font-mono text-xs flex flex-wrap items-center justify-between gap-3 text-slate-300 tabular-nums">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-cyan-300 font-bold flex items-center gap-1.5">
              <Activity size={14} />
              <span>CHANNEL</span>
            </span>
            <span>
              Band{' '}
              <strong className="text-white">
                {hoveredPoint
                  ? `#${hoveredPoint.bandIndex} (Array ${hoveredPoint.detectorArray})`
                  : 'Hover data point'}
              </strong>
            </span>
            <span>
              λ{' '}
              <strong className="text-cyan-300">
                {hoveredPoint ? `${hoveredPoint.wavelengthMicrons.toFixed(3)} µm` : '—'}
              </strong>
            </span>
            <span>
              Flux{' '}
              <strong className="text-white">
                {hoveredPoint
                  ? `${hoveredPoint.fluxDensityMjy.toFixed(2)} ± ${hoveredPoint.uncertaintyMjy.toFixed(2)} mJy`
                  : '—'}
              </strong>
            </span>
          </div>

          {hoveredPoint?.featureNoteEn && (
            <div className="text-xs text-amber-300 font-semibold">
              {language === 'ar' ? hoveredPoint.featureNoteAr : hoveredPoint.featureNoteEn}
            </div>
          )}
        </div>
      </section>

      <section className="p-5 rounded-2xl cosmic-glass text-xs text-slate-300 leading-relaxed space-y-2">
        <h3 className="font-display font-bold text-white text-sm flex items-center gap-2">
          <Info size={15} className="text-cyan-400" />
          <span>{t('dataProvenance')}</span>
        </h3>
        <p className="text-slate-400 font-mono text-[11px] tabular-nums">
          {selectedSpectralDataset.provenance} · Observed Date: {selectedSpectralDataset.dateObserved}
        </p>
        <p>{language === 'ar' ? selectedSpectralDataset.notesAr : selectedSpectralDataset.notesEn}</p>
      </section>
    </div>
  );
};
