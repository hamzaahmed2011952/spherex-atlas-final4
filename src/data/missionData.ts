import { ObservationRecord } from '../types/astronomy';

export interface MissionSpecification {
  telescopeAperture: string;
  fieldOfView: string;
  pixelScale: string;
  spectralRange: string;
  resolvingPower: string;
  detectorCount: string;
  detectorType: string;
  orbitType: string;
  altitude: string;
  inclination: string;
  missionDuration: string;
  totalSkySurveys: number;
}

export const SPHEREX_SPECS: MissionSpecification = {
  telescopeAperture: '20 cm (all-aluminum Ritchey-Chrétien)',
  fieldOfView: '3.5° × 11.3° wide-field instantaneous FOV',
  pixelScale: '6.2 arcseconds per pixel',
  spectralRange: '0.75 – 5.00 µm (continuous infrared)',
  resolvingPower: 'R = 35 to 130 across 102 spectrophotometric channels',
  detectorCount: '6 Hawaii-2RG (H2RG) 2048 × 2048 arrays',
  detectorType: 'Linear Variable Filter (LVF) focal plane assembly',
  orbitType: 'Low Earth Sun-Synchronous Terminator Orbit (6 AM / 6 PM)',
  altitude: '700 km circular polar orbit',
  inclination: '98.2°',
  missionDuration: '25 months baseline science operations',
  totalSkySurveys: 4,
};

export const DETECTOR_ARRAYS = [
  {
    array: 1,
    range: '0.75 – 1.11 µm',
    channels: 17,
    resolution: 'R ~ 41',
    scienceFocusEn: 'Rest-frame optical galaxies, stellar halos, zodiacal light baseline',
    scienceFocusAr: 'مجرات النطاق المرئي، الهالات النجمية، ضوء البروج المرجعي',
  },
  {
    array: 2,
    range: '1.11 – 1.64 µm',
    channels: 17,
    resolution: 'R ~ 41',
    scienceFocusEn: 'J-band continuum, high-redshift galaxy redshift measurements',
    scienceFocusAr: 'نطاق J المستمر، قياسات الانزياح الأحمر للمجرات البعيدة',
  },
  {
    array: 3,
    range: '1.64 – 2.42 µm',
    channels: 17,
    resolution: 'R ~ 41',
    scienceFocusEn: 'H & Ks bands, stellar mass estimation, cosmic non-Gaussianity',
    scienceFocusAr: 'نطاقات H و Ks، تقدير الكتلة النجمية، اللاتماثل الكوني',
  },
  {
    array: 4,
    range: '2.42 – 3.82 µm',
    channels: 17,
    resolution: 'R ~ 35 – 100',
    scienceFocusEn: 'Major biogenic H2O ice (3.05 µm) & CH4 (3.32 µm), PAH 3.3 µm',
    scienceFocusAr: 'جليد الماء الحيوي الرئيسي (3.05 ميكرومتر)، الميثان، وPAH',
  },
  {
    array: 5,
    range: '3.82 – 4.42 µm',
    channels: 17,
    resolution: 'R ~ 130',
    scienceFocusEn: 'CO2 ice (4.27 µm), Brackett-alpha (4.05 µm), circumstellar disks',
    scienceFocusAr: 'جليد ثاني أكسيد الكربون (4.27 ميكرومتر)، خط براكيت-ألفا',
  },
  {
    array: 6,
    range: '4.42 – 5.00 µm',
    channels: 17,
    resolution: 'R ~ 130',
    scienceFocusEn: 'CO ice (4.67 µm), XCN feature (4.62 µm), warm protostellar dust',
    scienceFocusAr: 'جليد أول أكسيد الكربون (4.67 ميكرومتر)، غبار النجوم الأولية',
  },
];

