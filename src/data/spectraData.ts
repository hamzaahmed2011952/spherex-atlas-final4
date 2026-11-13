import { SpectralDataset, SpectralPoint } from '../types/astronomy';

// Generates 102 contiguous SPHEREx spectral bands across 6 Linear Variable Filter arrays
export function getSpherexBandWavelengths(): { bandIndex: number; wavelength: number; array: number }[] {
  const bands: { bandIndex: number; wavelength: number; array: number }[] = [];

  // Array 1: 0.75 - 1.11 µm (17 bands)
  for (let i = 0; i < 17; i++) {
    bands.push({
      bandIndex: i + 1,
      wavelength: Number((0.75 + (i / 16) * (1.11 - 0.75)).toFixed(3)),
      array: 1,
    });
  }

  // Array 2: 1.11 - 1.64 µm (17 bands)
  for (let i = 0; i < 17; i++) {
    bands.push({
      bandIndex: 17 + i + 1,
      wavelength: Number((1.11 + (i / 16) * (1.64 - 1.11)).toFixed(3)),
      array: 2,
    });
  }

  // Array 3: 1.64 - 2.42 µm (17 bands)
  for (let i = 0; i < 17; i++) {
    bands.push({
      bandIndex: 34 + i + 1,
      wavelength: Number((1.64 + (i / 16) * (2.42 - 1.64)).toFixed(3)),
      array: 3,
    });
  }

  // Array 4: 2.42 - 3.82 µm (17 bands)
  for (let i = 0; i < 17; i++) {
    bands.push({
      bandIndex: 51 + i + 1,
      wavelength: Number((2.42 + (i / 16) * (3.82 - 2.42)).toFixed(3)),
      array: 4,
    });
  }

  // Array 5: 3.82 - 4.42 µm (17 bands)
  for (let i = 0; i < 17; i++) {
    bands.push({
      bandIndex: 68 + i + 1,
      wavelength: Number((3.82 + (i / 16) * (4.42 - 3.82)).toFixed(3)),
      array: 5,
    });
  }

  // Array 6: 4.42 - 5.00 µm (17 bands)
  for (let i = 0; i < 17; i++) {
    bands.push({
      bandIndex: 85 + i + 1,
      wavelength: Number((4.42 + (i / 16) * (5.00 - 4.42)).toFixed(3)),
      array: 6,
    });
  }

  return bands;
}

const SPHEREX_BANDS = getSpherexBandWavelengths();

