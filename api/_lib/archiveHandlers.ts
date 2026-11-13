import https from 'https';
import zlib from 'zlib';
import { ApiRequest, ApiResponse, getQueryParam, parseRequestBody, setCorsHeaders } from './http';

export function degToHms(raDeg: number): string {
  const totalHours = (((raDeg % 360) + 360) % 360) / 15;
  const h = Math.floor(totalHours);
  const m = Math.floor((totalHours - h) * 60);
  const s = ((totalHours - h - m / 60) * 3600).toFixed(2);
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${s.padStart(5, '0')}s`;
}

export function degToDms(decDeg: number): string {
  const sign = decDeg < 0 ? '-' : '+';
  const abs = Math.abs(decDeg);
  const d = Math.floor(abs);
  const m = Math.floor((abs - d) * 60);
  const s = ((abs - d - m / 60) * 3600).toFixed(1);
  return `${sign}${String(d).padStart(2, '0')}° ${String(m).padStart(2, '0')}' ${s.padStart(4, '0')}"`;
}

// Convert Modified Julian Date (MJD) to ISO 8601 UTC string, or null if missing/invalid
export function mjdToIsoString(mjd: number | null | undefined): string | null {
  if (mjd === null || mjd === undefined || !Number.isFinite(mjd)) {
    return null;
  }
  const unixMs = (mjd - 40587) * 86400 * 1000;
  const d = new Date(unixMs);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export interface IrsaTapResponse {
  statusCode: number;
  data?: any;
  error?: string;
  isTimeout?: boolean;
}

export function queryIrsaTap(adql: string, timeoutMs: number = 5000): Promise<IrsaTapResponse> {
  return new Promise((resolve) => {
    const postData = 'REQUEST=doQuery&LANG=ADQL&FORMAT=json&QUERY=' + encodeURIComponent(adql);
    const req = https.request(
      {
        hostname: 'irsa.ipac.caltech.edu',
        port: 443,
        path: '/TAP/sync',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'SPHEREx-ATLAS/1.0 (NASA/IPAC Archive Client; Space Apps)',
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
              resolve({ statusCode: 502, error: `Invalid JSON from IRSA TAP: ${err.message}` });
            }
          } else {
            resolve({
              statusCode: res.statusCode || 502,
              error: `IRSA TAP HTTP ${res.statusCode}: ${body.slice(0, 300)}`,
            });
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ statusCode: 504, error: `IRSA TAP query timed out after ${timeoutMs}ms`, isTimeout: true });
    });

    req.on('error', (err) => {
      resolve({ statusCode: 502, error: `Connection to IRSA TAP failed: ${err.message}` });
    });

    req.write(postData);
    req.end();
  });
}

export function queryCdsSesame(
  targetName: string,
  timeoutMs: number = 3500
): Promise<{ ok: boolean; text?: string; error?: string }> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'cds.unistra.fr',
        port: 443,
        path: `/cgi-bin/nph-sesame/-oI/A?${encodeURIComponent(targetName)}`,
        method: 'GET',
        headers: {
          'User-Agent': 'SPHEREx-ATLAS/1.0 (Astronomical Target Resolver)',
          Accept: 'text/plain, */*',
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
            resolve({ ok: true, text: body });
          } else {
            resolve({ ok: false, error: `CDS Sesame returned HTTP ${res.statusCode}` });
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'CDS Sesame lookup timed out.' });
    });

    req.on('error', (err) => {
      resolve({ ok: false, error: err.message });
    });

    req.end();
  });
}

