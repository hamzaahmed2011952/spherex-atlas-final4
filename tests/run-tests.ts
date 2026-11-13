process.env.NODE_ENV = 'test';
import assert from 'node:assert';
import http from 'node:http';
import {
  createSyntheticFitsBuffer,
  createMultiExtensionTestBuffer,
  parseFitsBuffer,
  computeImageDifference,
  pixelToWorldWcs,
  worldToPixelWcs,
  alignHduToReferenceWcs,
} from '../src/services/fitsEngine';
import {
  mjdToIsoString,
  decodeXmlEntities,
  extractFitsUrlFromDataLink,
  isAllowedFitsHost,
  parseSia2Json,
  resolveTargetHandler,
  archiveSearchHandler,
  fitsProxyHandler,
  benchmarkSimulationHandler,
} from '../api/_lib/archiveHandlers';
import {
  propagateGaiaPosition,
  angularSeparationArcsec,
  gaiaCrossMatchHandler,
} from '../api/_lib/gaiaHandlers';
import { neossatArchiveHandler } from '../api/_lib/neossatHandlers';
import {
  GEMINI_MODEL_ID,
  resolveServerGeminiApiKey,
  buildSystemInstruction,
  buildGeminiContents,
  geminiStatusHandler,
  researchAssistantHandler,
} from '../api/_lib/geminiAssistant';
import { ApiRequest, ApiResponse } from '../api/_lib/http';
import { app } from '../server';

interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  ended: boolean;
  apiRes: ApiResponse;
}

function createMockRes(): MockResponse {
  const state: MockResponse = {
    statusCode: 200,
    headers: {},
    body: undefined,
    ended: false,
    apiRes: null as any,
  };
  const apiRes: ApiResponse = {
    status(code: number) {
      state.statusCode = code;
      return apiRes;
    },
    json(data: any) {
      state.body = data;
      state.ended = true;
      return apiRes;
    },
    send(data: any) {
      state.body = data;
      state.ended = true;
      return apiRes;
    },
    setHeader(name: string, value: string | number | readonly string[]) {
      state.headers[name.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value);
      return apiRes;
    },
    end() {
      state.ended = true;
      return apiRes;
    },
  };
  state.apiRes = apiRes;
  return state;
}

