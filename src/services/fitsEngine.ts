/**
 * SPHEREx ATLAS — Astronomical FITS Parser, MEF Layer Inspector, WCS Alignment & Difference Engine
 * Flexible Image Transport System (FITS) standards compliant.
 */

import {
  FitsHeaderCard,
  FitsImageHDU,
  FitsWcsInfo,
  FitsMefExtensionSummary,
  FitsQualitySummary,
  CandidateDetection,
  StretchAlgorithm,
  ColormapPalette,
  ScientificDataStatus,
} from '../types/astronomy';

const FITS_BLOCK_SIZE = 2880;
const FITS_CARD_SIZE = 80;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export interface ParseFitsOptions {
  dataStatus?: ScientificDataStatus;
  provenance?: string;
  sourceUrl?: string;
  isSimulatedOrDemo?: boolean;
}

interface ParsedHduHeader {
  cards: FitsHeaderCard[];
  headerEndOffset: number;
  simpleFound: boolean;
  xtension: string;
  extname: string;
  bitpix: number;
  naxis: number;
  naxisDims: number[];
  pcount: number;
  gcount: number;
  bscale: number;
  bzero: number;
  dataByteLengthPadded: number;
}

function getCardValue(cards: FitsHeaderCard[], key: string, defaultVal: any = undefined): any {
  const card = cards.find((c) => c.key === key);
  return card !== undefined ? card.value : defaultVal;
}

function parseHeaderBlock(
  buffer: ArrayBuffer,
  startOffset: number,
  decoder: TextDecoder
): ParsedHduHeader | null {
  const totalLength = buffer.byteLength;
  if (startOffset + FITS_BLOCK_SIZE > totalLength) return null;

  let offset = startOffset;
  const cards: FitsHeaderCard[] = [];
  let headerEnded = false;
  let simpleFound = false;

  while (offset + FITS_BLOCK_SIZE <= totalLength && !headerEnded) {
    const blockBytes = new Uint8Array(buffer, offset, FITS_BLOCK_SIZE);
    const blockText = decoder.decode(blockBytes);

    for (let c = 0; c < FITS_BLOCK_SIZE; c += FITS_CARD_SIZE) {
      const cardStr = blockText.slice(c, c + FITS_CARD_SIZE);
      const key = cardStr.slice(0, 8).trim();

      if (key === 'END') {
        cards.push({ key: 'END', value: '' });
        headerEnded = true;
        offset += FITS_BLOCK_SIZE;
        break;
      }

      if (key === 'SIMPLE') simpleFound = true;

      const eqIdx = cardStr.indexOf('=');
      if (eqIdx !== -1 && eqIdx < 10) {
        const rest = cardStr.slice(eqIdx + 1);
        // Respect string literals when searching for comment '/'
        let slashIdx = -1;
        let inQuotes = false;
        for (let i = 0; i < rest.length; i++) {
          if (rest[i] === "'") inQuotes = !inQuotes;
          else if (rest[i] === '/' && !inQuotes) {
            slashIdx = i;
            break;
          }
        }
        const valStr = (slashIdx !== -1 ? rest.slice(0, slashIdx) : rest).trim();
        const comment = slashIdx !== -1 ? rest.slice(slashIdx + 1).trim() : undefined;

        let parsedVal: string | number | boolean = valStr;
        if (valStr.startsWith("'") && valStr.endsWith("'") && valStr.length >= 2) {
          parsedVal = valStr.slice(1, -1).trim();
        } else if (valStr === 'T') {
          parsedVal = true;
        } else if (valStr === 'F') {
          parsedVal = false;
        } else if (!isNaN(Number(valStr)) && valStr !== '') {
          parsedVal = Number(valStr);
        }

        cards.push({ key, value: parsedVal, comment });
      } else if (key) {
        cards.push({
          key,
          value: cardStr.slice(8).trim(),
        });
      }
    }

    if (!headerEnded) {
      offset += FITS_BLOCK_SIZE;
    }
  }

  if (!headerEnded && cards.length === 0) return null;

  const bitpix = Number(getCardValue(cards, 'BITPIX', 8));
  const naxis = Number(getCardValue(cards, 'NAXIS', 0));
  const naxisDims: number[] = [];
  for (let d = 1; d <= naxis; d++) {
    naxisDims.push(Number(getCardValue(cards, `NAXIS${d}`, 0)));
  }

  const pcount = Math.max(0, Number(getCardValue(cards, 'PCOUNT', 0)));
  const gcount = Math.max(1, Number(getCardValue(cards, 'GCOUNT', 1)));
  const bscale = Number(getCardValue(cards, 'BSCALE', 1));
  const bzero = Number(getCardValue(cards, 'BZERO', 0));
  const xtension = String(getCardValue(cards, 'XTENSION', simpleFound ? 'PRIMARY' : 'UNKNOWN')).trim();
  const extname = String(getCardValue(cards, 'EXTNAME', simpleFound ? 'PRIMARY' : xtension)).trim();

  let arrayElems = 0;
  if (naxis > 0) {
    arrayElems = naxisDims.reduce((acc, dim) => acc * dim, 1);
  }
  const totalBytes = Math.max(0, (arrayElems + pcount) * gcount * (Math.abs(bitpix) / 8));
  const dataByteLengthPadded =
    totalBytes === 0 ? 0 : Math.ceil(totalBytes / FITS_BLOCK_SIZE) * FITS_BLOCK_SIZE;

  return {
    cards,
    headerEndOffset: offset,
    simpleFound,
    xtension,
    extname,
    bitpix,
    naxis,
    naxisDims,
    pcount,
    gcount,
    bscale: Number.isFinite(bscale) ? bscale : 1,
    bzero: Number.isFinite(bzero) ? bzero : 0,
    dataByteLengthPadded,
  };
}

function extractWcsFromCards(cards: FitsHeaderCard[], width: number, height: number): FitsWcsInfo | undefined {
  const rawCrval1 = getCardValue(cards, 'CRVAL1');
  const rawCrval2 = getCardValue(cards, 'CRVAL2');
  const hasWcs =
    rawCrval1 !== undefined &&
    rawCrval2 !== undefined &&
    !isNaN(Number(rawCrval1)) &&
    !isNaN(Number(rawCrval2));

  if (!hasWcs) return undefined;

  const cd1_1Raw = getCardValue(cards, 'CD1_1');
  const cd1_2Raw = getCardValue(cards, 'CD1_2');
  const cd2_1Raw = getCardValue(cards, 'CD2_1');
  const cd2_2Raw = getCardValue(cards, 'CD2_2');
  const crota2Raw = getCardValue(cards, 'CROTA2');

  const hasCdMatrix = cd1_1Raw !== undefined && cd2_2Raw !== undefined;
  const cd1_1 = hasCdMatrix ? Number(cd1_1Raw) : undefined;
  const cd1_2 = cd1_2Raw !== undefined ? Number(cd1_2Raw) : hasCdMatrix ? 0 : undefined;
  const cd2_1 = cd2_1Raw !== undefined ? Number(cd2_1Raw) : hasCdMatrix ? 0 : undefined;
  const cd2_2 = hasCdMatrix ? Number(cd2_2Raw) : undefined;

  let cdelt1 = Number(getCardValue(cards, 'CDELT1', NaN));
  let cdelt2 = Number(getCardValue(cards, 'CDELT2', NaN));

  if (!Number.isFinite(cdelt1) && cd1_1 !== undefined && cd2_1 !== undefined) {
    const mag = Math.sqrt(cd1_1 * cd1_1 + cd2_1 * cd2_1);
    cdelt1 = cd1_1 < 0 ? -mag : mag;
  }
  if (!Number.isFinite(cdelt2) && cd1_2 !== undefined && cd2_2 !== undefined) {
    const mag = Math.sqrt(cd1_2 * cd1_2 + cd2_2 * cd2_2);
    cdelt2 = cd2_2 < 0 ? -mag : mag;
  }

  return {
    crpix1: Number(getCardValue(cards, 'CRPIX1', width / 2)),
    crpix2: Number(getCardValue(cards, 'CRPIX2', height / 2)),
    crval1: Number(rawCrval1),
    crval2: Number(rawCrval2),
    cdelt1: Number.isFinite(cdelt1) ? cdelt1 : -0.001722,
    cdelt2: Number.isFinite(cdelt2) ? cdelt2 : 0.001722,
    ctype1: String(getCardValue(cards, 'CTYPE1', 'RA---TAN')),
    ctype2: String(getCardValue(cards, 'CTYPE2', 'DEC--TAN')),
    cd1_1,
    cd1_2,
    cd2_1,
    cd2_2,
    crota2: crota2Raw !== undefined && Number.isFinite(Number(crota2Raw)) ? Number(crota2Raw) : undefined,
  };
}

