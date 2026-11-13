import https from 'https';
import { ApiRequest, ApiResponse, getQueryParam, setCorsHeaders } from './http';
import { mjdToIsoString } from './archiveHandlers';

function parseCsvLines(csvText: string): string[][] {
  const rows: string[][] = [];
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cols.push(current.trim());
    rows.push(cols);
  }
  return rows;
}

function httpsGetWithRedirects(
  targetUrl: string,
  redirectsLeft = 3,
  timeoutMs = 10000
): Promise<{ statusCode: number; text?: string; error?: string; isTimeout?: boolean }> {
  return new Promise((resolve) => {
    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      resolve({ statusCode: 400, error: 'Invalid CADC URL' });
      return;
    }

    const req = https.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: {
          'User-Agent': 'SPHEREx-ATLAS/1.0 (CADC NEOSSat Supplementary Client)',
          Accept: 'text/csv, text/plain, */*',
        },
        timeout: timeoutMs,
      },
      (res) => {
        const status = res.statusCode || 502;
        if ([301, 302, 303, 307, 308].includes(status) && res.headers.location && redirectsLeft > 0) {
          res.resume();
          const nextUrl = new URL(res.headers.location, targetUrl).toString();
          resolve(httpsGetWithRedirects(nextUrl, redirectsLeft - 1, timeoutMs));
          return;
        }

        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if (status >= 200 && status < 300) {
            resolve({ statusCode: status, text: body });
          } else {
            resolve({
              statusCode: status,
              error: `CADC TAP HTTP ${status}: ${body.slice(0, 300)}`,
            });
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ statusCode: 504, error: `CADC TAP timed out after ${timeoutMs}ms`, isTimeout: true });
    });

    req.on('error', (err) => {
      resolve({ statusCode: 502, error: `Connection to CADC TAP failed: ${err.message}` });
    });

    req.end();
  });
}

export function queryCadcTap(
  adql: string,
  timeoutMs = 10000
): Promise<{
  statusCode: number;
  rows?: string[][];
  error?: string;
  isTimeout?: boolean;
}> {
  const url = `https://ws.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/argus/sync?REQUEST=doQuery&LANG=ADQL&FORMAT=csv&QUERY=${encodeURIComponent(
    adql
  )}`;
  return httpsGetWithRedirects(url, 3, timeoutMs).then((res) => {
    if (res.statusCode !== 200 || !res.text) {
      return { statusCode: res.statusCode, error: res.error, isTimeout: res.isTimeout };
    }
    const parsedRows = parseCsvLines(res.text);
    if (parsedRows.length === 0) {
      return { statusCode: 200, rows: [] };
    }
    // Verify expected header vs error VOTABLE
    if (res.text.trim().startsWith('<')) {
      return { statusCode: 502, error: `CADC TAP returned XML/VOTABLE error: ${res.text.slice(0, 240)}` };
    }
    return { statusCode: 200, rows: parsedRows };
  });
}