const LOCAL_TARGETS: Record<string, any> = {
  orion: {
    target: 'Orion Nebula (M42)',
    ra: 83.8221,
    dec: -5.3911,
    raHms: '05h 35m 17.3s',
    decDms: '-05° 23\' 28.0"',
    objectType: 'HII Region / Star-Forming Complex',
    canonicalName: 'Messier 42 / Orion Nebula',
  },
  m42: {
    target: 'Orion Nebula (M42)',
    ra: 83.8221,
    dec: -5.3911,
    raHms: '05h 35m 17.3s',
    decDms: '-05° 23\' 28.0"',
    objectType: 'HII Region / Star-Forming Complex',
    canonicalName: 'Messier 42',
  },
  m31: {
    target: 'Andromeda Galaxy (M31)',
    ra: 10.6847,
    dec: 41.2687,
    raHms: '00h 42m 44.3s',
    decDms: '+41° 16\' 07.5"',
    objectType: 'Spiral Galaxy (SA(s)b)',
    canonicalName: 'Messier 31',
  },
  andromeda: {
    target: 'Andromeda Galaxy (M31)',
    ra: 10.6847,
    dec: 41.2687,
    raHms: '00h 42m 44.3s',
    decDms: '+41° 16\' 07.5"',
    objectType: 'Spiral Galaxy (SA(s)b)',
    canonicalName: 'Messier 31',
  },
  'trappist-1': {
    target: 'TRAPPIST-1',
    ra: 346.622,
    dec: -5.0414,
    raHms: '23h 06m 29.3s',
    decDms: '-05° 02\' 29.0"',
    objectType: 'Ultracool M-Dwarf Planetary System',
    canonicalName: '2MASS J23062928-0502285',
  },
  cosmos: {
    target: 'COSMOS Deep Field',
    ra: 150.1192,
    dec: 2.2058,
    raHms: '10h 00m 28.6s',
    decDms: '+02° 12\' 21.0"',
    objectType: 'Cosmological Deep Extragalactic Survey Field',
    canonicalName: 'COSMOS Field',
  },
  nep: {
    target: 'North Ecliptic Pole (NEP)',
    ra: 270.0,
    dec: 66.5607,
    raHms: '18h 00m 00.0s',
    decDms: '+66° 33\' 38.5"',
    objectType: 'SPHEREx Deep Calibration Field (>1000x coverage)',
    canonicalName: 'NEP Deep Survey Field',
  },
  sep: {
    target: 'South Ecliptic Pole (SEP)',
    ra: 90.0,
    dec: -66.5607,
    raHms: '06h 00m 00.0s',
    decDms: '-66° 33\' 38.5"',
    objectType: 'SPHEREx Deep Calibration Field (>1000x coverage)',
    canonicalName: 'SEP Deep Survey Field',
  },
  m82: {
    target: 'Cigar Galaxy (M82)',
    ra: 148.9685,
    dec: 69.6797,
    raHms: '09h 55m 52.4s',
    decDms: '+69° 40\' 47.0"',
    objectType: 'Starburst Galaxy / Infrared Hyper-Emitter',
    canonicalName: 'Messier 82',
  },
  betelgeuse: {
    target: 'Betelgeuse (Alpha Orionis)',
    ra: 88.7929,
    dec: 7.4071,
    raHms: '05h 55m 10.3s',
    decDms: '+07° 24\' 25.4"',
    objectType: 'Red Supergiant Star (M1-2 Ia-ab)',
    canonicalName: 'Alpha Orionis',
  },
  'hd 189733': {
    target: 'HD 189733',
    ra: 300.182,
    dec: 22.7108,
    raHms: '20h 00m 43.7s',
    decDms: '+22° 42\' 39.0"',
    objectType: 'Exoplanet Host Star with Atmospheric Water',
    canonicalName: 'HD 189733',
  },
  barnard: {
    target: "Barnard's Star (High Proper Motion)",
    ra: 269.4521,
    dec: 4.6934,
    raHms: '17h 57m 48.50s',
    decDms: '+04° 41\' 36.2"',
    objectType: 'High Proper Motion M-Dwarf (10.3"/yr)',
    canonicalName: "Barnard's Star / BD+04 3561a",
  },
  'barnards star': {
    target: "Barnard's Star (High Proper Motion)",
    ra: 269.4521,
    dec: 4.6934,
    raHms: '17h 57m 48.50s',
    decDms: '+04° 41\' 36.2"',
    objectType: 'High Proper Motion M-Dwarf (10.3"/yr)',
    canonicalName: "Barnard's Star / BD+04 3561a",
  },
  'wise 0855': {
    target: 'WISE J0855-0714 (Coldest Sub-Brown Dwarf)',
    ra: 133.7951,
    dec: -7.2452,
    raHms: '08h 55m 10.831s',
    decDms: '-07° 14\' 42.53"',
    objectType: 'Y4 Sub-Brown Dwarf (T ~ 250 K)',
    canonicalName: 'WISE J085510.83-071442.5',
  },
  wise0855: {
    target: 'WISE J0855-0714 (Coldest Sub-Brown Dwarf)',
    ra: 133.7951,
    dec: -7.2452,
    raHms: '08h 55m 10.831s',
    decDms: '-07° 14\' 42.53"',
    objectType: 'Y4 Sub-Brown Dwarf (T ~ 250 K)',
    canonicalName: 'WISE J085510.83-071442.5',
  },
  'r draconis': {
    target: 'R Draconis (Extreme Mira Variable)',
    ra: 248.1675,
    dec: 66.755,
    raHms: '16h 32m 40.20s',
    decDms: '+66° 45\' 18.0"',
    objectType: 'M3e-M9e Mira Variable Star',
    canonicalName: 'R Dra / HD 149214',
  },
  'r dra': {
    target: 'R Draconis (Extreme Mira Variable)',
    ra: 248.1675,
    dec: 66.755,
    raHms: '16h 32m 40.20s',
    decDms: '+66° 45\' 18.0"',
    objectType: 'M3e-M9e Mira Variable Star',
    canonicalName: 'R Dra / HD 149214',
  },
  'rw aurigae': {
    target: 'RW Aurigae (Accretion & Dust Occultation)',
    ra: 76.9563,
    dec: 30.4014,
    raHms: '05h 07m 49.50s',
    decDms: '+30° 24\' 05.0"',
    objectType: 'Classical T Tauri Binary Variable',
    canonicalName: 'RW Aur / HIP 23873',
  },
  'rw aur': {
    target: 'RW Aurigae (Accretion & Dust Occultation)',
    ra: 76.9563,
    dec: 30.4014,
    raHms: '05h 07m 49.50s',
    decDms: '+30° 24\' 05.0"',
    objectType: 'Classical T Tauri Binary Variable',
    canonicalName: 'RW Aur / HIP 23873',
  },
  'epsilon indi b': {
    target: 'Epsilon Indi B (Cold Binary Brown Dwarf)',
    ra: 331.0438,
    dec: -56.7828,
    raHms: '22h 04m 10.50s',
    decDms: '-56° 46\' 58.0"',
    objectType: 'T1+T6 Binary Brown Dwarf (pm: 4.7"/yr)',
    canonicalName: 'eps Ind B / GJ 845 B',
  },
  'eps ind b': {
    target: 'Epsilon Indi B (Cold Binary Brown Dwarf)',
    ra: 331.0438,
    dec: -56.7828,
    raHms: '22h 04m 10.50s',
    decDms: '-56° 46\' 58.0"',
    objectType: 'T1+T6 Binary Brown Dwarf (pm: 4.7"/yr)',
    canonicalName: 'eps Ind B / GJ 845 B',
  },
};

function searchLocalCatalog(query: string) {
  const q = query.toLowerCase().trim();
  for (const [key, val] of Object.entries(LOCAL_TARGETS)) {
    if (key === q || val.target.toLowerCase().includes(q) || val.canonicalName.toLowerCase().includes(q)) {
      return val;
    }
  }
  return null;
}

export async function resolveTargetHandler(req: ApiRequest, res: ApiResponse) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const targetParam = getQueryParam(req, 'target').trim();

  if (!targetParam) {
    return res.status(400).json({
      error: 'Target query parameter is required and must be non-empty text.',
      dataStatus: 'UNAVAILABLE DATA',
    });
  }

  if (targetParam.length > 128) {
    return res.status(400).json({
      error: 'Target name exceeds maximum allowed length of 128 characters.',
      dataStatus: 'UNAVAILABLE DATA',
    });
  }

  try {
    const sesameRes = await queryCdsSesame(targetParam, 3500);

    if (sesameRes.ok && sesameRes.text) {
      const text = sesameRes.text;
      const jMatch = text.match(/%J\s+([0-9.\-+]+)\s+([0-9.\-+]+)/);
      const typeMatch = text.match(/%T\s+([^\n\r]+)/);
      const onameMatch = text.match(/%C\.0\s+([^\n\r]+)/);

      if (jMatch) {
        const ra = parseFloat(jMatch[1]);
        const dec = parseFloat(jMatch[2]);
        return res.status(200).json({
          target: targetParam,
          found: true,
          source: 'CDS Sesame / SIMBAD (Strasbourg Astronomical Data Center)',
          dataStatus: 'EXTERNAL CATALOG DATA',
          ra,
          dec,
          raHms: degToHms(ra),
          decDms: degToDms(dec),
          objectType: typeMatch ? typeMatch[1].trim() : 'Astronomical Source',
          canonicalName: onameMatch ? onameMatch[1].trim() : targetParam,
          provenance: 'Authoritative CDS Sesame Name Resolver (Live)',
        });
      }
    }

    const localMatch = searchLocalCatalog(targetParam);
    if (localMatch) {
      return res.status(200).json({
        ...localMatch,
        found: true,
        source: 'Calibrated Astronomical Reference Catalog',
        dataStatus: 'EXTERNAL CATALOG DATA',
        provenance: 'Calibrated Astronomical Reference Database',
      });
    }

    return res.status(404).json({
      target: targetParam,
      found: false,
      dataStatus: 'UNAVAILABLE DATA',
      error: `Target "${targetParam}" could not be resolved by CDS Sesame or the reference catalog. Please provide coordinates directly (RA/Dec).`,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Astronomical resolver encountered an unexpected internal server error.',
      dataStatus: 'UNAVAILABLE DATA',
      details: err?.message,
    });
  }
}