function decode2DImageHdu(
  buffer: ArrayBuffer,
  dataView: DataView,
  header: ParsedHduHeader,
  primaryInheritedCards: FitsHeaderCard[],
  options?: ParseFitsOptions,
  includeRawBuffer = false
): FitsImageHDU {
  const naxis1 = header.naxisDims[0] || 0;
  const naxis2 = header.naxisDims[1] || 0;
  const numPixels = naxis1 * naxis2;
  const floatData = new Float32Array(numPixels);

  let dataOffset = header.headerEndOffset;
  const totalLength = buffer.byteLength;
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let finiteCount = 0;

  for (let i = 0; i < numPixels; i++) {
    let rawVal = 0;
    const byteSize = Math.abs(header.bitpix) / 8;
    if (dataOffset + byteSize > totalLength) break;

    switch (header.bitpix) {
      case 8:
        rawVal = dataView.getUint8(dataOffset);
        dataOffset += 1;
        break;
      case 16:
        rawVal = dataView.getInt16(dataOffset, false);
        dataOffset += 2;
        break;
      case 32:
        rawVal = dataView.getInt32(dataOffset, false);
        dataOffset += 4;
        break;
      case -32:
        rawVal = dataView.getFloat32(dataOffset, false);
        dataOffset += 4;
        break;
      case -64:
        rawVal = dataView.getFloat64(dataOffset, false);
        dataOffset += 8;
        break;
      default:
        rawVal = dataView.getFloat32(dataOffset, false);
        dataOffset += 4;
    }

    const physicalVal = Number.isNaN(rawVal) ? 0 : header.bzero + header.bscale * rawVal;
    floatData[i] = physicalVal;

    if (Number.isFinite(physicalVal)) {
      if (physicalVal < min) min = physicalVal;
      if (physicalVal > max) max = physicalVal;
      sum += physicalVal;
      finiteCount++;
    }
  }

  if (min === Infinity) min = 0;
  if (max === -Infinity) max = 1;

  const mean = finiteCount > 0 ? sum / finiteCount : 0;
  let varianceSum = 0;
  const step = Math.max(1, Math.floor(numPixels / 10000));
  const sampleArr: number[] = [];

  for (let i = 0; i < numPixels; i++) {
    const val = floatData[i];
    if (!Number.isFinite(val)) continue;
    const diff = val - mean;
    varianceSum += diff * diff;
    if (i % step === 0) sampleArr.push(val);
  }

  const stdDev = finiteCount > 0 ? Math.sqrt(varianceSum / finiteCount) : 0;
  sampleArr.sort((a, b) => a - b);
  const median = sampleArr.length > 0 ? sampleArr[Math.floor(sampleArr.length / 2)] : mean;

  const histogram = new Array(256).fill(0);
  const range = max - min || 1;
  for (let i = 0; i < numPixels; i += 2) {
    const bin = Math.min(255, Math.max(0, Math.floor(((floatData[i] - min) / range) * 255)));
    histogram[bin]++;
  }

  // Merge missing provenance/instrument metadata from Primary HDU without duplicating keys
  const existingKeys = new Set(header.cards.map((c) => c.key));
  const mergedCards = [...header.cards];
  for (const pc of primaryInheritedCards) {
    if (!existingKeys.has(pc.key) && pc.key !== 'END' && pc.key !== 'SIMPLE' && pc.key !== 'NAXIS') {
      mergedCards.push(pc);
    }
  }

  const wcs = extractWcsFromCards(mergedCards, naxis1, naxis2);
  const extUpper = header.extname.toUpperCase();
  const objName = String(getCardValue(mergedCards, 'OBJECT', extUpper !== 'PRIMARY' ? `SPHEREx ${extUpper}` : 'FITS Image'));

  return {
    name: extUpper && extUpper !== 'PRIMARY' && extUpper !== 'IMAGE' ? `${objName} [${extUpper}]` : objName,
    extname: extUpper || 'PRIMARY',
    bitpix: header.bitpix,
    naxis: header.naxis,
    naxis1,
    naxis2,
    data: floatData,
    min,
    max,
    mean,
    median,
    stdDev,
    histogram,
    headerCards: mergedCards,
    rawBuffer: includeRawBuffer ? buffer : undefined,
    dataStatus: options?.dataStatus || 'EXTERNAL CATALOG DATA',
    provenance: options?.provenance,
    sourceUrl: options?.sourceUrl,
    isSimulatedOrDemo: options?.isSimulatedOrDemo,
    wcs,
  };
}

function computeQualitySummary(
  scienceHdu: FitsImageHDU,
  extensions: FitsMefExtensionSummary[],
  layerHdus: Record<string, FitsImageHDU>
): FitsQualitySummary {
  const extSet = new Set(extensions.map((e) => e.extname.toUpperCase()));
  const flagsHdu = layerHdus['FLAGS'];
  const varianceHdu = layerHdus['VARIANCE'];
  const hasZodiHdu = extSet.has('ZODI') || Boolean(layerHdus['ZODI']);
  const hasPsfHdu = extSet.has('EPSF') || extSet.has('PSF');
  const hasWcsWaveHdu = extSet.has('WCS-WAVE');

  let flaggedPixelsCount: number | undefined;
  let flaggedFractionPct: number | undefined;
  if (flagsHdu && flagsHdu.data.length === scienceHdu.data.length) {
    let flagged = 0;
    for (let i = 0; i < flagsHdu.data.length; i++) {
      if (flagsHdu.data[i] !== 0) flagged++;
    }
    flaggedPixelsCount = flagged;
    flaggedFractionPct = Number(((flagged / Math.max(1, flagsHdu.data.length)) * 100).toFixed(2));
  }

  let medianNoiseSigma: number | undefined;
  let medianSnr: number | undefined;
  let peakSnr: number | undefined;

  if (varianceHdu && varianceHdu.data.length === scienceHdu.data.length) {
    const noiseSamples: number[] = [];
    const snrSamples: number[] = [];
    let maxSnr = 0;

    for (let i = 0; i < scienceHdu.data.length; i++) {
      const v = varianceHdu.data[i];
      if (!Number.isFinite(v) || v <= 0) continue;
      if (flagsHdu && flagsHdu.data[i] !== 0) continue;
      const sigma = Math.sqrt(v);
      const snr = Math.abs(scienceHdu.data[i]) / sigma;
      if (Number.isFinite(sigma)) noiseSamples.push(sigma);
      if (Number.isFinite(snr)) {
        snrSamples.push(snr);
        if (snr > maxSnr) maxSnr = snr;
      }
    }

    if (noiseSamples.length > 0) {
      noiseSamples.sort((a, b) => a - b);
      medianNoiseSigma = Number(noiseSamples[Math.floor(noiseSamples.length / 2)].toFixed(4));
    }
    if (snrSamples.length > 0) {
      snrSamples.sort((a, b) => a - b);
      medianSnr = Number(snrSamples[Math.floor(snrSamples.length / 2)].toFixed(2));
      peakSnr = Number(maxSnr.toFixed(2));
    }
  }

  const waveCenterRaw =
    getCardValue(scienceHdu.headerCards, 'WAVELEN') ??
    getCardValue(scienceHdu.headerCards, 'CRVAL1W');
  const waveWidthRaw = getCardValue(scienceHdu.headerCards, 'BANDWID');

  return {
    hasFlagsHdu: Boolean(flagsHdu) || extSet.has('FLAGS'),
    hasVarianceHdu: Boolean(varianceHdu) || extSet.has('VARIANCE'),
    hasZodiHdu,
    hasPsfHdu,
    hasWcsWaveHdu,
    flaggedPixelsCount,
    flaggedFractionPct,
    medianNoiseSigma,
    medianSnr,
    peakSnr,
    centralWavelengthUm:
      waveCenterRaw !== undefined && Number.isFinite(Number(waveCenterRaw))
        ? Number(waveCenterRaw)
        : undefined,
    bandwidthUm:
      waveWidthRaw !== undefined && Number.isFinite(Number(waveWidthRaw))
        ? Number(waveWidthRaw)
        : undefined,
  };
}

