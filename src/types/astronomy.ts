/**
 * SPHEREx ATLAS — Astronomical Domain Type Definitions
 */

export type Language = 'en' | 'ar';

export type AppModule =
  | 'mission'
  | 'sky'
  | 'fits'
  | 'targets'
  | 'spectra'
  | 'timeline'
  | 'comparison'
  | 'datasets'
  | 'assistant'
  | 'workspace'
  | 'reports';

export type ScientificDataStatus =
  | 'REAL ARCHIVE DATA'
  | 'EXTERNAL CATALOG DATA'
  | 'SIMULATED DEMO DATA'
  | 'UNAVAILABLE DATA';

export interface AstroCoordinates {
  ra: number; // Degrees [0, 360)
  dec: number; // Degrees [-90, +90]
  fov?: number; // Field of view in degrees (e.g. 0.05 to 3.5 deg)
  raHms?: string;
  decDms?: string;
  l?: number;
  b?: number;
}

export interface AstroTarget extends AstroCoordinates {
  id: string;
  name: string;
  canonicalName: string;
  category:
    | 'deep_field'
    | 'ice_target'
    | 'starburst_galaxy'
    | 'exoplanet_host'
    | 'active_galactic_nuclei'
    | 'stellar_laboratory'
    | 'moving_object'
    | 'variable_star';
  descriptionEn: string;
  descriptionAr: string;
  spectralType?: string;
  redshift?: number;
  properMotion?: {
    pmRaMasYr: number;
    pmDecMasYr: number;
    totalArcsecYr?: number;
  };
  apparentMagnitude?: {
    v?: number;
    j?: number;
    h?: number;
    ks?: number;
    w1?: number;
    w2?: number;
  };
  distanceLightYears?: number;
  spherexRelevanceEn: string;
  spherexRelevanceAr: string;
  keyMolecules: string[];
  imageUrl?: string;
  sourceCatalog: string;
  dataStatus?: ScientificDataStatus;
  saved?: boolean;
}

export interface SpectralPoint {
  wavelengthMicrons: number; // 0.75 - 5.0 µm
  fluxDensityMjy: number;
  uncertaintyMjy: number;
  bandIndex: number; // 1 to 102
  detectorArray: number; // 1 to 6
  featureNoteEn?: string;
  featureNoteAr?: string;
  isRealMeasurement?: boolean;
}

export interface SpectralDataset {
  id: string;
  targetId: string;
  targetName: string;
  titleEn: string;
  titleAr: string;
  category: string;
  points: SpectralPoint[];
  provenance: string;
  resolutionPower: string;
  dateObserved: string;
  isSimulatedOrDemo: boolean;
  dataStatus?: ScientificDataStatus;
  notesEn: string;
  notesAr: string;
}

export interface FitsHeaderCard {
  key: string;
  value: string | number | boolean;
  comment?: string;
}

export interface FitsWcsInfo {
  crpix1: number;
  crpix2: number;
  crval1: number;
  crval2: number;
  cdelt1: number;
  cdelt2: number;
  ctype1: string;
  ctype2: string;
  cd1_1?: number;
  cd1_2?: number;
  cd2_1?: number;
  cd2_2?: number;
  crota2?: number;
}

export interface FitsMefExtensionSummary {
  index: number;
  extname: string;
  xtension: string;
  bitpix: number;
  naxis: number;
  naxis1: number;
  naxis2: number;
  naxis3?: number;
  bunit?: string;
  isImage2D: boolean;
}

export interface FitsQualitySummary {
  hasFlagsHdu: boolean;
  hasVarianceHdu: boolean;
  hasZodiHdu: boolean;
  hasPsfHdu: boolean;
  hasWcsWaveHdu: boolean;
  flaggedPixelsCount?: number;
  flaggedFractionPct?: number;
  medianNoiseSigma?: number;
  medianSnr?: number;
  peakSnr?: number;
  centralWavelengthUm?: number;
  bandwidthUm?: number;
}

