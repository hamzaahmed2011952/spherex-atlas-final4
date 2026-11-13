import https from 'https';
import { ApiRequest, ApiResponse, getQueryParam, setCorsHeaders } from './http';

const GAIA_REFERENCE_EPOCH_YEAR = 2016.0;

export function angularSeparationArcsec(
  ra1Deg: number,
  dec1Deg: number,
  ra2Deg: number,
  dec2Deg: number
): number {
  const toRad = Math.PI / 180;
  const r1 = ra1Deg * toRad;
  const d1 = dec1Deg * toRad;
  const r2 = ra2Deg * toRad;
  const d2 = dec2Deg * toRad;

  const sinD = Math.sin((d2 - d1) / 2);
  const sinR = Math.sin((r2 - r1) / 2);
  const a = sinD * sinD + Math.cos(d1) * Math.cos(d2) * sinR * sinR;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return (c * 180) / Math.PI * 3600;
}

export function propagateGaiaPosition(
  raDeg: number,
  decDeg: number,
  pmRaMasYr: number | null,
  pmDecMasYr: number | null,
  targetEpochYear: number
): { ra: number; dec: number; dtYears: number } {
  const dtYears = targetEpochYear - GAIA_REFERENCE_EPOCH_YEAR;
  if (!Number.isFinite(dtYears) || Math.abs(dtYears) < 1e-6) {
    return { ra: raDeg, dec: decDeg, dtYears: 0 };
  }

  const pmRa = pmRaMasYr !== null && Number.isFinite(pmRaMasYr) ? pmRaMasYr : 0;
  const pmDec = pmDecMasYr !== null && Number.isFinite(pmDecMasYr) ? pmDecMasYr : 0;
  const cosDec = Math.max(0.01, Math.cos((decDeg * Math.PI) / 180));

  // pmra in Gaia DR3 already includes cos(delta): mu_alpha* = d(alpha)/dt * cos(delta)
  const dRaDeg = (pmRa * dtYears) / (3600 * 1000 * cosDec);
  const dDecDeg = (pmDec * dtYears) / (3600 * 1000);

  const propRa = ((raDeg + dRaDeg) % 360 + 360) % 360;
  const propDec = Math.max(-90, Math.min(90, decDeg + dDecDeg));
  return { ra: propRa, dec: propDec, dtYears };
}

export function parseEpochYear(epochStr?: string): number {
  if (!epochStr || !epochStr.trim()) return 2025.5;
  const asNum = Number(epochStr);
  if (Number.isFinite(asNum) && asNum > 1900 && asNum < 2100) {
    return asNum;
  }
  const d = new Date(epochStr);
  if (!Number.isNaN(d.getTime())) {
    const year = d.getUTCFullYear();
    const startOfYear = Date.UTC(year, 0, 1);
    const endOfYear = Date.UTC(year + 1, 0, 1);
    return year + (d.getTime() - startOfYear) / (endOfYear - startOfYear);
  }
  return 2025.5;
}

export function queryGaiaTap(adql: string, timeoutMs = 10000): Promise<{
  statusCode: number;
  data?: any;
  error?: string;
  isTimeout?: boolean;
}> {
  return new Promise((resolve) => {
    const postData = 'REQUEST=doQuery&LANG=ADQL&FORMAT=json&QUERY=' + encodeURIComponent(adql);
    const req = https.request(
      {
        hostname: 'gea.esac.esa.int',
        port: 443,
        path: '/tap-server/tap/sync',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'SPHEREx-ATLAS/1.0 (ESA Gaia DR3 Cross-Match Client)',
          Accept: 'application/json, text/plain, */*',
        },
        timeout: timeoutMs,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(body);
              resolve({ statusCode: res.statusCode, data: parsed });
            } catch (err: any) {
              resolve({ statusCode: 502, error: `Invalid JSON from ESA Gaia TAP: ${err.message}` });
            }
          } else {
            resolve({
              statusCode: res.statusCode || 502,
              error: `ESA Gaia TAP HTTP ${res.statusCode}: ${body.slice(0, 300)}`,
            });
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ statusCode: 504, error: `ESA Gaia TAP timed out after ${timeoutMs}ms`, isTimeout: true });
    });

    req.on('error', (err) => {
      resolve({ statusCode: 502, error: `Connection to ESA Gaia TAP failed: ${err.message}` });
    });

    req.write(postData);
    req.end();
  });
}