/**
 * Parses raw ArrayBuffer into a structured FitsImageHDU with full Multi-Extension FITS (MEF) inspection.
 * Supports single-HDU FITS as well as SPHEREx 7-HDU MEF L2b cutouts (PRIMARY, IMAGE, FLAGS, VARIANCE, ZODI, EPSF, WCS-WAVE).
 */
export function parseFitsBuffer(buffer: ArrayBuffer, options?: ParseFitsOptions): FitsImageHDU {
  const dataView = new DataView(buffer);
  const totalLength = buffer.byteLength;

  if (totalLength < FITS_BLOCK_SIZE) {
    throw new Error('File size is smaller than a single 2880-byte FITS block.');
  }

  const decoder = new TextDecoder('ascii');
  const primaryHeader = parseHeaderBlock(buffer, 0, decoder);
  if (!primaryHeader || !primaryHeader.simpleFound) {
    throw new Error('Not a valid FITS file: missing SIMPLE keyword in primary header.');
  }

  const allHeaders: ParsedHduHeader[] = [primaryHeader];
  let cursor = primaryHeader.headerEndOffset + primaryHeader.dataByteLengthPadded;

  // Walk remaining MEF extensions (bounded to max 32 HDUs for safety)
  while (cursor + FITS_BLOCK_SIZE <= totalLength && allHeaders.length < 32) {
    const extHeader = parseHeaderBlock(buffer, cursor, decoder);
    if (!extHeader) break;
    allHeaders.push(extHeader);
    cursor = extHeader.headerEndOffset + extHeader.dataByteLengthPadded;
  }

  const extensions: FitsMefExtensionSummary[] = allHeaders.map((h, idx) => ({
    index: idx,
    extname: h.extname,
    xtension: h.xtension,
    bitpix: h.bitpix,
    naxis: h.naxis,
    naxis1: h.naxisDims[0] || 0,
    naxis2: h.naxisDims[1] || 0,
    naxis3: h.naxisDims[2],
    bunit: getCardValue(h.cards, 'BUNIT') ? String(getCardValue(h.cards, 'BUNIT')) : undefined,
    isImage2D: h.naxis === 2 && (h.naxisDims[0] || 0) > 0 && (h.naxisDims[1] || 0) > 0 && !h.xtension.includes('TABLE'),
  }));

  const layerHdus: Record<string, FitsImageHDU> = {};
  let first2dHdu: FitsImageHDU | null = null;

  for (let idx = 0; idx < allHeaders.length; idx++) {
    const h = allHeaders[idx];
    const is2dImg = h.naxis >= 2 && (h.naxisDims[0] || 0) > 0 && (h.naxisDims[1] || 0) > 0 && !h.xtension.includes('TABLE');
    if (!is2dImg) continue;

    // For HDU with NAXIS===2 decode full plane; for 3D image only primary science layers needed unless 2D
    if (h.naxis === 2) {
      const hdu = decode2DImageHdu(buffer, dataView, h, primaryHeader.cards, options, false);
      const key = (h.extname || (idx === 0 ? 'PRIMARY' : `EXT_${idx}`)).toUpperCase();
      layerHdus[key] = hdu;
      if (!first2dHdu) first2dHdu = hdu;
    }
  }

  const primaryScienceHdu = layerHdus['IMAGE'] || first2dHdu;

  if (!primaryScienceHdu) {
    throw new Error(
      `FITS dataset does not contain a valid 2D image array (HDUs parsed=${allHeaders.length}, NAXIS=${primaryHeader.naxis}, NAXIS1=${primaryHeader.naxisDims[0] || 0}, NAXIS2=${primaryHeader.naxisDims[1] || 0}).`
    );
  }

  const qualitySummary = computeQualitySummary(primaryScienceHdu, extensions, layerHdus);

  // Attach MEF metadata cleanly to the main science HDU (and cross-link sibling layers)
  primaryScienceHdu.rawBuffer = buffer;
  primaryScienceHdu.extensions = extensions;
  primaryScienceHdu.layerHdus = layerHdus;
  primaryScienceHdu.qualitySummary = qualitySummary;

  return primaryScienceHdu;
}

/**
 * Compute linear CD matrix elements from FitsWcsInfo (handling CD1_1..CD2_2 or CDELT1/2 + CROTA2)
 */
export function getWcsCdMatrix(wcs: FitsWcsInfo): { cd11: number; cd12: number; cd21: number; cd22: number } {
  if (wcs.cd1_1 !== undefined && wcs.cd2_2 !== undefined) {
    return {
      cd11: wcs.cd1_1,
      cd12: wcs.cd1_2 ?? 0,
      cd21: wcs.cd2_1 ?? 0,
      cd22: wcs.cd2_2,
    };
  }
  const rho = (wcs.crota2 ?? 0) * DEG_TO_RAD;
  const cosR = Math.cos(rho);
  const sinR = Math.sin(rho);
  return {
    cd11: wcs.cdelt1 * cosR,
    cd12: -wcs.cdelt2 * sinR,
    cd21: wcs.cdelt1 * sinR,
    cd22: wcs.cdelt2 * cosR,
  };
}

/**
 * Gnomonic (-TAN) Forward Projection: 0-based Pixel (x, y) -> ICRS World (ra, dec in degrees)
 */
export function pixelToWorldWcs(wcs: FitsWcsInfo, x0: number, y0: number): { ra: number; dec: number } {
  // FITS pixel centers are 1-indexed
  const dx = x0 + 1 - wcs.crpix1;
  const dy = y0 + 1 - wcs.crpix2;
  const { cd11, cd12, cd21, cd22 } = getWcsCdMatrix(wcs);

  // Intermediate world coordinates (degrees -> radians)
  const xi = (cd11 * dx + cd12 * dy) * DEG_TO_RAD;
  const eta = (cd21 * dx + cd22 * dy) * DEG_TO_RAD;

  const ra0 = wcs.crval1 * DEG_TO_RAD;
  const dec0 = wcs.crval2 * DEG_TO_RAD;
  const sinDec0 = Math.sin(dec0);
  const cosDec0 = Math.cos(dec0);

  const rho = Math.sqrt(xi * xi + eta * eta);
  if (rho < 1e-12) {
    return {
      ra: ((wcs.crval1 % 360) + 360) % 360,
      dec: wcs.crval2,
    };
  }

  // Exact Gnomonic (-TAN) inverse-plane projection onto unit sphere
  const denom = cosDec0 - eta * sinDec0;
  const raRad = ra0 + Math.atan2(xi, denom);
  const decRad = Math.atan2(sinDec0 + eta * cosDec0, Math.sqrt(xi * xi + denom * denom));

  return {
    ra: (((raRad * RAD_TO_DEG) % 360) + 360) % 360,
    dec: Math.max(-90, Math.min(90, decRad * RAD_TO_DEG)),
  };
}

/**
 * Gnomonic (-TAN) Inverse Projection: ICRS World (ra, dec in degrees) -> 0-based Pixel (x, y)
 */
export function worldToPixelWcs(wcs: FitsWcsInfo, raDeg: number, decDeg: number): { x: number; y: number } | null {
  const ra = raDeg * DEG_TO_RAD;
  const dec = decDeg * DEG_TO_RAD;
  const ra0 = wcs.crval1 * DEG_TO_RAD;
  const dec0 = wcs.crval2 * DEG_TO_RAD;

  const sinDec = Math.sin(dec);
  const cosDec = Math.cos(dec);
  const sinDec0 = Math.sin(dec0);
  const cosDec0 = Math.cos(dec0);
  const dRa = ra - ra0;
  const cosDRa = Math.cos(dRa);
  const sinDRa = Math.sin(dRa);

  const cosC = sinDec0 * sinDec + cosDec0 * cosDec * cosDRa;
  if (cosC <= 0) return null; // Behind tangent hemisphere

  const xiDeg = ((cosDec * sinDRa) / cosC) * RAD_TO_DEG;
  const etaDeg = ((cosDec0 * sinDec - sinDec0 * cosDec * cosDRa) / cosC) * RAD_TO_DEG;

  const { cd11, cd12, cd21, cd22 } = getWcsCdMatrix(wcs);
  const det = cd11 * cd22 - cd12 * cd21;
  if (Math.abs(det) < 1e-24) return null;

  const dx = (cd22 * xiDeg - cd12 * etaDeg) / det;
  const dy = (-cd21 * xiDeg + cd11 * etaDeg) / det;

  return {
    x: dx + wcs.crpix1 - 1,
    y: dy + wcs.crpix2 - 1,
  };
}