// 1. Orion KL Protostellar Core with massive biogenic ice absorption features
function generateOrionSpectrum(): SpectralPoint[] {
  return SPHEREX_BANDS.map((b) => {
    const w = b.wavelength;
    // Base continuum: rising modified blackbody for cold protostellar dust
    let continuum = 28.0 * Math.pow(w / 1.5, 2.1);

    let noteEn = undefined;
    let noteAr = undefined;

    // Feature 1: H2O Ice absorption at 3.05 µm (FWHM ~ 0.35 µm)
    const h2oDepth = 0.78 * Math.exp(-Math.pow((w - 3.05) / 0.18, 2));
    if (Math.abs(w - 3.05) < 0.12) {
      noteEn = 'Deep H2O Ice absorption (3.05 µm)';
      noteAr = 'امتصاص عميق لجليد الماء (3.05 ميكرومتر)';
    }

    // Feature 2: CO2 Ice absorption at 4.27 µm (FWHM ~ 0.08 µm)
    const co2Depth = 0.52 * Math.exp(-Math.pow((w - 4.27) / 0.05, 2));
    if (Math.abs(w - 4.27) < 0.05) {
      noteEn = 'Solid CO2 Ice feature (4.27 µm)';
      noteAr = 'بصمة جليد ثاني أكسيد الكربون الصلب (4.27 ميكرومتر)';
    }

    // Feature 3: CO Ice absorption at 4.67 µm (FWHM ~ 0.04 µm)
    const coDepth = 0.44 * Math.exp(-Math.pow((w - 4.67) / 0.035, 2));
    if (Math.abs(w - 4.67) < 0.04) {
      noteEn = 'CO Ice absorption (4.67 µm)';
      noteAr = 'امتصاص جليد أول أكسيد الكربون (4.67 ميكرومتر)';
    }

    // Feature 4: Methanol CH3OH ice wing at 3.53 µm
    const ch3ohDepth = 0.22 * Math.exp(-Math.pow((w - 3.53) / 0.08, 2));
    if (Math.abs(w - 3.53) < 0.05) {
      noteEn = 'Interstellar CH3OH Methanol Ice wing (3.53 µm)';
      noteAr = 'جليد الميثانول بين النجمي (3.53 ميكرومتر)';
    }

    const absorptionFactor = Math.max(0.08, 1.0 - (h2oDepth + co2Depth + coDepth + ch3ohDepth));
    const flux = Number((continuum * absorptionFactor + (Math.sin(b.bandIndex * 3.7) * 0.4)).toFixed(2));
    const uncert = Number((0.02 * flux + 0.15).toFixed(2));

    return {
      bandIndex: b.bandIndex,
      wavelengthMicrons: w,
      detectorArray: b.array,
      fluxDensityMjy: Math.max(0.5, flux),
      uncertaintyMjy: uncert,
      featureNoteEn: noteEn,
      featureNoteAr: noteAr,
    };
  });
}

// 2. Starburst Galaxy M82 with prominent PAH emissions and warm dust
function generateM82Spectrum(): SpectralPoint[] {
  return SPHEREX_BANDS.map((b) => {
    const w = b.wavelength;
    // Stellar continuum + dust
    let flux = 450.0 * Math.pow(w / 2.0, -0.7) + 80.0 * Math.pow(w / 3.0, 1.8);

    let noteEn = undefined;
    let noteAr = undefined;

    // Feature: PAH emission at 3.3 µm
    if (Math.abs(w - 3.3) < 0.08) {
      flux += 280.0 * Math.exp(-Math.pow((w - 3.3) / 0.04, 2));
      noteEn = 'PAH 3.3 µm C-H stretch emission';
      noteAr = 'انبعاث الهيدروكربونات العطرية PAH عند 3.3 ميكرومتر';
    }

    // Feature: Brackett-alpha hydrogen recombination at 4.05 µm
    if (Math.abs(w - 4.05) < 0.06) {
      flux += 140.0 * Math.exp(-Math.pow((w - 4.05) / 0.03, 2));
      noteEn = 'Brackett-alpha (4.05 µm) H-recombination line';
      noteAr = 'خط براكيت-ألفا لإعادة اتحاد الهيدروجين (4.05 ميكرومتر)';
    }

    // Feature: CO stellar absorption bandhead at 2.3 µm
    if (Math.abs(w - 2.32) < 0.07) {
      flux -= 65.0 * Math.exp(-Math.pow((w - 2.32) / 0.04, 2));
      noteEn = 'Stellar CO Bandhead absorption (2.3 µm)';
      noteAr = 'امتصاص قمة نطاق أول أكسيد الكربون النجمي (2.3 ميكرومتر)';
    }

    const uncert = Number((0.015 * flux + 1.2).toFixed(2));

    return {
      bandIndex: b.bandIndex,
      wavelengthMicrons: w,
      detectorArray: b.array,
      fluxDensityMjy: Number(flux.toFixed(2)),
      uncertaintyMjy: uncert,
      featureNoteEn: noteEn,
      featureNoteAr: noteAr,
    };
  });
}