export interface ParsedSia2Row {
  obsId: string;
  collection: string;
  ra: number | null;
  dec: number | null;
  band: string;
  emMin: number | null;
  emMax: number | null;
  tMinMjd: number | null;
  tMaxMjd: number | null;
  exposureSec: number;
  accessUrl?: string;
  accessFormat: string;
  calibLevel?: number;
  targetName?: string;
}

export function parseSia2Json(json: any): ParsedSia2Row[] {
  const resources = json?.VOTABLE?.RESOURCE_ARRAY || (json?.VOTABLE?.RESOURCE ? [json.VOTABLE.RESOURCE] : []);
  if (!Array.isArray(resources) || resources.length === 0) return [];
  const table = resources[0]?.TABLE;
  if (!table) return [];

  const fieldsRaw = table.FIELD_ARRAY || table.FIELD || [];
  const fields: string[] = Array.isArray(fieldsRaw)
    ? fieldsRaw.map((f: any) => String(f?.name || f?.ID || '').toLowerCase())
    : [];

  const tableData = table?.DATA?.TABLEDATA;
  let rawRows: any[][] = [];

  if (Array.isArray(tableData)) {
    rawRows = tableData;
  } else if (tableData && Array.isArray(tableData.TR_ARRAY)) {
    rawRows = tableData.TR_ARRAY.map((tr: any) => tr?.TD_ARRAY || tr?.TD || []);
  } else if (tableData && Array.isArray(tableData.TR)) {
    rawRows = tableData.TR.map((tr: any) => tr?.TD_ARRAY || tr?.TD || []);
  }

  const colIdx = (...names: string[]) => {
    for (const n of names) {
      const idx = fields.indexOf(n.toLowerCase());
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const iObsId = colIdx('obs_id', 'obs_publisher_did');
  const iColl = colIdx('obs_collection');
  const iRa = colIdx('s_ra');
  const iDec = colIdx('s_dec');
  const iBand = colIdx('energy_bandpassname', 'filter');
  const iEmMin = colIdx('em_min');
  const iEmMax = colIdx('em_max');
  const iTMin = colIdx('t_min');
  const iTMax = colIdx('t_max');
  const iExp = colIdx('t_exptime');
  const iUrl = colIdx('access_url');
  const iFmt = colIdx('access_format');
  const iCal = colIdx('calib_level');
  const iTgt = colIdx('target_name', 'obs_title');

  return rawRows
    .map((row: any[], idx: number): ParsedSia2Row | null => {
      if (!Array.isArray(row)) return null;
      const getStr = (i: number) => (i >= 0 && row[i] !== null && row[i] !== undefined && row[i] !== '' ? String(row[i]) : '');
      const getNum = (i: number) => {
        if (i < 0 || row[i] === null || row[i] === undefined || row[i] === '') return null;
        const n = Number(row[i]);
        return Number.isFinite(n) ? n : null;
      };

      const accessUrl = getStr(iUrl) || undefined;
      return {
        obsId: getStr(iObsId) || `SIA2-${idx + 1}`,
        collection: getStr(iColl) || 'SPHEREx SIA2',
        ra: getNum(iRa),
        dec: getNum(iDec),
        band: getStr(iBand) || 'SPHEREx LVF',
        emMin: getNum(iEmMin),
        emMax: getNum(iEmMax),
        tMinMjd: getNum(iTMin),
        tMaxMjd: getNum(iTMax),
        exposureSec: getNum(iExp) ?? 0,
        accessUrl,
        accessFormat: getStr(iFmt) || 'application/fits',
        calibLevel: getNum(iCal) ?? undefined,
        targetName: getStr(iTgt) || undefined,
      };
    })
    .filter((r): r is ParsedSia2Row => r !== null);
}

export function queryIrsaSia2(
  collection: string,
  ra: number,
  dec: number,
  radiusDeg: number,
  timeoutMs: number = 9000
): Promise<{ statusCode: number; rows: ParsedSia2Row[]; error?: string }> {
  return new Promise((resolve) => {
    const safeRadius = Math.max(0.01, Math.min(2.0, radiusDeg));
    const path = `/SIA?COLLECTION=${encodeURIComponent(collection)}&POS=circle+${ra.toFixed(5)}+${dec.toFixed(5)}+${safeRadius.toFixed(4)}&RESPONSEFORMAT=json`;

    const req = https.request(
      {
        hostname: 'irsa.ipac.caltech.edu',
        port: 443,
        path,
        method: 'GET',
        headers: {
          'User-Agent': 'SPHEREx-ATLAS/1.0 (NASA/IPAC SIA2 Client)',
          Accept: 'application/json, */*',
        },
        timeout: timeoutMs,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => {
          body += c;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(body);
              resolve({ statusCode: res.statusCode, rows: parseSia2Json(parsed) });
            } catch (err: any) {
              resolve({ statusCode: 502, rows: [], error: `Invalid JSON from IRSA SIA2: ${err.message}` });
            }
          } else {
            resolve({
              statusCode: res.statusCode || 502,
              rows: [],
              error: `IRSA SIA2 HTTP ${res.statusCode}`,
            });
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ statusCode: 504, rows: [], error: `IRSA SIA2 timed out after ${timeoutMs}ms` });
    });

    req.on('error', (err) => {
      resolve({ statusCode: 502, rows: [], error: err.message });
    });

    req.end();
  });
}

export function inferReleaseTag(text?: string): 'DR1' | 'QR3' | 'QR2' | 'Archive' {
  const s = (text || '').toLowerCase();
  if (s.includes('/dr1/') || s.includes('spherex_dr1') || s.includes('dr1')) return 'DR1';
  if (s.includes('/qr3/') || s.includes('spherex_qr3') || s.includes('qr3')) return 'QR3';
  if (s.includes('/qr2/') || s.includes('spherex_qr2') || s.includes('qr2')) return 'QR2';
  return 'Archive';
}

function releasePriority(tag: string): number {
  if (tag === 'DR1') return 3;
  if (tag === 'QR3') return 2;
  if (tag === 'QR2') return 1;
  return 0;
}

export function parseDetectorFromBandpass(band?: string): number[] {
  if (!band) return [];
  const match = band.match(/(?:D|ARRAY[_\s]?|DET(?:ECTOR)?[_\s]?)([1-6])\b/i);
  if (match) {
    return [Number(match[1])];
  }
  return [];
}