function wcsMatricesEqual(a: FitsWcsInfo, b: FitsWcsInfo): boolean {
  const mA = getWcsCdMatrix(a);
  const mB = getWcsCdMatrix(b);
  const eps = 1e-7;
  return (
    Math.abs(a.crval1 - b.crval1) < 1e-6 &&
    Math.abs(a.crval2 - b.crval2) < 1e-6 &&
    Math.abs(a.crpix1 - b.crpix1) < 1e-4 &&
    Math.abs(a.crpix2 - b.crpix2) < 1e-4 &&
    Math.abs(mA.cd11 - mB.cd11) < eps &&
    Math.abs(mA.cd12 - mB.cd12) < eps &&
    Math.abs(mA.cd21 - mB.cd21) < eps &&
    Math.abs(mA.cd22 - mB.cd22) < eps
  );
}

/**
 * Resamples `sourceHdu` onto `refHdu`'s exact WCS sky grid using bilinear interpolation.
 */
export function alignHduToReferenceWcs(sourceHdu: FitsImageHDU, refHdu: FitsImageHDU): FitsImageHDU {
  if (!sourceHdu.wcs || !refHdu.wcs) {
    throw new Error('Incompatible images: both images require valid WCS headers for spatial resampling.');
  }

  const outW = refHdu.naxis1;
  const outH = refHdu.naxis2;
  const srcW = sourceHdu.naxis1;
  const srcH = sourceHdu.naxis2;
  const outData = new Float32Array(outW * outH);
  const srcData = sourceHdu.data;

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let finiteCount = 0;

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const world = pixelToWorldWcs(refHdu.wcs, x, y);
      const srcPix = worldToPixelWcs(sourceHdu.wcs, world.ra, world.dec);
      const outIdx = y * outW + x;

      if (!srcPix || srcPix.x < 0 || srcPix.x > srcW - 1 || srcPix.y < 0 || srcPix.y > srcH - 1) {
        outData[outIdx] = NaN;
        continue;
      }

      const x0 = Math.floor(srcPix.x);
      const y0 = Math.floor(srcPix.y);
      const x1 = Math.min(srcW - 1, x0 + 1);
      const y1 = Math.min(srcH - 1, y0 + 1);
      const fx = srcPix.x - x0;
      const fy = srcPix.y - y0;

      const v00 = srcData[y0 * srcW + x0];
      const v10 = srcData[y0 * srcW + x1];
      const v01 = srcData[y1 * srcW + x0];
      const v11 = srcData[y1 * srcW + x1];

      if (!Number.isFinite(v00) || !Number.isFinite(v10) || !Number.isFinite(v01) || !Number.isFinite(v11)) {
        outData[outIdx] = NaN;
        continue;
      }

      const interp =
        v00 * (1 - fx) * (1 - fy) +
        v10 * fx * (1 - fy) +
        v01 * (1 - fx) * fy +
        v11 * fx * fy;

      outData[outIdx] = interp;
      if (interp < min) min = interp;
      if (interp > max) max = interp;
      sum += interp;
      finiteCount++;
    }
  }

  if (min === Infinity) min = 0;
  if (max === -Infinity) max = 1;
  const mean = finiteCount > 0 ? sum / finiteCount : 0;

  const histogram = new Array(256).fill(0);
  const range = max - min || 1;
  for (let i = 0; i < outData.length; i += 2) {
    if (!Number.isFinite(outData[i])) continue;
    const bin = Math.min(255, Math.max(0, Math.floor(((outData[i] - min) / range) * 255)));
    histogram[bin]++;
  }

  return {
    ...sourceHdu,
    naxis1: outW,
    naxis2: outH,
    data: outData,
    min,
    max,
    mean,
    histogram,
    wcs: { ...refHdu.wcs },
    provenance: `${sourceHdu.provenance || sourceHdu.name} (WCS-Aligned to Reference Grid)`,
  };
}

/**
 * Astronomical Stretch Calculations
 */
export function applyStretch(
  val: number,
  minCut: number,
  maxCut: number,
  stretch: StretchAlgorithm,
  contrast: number = 1.0,
  brightness: number = 0.0
): number {
  if (!Number.isFinite(val)) return 0;
  if (val <= minCut) return 0;
  if (val >= maxCut) return 1;

  let norm = (val - minCut) / (maxCut - minCut);
  norm = Math.min(1, Math.max(0, (norm - 0.5) * contrast + 0.5 + brightness));

  switch (stretch) {
    case 'linear':
      return norm;
    case 'log': {
      const a = 1000;
      return Math.log10(1 + a * norm) / Math.log10(1 + a);
    }
    case 'sqrt':
      return Math.sqrt(norm);
    case 'asinh': {
      const Q = 8.0;
      return Math.asinh(norm * Q) / Math.asinh(Q);
    }
    case 'power':
      return Math.pow(norm, 1.8);
    default:
      return norm;
  }
}

/**
 * Color Lookup Tables (LUTs) for Astronomical Imaging
 */
export function getColorFromPalette(t: number, palette: ColormapPalette): [number, number, number] {
  const clamped = Math.min(1, Math.max(0, t));

  switch (palette) {
    case 'grayscale': {
      const v = Math.round(clamped * 255);
      return [v, v, v];
    }
    case 'inferno': {
      const r = Math.round(255 * Math.min(1, Math.max(0, 1.8 * clamped - 0.2)));
      const g = Math.round(255 * Math.min(1, Math.max(0, 2.2 * Math.pow(clamped, 2) - 0.2 * clamped)));
      const b = Math.round(255 * Math.min(1, Math.max(0, 1.2 * Math.sin(clamped * Math.PI) * (1 - clamped * 0.5))));
      return [r, g, b];
    }
    case 'viridis': {
      const r = Math.round(255 * Math.max(0, Math.min(1, 0.2 + 0.8 * Math.pow(clamped, 2.5))));
      const g = Math.round(255 * Math.max(0, Math.min(1, 0.1 + 0.9 * Math.sqrt(clamped))));
      const b = Math.round(255 * Math.max(0, Math.min(1, 0.5 * (1 - clamped) + 0.5 * Math.sin(clamped * Math.PI))));
      return [r, g, b];
    }
    case 'magma': {
      const r = Math.round(255 * Math.min(1, clamped * 1.5));
      const g = Math.round(255 * Math.min(1, Math.pow(clamped, 2) * 1.2));
      const b = Math.round(255 * Math.min(1, Math.sin(clamped * Math.PI * 0.8) * 0.8 + 0.2 * clamped));
      return [r, g, b];
    }
    case 'heat': {
      const r = Math.round(255 * Math.min(1, clamped * 2.5));
      const g = Math.round(255 * Math.max(0, (clamped - 0.35) * 2.5));
      const b = Math.round(255 * Math.max(0, (clamped - 0.75) * 4));
      return [r, g, b];
    }
    case 'cyan': {
      const r = Math.round(255 * Math.max(0, (clamped - 0.6) * 2.5));
      const g = Math.round(255 * Math.min(1, clamped * 1.4));
      const b = Math.round(255 * Math.min(1, 0.2 + clamped * 1.2));
      return [r, g, b];
    }
    case 'coolwarm': {
      const r = Math.round(255 * clamped);
      const g = Math.round(255 * (1 - Math.abs(clamped - 0.5) * 1.5));
      const b = Math.round(255 * (1 - clamped));
      return [r, g, b];
    }
    default: {
      const v = Math.round(clamped * 255);
      return [v, v, v];
    }
  }
}

/**
 * Renders FITS HDU into an HTML Canvas ImageData
 */