async function runUnitTests() {
  console.log('1. Running Data Integrity & Shared Archive Helper unit tests...');

  // A. MJD conversion must return null for missing or invalid values
  assert.strictEqual(mjdToIsoString(null), null, 'null MJD must return null');
  assert.strictEqual(mjdToIsoString(undefined), null, 'undefined MJD must return null');
  assert.strictEqual(mjdToIsoString(NaN), null, 'NaN MJD must return null');
  assert.strictEqual(mjdToIsoString(Infinity), null, 'Infinity MJD must return null');
  assert.strictEqual(
    mjdToIsoString(59000),
    new Date((59000 - 40587) * 86400 * 1000).toISOString(),
    'Valid MJD must return valid ISO 8601 string'
  );

  // B. DataLink XML entity decoding and direct FITS selection
  assert.strictEqual(decodeXmlEntities('a&amp;b&lt;c&gt;'), 'a&b<c>');
  const mockVotable = `
    <VOTABLE version="1.3">
      <RESOURCE>
        <TABLE>
          <DATA>
            <TABLEDATA>
              <TR><TD>https://irsa.ipac.caltech.edu/datalink/links/spherex?ID=ivo</TD></TR>
              <TR><TD>https://irsa.ipac.caltech.edu/ibe/data/spherex/qr2/file.fits?cutout=true&amp;ra=269.45</TD></TR>
            </TABLEDATA>
          </DATA>
        </TABLE>
      </RESOURCE>
    </VOTABLE>
  `;
  const extractedUrl = extractFitsUrlFromDataLink(mockVotable);
  assert.strictEqual(
    extractedUrl,
    'https://irsa.ipac.caltech.edu/ibe/data/spherex/qr2/file.fits?cutout=true&ra=269.45',
    'DataLink extractor must unescape XML entities and choose direct .fits URL'
  );

  // C. IRSA SIA2 VOTABLE JSON parsing (TR_ARRAY / TD_ARRAY + FIELD_ARRAY)
  const mockSiaJson = {
    VOTABLE: {
      RESOURCE_ARRAY: [
        {
          TABLE: {
            FIELD_ARRAY: [
              { name: 'obs_id' },
              { name: 'obs_collection' },
              { name: 's_ra' },
              { name: 's_dec' },
              { name: 'energy_bandpassname' },
              { name: 't_min' },
              { name: 't_exptime' },
              { name: 'access_url' },
            ],
            DATA: {
              TABLEDATA: {
                TR_ARRAY: [
                  {
                    TD_ARRAY: [
                      'spherex-qr3-101',
                      'spherex_qr3',
                      '270.0',
                      '66.5607',
                      'D1 (0.75-1.11 um)',
                      '60800.25',
                      '112.5',
                      'https://irsa.ipac.caltech.edu/ibe/data/spherex/qr3/sample.fits',
                    ],
                  },
                ],
              },
            },
          },
        },
      ],
    },
  };
  const siaRows = parseSia2Json(mockSiaJson);
  assert.strictEqual(siaRows.length, 1);
  assert.strictEqual(siaRows[0].obsId, 'spherex-qr3-101');
  assert.strictEqual(siaRows[0].ra, 270.0);
  assert.strictEqual(siaRows[0].band, 'D1 (0.75-1.11 um)');
  assert(siaRows[0].accessUrl?.endsWith('sample.fits'));

  // D. SSRF Host Allowlist checks
  assert.strictEqual(isAllowedFitsHost('irsa.ipac.caltech.edu'), true);
  assert.strictEqual(isAllowedFitsHost('sub.ipac.caltech.edu'), true);
  assert.strictEqual(isAllowedFitsHost('nasa-irsa-spherex.s3.us-west-2.amazonaws.com'), true);
  assert.strictEqual(isAllowedFitsHost('example.com'), false);
  assert.strictEqual(isAllowedFitsHost('127.0.0.1'), false);
  assert.strictEqual(isAllowedFitsHost('169.254.169.254'), false);

  console.log('   Data Integrity & Shared Archive Helper unit tests: PASS');

  console.log('2. Running MEF FITS, -TAN WCS Alignment & Candidate Extraction unit tests...');
  const bufA = createSyntheticFitsBuffer('barnard_star_epoch1');
  const hduA = parseFitsBuffer(bufA, {
    dataStatus: 'SIMULATED DEMO DATA',
    isSimulatedOrDemo: true,
    provenance: 'Test Fixture',
  });
  assert.strictEqual(hduA.naxis1, 256);
  assert.strictEqual(hduA.naxis2, 256);
  assert.strictEqual(hduA.dataStatus, 'SIMULATED DEMO DATA');

  const bufB = createSyntheticFitsBuffer('barnard_star_epoch2');
  const hduB = parseFitsBuffer(bufB, {
    dataStatus: 'SIMULATED DEMO DATA',
    isSimulatedOrDemo: true,
    provenance: 'Test Fixture',
  });
  const diff = computeImageDifference(hduA, hduB);
  assert.strictEqual(diff.compatibility.isCompatible, true);
  assert(diff.rmsDiff > 0, 'Expected non-zero RMS difference');

  // Incompatible WCS test: missing WCS on hduB must be rejected
  const hduNoWcs = { ...hduB, wcs: undefined };
  assert.throws(() => computeImageDifference(hduA, hduNoWcs), /Incompatible images/i);

  // Truncated FITS test
  assert.throws(
    () => parseFitsBuffer(new ArrayBuffer(100)),
    /smaller than a single 2880-byte FITS block/i
  );

  // Multi-Extension FITS (MEF) 5-HDU parsing & quality extraction
  const mefBufRef = createMultiExtensionTestBuffer(32, 32, 270.0, 66.5607);
  const mefRef = parseFitsBuffer(mefBufRef, {
    dataStatus: 'SIMULATED DEMO DATA',
    isSimulatedOrDemo: true,
    provenance: 'MEF Fixture',
  });
  assert.strictEqual(mefRef.extensions?.length, 5, 'Expected PRIMARY + 4 image extensions');
  assert(mefRef.layerHdus?.['IMAGE'], 'IMAGE HDU layer missing');
  assert(mefRef.layerHdus?.['FLAGS'], 'FLAGS HDU layer missing');
  assert(mefRef.layerHdus?.['VARIANCE'], 'VARIANCE HDU layer missing');
  assert(mefRef.layerHdus?.['ZODI'], 'ZODI HDU layer missing');
  assert.strictEqual(mefRef.qualitySummary?.hasFlagsHdu, true);
  assert.strictEqual(mefRef.qualitySummary?.flaggedPixelsCount, 4);
  assert.strictEqual(mefRef.qualitySummary?.medianNoiseSigma, 2);
  assert.strictEqual(mefRef.qualitySummary?.medianSnr, 5);
  assert.strictEqual(mefRef.qualitySummary?.peakSnr, 60);

  // -TAN Gnomonic WCS Round-trip Accuracy (with rotation CD matrix)
  const rotAngle = 0.25; // radians
  const pixScale = 0.001722;
  const rotWcs = {
    crpix1: 64.5,
    crpix2: 64.5,
    crval1: 270.0,
    crval2: 66.5607,
    cdelt1: -pixScale,
    cdelt2: pixScale,
    ctype1: 'RA---TAN',
    ctype2: 'DEC--TAN',
    cd1_1: -pixScale * Math.cos(rotAngle),
    cd1_2: pixScale * Math.sin(rotAngle),
    cd2_1: -pixScale * Math.sin(rotAngle),
    cd2_2: -pixScale * Math.cos(rotAngle),
  };
  const testWorld = pixelToWorldWcs(rotWcs, 48.25, 81.75);
  const backPix = worldToPixelWcs(rotWcs, testWorld.ra, testWorld.dec);
  assert(backPix !== null, 'worldToPixelWcs returned null on front hemisphere');
  assert(Math.abs(backPix!.x - 48.25) < 1e-3, 'RA/Dec -> X round-trip drifted');
  assert(Math.abs(backPix!.y - 81.75) < 1e-3, 'RA/Dec -> Y round-trip drifted');

  // Bilinear WCS Alignment & Difference Subtraction across shifted tangent grids
  // Shift crval1 by ~2 pixels (0.0086 deg within NEP 0.055 deg box)
  const mefBufShifted = createMultiExtensionTestBuffer(32, 32, 270.0086, 66.5607);
  const mefShifted = parseFitsBuffer(mefBufShifted, {
    dataStatus: 'SIMULATED DEMO DATA',
    isSimulatedOrDemo: true,
    provenance: 'Shifted MEF Fixture',
  });
  const resampled = alignHduToReferenceWcs(mefShifted, mefRef);
  assert.strictEqual(resampled.naxis1, 32);
  assert.strictEqual(resampled.naxis2, 32);
  // Zero-shift baseline diff against shifted grid (with different star sky position due to CRVAL shift)
  const shiftedDiff = computeImageDifference(mefRef, mefShifted);
  assert.strictEqual(
    shiftedDiff.compatibility.alignmentApplied,
    true,
    'Expected automatic WCS alignment when CRVAL differs'
  );
  assert(shiftedDiff.detections.length > 0, 'Expected candidate detections on shifted star');
  assert.strictEqual(shiftedDiff.detections[0].isCandidateOnly, true);
  assert(shiftedDiff.detections[0].ra !== undefined, 'Expected sky RA on candidate detection');

  // Gaia DR3 J2016.0 Proper Motion Propagation (Barnard's Star ~10.3"/yr -> ~103" over 10 yrs)
  const propBarnard = propagateGaiaPosition(269.454023, 4.668288, -802.8, 10362.5, 2026.0);
  const movedArcsec = angularSeparationArcsec(
    269.454023,
    4.668288,
    propBarnard.ra,
    propBarnard.dec
  );
  assert(
    movedArcsec > 102 && movedArcsec < 105,
    `Expected ~103.9" proper motion displacement for Barnard's Star over 10 yr, got ${movedArcsec.toFixed(2)}"`
  );

  console.log('   MEF FITS, -TAN WCS Alignment & Gaia Propagation tests: PASS');
}