export function buildIrsaCutoutUrl(
  uriOrUrl: string | undefined,
  ra: number,
  dec: number,
  sizeDeg: number = 0.04
): { accessUrl?: string; cutoutUrl?: string } {
  if (!uriOrUrl) return {};
  const trimmed = uriOrUrl.trim();
  if (!trimmed) return {};

  const fullUrl = trimmed.startsWith('http')
    ? trimmed
    : trimmed.startsWith('/')
      ? `https://irsa.ipac.caltech.edu${trimmed}`
      : `https://irsa.ipac.caltech.edu/${trimmed}`;

  const safeSize = Math.max(0.015, Math.min(0.08, sizeDeg));

  // IRSA IBE FITS paths support native spatial cutouts (?center=RA,DECd&size=deg)
  if (/irsa\.ipac\.caltech\.edu\/ibe\/data\/.+\.fits(\.gz)?$/i.test(fullUrl)) {
    const cutoutUrl = `${fullUrl}?center=${ra.toFixed(5)},${dec.toFixed(5)}d&size=${safeSize.toFixed(4)}`;
    return { accessUrl: fullUrl, cutoutUrl };
  }

  return { accessUrl: fullUrl };
}

export async function archiveStatusHandler(req: ApiRequest, res: ApiResponse) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const startTime = Date.now();
  try {
    const tapRes = await queryIrsaTap(
      "SELECT table_name, description FROM TAP_SCHEMA.tables WHERE schema_name='spherex'",
      5500
    );
    const latencyMs = Date.now() - startTime;

    if (tapRes.statusCode === 200 && tapRes.data) {
      const rows = tapRes.data?.VOTABLE?.RESOURCE_ARRAY?.[0]?.TABLE?.DATA?.TABLEDATA || [];
      const tables = rows.map((r: any[]) => ({ name: r[0], description: r[1] }));

      return res.status(200).json({
        connected: true,
        archive: 'NASA/IPAC Infrared Science Archive (IRSA)',
        endpoint: 'https://irsa.ipac.caltech.edu/TAP/sync',
        protocol: 'IVOA TAP 1.0 (spherex.artifact/plane + spherex.obscore) + SIA2 + IBE Cutouts',
        latencyMs,
        verifiedTables: tables,
        dataReleaseStatus: 'SPHEREx Data Release 1 (DR1) & Quick Releases (QR2/QR3)',
      });
    }

    return res.status(tapRes.statusCode || 502).json({
      connected: false,
      archive: 'NASA/IPAC Infrared Science Archive (IRSA)',
      endpoint: 'https://irsa.ipac.caltech.edu/TAP/sync',
      error: tapRes.error || `Upstream TAP service responded with HTTP ${tapRes.statusCode}`,
      isTimeout: tapRes.isTimeout || false,
      latencyMs,
    });
  } catch (err: any) {
    return res.status(503).json({
      connected: false,
      archive: 'NASA/IPAC Infrared Science Archive (IRSA)',
      endpoint: 'https://irsa.ipac.caltech.edu/TAP/sync',
      error: err?.message || 'Service unavailable',
    });
  }
}