export async function neossatArchiveHandler(req: ApiRequest, res: ApiResponse) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const target = getQueryParam(req, 'target').trim();
  const raRaw = getQueryParam(req, 'ra');
  const decRaw = getQueryParam(req, 'dec');
  const radiusRaw = getQueryParam(req, 'radiusDeg') || '2.0';

  const hasCoords =
    raRaw !== '' &&
    decRaw !== '' &&
    Number.isFinite(Number(raRaw)) &&
    Number.isFinite(Number(decRaw));

  let adql = `SELECT TOP 20 obs_id, target_name, s_ra, s_dec, t_min, t_exptime, instrument_name, dataproduct_type, access_url FROM ivoa.ObsCore WHERE obs_collection = 'NEOSSAT'`;

  if (hasCoords) {
    const ra = parseFloat(raRaw);
    const dec = parseFloat(decRaw);
    const radius = Math.min(15, Math.max(0.1, parseFloat(radiusRaw) || 2.0));
    if (ra < 0 || ra >= 360 || dec < -90 || dec > 90) {
      return res.status(400).json({
        error: 'Invalid coordinates for NEOSSat query.',
        dataStatus: 'UNAVAILABLE DATA',
        observations: [],
      });
    }
    adql += ` AND 1 = CONTAINS(POINT('ICRS', s_ra, s_dec), CIRCLE('ICRS', ${ra.toFixed(5)}, ${dec.toFixed(
      5
    )}, ${radius.toFixed(3)}))`;
  } else if (target) {
    const safeTarget = target.replace(/[^a-zA-Z0-9_\-\s.]/g, '').toUpperCase();
    if (/^\d{4}$/.test(safeTarget)) {
      adql += ` AND obs_id LIKE '${safeTarget}%'`;
    } else if (safeTarget) {
      adql += ` AND UPPER(target_name) LIKE '%${safeTarget}%'`;
    }
  }

  const startTime = Date.now();
  const tapRes = await queryCadcTap(adql, 10000);
  const queryTimeMs = Date.now() - startTime;

  if (tapRes.statusCode !== 200 || !tapRes.rows) {
    return res.status(tapRes.statusCode || 502).json({
      dataStatus: 'UNAVAILABLE DATA',
      source: 'Canadian Astronomy Data Centre (CADC) TAP — CSA NEOSSat (NOT SPHEREx)',
      observations: [],
      error: tapRes.error || 'CADC TAP service failed to respond.',
      queryTimeMs,
    });
  }

  // First CSV row is column headers: obs_id,target_name,s_ra,s_dec,t_min,t_exptime,instrument_name,dataproduct_type,access_url
  const dataRows = tapRes.rows.length > 1 ? tapRes.rows.slice(1) : [];

  const observations = dataRows
    .map((r) => {
      const obsId = String(r[0] || '');
      const targetName = r[1] ? String(r[1]) : 'NEOSSat Exposure';
      const sRa = r[2] !== undefined && r[2] !== '' ? Number(r[2]) : null;
      const sDec = r[3] !== undefined && r[3] !== '' ? Number(r[3]) : null;
      const mjd = r[4] !== undefined && r[4] !== '' ? Number(r[4]) : null;
      const exp = r[5] !== undefined && r[5] !== '' ? Number(r[5]) : null;
      const inst = r[6] ? String(r[6]) : 'NEOSSat Optical Telescope';
      const dpType = r[7] ? String(r[7]) : 'image';
      const cadcAccess = r[8] ? String(r[8]) : '';

      return {
        obsId,
        targetName,
        ra: sRa !== null && Number.isFinite(sRa) ? Number(sRa.toFixed(4)) : null,
        dec: sDec !== null && Number.isFinite(sDec) ? Number(sDec.toFixed(4)) : null,
        dateStart: mjdToIsoString(mjd),
        exposureSec: exp !== null && Number.isFinite(exp) ? Number(exp.toFixed(1)) : null,
        instrument: inst,
        dataProductType: dpType,
        collection: 'NEOSSAT' as const,
        cadcUrl:
          cadcAccess ||
          `https://ws.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/search/?Observation.collection=NEOSSAT&Observation.obsID=${encodeURIComponent(
            obsId
          )}`,
      };
    })
    .sort((a, b) => (b.dateStart || '').localeCompare(a.dateStart || ''));

  return res.status(200).json({
    dataStatus: observations.length > 0 ? 'EXTERNAL CATALOG DATA' : 'UNAVAILABLE DATA',
    source: 'Canadian Astronomy Data Centre (CADC) — CSA NEOSSat Optical Satellite (NOT SPHEREx)',
    disclaimer:
      'Supplementary moving-object / resident-space-object dataset from the Canadian Space Agency NEOSSat archive. Never use or present these records as NASA SPHEREx observations.',
    count: observations.length,
    observations,
    queryTimeMs,
  });
}
