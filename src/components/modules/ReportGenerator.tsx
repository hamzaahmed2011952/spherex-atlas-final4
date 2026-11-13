import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GaiaCrossMatchSource } from '../../types/astronomy';
import {
  Printer,
  FileSpreadsheet,
  FileCode,
  Loader2,
  Crosshair,
} from 'lucide-react';
import { ObservatoryPageHeader, ProvenanceNotice } from '../ui/ObservatoryPrimitives';

export const ReportGenerator: React.FC = () => {
  const {
    t,
    language,
    selectedTarget,
    selectedSpectralDataset,
    activeFitsImage,
    savedResearch,
  } = useApp();

  const [reportTitle, setReportTitle] = useState(
    `SPHEREx Astrophysical Investigation: ${selectedTarget.name}`
  );
  const [investigator, setInvestigator] = useState('NASA Space Apps Astrophysics Researcher');
  const [includeFits, setIncludeFits] = useState(true);
  const [includeSpectra, setIncludeSpectra] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeAiSummary, setIncludeAiSummary] = useState(true);
  const [gaiaLoading, setGaiaLoading] = useState(false);
  const [gaiaSources, setGaiaSources] = useState<GaiaCrossMatchSource[] | null>(null);
  const [gaiaError, setGaiaError] = useState<string | null>(null);

  const handleRunGaiaVerification = async () => {
    setGaiaLoading(true);
    setGaiaError(null);
    try {
      const res = await fetch(
        `/api/catalog/gaia-crossmatch?ra=${selectedTarget.ra.toFixed(6)}&dec=${selectedTarget.dec.toFixed(
          6
        )}&radiusArcsec=30&epochYear=2025.5`
      );
      const data = await res.json();
      if (!res.ok) {
        setGaiaError(data?.error || `HTTP ${res.status}`);
      } else {
        setGaiaSources(
          Array.isArray(data.matches)
            ? data.matches
            : Array.isArray(data.sources)
            ? data.sources
            : []
        );
      }
    } catch (err: any) {
      setGaiaError(err?.message || 'Failed to query ESA Gaia DR3');
    } finally {
      setGaiaLoading(false);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const handleExportJson = () => {
    const reportData = {
      title: reportTitle,
      investigator,
      generatedAt: new Date().toISOString(),
      target: {
        name: selectedTarget.name,
        canonicalName: selectedTarget.canonicalName,
        category: selectedTarget.category,
        ra: selectedTarget.ra,
        dec: selectedTarget.dec,
        raHms: selectedTarget.raHms,
        decDms: selectedTarget.decDms,
        spectralType: selectedTarget.spectralType,
        keyMolecules: selectedTarget.keyMolecules,
        photometry: selectedTarget.apparentMagnitude,
      },
      fitsMetadata: activeFitsImage
        ? {
            name: activeFitsImage.name,
            bitpix: activeFitsImage.bitpix,
            dimensions: `${activeFitsImage.naxis1}x${activeFitsImage.naxis2}`,
            min: activeFitsImage.min,
            max: activeFitsImage.max,
            mean: activeFitsImage.mean,
            stdDev: activeFitsImage.stdDev,
            wcs: activeFitsImage.wcs,
            extensionsCount: activeFitsImage.extensions?.length || 1,
            qualitySummary: activeFitsImage.qualitySummary || null,
          }
        : null,
      gaiaDr3Verification: gaiaSources,
      spectralData: {
        title: selectedSpectralDataset.titleEn,
        provenance: selectedSpectralDataset.provenance,
        resolution: selectedSpectralDataset.resolutionPower,
        pointsCount: selectedSpectralDataset.points.length,
        points: selectedSpectralDataset.points.slice(0, 30),
      },
      researchNotes: savedResearch.notes.filter((n) => n.targetId === selectedTarget.id || !n.targetId),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SPHEREx_Scientific_Report_${selectedTarget.id}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    let csv = 'band_index,detector_array,wavelength_um,flux_density_mjy,uncertainty_mjy,target,date\n';
    selectedSpectralDataset.points.forEach((p) => {
      csv += `${p.bandIndex},${p.detectorArray},${p.wavelengthMicrons},${p.fluxDensityMjy},${p.uncertaintyMjy},"${selectedTarget.name}",${selectedSpectralDataset.dateObserved}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SPHEREx_Measurements_${selectedTarget.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const relevantNotes = savedResearch.notes.filter(
    (n) => n.targetId === selectedTarget.id || !n.targetId
  );

  return (
    <div className="space-y-6 pb-16">
      <div className="no-print">
        <ObservatoryPageHeader
          kicker="PUBLICATION & SCIENTIFIC EXPORT"
          title={t('reportsTitle')}
          subtitle={t('reportsSubtitle')}
          actions={
            <>
              <button
                onClick={handlePrintPdf}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap"
              >
                <Printer size={14} />
                <span>{t('exportPdf')}</span>
              </button>

              <button
                onClick={handleExportJson}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0D162E] hover:bg-[#132042] text-slate-200 border border-slate-700/80 text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <FileCode size={14} />
                <span>{t('exportJsonPackage')}</span>
              </button>

              <button
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0D162E] hover:bg-[#132042] text-slate-200 border border-slate-700/80 text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <FileSpreadsheet size={14} />
                <span>{t('exportCsvTable')}</span>
              </button>
            </>
          }
        />
      </div>

      {/* Customizer Bar */}
      <div className="no-print p-5 rounded-2xl cosmic-glass grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <label className="text-slate-300 font-medium block mb-1.5">{t('reportTitle')}</label>
          <input
            type="text"
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            className="w-full bg-[#060A16] border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/70"
          />
        </div>

        <div>
          <label className="text-slate-300 font-medium block mb-1.5">{t('reportInvestigator')}</label>
          <input
            type="text"
            value={investigator}
            onChange={(e) => setInvestigator(e.target.value)}
            className="w-full bg-[#060A16] border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/70"
          />
        </div>

        <div className="md:col-span-2 flex flex-wrap gap-5 pt-1 text-slate-300">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={includeFits}
              onChange={(e) => setIncludeFits(e.target.checked)}
              className="accent-cyan-400"
            />
            <span>{t('includeFitsStats')}</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={includeSpectra}
              onChange={(e) => setIncludeSpectra(e.target.checked)}
              className="accent-cyan-400"
            />
            <span>{t('includeSpectralChart')}</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={includeNotes}
              onChange={(e) => setIncludeNotes(e.target.checked)}
              className="accent-cyan-400"
            />
            <span>Include Personal Notes</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={includeAiSummary}
              onChange={(e) => setIncludeAiSummary(e.target.checked)}
              className="accent-cyan-400"
            />
            <span>{t('includeAiSummary')}</span>
          </label>
          <button
            type="button"
            onClick={handleRunGaiaVerification}
            disabled={gaiaLoading}
            className="ms-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D162E] hover:bg-[#132042] text-cyan-300 border border-cyan-500/35 text-xs font-semibold transition-colors"
          >
            {gaiaLoading ? <Loader2 size={12} className="animate-spin" /> : <Crosshair size={12} />}
            <span>Attach Live Gaia DR3 Verification</span>
          </button>
        </div>
      </div>

      {/* Print-ready Publication Memorandum */}
      <div className="p-6 sm:p-10 rounded-2xl cosmic-glass text-slate-200 space-y-6 report-page">
        <div className="border-b-2 border-cyan-500/60 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
          <div>
            <div className="text-[11px] font-mono tracking-widest uppercase text-cyan-300 font-bold mb-1">
              NASA SPHEREx ASTROPHYSICAL OBSERVATION MEMORANDUM
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-extrabold text-white">
              {reportTitle}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Primary Investigator: <strong className="text-slate-200">{investigator}</strong>
            </p>
          </div>

          <div className="text-left rtl:text-right font-mono text-[11px] text-slate-400 space-y-0.5 tabular-nums">
            <div>DATE: {new Date().toLocaleDateString()}</div>
            <div>MISSION: NASA SPHEREx (MIDEX)</div>
            <div>ARCHIVE: NASA/IPAC IRSA (Caltech)</div>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
            <span>1.0</span> <span>{t('executiveSummary')}</span>
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed bg-[#060A16] p-4 rounded-xl border border-slate-800/80">
            {language === 'ar' ? selectedTarget.descriptionAr : selectedTarget.descriptionEn}
            <br className="mb-2" />
            <strong className="text-cyan-300">SPHEREx Mission Context: </strong>
            {language === 'ar' ? selectedTarget.spherexRelevanceAr : selectedTarget.spherexRelevanceEn}
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
            <span>2.0</span> <span>{t('astrometricData')}</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#060A16] p-4 rounded-xl border border-slate-800/80 font-mono text-xs tabular-nums">
            <div>
              <span className="text-[10px] text-slate-400 uppercase block">Right Ascension (J2000)</span>
              <span className="text-white font-bold">
                {selectedTarget.raHms} ({selectedTarget.ra.toFixed(3)}°)
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase block">Declination (J2000)</span>
              <span className="text-white font-bold">
                {selectedTarget.decDms} ({selectedTarget.dec.toFixed(3)}°)
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase block">Spectral / Object Type</span>
              <span className="text-cyan-300">{selectedTarget.spectralType || 'Astronomical Source'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase block">Source Catalog</span>
              <span className="text-slate-300">{selectedTarget.sourceCatalog}</span>
            </div>
          </div>
        </div>

        {includeFits && activeFitsImage && (
          <div className="space-y-2">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
              <span>3.0</span> <span>FITS Array Properties, MEF Layers &amp; WCS Calibration</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#060A16] p-4 rounded-xl border border-slate-800/80 font-mono text-xs tabular-nums">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">FITS Image ID</span>
                <span className="text-white font-bold">{activeFitsImage.name}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Array Dimensions</span>
                <span className="text-white">
                  {activeFitsImage.naxis1} × {activeFitsImage.naxis2} px ({activeFitsImage.extensions?.length || 1} HDUs)
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Mean Surface Brightness</span>
                <span className="text-cyan-300">
                  {activeFitsImage.mean.toFixed(2)}{' '}
                  {String(activeFitsImage.headerCards.find((c) => c.key === 'BUNIT')?.value || 'MJy/sr')}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">
                  {activeFitsImage.qualitySummary ? 'Median / Peak SNR' : 'Pixel Dispersion (1σ)'}
                </span>
                <span className="text-slate-300">
                  {activeFitsImage.qualitySummary?.medianSnr !== undefined &&
                  activeFitsImage.qualitySummary?.medianSnr !== null
                    ? `${activeFitsImage.qualitySummary.medianSnr.toFixed(1)} / ${
                        activeFitsImage.qualitySummary.peakSnr?.toFixed(1) ?? '—'
                      }`
                    : activeFitsImage.stdDev.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {(gaiaSources || gaiaError) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                <span>2.5</span> <span>ESA Gaia DR3 Astrometric Verification (J2025.5)</span>
              </h2>
              <ProvenanceNotice status="EXTERNAL CATALOG DATA" compact />
            </div>
            {gaiaError ? (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs font-mono text-rose-200">
                {gaiaError}
              </div>
            ) : gaiaSources && gaiaSources.length === 0 ? (
              <div className="p-3 rounded-xl bg-[#060A16] border border-slate-800/80 text-xs font-mono text-slate-400">
                No Gaia DR3 counterparts found within 30&quot; of {selectedTarget.name}.
              </div>
            ) : (
              <div className="bg-[#060A16] p-3 rounded-xl border border-slate-800/80 font-mono text-[11px] overflow-x-auto tabular-nums">
                <table className="w-full text-left rtl:text-right">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-1.5 px-2">Gaia DR3 Source ID</th>
                      <th className="py-1.5 px-2">Sep (&quot;)</th>
                      <th className="py-1.5 px-2">G (mag)</th>
                      <th className="py-1.5 px-2">PM Total (mas/yr)</th>
                      <th className="py-1.5 px-2">Class</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {gaiaSources?.slice(0, 5).map((src) => (
                      <tr key={src.sourceId}>
                        <td className="py-1.5 px-2 text-cyan-300">{src.sourceId}</td>
                        <td className="py-1.5 px-2">{src.propagatedSeparationArcsec.toFixed(2)}&quot;</td>
                        <td className="py-1.5 px-2">
                          {src.photGMag !== null ? src.photGMag.toFixed(2) : '—'}
                        </td>
                        <td className="py-1.5 px-2">
                          {src.totalPmMasYr !== null ? src.totalPmMasYr.toFixed(1) : '—'}
                        </td>
                        <td className="py-1.5 px-2 text-emerald-300">{src.matchClassification}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {includeSpectra && (
          <div className="space-y-2">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
              <span>4.0</span> <span>{t('spectralMeasurementsTable')} (0.75 – 5.00 µm)</span>
            </h2>
            <div className="bg-[#060A16] p-3 rounded-xl border border-slate-800/80 font-mono text-[11px] overflow-x-auto tabular-nums">
              <table className="w-full text-left rtl:text-right">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-1.5 px-2">Band #</th>
                    <th className="py-1.5 px-2">Detector</th>
                    <th className="py-1.5 px-2">Wavelength (µm)</th>
                    <th className="py-1.5 px-2">Flux (mJy)</th>
                    <th className="py-1.5 px-2">Uncertainty</th>
                    <th className="py-1.5 px-2">Feature / Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {selectedSpectralDataset.points.slice(0, 10).map((pt) => (
                    <tr key={pt.bandIndex}>
                      <td className="py-1.5 px-2 font-bold text-cyan-300">#{pt.bandIndex}</td>
                      <td className="py-1.5 px-2">Array {pt.detectorArray}</td>
                      <td className="py-1.5 px-2">{pt.wavelengthMicrons.toFixed(3)}</td>
                      <td className="py-1.5 px-2 text-white font-bold">{pt.fluxDensityMjy.toFixed(2)}</td>
                      <td className="py-1.5 px-2 text-slate-400">±{pt.uncertaintyMjy.toFixed(2)}</td>
                      <td className="py-1.5 px-2 text-amber-300">
                        {language === 'ar' ? pt.featureNoteAr || '—' : pt.featureNoteEn || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-[10px] text-slate-400 text-center py-1.5 mt-1">
                Showing sample of 10 channels ({selectedSpectralDataset.dataStatus || 'SIMULATED DEMO DATA'}). Export CSV for all 102 channels.
              </div>
            </div>
          </div>
        )}

        {includeAiSummary && (
          <div className="space-y-2">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
              <span>5.0</span> <span>Epistemic Evaluation Summary</span>
            </h2>
            <div className="bg-[#060A16] p-4 rounded-xl border border-slate-800/80 text-xs text-slate-200 leading-relaxed space-y-2">
              <p>
                <span className="inline-block px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700 font-mono font-bold text-[10px] me-1.5">
                  [DIRECT OBSERVATION]
                </span>
                Target {selectedTarget.name} includes catalog coordinates and 2MASS/WISE reference magnitudes. Full 0.75–5.00 µm coverage encompasses biogenic ice bands (H2O 3.05 µm, CO2 4.27 µm, CO 4.67 µm).
              </p>
              <p>
                <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 font-mono font-bold text-[10px] me-1.5">
                  [DERIVED PARAMETER]
                </span>
                Derived optical depths across Array 4 (2.42–3.82 µm) and Array 5 (3.82–4.42 µm) track column densities across interstellar molecular dust grains.
              </p>
              <p>
                <span className="inline-block px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-700 font-mono font-bold text-[10px] me-1.5">
                  [THEORETICAL MODEL]
                </span>
                Spectral energy distribution matches theoretical protostellar dust envelope models with cryogenic grain ice mantling.
              </p>
            </div>
          </div>
        )}

        {includeNotes && relevantNotes.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
              <span>6.0</span> <span>Investigator Research Notes</span>
            </h2>
            <div className="space-y-2">
              {relevantNotes.map((note) => (
                <div key={note.id} className="p-3 rounded-xl bg-[#060A16] border border-slate-800/80 text-xs">
                  <h4 className="font-bold text-white mb-1">{note.title}</h4>
                  <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-800 text-[10px] font-mono text-slate-400 flex flex-wrap items-center justify-between gap-2">
          <div>Generated by SPHEREx ATLAS Platform · NASA Space Apps Challenge</div>
          <div>Archive Citation: NASA/IPAC Infrared Science Archive (IRSA), Caltech</div>
        </div>
      </div>
    </div>
  );
};