export async function archiveSearchHandler(req: ApiRequest, res: ApiResponse) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method && req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed. Use POST.',
      dataStatus: 'UNAVAILABLE DATA',
    });
  }

  const startTime = Date.now();
  try {
    const body = parseRequestBody(req);
    const { ra, dec, fov = 0.5 } = body;

    if (ra === undefined || ra === null || isNaN(Number(ra))) {
      return res.status(400).json({
        error: 'Right Ascension (RA) is required and must be a valid number in degrees [0, 360).',
        dataStatus: 'UNAVAILABLE DATA',
      });
    }

    if (dec === undefined || dec === null || isNaN(Number(dec))) {
      return res.status(400).json({
        error: 'Declination (Dec) is required and must be a valid number in degrees [-90, +90].',
        dataStatus: 'UNAVAILABLE DATA',
      });
    }

    const numRa = parseFloat(String(ra));
    const numDec = parseFloat(String(dec));

    if (numRa < 0 || numRa >= 360) {
      return res.status(400).json({
        error: `Right Ascension ${numRa}° is out of valid celestial range [0, 360).`,
        dataStatus: 'UNAVAILABLE DATA',
      });
    }

    if (numDec < -90 || numDec > 90) {
      return res.status(400).json({
        error: `Declination ${numDec}° is out of valid celestial range [-90, +90].`,
        dataStatus: 'UNAVAILABLE DATA',
      });
    }

    const numFov = parseFloat(String(fov));
    if (isNaN(numFov) || numFov <= 0 || numFov > 15.0) {
      return res.status(400).json({
        error: 'Field of view (fov) must be a positive number in degrees (0 < fov <= 15.0).',
        dataStatus: 'UNAVAILABLE DATA',
      });
    }

    const radiusDeg = numFov / 2;
    const rawLimit = Number(body?.limit ?? 100);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, Math.floor(rawLimit)), 250) : 100;
    const cutoutSizeDeg = Number.isFinite(Number(body?.cutoutSizeDeg))
      ? Math.max(0.015, Math.min(0.06, Number(body.cutoutSizeDeg)))
      : 0.04;
    const releaseFilter = String(body?.releaseFilter || 'all').toLowerCase();

    // Primary Official Pattern (Caltech-IPAC spherex_cutouts.md):
    // spherex.artifact JOIN spherex.plane returns direct IRSA IBE MEF paths supporting ?center=RA,Decd&size=deg cutouts.
    const artifactAdql = `SELECT TOP ${limit} a.uri, p.time_bounds_lower, p.time_bounds_upper, p.energy_bandpassname, p.planeid FROM spherex.artifact a JOIN spherex.plane p ON a.planeid = p.planeid WHERE 1 = CONTAINS(POINT('ICRS', ${numRa.toFixed(5)}, ${numDec.toFixed(5)}), p.poly) ORDER BY p.time_bounds_lower ASC`;

    const tapTimeoutMs = 18000;
    const artifactRes = await queryIrsaTap(artifactAdql, tapTimeoutMs);

    const observationsMap = new Map<string, any>();
    let queriedTable = 'spherex.artifact JOIN spherex.plane';

    if (artifactRes.statusCode === 200 && artifactRes.data) {
      const artifactRows: any[] = artifactRes.data?.VOTABLE?.RESOURCE_ARRAY?.[0]?.TABLE?.DATA?.TABLEDATA || [];
      for (const r of artifactRows) {
        const uri = r[0] ? String(r[0]) : '';
        const tMinMjd = r[1] !== null && r[1] !== undefined ? Number(r[1]) : null;
        const tMaxMjd = r[2] !== null && r[2] !== undefined ? Number(r[2]) : null;
        const band = r[3] ? String(r[3]) : 'SPHEREx LVF';
        const planeId = r[4] ? String(r[4]) : uri.split('/').pop() || `SPX-${observationsMap.size + 1}`;
        const releaseTag = inferReleaseTag(uri);
        const { accessUrl, cutoutUrl } = buildIrsaCutoutUrl(uri, numRa, numDec, cutoutSizeDeg);
        const detectorsActive = parseDetectorFromBandpass(band);
        const exposureSec =
          tMinMjd !== null && tMaxMjd !== null && Number.isFinite(tMinMjd) && Number.isFinite(tMaxMjd)
            ? Number(Math.max(0, (tMaxMjd - tMinMjd) * 86400).toFixed(1))
            : 0;

        const key = cutoutUrl || accessUrl || planeId;
        if (!observationsMap.has(key)) {
          observationsMap.set(key, {
            id: planeId,
            surveyPass: releaseTag === 'DR1' ? 'Data Release 1 (DR1)' : 'Quick Release',
            targetRegion: `ICRS ${numRa.toFixed(3)}°, ${numDec >= 0 ? '+' : ''}${numDec.toFixed(3)}°`,
            ra: numRa,
            dec: numDec,
            dateStart: mjdToIsoString(tMinMjd),
            dateEnd: mjdToIsoString(tMaxMjd),
            mjd: tMinMjd ?? undefined,
            exposureSec,
            instrument: 'SPHEREx LVF',
            band,
            detectorsActive,
            dataProductLevel: 'Level 2 (Calibrated Images)',
            irsaArchiveId: planeId,
            accessUrl,
            cutoutUrl,
            accessFormat: 'application/fits',
            status: 'Completed',
            dataStatus: 'REAL ARCHIVE DATA',
            isSimulatedOrDemo: false,
            coverageOverlapCount: 1,
            sciencePillar: 'Galaxy Formation',
            productStages: {
              archiveRecordExists: true,
              imageProductAvailable: Boolean(accessUrl),
              cutoutAvailable: Boolean(cutoutUrl),
              releaseTag,
            },
          });
        }
      }
    }

    // Fallback/Complement: if artifact query returned 0 rows (or timed out/errored), try spherex.obscore and SIA2
    let obscoreRes: IrsaTapResponse | null = null;
    if (observationsMap.size === 0) {
      queriedTable = 'spherex.obscore + IRSA SIA2';
      const obscoreAdql = `SELECT TOP ${limit} obs_id, target_name, s_ra, s_dec, energy_bandpassname, em_min, em_max, t_min, t_max, t_exptime, access_url, access_format, dataproduct_type, calib_level, obs_title, obs_collection, facility_name, instrument_name FROM spherex.obscore WHERE 1 = CONTAINS(POINT('ICRS', s_ra, s_dec), CIRCLE('ICRS', ${numRa.toFixed(5)}, ${numDec.toFixed(5)}, ${radiusDeg.toFixed(4)})) ORDER BY t_min ASC`;
      obscoreRes = await queryIrsaTap(obscoreAdql, 14000);

      if (obscoreRes.statusCode === 200 && obscoreRes.data) {
        const rows = obscoreRes.data?.VOTABLE?.RESOURCE_ARRAY?.[0]?.TABLE?.DATA?.TABLEDATA || [];
        for (const r of rows) {
          const obsId = String(r[0]);
          const targetRegion = r[1] ? String(r[1]) : r[14] ? String(r[14]) : 'SPHEREx Observation';
          const sRa = Number(r[2]);
          const sDec = Number(r[3]);
          const band = r[4] ? String(r[4]) : 'SPHEREx LVF';
          const emMin = r[5] ? Number(r[5]) : null;
          const emMax = r[6] ? Number(r[6]) : null;
          const tMinMjd = r[7] ? Number(r[7]) : null;
          const tMaxMjd = r[8] ? Number(r[8]) : null;
          const exposureSec = r[9] ? Number(r[9]) : 0;
          const rawUrl = r[10] ? String(r[10]) : undefined;
          const accessFormat = r[11] ? String(r[11]) : 'application/fits';
          const calibLevel = r[13];
          const collection = r[15] ? String(r[15]) : '';

          const releaseTag = inferReleaseTag(`${collection} ${rawUrl || ''}`);
          const { accessUrl, cutoutUrl } = buildIrsaCutoutUrl(rawUrl, numRa, numDec, cutoutSizeDeg);

          let dataProductLevel = 'Level 2 (Calibrated Images)';
          if (calibLevel === 3) dataProductLevel = 'Level 3 (Spectral Cubes)';
          if (calibLevel === 1) dataProductLevel = 'Level 1A (Raw)';

          const key = cutoutUrl || accessUrl || obsId;
          if (!observationsMap.has(key)) {
            observationsMap.set(key, {
              id: obsId,
              surveyPass: releaseTag === 'DR1' ? 'Data Release 1 (DR1)' : 'Quick Release',
              targetRegion,
              ra: Number.isFinite(sRa) ? sRa : numRa,
              dec: Number.isFinite(sDec) ? sDec : numDec,
              dateStart: mjdToIsoString(tMinMjd),
              dateEnd: mjdToIsoString(tMaxMjd),
              mjd: tMinMjd ?? undefined,
              exposureSec,
              instrument: r[17] ? String(r[17]) : 'SPHEREx LVF',
              band,
              detectorsActive: parseDetectorFromBandpass(band),
              wavelengthRangeUm:
                emMin !== null && emMax !== null && Number.isFinite(emMin) && Number.isFinite(emMax)
                  ? [Number((emMin * 1e6).toFixed(3)), Number((emMax * 1e6).toFixed(3))]
                  : undefined,
              dataProductLevel,
              irsaArchiveId: obsId,
              accessUrl,
              cutoutUrl,
              accessFormat,
              status: 'Completed',
              dataStatus: 'REAL ARCHIVE DATA',
              isSimulatedOrDemo: false,
              coverageOverlapCount: 1,
              productStages: {
                archiveRecordExists: true,
                imageProductAvailable: Boolean(accessUrl),
                cutoutAvailable: Boolean(cutoutUrl),
                releaseTag,
              },
            });
          }
        }
      }

      // If TAP returned nothing, probe official IRSA SIA2 collections (spherex_qr3 / spherex_qr2)
      if (observationsMap.size === 0) {
        const siaRes = await queryIrsaSia2('spherex_qr3', numRa, numDec, radiusDeg, 8000);
        const siaRows = siaRes.rows.length > 0 ? siaRes.rows : (await queryIrsaSia2('spherex_qr2', numRa, numDec, radiusDeg, 8000)).rows;
        for (const r of siaRows) {
          const releaseTag = inferReleaseTag(`${r.collection} ${r.accessUrl || ''}`);
          const { accessUrl, cutoutUrl } = buildIrsaCutoutUrl(r.accessUrl, numRa, numDec, cutoutSizeDeg);
          const key = cutoutUrl || accessUrl || r.obsId;
          if (!observationsMap.has(key)) {
            observationsMap.set(key, {
              id: r.obsId,
              surveyPass: releaseTag === 'DR1' ? 'Data Release 1 (DR1)' : 'Quick Release',
              targetRegion: r.targetName || `SIA2 ${r.collection}`,
              ra: r.ra ?? numRa,
              dec: r.dec ?? numDec,
              dateStart: mjdToIsoString(r.tMinMjd),
              dateEnd: mjdToIsoString(r.tMaxMjd),
              mjd: r.tMinMjd ?? undefined,
              exposureSec: r.exposureSec,
              instrument: 'SPHEREx LVF',
              band: r.band,
              detectorsActive: parseDetectorFromBandpass(r.band),
              wavelengthRangeUm:
                r.emMin !== null && r.emMax !== null
                  ? [Number((r.emMin * 1e6).toFixed(3)), Number((r.emMax * 1e6).toFixed(3))]
                  : undefined,
              dataProductLevel: 'Level 2 (Calibrated Images)',
              irsaArchiveId: r.obsId,
              accessUrl,
              cutoutUrl,
              accessFormat: r.accessFormat,
              status: 'Completed',
              dataStatus: 'REAL ARCHIVE DATA',
              isSimulatedOrDemo: false,
              coverageOverlapCount: 1,
              productStages: {
                archiveRecordExists: true,
                imageProductAvailable: Boolean(accessUrl),
                cutoutAvailable: Boolean(cutoutUrl),
                releaseTag,
              },
            });
          }
        }
      }
    }

    const queryTimeMs = Date.now() - startTime;

    if (observationsMap.size === 0 && artifactRes.isTimeout && (!obscoreRes || obscoreRes.isTimeout)) {
      return res.status(504).json({
        spherexAvailable: false,
        dataStatus: 'UNAVAILABLE DATA',
        count: 0,
        observations: [],
        error: `Archive query to NASA/IPAC IRSA TAP timed out.`,
        archiveTimeout: true,
        ra: numRa,
        dec: numDec,
        radiusDeg,
        notice: 'The upstream NASA/IPAC IRSA TAP server did not respond within the allocated timeout window.',
        archiveService: {
          endpoint: 'https://irsa.ipac.caltech.edu/TAP/sync',
          table: queriedTable,
          timeoutMs: tapTimeoutMs,
        },
      });
    }

    let realObservations = Array.from(observationsMap.values());

    if (releaseFilter !== 'all') {
      const filtered = realObservations.filter(
        (obs) => String(obs.productStages?.releaseTag || '').toLowerCase() === releaseFilter
      );
      if (filtered.length > 0) {
        realObservations = filtered;
      }
    }

    // Prefer DR1 > QR3 > QR2, then chronological dateStart ascending
    realObservations.sort((a, b) => {
      const prioDiff =
        releasePriority(b.productStages?.releaseTag || '') - releasePriority(a.productStages?.releaseTag || '');
      if (prioDiff !== 0) return prioDiff;
      const tA = a.dateStart ? Date.parse(a.dateStart) : 0;
      const tB = b.dateStart ? Date.parse(b.dateStart) : 0;
      return tA - tB;
    });

    if (realObservations.length > 0) {
      return res.status(200).json({
        spherexAvailable: true,
        dataStatus: 'REAL ARCHIVE DATA',
        count: realObservations.length,
        observations: realObservations,
        source: `NASA/IPAC IRSA SPHEREx Archive (${queriedTable})`,
        ra: numRa,
        dec: numDec,
        radiusDeg,
        notice: `Retrieved ${realObservations.length} genuine SPHEREx archive products (preferring DR1/QR3 over QR2) with direct MEF cutout readiness.`,
        archiveService: {
          endpoint: 'https://irsa.ipac.caltech.edu/TAP/sync',
          table: queriedTable,
          queryStatus: 'OK',
          queryTimeMs,
        },
      });
    }

    if (artifactRes.statusCode !== 200 && obscoreRes && obscoreRes.statusCode !== 200) {
      return res.status(artifactRes.statusCode || 502).json({
        spherexAvailable: false,
        dataStatus: 'UNAVAILABLE DATA',
        count: 0,
        observations: [],
        error: `NASA/IPAC IRSA TAP query failed: ${artifactRes.error || obscoreRes.error}`,
        queryTimeMs,
        archiveService: {
          endpoint: 'https://irsa.ipac.caltech.edu/TAP/sync',
          table: queriedTable,
        },
      });
    }

    return res.status(200).json({
      spherexAvailable: false,
      dataStatus: 'UNAVAILABLE DATA',
      count: 0,
      observations: [],
      source: 'NASA/IPAC IRSA SPHEREx Archive',
      ra: numRa,
      dec: numDec,
      radiusDeg,
      notice: `No public SPHEREx observations cover coordinates RA: ${numRa.toFixed(4)}°, Dec: ${numDec.toFixed(4)}° (search radius ${radiusDeg.toFixed(3)}°). Public releases currently index designated calibration zones and rolling survey strips.`,
      archiveService: {
        endpoint: 'https://irsa.ipac.caltech.edu/TAP/sync',
        table: queriedTable,
        queryStatus: 'EMPTY_RESULT',
        queryTimeMs,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Archive query failed due to an unexpected internal error.',
      dataStatus: 'UNAVAILABLE DATA',
      details: err?.message,
    });
  }
}