export interface FitsImageHDU {
  name: string;
  extname?: string;
  bitpix: number; // 8, 16, 32, -32, -64
  naxis: number;
  naxis1: number;
  naxis2: number;
  data: Float32Array;
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  histogram: number[]; // 256 bins
  headerCards: FitsHeaderCard[];
  rawBuffer?: ArrayBuffer;
  dataStatus?: ScientificDataStatus;
  provenance?: string;
  sourceUrl?: string;
  isSimulatedOrDemo?: boolean;
  wcs?: FitsWcsInfo;
  // Multi-Extension FITS (SPHEREx L2b MEF) layers when present
  extensions?: FitsMefExtensionSummary[];
  layerHdus?: Record<string, FitsImageHDU>;
  qualitySummary?: FitsQualitySummary;
}

export type StretchAlgorithm = 'linear' | 'log' | 'sqrt' | 'asinh' | 'power';
export type ColormapPalette =
  | 'grayscale'
  | 'inferno'
  | 'viridis'
  | 'magma'
  | 'heat'
  | 'cyan'
  | 'coolwarm';

export interface ProductVerificationStages {
  archiveRecordExists: boolean;
  imageProductAvailable: boolean;
  cutoutAvailable: boolean;
  releaseTag?: string; // e.g., DR1, QR3, QR2
}

export interface ObservationRecord {
  id: string;
  surveyPass:
    | 'Survey 1'
    | 'Survey 2'
    | 'Survey 3'
    | 'Survey 4'
    | 'Deep Calibration'
    | 'Multi-Epoch Archive'
    | 'Quick Release'
    | 'Data Release 1 (DR1)';
  targetRegion: string;
  ra: number;
  dec: number;
  dateStart: string | null;
  dateEnd: string | null;
  mjd?: number;
  exposureSec: number;
  instrument?: string;
  band?: string;
  wavelengthRangeUm?: [number, number];
  detectorsActive: number[];
  dataProductLevel:
    | 'Level 1A (Raw)'
    | 'Level 2 (Calibrated Images)'
    | 'Level 3 (Spectral Cubes)'
    | 'Calibrated Archive';
  irsaArchiveId: string;
  status: 'Completed' | 'Processing' | 'Planned' | 'Archived';
  dataStatus?: ScientificDataStatus;
  isSimulatedOrDemo?: boolean;
  coverageOverlapCount: number;
  sciencePillar:
    | 'Cosmic Inflation'
    | 'Galaxy Formation'
    | 'Interstellar Ices'
    | 'Time-Domain Astrophysics';
  accessUrl?: string;
  cutoutUrl?: string;
  accessFormat?: string;
  fitsUrl?: string;
  productStages?: ProductVerificationStages;
  hasMovingTargetCandidate?: boolean;
  motionNote?: string;
}

export interface CandidateDetection {
  id: string;
  x: number;
  y: number;
  ra?: number;
  dec?: number;
  deltaVal: number;
  fluxA?: number;
  fluxB?: number;
  snrSigma: number;
  displacementArcsec?: number;
  type: 'moving_candidate' | 'variable_source' | 'dipolar_residual';
  qualityNote: string;
  isCandidateOnly: true;
}

export interface GaiaCrossMatchSource {
  sourceId: string;
  ra: number;
  dec: number;
  propagatedRa: number;
  propagatedDec: number;
  separationArcsec: number;
  propagatedSeparationArcsec: number;
  pmRaMasYr: number | null;
  pmDecMasYr: number | null;
  totalPmMasYr: number | null;
  parallaxMas: number | null;
  distancePc: number | null;
  photGMag: number | null;
  bpRpColor: number | null;
  astrometricErrorMas: number | null;
  matchClassification: 'Catalog Match Candidate' | 'Nearby Field Source';
}

export interface NeossatObservation {
  obsId: string;
  targetName: string;
  ra: number | null;
  dec: number | null;
  dateStart: string | null;
  exposureSec: number | null;
  instrument: string;
  dataProductType: string;
  collection: 'NEOSSAT';
  cadcUrl: string;
}

export interface ResearchCollection {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn?: string;
  descriptionAr?: string;
  targetIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ResearchNote {
  id: string;
  targetId?: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SavedResearchState {
  collections: ResearchCollection[];
  savedTargets: string[];
  notes: ResearchNote[];
  bookmarkedObservations: string[];
  lastActiveTargetId?: string;
}