async function runServerlessHandlerTests() {
  console.log('3. Running Vercel Serverless Handler & Security tests...');

  // A. resolveTargetHandler missing param -> 400
  {
    const req: ApiRequest = { method: 'GET', query: {} };
    const mock = createMockRes();
    await resolveTargetHandler(req, mock.apiRes);
    assert.strictEqual(mock.statusCode, 400);
    assert(mock.body?.error, 'Missing target must return JSON error');
  }

  // B. archiveSearchHandler invalid RA/Dec -> 400
  {
    const req: ApiRequest = { method: 'POST', body: { ra: -5, dec: 0, fov: 0.5 } };
    const mock = createMockRes();
    await archiveSearchHandler(req, mock.apiRes);
    assert.strictEqual(mock.statusCode, 400);
    assert.strictEqual(mock.body?.dataStatus, 'UNAVAILABLE DATA');
  }

  // C. fitsProxyHandler validation & SSRF checks
  {
    const reqMissing: ApiRequest = { method: 'GET', query: {} };
    const mMissing = createMockRes();
    await fitsProxyHandler(reqMissing, mMissing.apiRes);
    assert.strictEqual(mMissing.statusCode, 400);

    const reqHttp: ApiRequest = { method: 'GET', query: { url: 'http://127.0.0.1:3000/secret.fits' } };
    const mHttp = createMockRes();
    await fitsProxyHandler(reqHttp, mHttp.apiRes);
    assert.strictEqual(mHttp.statusCode, 400);

    const reqUntrusted: ApiRequest = { method: 'GET', query: { url: 'https://example.com/test.fits' } };
    const mUntrusted = createMockRes();
    await fitsProxyHandler(reqUntrusted, mUntrusted.apiRes);
    assert.strictEqual(mUntrusted.statusCode, 403);
  }

  // D. benchmarkSimulationHandler returns isolated SIMULATED DEMO DATA
  {
    const req: ApiRequest = { method: 'GET', query: { target: 'wise0855' } };
    const mock = createMockRes();
    benchmarkSimulationHandler(req, mock.apiRes);
    assert.strictEqual(mock.statusCode, 200);
    assert.strictEqual(mock.body?.dataStatus, 'SIMULATED DEMO DATA');
    assert.strictEqual(mock.body?.isSimulatedOrDemo, true);
    assert(Array.isArray(mock.body?.epochs) && mock.body.epochs.length === 2);
  }

  // E. gaiaCrossMatchHandler input validation -> 400
  {
    const req: ApiRequest = { method: 'GET', query: { ra: '400', dec: '10' } };
    const mock = createMockRes();
    await gaiaCrossMatchHandler(req, mock.apiRes);
    assert.strictEqual(mock.statusCode, 400);
    assert.strictEqual(mock.body?.dataStatus, 'UNAVAILABLE DATA');
  }

  // F. neossatArchiveHandler input validation -> 400 on out-of-range coords
  {
    const req: ApiRequest = { method: 'GET', query: { ra: '999', dec: '10' } };
    const mock = createMockRes();
    await neossatArchiveHandler(req, mock.apiRes);
    assert.strictEqual(mock.statusCode, 400);
    assert.strictEqual(mock.body?.dataStatus, 'UNAVAILABLE DATA');
  }

  console.log('   Vercel Serverless Handler & Security tests: PASS');
}