export function isAllowedFitsHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'irsa.ipac.caltech.edu' ||
    host.endsWith('.ipac.caltech.edu') ||
    /^nasa-irsa-spherex(\.s3(\.[a-z0-9-]+)?)?\.amazonaws\.com$/.test(host) ||
    /^irsa-spherex[a-z0-9-]*\.s3(\.[a-z0-9-]+)?\.amazonaws\.com$/.test(host)
  );
}

export function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export function extractFitsUrlFromDataLink(xmlText: string): string | null {
  const tdMatches = xmlText.match(/<(?:[a-zA-Z0-9_-]+:)?TD[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?TD>/gi);
  if (!tdMatches) return null;
  const urls = tdMatches
    .map((m) => decodeXmlEntities(m.replace(/<\/?(?:[a-zA-Z0-9_-]+:)?TD[^>]*>/gi, '').trim()))
    .filter((u) => u.startsWith('https://'));

  const directFits = urls.find((u) => /\.fits(\.gz)?(\?|$)/i.test(u));
  if (directFits) return directFits;

  const nonDataLink = urls.find((u) => !u.includes('/datalink/'));
  return nonDataLink || null;
}

function getMaxFitsBytes(): number {
  // Vercel Serverless Functions enforce a 4.5 MB synchronous response payload ceiling
  if (process.env.VERCEL === '1') {
    return Math.floor(4.2 * 1024 * 1024);
  }
  return 100 * 1024 * 1024;
}

export function fetchFitsWithRedirects(
  targetUrl: string,
  redirectsLeft = 5,
  timeoutMs = 15000,
  maxBytes = getMaxFitsBytes()
): Promise<{ statusCode: number; contentType: string; buffer?: Buffer; error?: string; isTimeout?: boolean; resolvedUrl?: string }> {
  return new Promise((resolve) => {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return resolve({ statusCode: 400, contentType: '', error: 'Invalid product URL.' });
    }

    if (parsedUrl.protocol !== 'https:') {
      return resolve({ statusCode: 400, contentType: '', error: 'Only HTTPS product URLs are permitted.' });
    }

    if (!isAllowedFitsHost(parsedUrl.hostname)) {
      return resolve({
        statusCode: 403,
        contentType: '',
        error: `Host "${parsedUrl.hostname.toLowerCase()}" is not an authorized NASA/IPAC IRSA or AWS Open Data mirror.`,
      });
    }

    const req = https.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'SPHEREx-ATLAS/1.0 (NASA/IPAC FITS Client)',
          Accept: 'application/fits, application/octet-stream, */*',
        },
        timeout: timeoutMs,
      },
      (res) => {
        const status = res.statusCode || 502;

        if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
          res.resume();
          if (redirectsLeft <= 0) {
            return resolve({ statusCode: 502, contentType: '', error: 'Too many redirects while retrieving FITS product.' });
          }
          const nextUrl = new URL(res.headers.location, targetUrl).toString();
          return fetchFitsWithRedirects(nextUrl, redirectsLeft - 1, timeoutMs, maxBytes).then(resolve);
        }

        const contentType = String(res.headers['content-type'] || '');
        const contentLength = Number(res.headers['content-length'] || 0);
        const limitMb = (maxBytes / (1024 * 1024)).toFixed(1);

        if (contentLength > maxBytes) {
          res.destroy();
          return resolve({
            statusCode: 413,
            contentType,
            resolvedUrl: targetUrl,
            error: `FITS product size (${(contentLength / (1024 * 1024)).toFixed(1)} MB) exceeds serverless proxy limit of ${limitMb} MB. Download directly from the NASA/IPAC IRSA link or request a smaller cutout (?size=0.04).`,
          });
        }

        if (status < 200 || status >= 300) {
          res.resume();
          return resolve({
            statusCode: status,
            contentType,
            error: `Upstream archive returned HTTP ${status} for FITS product.`,
          });
        }

        const chunks: Buffer[] = [];
        let totalBytes = 0;

        res.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes > maxBytes) {
            res.destroy();
            resolve({
              statusCode: 413,
              contentType,
              resolvedUrl: targetUrl,
              error: `FITS product stream exceeded ${limitMb} MB proxy limit.`,
            });
            return;
          }
          chunks.push(chunk);
        });

        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({ statusCode: status, contentType, buffer, resolvedUrl: targetUrl });
        });

        res.on('error', (err) => {
          resolve({ statusCode: 502, contentType, error: `Stream error: ${err.message}` });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ statusCode: 504, contentType: '', error: `FITS download timed out after ${timeoutMs}ms.`, isTimeout: true });
    });

    req.on('error', (err) => {
      resolve({ statusCode: 502, contentType: '', error: `Failed to connect to FITS product host: ${err.message}` });
    });

    req.end();
  });
}