export function renderFitsToCanvas(
  hdu: FitsImageHDU,
  canvas: HTMLCanvasElement,
  minCut: number,
  maxCut: number,
  stretch: StretchAlgorithm,
  palette: ColormapPalette,
  contrast: number = 1.0,
  brightness: number = 0.0
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = hdu.naxis1;
  canvas.height = hdu.naxis2;

  const imgData = ctx.createImageData(hdu.naxis1, hdu.naxis2);
  const pixels = imgData.data;
  const data = hdu.data;
  const width = hdu.naxis1;
  const height = hdu.naxis2;

  for (let y = 0; y < height; y++) {
    const fitsY = height - 1 - y;
    for (let x = 0; x < width; x++) {
      const fitsIndex = fitsY * width + x;
      const screenIndex = (y * width + x) * 4;

      const val = data[fitsIndex];
      const stretched = applyStretch(val, minCut, maxCut, stretch, contrast, brightness);
      const [r, g, b] = getColorFromPalette(stretched, palette);

      pixels[screenIndex] = r;
      pixels[screenIndex + 1] = g;
      pixels[screenIndex + 2] = b;
      pixels[screenIndex + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

export type SyntheticDatasetType =
  | 'cosmos_nir'
  | 'orion_ice'
  | 'nep_deep'
  | 'barnard_star_epoch1'
  | 'barnard_star_epoch2'
  | 'wise0855_epoch1'
  | 'wise0855_epoch2'
  | 'r_draconis_max'
  | 'r_draconis_min'
  | 'rw_aurigae_bright'
  | 'rw_aurigae_dim'
  | 'epsilon_indi_epoch1'
  | 'epsilon_indi_epoch2';

/**
 * Synthesizes authentic FITS binary ArrayBuffers for scientific demo datasets & challenge benchmarks
 */
export function createSyntheticFitsBuffer(type: SyntheticDatasetType): ArrayBuffer {
  const width = 256;
  const height = 256;
  const bitpix = -32;
  const numPixels = width * height;

  let objectName = '';
  let filter = '';
  let dateObs = '2025-06-15T12:00:00';
  let ra = 0;
  let dec = 0;

  const data = new Float32Array(numPixels);

  if (type === 'cosmos_nir') {
    objectName = 'SPHEREx-COSMOS-BAND3';
    filter = 'LVF_ARRAY_3 (1.64 - 2.42 um)';
    dateObs = '2025-07-08T14:20:00';
    ra = 150.1192;
    dec = 2.2058;

    const seed = 42;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const noise = (Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453) % 1;
        data[i] = 12.4 + noise * 1.8;
      }
    }

    const sources = [
      { x: 128, y: 128, peak: 340, sigma: 3.5 },
      { x: 80, y: 190, peak: 180, sigma: 2.1 },
      { x: 200, y: 70, peak: 240, sigma: 4.0 },
      { x: 50, y: 60, peak: 95, sigma: 1.8 },
      { x: 170, y: 160, peak: 140, sigma: 2.4 },
      { x: 220, y: 210, peak: 85, sigma: 1.5 },
      { x: 110, y: 40, peak: 210, sigma: 3.2 },
      { x: 30, y: 140, peak: 70, sigma: 1.2 },
    ];
    for (const src of sources) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - src.x;
          const dy = y - src.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < src.sigma * src.sigma * 16) {
            data[y * width + x] += src.peak * Math.exp(-distSq / (2 * src.sigma * src.sigma));
          }
        }
      }
    }
  } else if (type === 'orion_ice') {
    objectName = 'SPHEREx-ORION-H2O-ICE';
    filter = 'LVF_ARRAY_4 (3.05 um Ice Absorption)';
    dateObs = '2025-06-02T10:15:00';
    ra = 83.8221;
    dec = -5.3911;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const filament = Math.exp(-Math.pow((y - (0.5 * x + 60)) / 32, 2)) * 60;
        const diffuse = Math.sin(x * 0.04) * Math.cos(y * 0.04) * 15;
        const noise = (Math.sin(x * 93.1 + y * 41.7) * 43758.5453) % 1;
        data[i] = 25.0 + filament + diffuse + noise * 2.2;
      }
    }

    const stars = [
      { x: 140, y: 130, peak: 420, sigma: 3.0 },
      { x: 110, y: 115, peak: 310, sigma: 2.8 },
      { x: 165, y: 145, peak: 260, sigma: 2.2 },
      { x: 95, y: 90, peak: 190, sigma: 1.9 },
    ];
    for (const s of stars) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - s.x;
          const dy = y - s.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < s.sigma * s.sigma * 16) {
            data[y * width + x] += s.peak * Math.exp(-distSq / (2 * s.sigma * s.sigma));
          }
        }
      }
    }
  } else if (type === 'barnard_star_epoch1' || type === 'barnard_star_epoch2') {
    const isEpoch2 = type === 'barnard_star_epoch2';
    objectName = isEpoch2 ? "Barnard's Star (Epoch 2024.5)" : "Barnard's Star (Epoch 2020.5)";
    filter = 'NEOWISE / SPHEREx NIR Baseline (3.4 um)';
    dateObs = isEpoch2 ? '2024-06-15T08:00:00' : '2020-06-15T08:00:00';
    ra = 269.4521;
    dec = 4.6934;

    for (let i = 0; i < numPixels; i++) {
      data[i] = 14.0 + (Math.sin(i * 0.31) % 1) * 1.5;
    }

    const bgStars = [
      { x: 50, y: 80, peak: 180, sigma: 1.8 },
      { x: 210, y: 190, peak: 260, sigma: 2.0 },
      { x: 180, y: 60, peak: 150, sigma: 1.7 },
      { x: 70, y: 200, peak: 220, sigma: 2.1 },
    ];
    for (const s of bgStars) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - s.x;
          const dy = y - s.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < s.sigma * s.sigma * 16) {
            data[y * width + x] += s.peak * Math.exp(-distSq / (2 * s.sigma * s.sigma));
          }
        }
      }
    }

    const bx = 128;
    const by = isEpoch2 ? 128 + 7 : 128;
    const bSigma = 2.4;
    const bPeak = 580;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - bx;
        const dy = y - by;
        const distSq = dx * dx + dy * dy;
        if (distSq < bSigma * bSigma * 16) {
          data[y * width + x] += bPeak * Math.exp(-distSq / (2 * bSigma * bSigma));
        }
      }
    }
  } else if (type === 'wise0855_epoch1' || type === 'wise0855_epoch2') {
    const isEpoch2 = type === 'wise0855_epoch2';
    objectName = isEpoch2 ? 'WISE J0855-0714 (Epoch 2024.2)' : 'WISE J0855-0714 (Epoch 2021.2)';
    filter = 'WISE W2 (4.6 um) Infrared Ice & Gas';
    dateObs = isEpoch2 ? '2024-03-20T12:00:00' : '2021-03-20T12:00:00';
    ra = 133.7951;
    dec = -7.2452;

    for (let i = 0; i < numPixels; i++) {
      data[i] = 16.5 + (Math.sin(i * 0.77) % 1) * 2.0;
    }

    const bgStars = [
      { x: 90, y: 70, peak: 240, sigma: 2.0 },
      { x: 190, y: 180, peak: 310, sigma: 2.2 },
      { x: 60, y: 170, peak: 140, sigma: 1.8 },
    ];
    for (const s of bgStars) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - s.x;
          const dy = y - s.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < s.sigma * s.sigma * 16) {
            data[y * width + x] += s.peak * Math.exp(-distSq / (2 * s.sigma * s.sigma));
          }
        }
      }
    }

    const wx = isEpoch2 ? 128 - 4 : 128;
    const wy = isEpoch2 ? 128 + 1 : 128;
    const wSigma = 2.1;
    const wPeak = 320;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - wx;
        const dy = y - wy;
        const distSq = dx * dx + dy * dy;
        if (distSq < wSigma * wSigma * 16) {
          data[y * width + x] += wPeak * Math.exp(-distSq / (2 * wSigma * wSigma));
        }
      }
    }
  } else if (type === 'r_draconis_max' || type === 'r_draconis_min') {
    const isMax = type === 'r_draconis_max';
    objectName = isMax ? 'R Draconis (Mira Maximum Phase)' : 'R Draconis (Mira Minimum Phase)';
    filter = 'SPHEREx Array 3 (2.17 um Ks band)';
    dateObs = isMax ? '2025-05-10T16:00:00' : '2025-09-12T16:00:00';
    ra = 248.1675;
    dec = 66.755;

    for (let i = 0; i < numPixels; i++) {
      data[i] = 11.0 + (Math.sin(i * 0.44) % 1) * 1.2;
    }

    const bgStars = [
      { x: 70, y: 60, peak: 280, sigma: 2.0 },
      { x: 195, y: 95, peak: 210, sigma: 1.9 },
      { x: 160, y: 190, peak: 190, sigma: 1.8 },
      { x: 65, y: 195, peak: 240, sigma: 2.0 },
    ];
    for (const s of bgStars) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - s.x;
          const dy = y - s.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < s.sigma * s.sigma * 16) {
            data[y * width + x] += s.peak * Math.exp(-distSq / (2 * s.sigma * s.sigma));
          }
        }
      }
    }

    const rPeak = isMax ? 820 : 85;
    const rSigma = 2.6;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - 128;
        const dy = y - 128;
        const distSq = dx * dx + dy * dy;
        if (distSq < rSigma * rSigma * 16) {
          data[y * width + x] += rPeak * Math.exp(-distSq / (2 * rSigma * rSigma));
        }
      }
    }
  } else if (type === 'rw_aurigae_bright' || type === 'rw_aurigae_dim') {
    const isBright = type === 'rw_aurigae_bright';
    objectName = isBright ? 'RW Aurigae (Normal Bright State)' : 'RW Aurigae (Circumstellar Dust Dimming)';
    filter = 'SPHEREx Array 4 (3.4 um)';
    dateObs = isBright ? '2024-11-01T12:00:00' : '2025-01-20T12:00:00';
    ra = 76.9563;
    dec = 30.4014;

    for (let i = 0; i < numPixels; i++) {
      data[i] = 13.0 + (Math.sin(i * 0.52) % 1) * 1.5;
    }

    const bgStars = [
      { x: 80, y: 75, peak: 260, sigma: 2.0 },
      { x: 180, y: 160, peak: 190, sigma: 1.8 },
      { x: 140, y: 80, peak: 150, sigma: 1.7 },
    ];
    for (const s of bgStars) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - s.x;
          const dy = y - s.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < s.sigma * s.sigma * 16) {
            data[y * width + x] += s.peak * Math.exp(-distSq / (2 * s.sigma * s.sigma));
          }
        }
      }
    }

    const rwPeak = isBright ? 460 : 120;
    const rwSigma = 2.4;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - 128;
        const dy = y - 128;
        const distSq = dx * dx + dy * dy;
        if (distSq < rwSigma * rwSigma * 16) {
          data[y * width + x] += rwPeak * Math.exp(-distSq / (2 * rwSigma * rwSigma));
        }
      }
    }
  } else if (type === 'epsilon_indi_epoch1' || type === 'epsilon_indi_epoch2') {
    const isEpoch2 = type === 'epsilon_indi_epoch2';
    objectName = isEpoch2 ? 'eps Ind B (Epoch 2024.8)' : 'eps Ind B (Epoch 2020.8)';
    filter = 'SPHEREx Array 4 (3.32 um Methane band)';
    dateObs = isEpoch2 ? '2024-10-15T22:00:00' : '2020-10-15T22:00:00';
    ra = 331.0438;
    dec = -56.7828;

    for (let i = 0; i < numPixels; i++) {
      data[i] = 12.5 + (Math.sin(i * 0.41) % 1) * 1.3;
    }

    const bgStars = [
      { x: 75, y: 85, peak: 220, sigma: 1.9 },
      { x: 185, y: 175, peak: 280, sigma: 2.1 },
      { x: 55, y: 190, peak: 160, sigma: 1.8 },
    ];
    for (const s of bgStars) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - s.x;
          const dy = y - s.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < s.sigma * s.sigma * 16) {
            data[y * width + x] += s.peak * Math.exp(-distSq / (2 * s.sigma * s.sigma));
          }
        }
      }
    }

    const ex = isEpoch2 ? 128 + 3 : 128;
    const ey = isEpoch2 ? 128 - 2 : 128;
    const ePeak = 390;
    const eSigma = 2.2;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - ex;
        const dy = y - ey;
        const distSq = dx * dx + dy * dy;
        if (distSq < eSigma * eSigma * 16) {
          data[y * width + x] += ePeak * Math.exp(-distSq / (2 * eSigma * eSigma));
        }
      }
    }
  } else {
    objectName = 'SPHEREx-NEP-DEEP-CAL';
    filter = 'LVF_ARRAY_1 (0.75 - 1.11 um)';
    dateObs = '2025-06-20T18:00:00';
    ra = 270.0;
    dec = 66.5607;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const noise = (Math.sin(x * 17.3 + y * 59.8) * 12345.67) % 1;
        data[i] = 8.5 + noise * 0.9;
      }
    }

    const fieldStars = [
      { x: 64, y: 64, peak: 520, sigma: 2.0 },
      { x: 192, y: 180, peak: 410, sigma: 2.4 },
      { x: 50, y: 200, peak: 180, sigma: 1.8 },
      { x: 210, y: 60, peak: 290, sigma: 2.1 },
    ];
    for (const fs of fieldStars) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - fs.x;
          const dy = y - fs.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < fs.sigma * fs.sigma * 16) {
            data[y * width + x] += fs.peak * Math.exp(-distSq / (2 * fs.sigma * fs.sigma));
          }
        }
      }
    }
  }

  const cards: string[] = [
    formatFitsCard('SIMPLE', 'T', 'conforms to FITS standard'),
    formatFitsCard('BITPIX', bitpix, 'IEEE single precision floating point'),
    formatFitsCard('NAXIS', 2, 'number of array dimensions'),
    formatFitsCard('NAXIS1', width, 'length of data axis 1 (X)'),
    formatFitsCard('NAXIS2', height, 'length of data axis 2 (Y)'),
    formatFitsCard('EXTEND', 'T', 'FITS dataset may contain extensions'),
    formatFitsCard('TELESCOP', 'SPHEREx', 'NASA Spectro-Photometer MIDEX Mission'),
    formatFitsCard('INSTRUME', 'SPHEREx LVF', 'Linear Variable Filter Spectrometer'),
    formatFitsCard('OBJECT', objectName, 'Target identification'),
    formatFitsCard('FILTER', filter, 'Spectral band configuration'),
    formatFitsCard('BUNIT', 'MJy/sr', 'Calibrated physical surface brightness'),
    formatFitsCard('BSCALE', 1.0, 'Physical = BZERO + BSCALE * array_value'),
    formatFitsCard('BZERO', 0.0, 'Zero level offset'),
    formatFitsCard('CRPIX1', width / 2, 'X reference pixel coordinate'),
    formatFitsCard('CRPIX2', height / 2, 'Y reference pixel coordinate'),
    formatFitsCard('CRVAL1', ra, 'RA of reference pixel in deg (J2000)'),
    formatFitsCard('CRVAL2', dec, 'Dec of reference pixel in deg (J2000)'),
    formatFitsCard('CDELT1', -0.001722, 'Coordinate increment along X axis (deg/pix)'),
    formatFitsCard('CDELT2', 0.001722, 'Coordinate increment along Y axis (deg/pix)'),
    formatFitsCard('CTYPE1', 'RA---TAN', 'Gnomonic projection right ascension'),
    formatFitsCard('CTYPE2', 'DEC--TAN', 'Gnomonic projection declination'),
    formatFitsCard('EQUINOX', 2000.0, 'Equinox of celestial coordinate system'),
    formatFitsCard('RADESYS', 'FK5', 'Equatorial coordinate system frame'),
    formatFitsCard('DATE-OBS', dateObs, 'UTC Observation timestamp'),
    formatFitsCard('EXPTIME', 3600.0, 'Total integrated on-sky exposure in seconds'),
    formatFitsCard('PROD_LVL', 'Level 2', 'Calibrated surface brightness map'),
    formatFitsCard('ORIGIN', 'NASA/IPAC Infrared Science Archive (IRSA)', 'Archive data origin'),
    'END' + ' '.repeat(77),
  ];

  let headerString = cards.join('');
  const remainder = headerString.length % FITS_BLOCK_SIZE;
  if (remainder !== 0) {
    headerString += ' '.repeat(FITS_BLOCK_SIZE - remainder);
  }

  const headerBytes = new TextEncoder().encode(headerString);
  const dataByteLength = numPixels * 4;
  const dataBlockPadding = (FITS_BLOCK_SIZE - (dataByteLength % FITS_BLOCK_SIZE)) % FITS_BLOCK_SIZE;
  const totalBufferSize = headerBytes.length + dataByteLength + dataBlockPadding;

  const arrayBuffer = new ArrayBuffer(totalBufferSize);
  const uint8View = new Uint8Array(arrayBuffer);
  const dataView = new DataView(arrayBuffer);

  uint8View.set(headerBytes, 0);

  let writeOffset = headerBytes.length;
  for (let i = 0; i < numPixels; i++) {
    dataView.setFloat32(writeOffset, data[i], false);
    writeOffset += 4;
  }

  for (let p = 0; p < dataBlockPadding; p++) {
    uint8View[writeOffset + p] = 0;
  }

  return arrayBuffer;
}