// 3. Protoplanetary Disk around Young Stellar Object
function generateProtoplanetaryDiskSpectrum(): SpectralPoint[] {
  return SPHEREX_BANDS.map((b) => {
    const w = b.wavelength;
    const starContinuum = 60.0 * Math.pow(w / 1.0, -2.5);
    const diskDust = 25.0 * Math.pow(w / 2.0, 1.5);
    let flux = starContinuum + diskDust;

    let noteEn = undefined;
    let noteAr = undefined;

    // Moderate ice absorption in outer disk
    const ice = 0.35 * Math.exp(-Math.pow((w - 3.05) / 0.2, 2));
    if (Math.abs(w - 3.05) < 0.1) {
      noteEn = 'Circumstellar Disk Water Ice (3.05 µm)';
      noteAr = 'جليد ماء في القرص حول النجم (3.05 ميكرومتر)';
    }

    // Weak CO2 ice
    const co2 = 0.2 * Math.exp(-Math.pow((w - 4.27) / 0.06, 2));
    if (Math.abs(w - 4.27) < 0.05) {
      noteEn = 'Disk CO2 Ice (4.27 µm)';
      noteAr = 'جليد ثاني أكسيد الكربون في القرص (4.27 ميكرومتر)';
    }

    flux = flux * (1.0 - (ice + co2));

    return {
      bandIndex: b.bandIndex,
      wavelengthMicrons: w,
      detectorArray: b.array,
      fluxDensityMjy: Number(flux.toFixed(2)),
      uncertaintyMjy: Number((0.02 * flux + 0.3).toFixed(2)),
      featureNoteEn: noteEn,
      featureNoteAr: noteAr,
    };
  });
}

// 4. Brown Dwarf / Exoplanet Atmosphere (Methane & Water vapor)
function generateBrownDwarfSpectrum(): SpectralPoint[] {
  return SPHEREX_BANDS.map((b) => {
    const w = b.wavelength;
    let flux = 15.0 * Math.exp(-Math.pow((w - 1.25) / 0.4, 2)) + 12.0 * Math.exp(-Math.pow((w - 1.6) / 0.3, 2)) + 8.0 * Math.exp(-Math.pow((w - 2.15) / 0.3, 2));

    let noteEn = undefined;
    let noteAr = undefined;

    // Strong CH4 methane absorption band at 3.32 µm
    if (w >= 3.1 && w <= 3.6) {
      flux *= 0.15;
      noteEn = 'Fundamental Methane (CH4) absorption band';
      noteAr = 'نطاق امتصاص غاز الميثان الأساسي (3.32 ميكرومتر)';
    }

    // Water vapor absorption troughs at 1.4 µm & 1.9 µm
    if (Math.abs(w - 1.4) < 0.08 || Math.abs(w - 1.9) < 0.08) {
      flux *= 0.2;
      noteEn = 'Atmospheric H2O vapor absorption';
      noteAr = 'امتصاص بخار الماء في الغلاف الجوي';
    }

    return {
      bandIndex: b.bandIndex,
      wavelengthMicrons: w,
      detectorArray: b.array,
      fluxDensityMjy: Math.max(0.1, Number(flux.toFixed(2))),
      uncertaintyMjy: Number((0.03 * flux + 0.05).toFixed(2)),
      featureNoteEn: noteEn,
      featureNoteAr: noteAr,
    };
  });
}