function applyCutoutParamsIfNeeded(urlStr: string, raParam: string, decParam: string, sizeParam: string): string {
  try {
    const parsed = new URL(urlStr);
    if (!parsed.hostname.toLowerCase().includes('irsa.ipac.caltech.edu') || !parsed.pathname.includes('/ibe/data/')) {
      return urlStr;
    }

    const requestedSize = sizeParam ? Number(sizeParam) : 0.04;
    let safeSize = Number.isFinite(requestedSize) && requestedSize > 0 ? requestedSize : 0.04;
    if (process.env.VERCEL === '1') {
      safeSize = Math.min(safeSize, 0.042);
    } else {
      safeSize = Math.min(safeSize, 0.15);
    }

    if (parsed.searchParams.has('center')) {
      const existingSize = Number(parsed.searchParams.get('size'));
      if (process.env.VERCEL === '1' && (!Number.isFinite(existingSize) || existingSize > 0.042)) {
        parsed.searchParams.set('size', safeSize.toFixed(4));
      }
      return parsed.toString();
    }

    const ra = Number(raParam);
    const dec = Number(decParam);
    if (raParam && decParam && Number.isFinite(ra) && Number.isFinite(dec)) {
      return `${parsed.origin}${parsed.pathname}?center=${ra.toFixed(5)},${dec.toFixed(5)}d&size=${safeSize.toFixed(4)}`;
    }
    return urlStr;
  } catch {
    return urlStr;
  }
}