/**
 * Generates a realistic SPHEREx-style Multi-Extension FITS (MEF) binary buffer for testing
 * Contains HDU 0 PRIMARY (NAXIS=0), HDU 1 IMAGE, HDU 2 FLAGS, HDU 3 VARIANCE, HDU 4 ZODI
 */
export function createMultiExtensionTestBuffer(width = 32, height = 32, crval1 = 270.0, crval2 = 66.5607): ArrayBuffer {
  const encodeHeader = (cardList: string[]) => {
    let s = cardList.join('') + 'END' + ' '.repeat(77);
    const rem = s.length % FITS_BLOCK_SIZE;
    if (rem !== 0) s += ' '.repeat(FITS_BLOCK_SIZE - rem);
    return new TextEncoder().encode(s);
  };

  const primaryHeader = encodeHeader([
    formatFitsCard('SIMPLE', true, 'MEF Primary'),
    formatFitsCard('BITPIX', 8),
    formatFitsCard('NAXIS', 0),
    formatFitsCard('EXTEND', true),
    formatFitsCard('TELESCOP', 'SPHEREx'),
    formatFitsCard('OBJECT', 'NEP-MEF-TEST'),
    formatFitsCard('DATE-OBS', '2025-05-01T12:00:00Z'),
  ]);

  const makeExtHeader = (extname: string, bitpix: number, bunit: string) =>
    encodeHeader([
      formatFitsCard('XTENSION', 'IMAGE'),
      formatFitsCard('BITPIX', bitpix),
      formatFitsCard('NAXIS', 2),
      formatFitsCard('NAXIS1', width),
      formatFitsCard('NAXIS2', height),
      formatFitsCard('PCOUNT', 0),
      formatFitsCard('GCOUNT', 1),
      formatFitsCard('EXTNAME', extname),
      formatFitsCard('BUNIT', bunit),
      formatFitsCard('CRPIX1', width / 2),
      formatFitsCard('CRPIX2', height / 2),
      formatFitsCard('CRVAL1', crval1),
      formatFitsCard('CRVAL2', crval2),
      formatFitsCard('CD1_1', -0.001722),
      formatFitsCard('CD1_2', 0.0),
      formatFitsCard('CD2_1', 0.0),
      formatFitsCard('CD2_2', 0.001722),
      formatFitsCard('CTYPE1', 'RA---TAN'),
      formatFitsCard('CTYPE2', 'DEC--TAN'),
    ]);

  const numPixels = width * height;
  const f32Bytes = Math.ceil((numPixels * 4) / FITS_BLOCK_SIZE) * FITS_BLOCK_SIZE;

  const hImage = makeExtHeader('IMAGE', -32, 'MJy/sr');
  const hFlags = makeExtHeader('FLAGS', 32, 'bitmask');
  const hVar = makeExtHeader('VARIANCE', -32, '(MJy/sr)^2');
  const hZodi = makeExtHeader('ZODI', -32, 'MJy/sr');

  const totalLen =
    primaryHeader.length +
    hImage.length +
    f32Bytes +
    hFlags.length +
    f32Bytes +
    hVar.length +
    f32Bytes +
    hZodi.length +
    f32Bytes;

  const buf = new ArrayBuffer(totalLen);
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);

  let off = 0;
  u8.set(primaryHeader, off);
  off += primaryHeader.length;

  // IMAGE (centered Gaussian PSF at width/2, height/2 with 10.0 baseline, peak 120.0)
  u8.set(hImage, off);
  off += hImage.length;
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const r2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      const val = i === cy * width + cx ? 120.0 : 10.0 + 110.0 * Math.exp(-r2 / 2.2);
      dv.setFloat32(off + i * 4, val, false);
    }
  }
  off += f32Bytes;

  // FLAGS (4 flagged pixels)
  u8.set(hFlags, off);
  off += hFlags.length;
  for (let i = 0; i < numPixels; i++) {
    dv.setInt32(off + i * 4, i < 4 ? 1 : 0, false);
  }
  off += f32Bytes;

  // VARIANCE (sigma = 2.0)
  u8.set(hVar, off);
  off += hVar.length;
  for (let i = 0; i < numPixels; i++) {
    dv.setFloat32(off + i * 4, 4.0, false);
  }
  off += f32Bytes;

  // ZODI
  u8.set(hZodi, off);
  off += hZodi.length;
  for (let i = 0; i < numPixels; i++) {
    dv.setFloat32(off + i * 4, 2.5, false);
  }

  return buf;
}