export const OBSERVATIONS_TIMELINE: ObservationRecord[] = [
  {
    id: 'OBS-SPX-00104',
    surveyPass: 'Survey 1',
    targetRegion: 'Galactic Plane / Orion Molecular Cloud',
    ra: 83.82,
    dec: -5.39,
    dateStart: '2025-06-01',
    dateEnd: '2025-06-03',
    exposureSec: 4200,
    detectorsActive: [1, 2, 3, 4, 5, 6],
    dataProductLevel: 'Level 2 (Calibrated Images)',
    irsaArchiveId: 'IRSA-SPX-20250601-00104',
    status: 'Completed',
    coverageOverlapCount: 18,
    sciencePillar: 'Interstellar Ices',
  },
  {
    id: 'OBS-SPX-00215',
    surveyPass: 'Deep Calibration',
    targetRegion: 'North Ecliptic Pole (NEP) Primary Overlap',
    ra: 270.0,
    dec: 66.56,
    dateStart: '2025-06-15',
    dateEnd: '2025-06-25',
    exposureSec: 86400,
    detectorsActive: [1, 2, 3, 4, 5, 6],
    dataProductLevel: 'Level 3 (Spectral Cubes)',
    irsaArchiveId: 'IRSA-SPX-20250615-00215',
    status: 'Completed',
    coverageOverlapCount: 1140,
    sciencePillar: 'Galaxy Formation',
  },
  {
    id: 'OBS-SPX-00389',
    surveyPass: 'Survey 1',
    targetRegion: 'COSMOS Deep Extragalactic Slice',
    ra: 150.12,
    dec: 2.21,
    dateStart: '2025-07-08',
    dateEnd: '2025-07-10',
    exposureSec: 7200,
    detectorsActive: [1, 2, 3, 4, 5, 6],
    dataProductLevel: 'Level 3 (Spectral Cubes)',
    irsaArchiveId: 'IRSA-SPX-20250708-00389',
    status: 'Completed',
    coverageOverlapCount: 42,
    sciencePillar: 'Cosmic Inflation',
  },
  {
    id: 'OBS-SPX-00442',
    surveyPass: 'Survey 1',
    targetRegion: 'Messier 82 Starburst Core & Halo',
    ra: 148.97,
    dec: 69.68,
    dateStart: '2025-08-02',
    dateEnd: '2025-08-04',
    exposureSec: 3600,
    detectorsActive: [1, 2, 3, 4, 5, 6],
    dataProductLevel: 'Level 2 (Calibrated Images)',
    irsaArchiveId: 'IRSA-SPX-20250802-00442',
    status: 'Completed',
    coverageOverlapCount: 65,
    sciencePillar: 'Galaxy Formation',
  },
  {
    id: 'OBS-SPX-00512',
    surveyPass: 'Survey 2',
    targetRegion: 'Taurus-Auriga Star Formation Region',
    ra: 68.9,
    dec: 24.5,
    dateStart: '2025-11-12',
    dateEnd: '2025-11-16',
    exposureSec: 5400,
    detectorsActive: [1, 2, 3, 4, 5, 6],
    dataProductLevel: 'Level 2 (Calibrated Images)',
    irsaArchiveId: 'IRSA-SPX-20251112-00512',
    status: 'Completed',
    coverageOverlapCount: 24,
    sciencePillar: 'Interstellar Ices',
  },
  {
    id: 'OBS-SPX-00670',
    surveyPass: 'Deep Calibration',
    targetRegion: 'South Ecliptic Pole (SEP) Deep Calibration',
    ra: 90.0,
    dec: -66.56,
    dateStart: '2025-12-20',
    dateEnd: '2025-12-30',
    exposureSec: 72000,
    detectorsActive: [1, 2, 3, 4, 5, 6],
    dataProductLevel: 'Level 3 (Spectral Cubes)',
    irsaArchiveId: 'IRSA-SPX-20251220-00670',
    status: 'Completed',
    coverageOverlapCount: 980,
    sciencePillar: 'Galaxy Formation',
  },
  {
    id: 'OBS-SPX-00810',
    surveyPass: 'Survey 3',
    targetRegion: 'Bootes & Lockman Hole Deep Voids',
    ra: 218.0,
    dec: 34.0,
    dateStart: '2026-04-10',
    dateEnd: '2026-04-14',
    exposureSec: 6800,
    detectorsActive: [1, 2, 3, 4, 5, 6],
    dataProductLevel: 'Level 1A (Raw)',
    irsaArchiveId: 'IRSA-SPX-20260410-00810',
    status: 'Processing',
    coverageOverlapCount: 36,
    sciencePillar: 'Cosmic Inflation',
  },
  {
    id: 'OBS-SPX-00995',
    surveyPass: 'Survey 4',
    targetRegion: 'All-Sky Completeness Pass IV',
    ra: 0.0,
    dec: 0.0,
    dateStart: '2026-10-01',
    dateEnd: '2027-03-31',
    exposureSec: 1200000,
    detectorsActive: [1, 2, 3, 4, 5, 6],
    dataProductLevel: 'Level 3 (Spectral Cubes)',
    irsaArchiveId: 'IRSA-SPX-20261001-00995',
    status: 'Planned',
    coverageOverlapCount: 100,
    sciencePillar: 'Cosmic Inflation',
  },
];

export interface ArchiveDatasetRecord {
  id: string;
  name: string;
  provider: string;
  productType: string;
  format: string;
  coverage: string;
  wavelengthRange: string;
  descriptionEn: string;
  descriptionAr: string;
  officialUrl: string;
  doiCitation: string;
  accessStatus: 'Publicly Available' | 'Pipeline Release Scheduled' | 'Cross-Calibrated';
}