export async function gaiaCrossMatchHandler(req: ApiRequest, res: ApiResponse) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const raRaw = getQueryParam(req, 'ra');
  const decRaw = getQueryParam(req, 'dec');
  const radiusArcsecRaw = getQueryParam(req, 'radiusArcsec') || '45';
  const epochRaw =
    getQueryParam(req, 'epoch') ||
    getQueryParam(req, 'epochYear') ||
    getQueryParam(req, 'epochDate') ||
    '';
  const limitRaw = parseInt(getQueryParam(req, 'limit') || '20', 10);
  const topLimit = Number.isFinite(limitRaw) ? Math.min(30, Math.max(1, limitRaw)) : 20;

  const ra = parseFloat(raRaw);
  const dec = parseFloat(decRaw);
  const radiusArcsec = Math.min(300, Math.max(2, parseFloat(radiusArcsecRaw) || 45));
  const radiusDeg = radiusArcsec / 3600;
  const targetEpochYear = parseEpochYear(epochRaw);

  if (!Number.isFinite(ra) || ra < 0 || ra >= 360) {
    return res.status(400).json({
      error: 'Valid Right Ascension (ra in degrees [0, 360)) is required.',
      dataStatus: 'UNAVAILABLE DATA',
      matches: [],
    });
  }

  if (!Number.isFinite(dec) || dec < -90 || dec > 90) {
    return res.status(400).json({
      error: 'Valid Declination (dec in degrees [-90, +90]) is required.',
      dataStatus: 'UNAVAILABLE DATA',
      matches: [],
    });
  }

  const startTime = Date.now();
  const adql = `SELECT TOP ${topLimit} source_id, ra, dec, ra_error, dec_error, pmra, pmdec, parallax, parallax_error, phot_g_mean_mag, bp_rp FROM gaiadr3.gaia_source WHERE 1 = CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', ${ra.toFixed(6)}, ${dec.toFixed(6)}, ${radiusDeg.toFixed(6)})) ORDER BY phot_g_mean_mag ASC`;

  const tapRes = await queryGaiaTap(adql, 10000);
  const queryTimeMs = Date.now() - startTime;

  if (tapRes.statusCode !== 200 || !tapRes.data) {
    return res.status(tapRes.statusCode || 502).json({
      dataStatus: 'UNAVAILABLE DATA',
      source: 'ESA Gaia DR3 TAP (https://gea.esac.esa.int/tap-server/tap/sync)',
      ra,
      dec,
      radiusArcsec,
      targetEpochYear,
      matches: [],
      error: tapRes.error || 'ESA Gaia DR3 TAP service failed to respond.',
      queryTimeMs,
    });
  }

  const metadataCols: Array<{ name: string }> = Array.isArray(tapRes.data.metadata)
    ? tapRes.data.metadata
    : [];
  const colIndex = (colName: string, fallback: number) => {
    const idx = metadataCols.findIndex((m) => m.name?.toLowerCase() === colName.toLowerCase());
    return idx >= 0 ? idx : fallback;
  };

  const rows: any[][] = Array.isArray(tapRes.data.data) ? tapRes.data.data : [];

  const matches = rows
    .map((r) => {
      const sRa = Number(r[colIndex('ra', 1)]);
      const sDec = Number(r[colIndex('dec', 2)]);
      const raErr = r[colIndex('ra_error', 3)] !== null ? Number(r[colIndex('ra_error', 3)]) : null;
      const decErr = r[colIndex('dec_error', 4)] !== null ? Number(r[colIndex('dec_error', 4)]) : null;
      const pmRa = r[colIndex('pmra', 5)] !== null ? Number(r[colIndex('pmra', 5)]) : null;
      const pmDec = r[colIndex('pmdec', 6)] !== null ? Number(r[colIndex('pmdec', 6)]) : null;
      const parallax = r[colIndex('parallax', 7)] !== null ? Number(r[colIndex('parallax', 7)]) : null;
      const parallaxErr =
        r[colIndex('parallax_error', 8)] !== null ? Number(r[colIndex('parallax_error', 8)]) : null;
      const photGMag =
        r[colIndex('phot_g_mean_mag', 9)] !== null ? Number(r[colIndex('phot_g_mean_mag', 9)]) : null;
      const bpRp = r[colIndex('bp_rp', 10)] !== null ? Number(r[colIndex('bp_rp', 10)]) : null;

      const prop = propagateGaiaPosition(sRa, sDec, pmRa, pmDec, targetEpochYear);
      const sepJ2016 = angularSeparationArcsec(ra, dec, sRa, sDec);
      const sepProp = angularSeparationArcsec(ra, dec, prop.ra, prop.dec);

      const totalPm =
        pmRa !== null && pmDec !== null ? Number(Math.hypot(pmRa, pmDec).toFixed(2)) : null;
      const distancePc =
        parallax !== null && parallax > 0 && (!parallaxErr || parallax / parallaxErr >= 3)
          ? Number((1000 / parallax).toFixed(2))
          : null;
      const astrometricErrorMas =
        raErr !== null && decErr !== null ? Number(Math.hypot(raErr, decErr).toFixed(3)) : null;

      const bestSep = Math.min(sepJ2016, sepProp);

      return {
        sourceId: String(r[colIndex('source_id', 0)]),
        ra: Number(sRa.toFixed(6)),
        dec: Number(sDec.toFixed(6)),
        propagatedRa: Number(prop.ra.toFixed(6)),
        propagatedDec: Number(prop.dec.toFixed(6)),
        separationArcsec: Number(sepJ2016.toFixed(2)),
        propagatedSeparationArcsec: Number(sepProp.toFixed(2)),
        pmRaMasYr: pmRa !== null ? Number(pmRa.toFixed(2)) : null,
        pmDecMasYr: pmDec !== null ? Number(pmDec.toFixed(2)) : null,
        totalPmMasYr: totalPm,
        parallaxMas: parallax !== null ? Number(parallax.toFixed(3)) : null,
        distancePc,
        photGMag: photGMag !== null ? Number(photGMag.toFixed(3)) : null,
        bpRpColor: bpRp !== null ? Number(bpRp.toFixed(3)) : null,
        astrometricErrorMas,
        matchClassification:
          bestSep <= 5.0 ? ('Catalog Match Candidate' as const) : ('Nearby Field Source' as const),
      };
    })
    .sort((a, b) => a.propagatedSeparationArcsec - b.propagatedSeparationArcsec);

  const hasCloseCandidate = matches.some((m) => m.matchClassification === 'Catalog Match Candidate');

  return res.status(200).json({
    dataStatus: matches.length > 0 ? 'EXTERNAL CATALOG DATA' : 'UNAVAILABLE DATA',
    source: 'ESA Gaia DR3 Archive (gaiadr3.gaia_source, Reference Epoch J2016.0)',
    queryCenter: { ra, dec },
    radiusArcsec,
    targetEpochYear: Number(targetEpochYear.toFixed(3)),
    count: matches.length,
    hasCloseCandidate,
    classificationSummary: hasCloseCandidate
      ? 'Known Gaia DR3 astrometric match candidate found within 5.0" after proper-motion propagation.'
      : matches.length > 0
      ? 'Field sources found in cone, but no counterpart within 5.0" at observation epoch (candidate remains unassociated or fast-moving).'
      : 'No Gaia DR3 counterparts detected within search radius.',
    matches,
    sources: matches,
    queryTimeMs,
  });
}