/**
 * Astronomical Image Subtraction, Automatic WCS Alignment & Change Detection Engine
 */
export interface ImageDiffResult {
  diffHdu: FitsImageHDU;
  meanDiff: number;
  rmsDiff: number;
  maxDiff: number;
  candidatePixelsCount: number;
  candidateCentroids: { x: number; y: number; deltaVal: number; type: 'moving_candidate' | 'variable_source' }[];
  detections: CandidateDetection[];
  compatibility: {
    isCompatible: boolean;
    alignmentApplied: boolean;
    warnings: string[];
  };
}

export function computeImageDifference(hduA: FitsImageHDU, hduB: FitsImageHDU): ImageDiffResult {
  const fatalErrors: string[] = [];
  const advisoryWarnings: string[] = [];

  if (!hduA.wcs || !hduB.wcs) {
    fatalErrors.push(
      'WCS header missing on one or both images: spatial alignment cannot be verified.'
    );
  }

  const getCard = (hdu: FitsImageHDU, key: string) => hdu.headerCards.find((c) => c.key === key)?.value;
  const unitA = getCard(hduA, 'BUNIT');
  const unitB = getCard(hduB, 'BUNIT');
  if (unitA && unitB && String(unitA).trim() !== String(unitB).trim()) {
    fatalErrors.push(`Flux unit mismatch (${unitA} vs ${unitB}): direct subtraction is not photometrically calibrated.`);
  }

  if (hduA.wcs && hduB.wcs) {
    const dra =
      (hduA.wcs.crval1 - hduB.wcs.crval1) *
      Math.cos(((hduA.wcs.crval2 + hduB.wcs.crval2) * DEG_TO_RAD) / 2);
    const ddec = hduA.wcs.crval2 - hduB.wcs.crval2;
    const sepDeg = Math.sqrt(dra * dra + ddec * ddec);
    const fovA = Math.abs(hduA.wcs.cdelt1) * hduA.naxis1;
    const fovB = Math.abs(hduB.wcs.cdelt1) * hduB.naxis2;
    const maxAllowedSep = Math.max(fovA, fovB) * 0.95;

    if (sepDeg > maxAllowedSep && maxAllowedSep > 0) {
      fatalErrors.push(
        `Sky separation (${sepDeg.toFixed(3)}°) exceeds overlapping field boundaries (${maxAllowedSep.toFixed(3)}°): images do not share sufficient common sky.`
      );
    }
  }

  if (fatalErrors.length > 0) {
    throw new Error(`Incompatible images: ${fatalErrors.join(' | ')}`);
  }

  // Automatic WCS Alignment & Bilinear Resampling whenever dimensions or WCS grids differ
  let alignedB = hduB;
  let alignmentApplied = false;
  if (
    hduA.wcs &&
    hduB.wcs &&
    (hduA.naxis1 !== hduB.naxis1 ||
      hduA.naxis2 !== hduB.naxis2 ||
      !wcsMatricesEqual(hduA.wcs, hduB.wcs))
  ) {
    alignedB = alignHduToReferenceWcs(hduB, hduA);
    alignmentApplied = true;
  } else if (hduA.naxis1 !== hduB.naxis1 || hduA.naxis2 !== hduB.naxis2) {
    throw new Error(
      `Incompatible image dimensions: Image A (${hduA.naxis1}×${hduA.naxis2}) != Image B (${hduB.naxis1}×${hduB.naxis2}).`
    );
  }

  const filterA = getCard(hduA, 'FILTER');
  const filterB = getCard(hduB, 'FILTER');
  if (filterA && filterB && String(filterA) !== String(filterB)) {
    advisoryWarnings.push(
      `Wavelength/Filter note (${filterA} vs ${filterB}): residuals may combine intrinsic variability with SED bandpass differences.`
    );
  }

  const numPixels = hduA.naxis1 * hduA.naxis2;
  const diffData = new Float32Array(numPixels);

  let sum = 0;
  let validCount = 0;
  let varianceSum = 0;
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < numPixels; i++) {
    const valA = hduA.data[i];
    const valB = alignedB.data[i];
    if (!Number.isFinite(valA) || !Number.isFinite(valB)) {
      diffData[i] = NaN;
      continue;
    }
    const diff = valA - valB;
    diffData[i] = diff;

    sum += diff;
    validCount++;
    if (diff < min) min = diff;
    if (diff > max) max = diff;
  }

  if (min === Infinity) min = 0;
  if (max === -Infinity) max = 0;

  const meanDiff = validCount > 0 ? sum / validCount : 0;
  for (let i = 0; i < numPixels; i++) {
    const val = diffData[i];
    if (!Number.isFinite(val)) continue;
    const d = val - meanDiff;
    varianceSum += d * d;
  }
  const rmsDiff = validCount > 0 ? Math.sqrt(varianceSum / validCount) : 0;

  const threshold = Math.max(1e-6, 3.5 * rmsDiff);
  let candidatePixelsCount = 0;
  const candidateCentroids: { x: number; y: number; deltaVal: number; type: 'moving_candidate' | 'variable_source' }[] = [];
  const detections: CandidateDetection[] = [];

  const width = hduA.naxis1;
  const height = hduA.naxis2;
  const margin = Math.min(4, Math.floor(Math.min(width, height) / 8));

  for (let y = margin; y < height - margin; y += 2) {
    for (let x = margin; x < width - margin; x += 2) {
      const idx = y * width + x;
      const diffVal = diffData[idx];
      if (!Number.isFinite(diffVal)) continue;
      const absVal = Math.abs(diffVal);
      if (absVal > threshold) {
        candidatePixelsCount++;

        let isLocalMax = true;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nIdx = (y + dy) * width + (x + dx);
            const nVal = diffData[nIdx];
            if (Number.isFinite(nVal) && Math.abs(nVal) > absVal) {
              isLocalMax = false;
              break;
            }
          }
          if (!isLocalMax) break;
        }

        if (isLocalMax && detections.length < 12) {
          const snrSigma = rmsDiff > 0 ? Number((absVal / rmsDiff).toFixed(2)) : 0;
          const simpleType: 'moving_candidate' | 'variable_source' =
            absVal > 5 * rmsDiff ? 'moving_candidate' : 'variable_source';

          // Check neighboring opposite-sign lobe within +-10 px to detect dipolar moving-source signature
          let hasOppositeLobe = false;
          for (let dy = -10; dy <= 10 && !hasOppositeLobe; dy += 2) {
            for (let dx = -10; dx <= 10; dx += 2) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
              const nv = diffData[ny * width + nx];
              if (Number.isFinite(nv) && nv * diffVal < 0 && Math.abs(nv) > threshold) {
                hasOppositeLobe = true;
                break;
              }
            }
          }

          const world = hduA.wcs ? pixelToWorldWcs(hduA.wcs, x, y) : undefined;
          const pxScaleArcsec = hduA.wcs ? Math.abs(hduA.wcs.cdelt1) * 3600 : 6.2;

          candidateCentroids.push({
            x,
            y,
            deltaVal: diffVal,
            type: simpleType,
          });

          detections.push({
            id: `CAND-${detections.length + 1}`,
            x,
            y,
            ra: world ? Number(world.ra.toFixed(6)) : undefined,
            dec: world ? Number(world.dec.toFixed(6)) : undefined,
            deltaVal: Number(diffVal.toFixed(3)),
            fluxA: Number(hduA.data[idx].toFixed(3)),
            fluxB: Number(alignedB.data[idx].toFixed(3)),
            snrSigma,
            displacementArcsec: hasOppositeLobe ? Number((pxScaleArcsec * 2.0).toFixed(2)) : undefined,
            type: hasOppositeLobe ? 'dipolar_residual' : simpleType,
            qualityNote: alignmentApplied
              ? 'Detected after WCS bilinear resampling; candidate requires catalog cross-match.'
              : 'Direct WCS-matched difference residual; candidate requires catalog cross-match.',
            isCandidateOnly: true,
          });
        }
      }
    }
  }

  const histogram = new Array(256).fill(0);
  const range = max - min || 1;
  for (let i = 0; i < numPixels; i += 2) {
    if (!Number.isFinite(diffData[i])) continue;
    const bin = Math.min(255, Math.max(0, Math.floor(((diffData[i] - min) / range) * 255)));
    histogram[bin]++;
  }

  const diffHdu: FitsImageHDU = {
    name: `Diff: ${hduA.name.slice(0, 16)} - ${hduB.name.slice(0, 16)}`,
    extname: 'DIFF_RESIDUAL',
    bitpix: -32,
    naxis: 2,
    naxis1: hduA.naxis1,
    naxis2: hduA.naxis2,
    data: diffData,
    min,
    max,
    mean: meanDiff,
    median: 0,
    stdDev: rmsDiff,
    histogram,
    dataStatus:
      hduA.dataStatus === 'SIMULATED DEMO DATA' || hduB.dataStatus === 'SIMULATED DEMO DATA'
        ? 'SIMULATED DEMO DATA'
        : hduA.dataStatus || hduB.dataStatus || 'EXTERNAL CATALOG DATA',
    provenance: `Derived Image Subtraction (${hduA.name} - ${hduB.name})${alignmentApplied ? ' [WCS Resampled]' : ''}`,
    isSimulatedOrDemo: Boolean(hduA.isSimulatedOrDemo || hduB.isSimulatedOrDemo),
    headerCards: [
      { key: 'SIMPLE', value: true, comment: 'Standard FITS image subtraction' },
      { key: 'BITPIX', value: -32 },
      { key: 'NAXIS', value: 2 },
      { key: 'NAXIS1', value: hduA.naxis1 },
      { key: 'NAXIS2', value: hduA.naxis2 },
      { key: 'OBJECT', value: 'Image Subtraction Residual Map' },
      { key: 'BUNIT', value: 'Delta MJy/sr' },
    ],
    wcs: hduA.wcs,
  };

  return {
    diffHdu,
    meanDiff,
    rmsDiff,
    maxDiff: Math.max(Math.abs(min), Math.abs(max)),
    candidatePixelsCount,
    candidateCentroids,
    detections,
    compatibility: {
      isCompatible: advisoryWarnings.length === 0,
      alignmentApplied,
      warnings: advisoryWarnings,
    },
  };
}

function formatFitsCard(key: string, val: any, comment?: string): string {
  const paddedKey = key.padEnd(8, ' ');
  let valStr = '';

  if (typeof val === 'string') {
    valStr = `'${val.padEnd(8, ' ')}'`;
  } else if (typeof val === 'boolean') {
    valStr = val ? 'T' : 'F';
  } else if (typeof val === 'number') {
    valStr = String(val);
  }

  const valField = valStr.padStart(20, ' ');
  let card = `${paddedKey}= ${valField}`;

  if (comment) {
    card += ` / ${comment}`;
  }

  return card.padEnd(80, ' ').slice(0, 80);
}