async function runGeminiAssistantTests() {
  console.log('4. Running Gemini 4 Hydrogen Assistant & Express Route Integration tests...');

  assert.strictEqual(GEMINI_MODEL_ID, 'gemini-4-hydrogen');

  // A. Context grounding & epistemic instructions
  const sysPrompt = buildSystemInstruction({
    target: { name: "Barnard's Star", spectralType: 'M4Ve', ra: 269.4521, dec: 4.6934 },
    activeFits: { name: 'Barnard_Epoch1', naxis1: 256, naxis2: 256, dataStatus: 'SIMULATED DEMO DATA' },
  });
  assert(sysPrompt.includes('[DIRECT OBSERVATION]'));
  assert(sysPrompt.includes('[DERIVED PARAMETER]'));
  assert(sysPrompt.includes('[THEORETICAL MODEL]'));
  assert(sysPrompt.includes('[MISSING / UNKNOWN]'));
  assert(sysPrompt.includes("Barnard's Star"));

  // B. Multi-turn history mapping, leading model skip & same-role turn merging
  const contents = buildGeminiContents("What is the proper motion of Barnard's Star?", [
    { sender: 'assistant', text: 'Leading model message should be skipped' },
    { sender: 'user', text: 'What type of star is Barnard Star?' },
    { sender: 'assistant', text: 'It is a red dwarf (M4Ve).' },
    { sender: 'user', text: 'Earlier failed user prompt without reply' },
  ]);
  assert.strictEqual(contents.length, 3);
  assert.strictEqual(contents[0].role, 'user');
  assert.strictEqual(contents[1].role, 'model');
  assert.strictEqual(contents[2].role, 'user');
  assert.strictEqual(contents[2].parts.length, 2);
  assert.strictEqual(contents[2].parts[1].text, "What is the proper motion of Barnard's Star?");

  // C. Method & input validation + honest MISSING_API_KEY error + status endpoint (no mock fallback or key leak)
  const originalKey = process.env.GEMINI_API_KEY;
  const originalGoogleKey = process.env.GOOGLE_API_KEY;
  try {
    const getReq: ApiRequest = { method: 'GET', body: {} };
    const getMock = createMockRes();
    await researchAssistantHandler(getReq, getMock.apiRes);
    assert.strictEqual(getMock.statusCode, 405);
    assert.strictEqual(getMock.body?.code, 'METHOD_NOT_ALLOWED');

    const emptyReq: ApiRequest = { method: 'POST', body: { message: '   ' } };
    const emptyMock = createMockRes();
    await researchAssistantHandler(emptyReq, emptyMock.apiRes);
    assert.strictEqual(emptyMock.statusCode, 400);
    assert.strictEqual(emptyMock.body?.code, 'INVALID_INPUT');

    // Placeholder key must be treated as missing
    process.env.GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY';
    delete process.env.GOOGLE_API_KEY;
    assert.strictEqual(resolveServerGeminiApiKey(), '');

    delete process.env.GEMINI_API_KEY;
    const statusMissingMock = createMockRes();
    await geminiStatusHandler({ method: 'GET' }, statusMissingMock.apiRes);
    assert.strictEqual(statusMissingMock.statusCode, 200);
    assert.strictEqual(statusMissingMock.body?.configured, false);
    assert.strictEqual(statusMissingMock.body?.model, GEMINI_MODEL_ID);
    assert(!JSON.stringify(statusMissingMock.body).includes('AIza'));

    const noKeyReq: ApiRequest = { method: 'POST', body: { message: 'What is SPHEREx?' } };
    const noKeyMock = createMockRes();
    await researchAssistantHandler(noKeyReq, noKeyMock.apiRes);
    assert.strictEqual(noKeyMock.statusCode, 503);
    assert.strictEqual(noKeyMock.body?.code, 'MISSING_API_KEY');
    assert.strictEqual(noKeyMock.body?.reply, undefined);
  } finally {
    if (originalKey !== undefined) {
      process.env.GEMINI_API_KEY = originalKey;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
    if (originalGoogleKey !== undefined) {
      process.env.GOOGLE_API_KEY = originalGoogleKey;
    } else {
      delete process.env.GOOGLE_API_KEY;
    }
  }

  // D. Express App integration tests for all routes
  const testServer = http.createServer(app);
  await new Promise<void>((resolve) => testServer.listen(0, '127.0.0.1', resolve));
  const serverAddr = testServer.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${serverAddr.port}`;

  try {
    const statusRes = await fetch(`${baseUrl}/api/gemini/status`);
    assert.strictEqual(statusRes.status, 200);
    const statusJson = await statusRes.json();
    assert.strictEqual(typeof statusJson.configured, 'boolean');
    assert.strictEqual(statusJson.model, GEMINI_MODEL_ID);

    const emptyRes = await fetch(`${baseUrl}/api/gemini/research-assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '' }),
    });
    assert.strictEqual(emptyRes.status, 400);
    assert(emptyRes.headers.get('content-type')?.includes('application/json'));
    const emptyJson = await emptyRes.json();
    assert.strictEqual(emptyJson.code, 'INVALID_INPUT');

    const benchRes = await fetch(`${baseUrl}/api/archive/benchmark-simulation?target=barnard`);
    assert.strictEqual(benchRes.status, 200);
    const benchJson = await benchRes.json();
    assert.strictEqual(benchJson.dataStatus, 'SIMULATED DEMO DATA');
    assert.strictEqual(benchJson.isSimulatedOrDemo, true);

    const ssrfRes = await fetch(
      `${baseUrl}/api/archive/fits?url=${encodeURIComponent('https://example.com/malicious.fits')}`
    );
    assert.strictEqual(ssrfRes.status, 403);

    const gaiaBadRes = await fetch(`${baseUrl}/api/catalog/gaia-crossmatch?ra=-10&dec=5`);
    assert.strictEqual(gaiaBadRes.status, 400);
    const gaiaBadJson = await gaiaBadRes.json();
    assert.strictEqual(gaiaBadJson.dataStatus, 'UNAVAILABLE DATA');

    const neoBadRes = await fetch(`${baseUrl}/api/archive/neossat?ra=500&dec=10`);
    assert.strictEqual(neoBadRes.status, 400);
    const neoBadJson = await neoBadRes.json();
    assert.strictEqual(neoBadJson.dataStatus, 'UNAVAILABLE DATA');
  } finally {
    testServer.close();
  }

  console.log('   Gemini 4 Hydrogen & Express Route Integration tests: PASS');
}

(async () => {
  await runUnitTests();
  await runServerlessHandlerTests();
  await runGeminiAssistantTests();
})().catch((err) => {
  console.error('TEST SUITE FAILED:', err);
  process.exit(1);
});