export const ARCHIVE_DATASETS: ArchiveDatasetRecord[] = [
  {
    id: 'ds-spherex-spectral-cat',
    name: 'SPHEREx All-Sky Spectral Catalog (Level 3)',
    provider: 'NASA / IPAC Infrared Science Archive (IRSA)',
    productType: '102-Band Spectrophotometric Point Source Catalog',
    format: 'Parquet / IPAC Table / FITS',
    coverage: 'All-Sky (4*pi steradians)',
    wavelengthRange: '0.75 – 5.00 µm',
    descriptionEn: 'Over 450 million galaxies and 100 million Milky Way stars with calibrated 102-channel infrared spectra.',
    descriptionAr: 'أكثر من 450 مليون مجرة و100 مليون نجم في درب التبانة مع أطياف تحت حمراء معايرة عبر 102 قناة.',
    officialUrl: 'https://irsa.ipac.caltech.edu/Missions/spherex.html',
    doiCitation: '10.26131/IRSA560',
    accessStatus: 'Pipeline Release Scheduled',
  },
  {
    id: 'ds-spherex-polar-cubes',
    name: 'SPHEREx Deep Polar Field Spectral Cubes',
    provider: 'NASA / IPAC IRSA',
    productType: 'High-Redundancy 3D Spectral Image Cubes',
    format: 'FITS 3D Multi-Extension Cube',
    coverage: 'NEP & SEP Deep Fields (~200 sq deg total)',
    wavelengthRange: '0.75 – 5.00 µm',
    descriptionEn: 'Deepest co-added spectral cubes reaching >1000x exposure redundancy for cosmic background light fluctuations.',
    descriptionAr: 'مكعبات طيفية عميقة مجمعة تصل إلى تكرار تعريض أكثر من 1000 مرة لقياس تقلبات الضوء الكوني.',
    officialUrl: 'https://irsa.ipac.caltech.edu/Missions/spherex.html',
    doiCitation: '10.26131/IRSA561',
    accessStatus: 'Pipeline Release Scheduled',
  },
  {
    id: 'ds-irsa-2mass',
    name: '2MASS All-Sky Point Source Catalog (PSC)',
    provider: 'NASA / IPAC IRSA',
    productType: 'J, H, Ks Photometric Baseline Catalog',
    format: 'FITS / IPAC Table / VO-Table',
    coverage: 'All-Sky',
    wavelengthRange: '1.25 µm (J), 1.65 µm (H), 2.17 µm (Ks)',
    descriptionEn: 'Essential primary astrometric and near-infrared photometric cross-calibration reference for SPHEREx Arrays 1–3.',
    descriptionAr: 'المرجع الفلكي الأساسي للمعايرة الضوئية القريبة من الأشعة تحت الحمراء لمصفوفات سفيريكس 1 إلى 3.',
    officialUrl: 'https://irsa.ipac.caltech.edu/Missions/2mass.html',
    doiCitation: '10.26131/IRSA1',
    accessStatus: 'Publicly Available',
  },
  {
    id: 'ds-catwise-2020',
    name: 'CatWISE2020 Mid-Infrared Catalog',
    provider: 'NASA / IPAC IRSA',
    productType: 'W1 (3.4 µm) & W2 (4.6 µm) Source Catalog',
    format: 'Parquet / FITS / IPAC',
    coverage: 'All-Sky',
    wavelengthRange: '3.4 µm & 4.6 µm',
    descriptionEn: 'Mid-infrared source catalog from combined WISE and NEOWISE survey data, matching SPHEREx Arrays 4 & 6 ice channels.',
    descriptionAr: 'فهرس مصادر الأشعة تحت الحمراء المتوسطة من مسح وايز، متوافق مع قنوات الجليد في مصفوفات سفيريكس 4 و6.',
    officialUrl: 'https://irsa.ipac.caltech.edu/Missions/wise.html',
    doiCitation: '10.26131/IRSA150',
    accessStatus: 'Publicly Available',
  },
  {
    id: 'ds-spitzer-sha',
    name: 'Spitzer Heritage Archive (SHA) Cryogenic Spectra',
    provider: 'NASA / IPAC IRSA',
    productType: 'IRS Spectrograph & IRAC Photometry',
    format: 'FITS Spectra & Calibrated Mosaics',
    coverage: 'Targeted High-Latitude & Galactic Clouds',
    wavelengthRange: '3.6 – 160 µm',
    descriptionEn: 'High-signal-to-noise benchmark spectra for validating SPHEREx interstellar ice column densities and PAH features.',
    descriptionAr: 'أطياف مرجعية عالية الدقة للتحقق من كثافة أعمدة الجليد بين النجمي في سفيريكس وانبعاثات PAH.',
    officialUrl: 'https://sha.ipac.caltech.edu/',
    doiCitation: '10.26131/IRSA2',
    accessStatus: 'Publicly Available',
  },
];