export const SPECTRAL_DATASETS: SpectralDataset[] = [
  {
    id: 'spec-orion-kl',
    targetId: 'target-orion-kl',
    targetName: 'Orion KL Protostellar Core',
    titleEn: 'SPHEREx Simulated Ice Column Spectrum (0.75 - 5.00 µm)',
    titleAr: 'طيف عمود الجليد المحاكى في سفيريكس (0.75 - 5.00 ميكرومتر)',
    category: 'Interstellar Ices',
    points: generateOrionSpectrum(),
    provenance: 'SPHEREx ATLAS Synthetic Radiative Transfer Model (Educational Demo Simulation)',
    dataStatus: 'SIMULATED DEMO DATA',
    resolutionPower: 'R ~ 41 (Arrays 1-3), R ~ 35-100 (Array 4), R ~ 130 (Arrays 5-6)',
    dateObserved: '2025-06-20',
    isSimulatedOrDemo: true,
    notesEn: 'Exhibits simulated water ice (3.05 µm), carbon dioxide ice (4.27 µm), and carbon monoxide ice (4.67 µm) optical depths demonstrating SPHEREx spectrophotometry.',
    notesAr: 'يوضح عمقاً بصرياً محاكياً لجليد الماء وثاني أكسيد الكربون وأول أكسيد الكربون كنموذج لقدرات سفيريكس.',
  },
  {
    id: 'spec-m82',
    targetId: 'target-m82',
    targetName: 'Messier 82 Starburst Core',
    titleEn: 'SPHEREx Simulated Starburst Continuum & PAH Emission (0.75 - 5.00 µm)',
    titleAr: 'طيف الاتصال وانبعاث PAH المحاكى في مجرة ميسييه 82',
    category: 'Starburst Galaxy',
    points: generateM82Spectrum(),
    provenance: 'SPHEREx ATLAS Starburst PAH Emission Model (Educational Demo Simulation)',
    dataStatus: 'SIMULATED DEMO DATA',
    resolutionPower: '102 Spectrophotometric Channels',
    dateObserved: '2025-07-14',
    isSimulatedOrDemo: true,
    notesEn: 'Prominent 3.3 µm aromatic C-H stretching band and Brackett-alpha 4.05 µm ionized gas tracer.',
    notesAr: 'يتميز بنطاق تمدد الكربون-هيدروجين العطري عند 3.3 ميكرومتر وخط غاز متأين براكيت-ألفا عند 4.05 ميكرومتر.',
  },
  {
    id: 'spec-yso-disk',
    targetId: 'target-iras-16293',
    targetName: 'IRAS 16293-2422 Protoplanetary Envelope',
    titleEn: 'Pre-Planetary Ice Reservoir Spectrum (0.75 - 5.00 µm)',
    titleAr: 'طيف مخزون الجليد قبل الكوكبي (0.75 - 5.00 ميكرومتر)',
    category: 'Planetary Systems Origins',
    points: generateProtoplanetaryDiskSpectrum(),
    provenance: 'SPHEREx ATLAS Deep Ice Survey Model (Educational Demo Simulation)',
    dataStatus: 'SIMULATED DEMO DATA',
    resolutionPower: '102 Channels (LVF 1-6)',
    dateObserved: '2025-08-02',
    isSimulatedOrDemo: true,
    notesEn: 'Tracing organic refractory compounds and biogenic ice precursors in young circumstellar matter.',
    notesAr: 'تتبع المركبات العضوية وسلائف الجليد الحيوي في المادة المحيطة بالنجوم الشابة.',
  },
  {
    id: 'spec-brown-dwarf',
    targetId: 'target-trappist-1',
    targetName: 'TRAPPIST-1 System & Ultracool Atmosphere',
    titleEn: 'Ultracool Dwarf Chromosphere & Molecular Atmosphere (0.75 - 5.00 µm)',
    titleAr: 'طيف الغلاف الجوي الجزيئي للقزم فائق البرودة تريبيست-1',
    category: 'Exoplanet & Host Star',
    points: generateBrownDwarfSpectrum(),
    provenance: 'SPHEREx ATLAS Ultracool Dwarf Atmospheric Model (Educational Demo Simulation)',
    dataStatus: 'SIMULATED DEMO DATA',
    resolutionPower: '102 Channels (R = 35 - 130)',
    dateObserved: '2025-09-01',
    isSimulatedOrDemo: true,
    notesEn: 'Dominated by deep atmospheric methane (3.32 µm) and water vapor absorption troughs.',
    notesAr: 'يهيمن عليه امتصاص غاز الميثان العميق (3.32 ميكرومتر) وأحواض امتصاص بخار الماء.',
  },
];