export async function fitsProxyHandler(req: ApiRequest, res: ApiResponse) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const rawProductUrl = getQueryParam(req, 'url').trim();
  if (!rawProductUrl) {
    return res.status(400).json({
      error: 'Query parameter "url" is required.',
      dataStatus: 'UNAVAILABLE DATA',
    });
  }

  const raParam = getQueryParam(req, 'ra').trim();
  const decParam = getQueryParam(req, 'dec').trim();
  const sizeParam = getQueryParam(req, 'size').trim();

  const effectiveUrl = applyCutoutParamsIfNeeded(rawProductUrl, raParam, decParam, sizeParam);
  let result = await fetchFitsWithRedirects(effectiveUrl, 5, 18000);

  if (result.error || !result.buffer) {
    return res.status(result.statusCode || 502).json({
      error: result.error || 'Failed to retrieve FITS product.',
      dataStatus: 'UNAVAILABLE DATA',
      isTimeout: result.isTimeout || false,
      directArchiveUrl: result.resolvedUrl || effectiveUrl,
    });
  }

  const prefixText = result.buffer.subarray(0, 512).toString('utf8');
  if (prefixText.includes('<VOTABLE') || result.contentType.includes('votable') || result.contentType.includes('xml')) {
    const fullXml = result.buffer.toString('utf8');
    const resolvedFitsUrl = extractFitsUrlFromDataLink(fullXml);
    if (!resolvedFitsUrl) {
      return res.status(422).json({
        error: 'DataLink descriptor did not contain a downloadable HTTPS FITS product URL.',
        dataStatus: 'UNAVAILABLE DATA',
      });
    }
    const finalResolvedUrl = applyCutoutParamsIfNeeded(resolvedFitsUrl, raParam, decParam, sizeParam);
    result = await fetchFitsWithRedirects(finalResolvedUrl, 5, 22000);
    if (result.error || !result.buffer) {
      return res.status(result.statusCode || 502).json({
        error: result.error || 'Failed to retrieve resolved FITS product.',
        dataStatus: 'UNAVAILABLE DATA',
        isTimeout: result.isTimeout || false,
        directArchiveUrl: result.resolvedUrl || finalResolvedUrl,
      });
    }
  }

  // Decompress .fits.gz transparently if gzip magic header (0x1f 0x8b) is encountered
  let fitsBuffer = result.buffer;
  if (fitsBuffer.length >= 2 && fitsBuffer[0] === 0x1f && fitsBuffer[1] === 0x8b) {
    try {
      fitsBuffer = zlib.gunzipSync(fitsBuffer);
      if (process.env.VERCEL === '1' && fitsBuffer.length > getMaxFitsBytes()) {
        return res.status(413).json({
          error: `Decompressed FITS cutout (${(fitsBuffer.length / (1024 * 1024)).toFixed(1)} MB) exceeds serverless limit. Request a smaller cutout size.`,
          dataStatus: 'UNAVAILABLE DATA',
          directArchiveUrl: result.resolvedUrl || effectiveUrl,
        });
      }
    } catch (err: any) {
      return res.status(422).json({
        error: `Failed to gunzip compressed FITS stream: ${err?.message || 'corrupt archive'}`,
        dataStatus: 'UNAVAILABLE DATA',
      });
    }
  }

  if (fitsBuffer.length < 2880) {
    return res.status(422).json({
      error: `Retrieved resource (${fitsBuffer.length} bytes, Content-Type: ${result.contentType || 'unknown'}) is smaller than a valid 2880-byte FITS block.`,
      dataStatus: 'UNAVAILABLE DATA',
    });
  }

  const headerPrefix = fitsBuffer.subarray(0, 80).toString('ascii');
  if (!headerPrefix.startsWith('SIMPLE  =')) {
    return res.status(422).json({
      error: `Retrieved resource (Content-Type: ${result.contentType || 'unknown'}) does not begin with a valid FITS "SIMPLE  =" header.`,
      dataStatus: 'UNAVAILABLE DATA',
    });
  }

  res.setHeader('Content-Type', 'application/fits');
  res.setHeader('X-Data-Provenance', 'REAL ARCHIVE DATA');
  return res.status(200).send(fitsBuffer);
}

export function benchmarkSimulationHandler(req: ApiRequest, res: ApiResponse) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const targetKey = (getQueryParam(req, 'target') || 'barnard').toLowerCase();

  const BENCHMARKS: Record<string, any> = {
    barnard: {
      target: "Barnard's Star Benchmark",
      ra: 269.4521,
      dec: 4.6934,
      motionType: 'Proper Motion (10.3"/yr)',
      epochs: [
        {
          id: 'SIM-BARNARD-EP1',
          epochLabel: 'Benchmark Epoch 2020.5',
          date: '2020-06-15',
          displacementArcsec: 0.0,
          fitsKey: 'barnard_star_epoch1',
        },
        {
          id: 'SIM-BARNARD-EP2',
          epochLabel: 'Benchmark Epoch 2024.5',
          date: '2024-06-15',
          displacementArcsec: 41.4,
          fitsKey: 'barnard_star_epoch2',
        },
      ],
    },
    wise0855: {
      target: 'WISE J0855-0714 Benchmark',
      ra: 133.7951,
      dec: -7.2452,
      motionType: 'Sub-Brown Dwarf Proper Motion (8.2"/yr)',
      epochs: [
        {
          id: 'SIM-WISE0855-EP1',
          epochLabel: 'Benchmark Epoch 2021.2',
          date: '2021-03-20',
          displacementArcsec: 0.0,
          fitsKey: 'wise0855_epoch1',
        },
        {
          id: 'SIM-WISE0855-EP2',
          epochLabel: 'Benchmark Epoch 2024.2',
          date: '2024-03-20',
          displacementArcsec: 24.6,
          fitsKey: 'wise0855_epoch2',
        },
      ],
    },
    r_draconis: {
      target: 'R Draconis Benchmark',
      ra: 248.1675,
      dec: 66.755,
      motionType: 'Mira Pulsation Variability (>8x flux change)',
      epochs: [
        {
          id: 'SIM-RDRA-MAX',
          epochLabel: 'Benchmark Maximum Phase',
          date: '2025-05-10',
          fluxMjySr: 820,
          fitsKey: 'r_draconis_max',
        },
        {
          id: 'SIM-RDRA-MIN',
          epochLabel: 'Benchmark Minimum Phase',
          date: '2025-09-12',
          fluxMjySr: 85,
          fitsKey: 'r_draconis_min',
        },
      ],
    },
    rw_aurigae: {
      target: 'RW Aurigae Benchmark',
      ra: 76.9563,
      dec: 30.4014,
      motionType: 'Circumstellar Dust Streamer Occultation',
      epochs: [
        {
          id: 'SIM-RWAUR-BRIGHT',
          epochLabel: 'Benchmark Normal Bright Phase',
          date: '2024-11-01',
          fluxMjySr: 460,
          fitsKey: 'rw_aurigae_bright',
        },
        {
          id: 'SIM-RWAUR-DIM',
          epochLabel: 'Benchmark Dust Occultation Phase',
          date: '2025-01-20',
          fluxMjySr: 120,
          fitsKey: 'rw_aurigae_dim',
        },
      ],
    },
    epsilon_indi: {
      target: 'Epsilon Indi B Benchmark',
      ra: 331.0438,
      dec: -56.7828,
      motionType: 'Binary Brown Dwarf Proper Motion (4.7"/yr)',
      epochs: [
        {
          id: 'SIM-EPSIND-EP1',
          epochLabel: 'Benchmark Epoch 2020.8',
          date: '2020-10-15',
          displacementArcsec: 0.0,
          fitsKey: 'epsilon_indi_epoch1',
        },
        {
          id: 'SIM-EPSIND-EP2',
          epochLabel: 'Benchmark Epoch 2024.8',
          date: '2024-10-15',
          displacementArcsec: 18.8,
          fitsKey: 'epsilon_indi_epoch2',
        },
      ],
    },
  };

  const benchmark = BENCHMARKS[targetKey] || BENCHMARKS.barnard;

  return res.status(200).json({
    ...benchmark,
    dataStatus: 'SIMULATED DEMO DATA',
    isSimulatedOrDemo: true,
    provenance: 'Astrophysical Multi-Epoch Simulation Engine',
    disclaimer:
      'SIMULATED DEMO DATA — NOT REAL SPHEREx OBSERVATIONS. Provided for time-domain and proper-motion algorithmic evaluation.',
  });
}
