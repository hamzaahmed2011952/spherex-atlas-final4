import { GoogleGenAI } from '@google/genai';
import { ApiRequest, ApiResponse, parseRequestBody, setCorsHeaders } from './http';

export const GEMINI_MODEL_ID = 'gemini-4-hydrogen';

export interface HistoryItem {
  role?: string;
  sender?: string;
  text?: string;
}

const PLACEHOLDER_KEY_PATTERNS = [
  /^your[_-]?gemini[_-]?api[_-]?key$/i,
  /^your[_-]?api[_-]?key$/i,
  /^replace[_-]?with/i,
  /^placeholder$/i,
];

export function resolveServerGeminiApiKey(): string {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.API_KEY,
  ];

  for (const raw of candidates) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim().replace(/^["']|["']$/g, '');
    if (!trimmed) continue;
    if (PLACEHOLDER_KEY_PATTERNS.some((re) => re.test(trimmed))) continue;
    return trimmed;
  }

  return '';
}

export function getGeminiClient(): GoogleGenAI | null {
  const geminiApiKey = resolveServerGeminiApiKey();
  if (!geminiApiKey) return null;
  return new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function buildSystemInstruction(context: any): string {
  return `You are the SPHEREx ATLAS Scientific Research Assistant, an expert astrophysicist and infrared observational astronomer specializing in NASA's SPHEREx mission (Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer).

SPHEREx Mission Reference:
- Survey coverage: All-sky near-infrared spectrophotometry across 102 continuous spectral channels spanning 0.75 – 5.00 µm with resolving power R ≈ 35 to 130 across 6 Hawaii-2RG Linear Variable Filter (LVF) focal plane arrays.
- Orbit: Sun-synchronous polar orbit (~700 km altitude), completing 4 all-sky surveys over the nominal mission with >1000x overlap at the North and South Ecliptic Poles (NEP/SEP).
- Three core science pillars:
  1. Cosmic Inflation: Constraining primordial non-Gaussianity (f_NL) via 3D large-scale galaxy clustering across hundreds of millions of galaxies.
  2. Galaxy Evolution & Reionization: Measuring spatial fluctuations in the Extragalactic Background Light (EBL) to probe early stellar populations and cosmic reionization.
  3. Interstellar Ices & Planetary Origins: Quantifying column densities of biogenic ices (H2O at 3.05 µm, CO2 at 4.27 µm, CO at 4.67 µm, CH4 at 3.32 µm, XCN at 4.62 µm) in molecular clouds and protostars.

STRICT EPISTEMIC & ACCURACY RULES:
1. Always answer the user's specific question directly, thoroughly, and concisely. Never ignore or override the user's question.
2. Never fabricate SPHEREx archive detections, observation dates, FITS URLs, or unverified measurements. If real SPHEREx archive data for the active target is absent or unverified in the session context, state that explicitly using [MISSING / UNKNOWN].
3. For scientific and astronomical topics, classify statements clearly using these standardized indicator tags where appropriate:
   - [DIRECT OBSERVATION]: Directly measured catalog values, coordinates, spectral lines, or verified pixel/FITS properties.
   - [DERIVED PARAMETER]: Calculated physical quantities (optical depth, column density, proper motion, effective temperature, redshift).
   - [THEORETICAL MODEL]: Astrophysical interpretations, inflationary models, or stellar evolution theory.
   - [MISSING / UNKNOWN]: Unverified, missing, or unavailable observational coverage.
4. For general knowledge questions unrelated to astronomy, answer accurately and factually without unnecessary refusal.
5. Respond naturally in the same language as the user's message (English or Arabic).
6. Ground context-dependent questions in the active workspace state below when relevant:
${JSON.stringify(context || {}, null, 2)}`;
}

export function buildGeminiContents(
  message: string,
  history?: HistoryItem[]
): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  if (Array.isArray(history)) {
    const recentHistory = history.slice(-20);
    for (const item of recentHistory) {
      if (item && typeof item.text === 'string' && item.text.trim()) {
        const role: 'user' | 'model' =
          item.role === 'assistant' || item.role === 'model' || item.sender === 'assistant'
            ? 'model'
            : 'user';
        const text = item.text.trim();
        // Gemini requires contents to begin with a 'user' turn
        if (contents.length === 0 && role === 'model') {
          continue;
        }
        // Merge consecutive turns of the same role to preserve strict alternation
        const last = contents[contents.length - 1];
        if (last && last.role === role) {
          last.parts.push({ text });
        } else {
          contents.push({
            role,
            parts: [{ text }],
          });
        }
      }
    }
  }

  const cleanMessage = message.trim();
  const last = contents[contents.length - 1];
  if (last && last.role === 'user') {
    last.parts.push({ text: cleanMessage });
  } else {
    contents.push({
      role: 'user',
      parts: [{ text: cleanMessage }],
    });
  }

  return contents;
}

function isTransientError(err: any): boolean {
  const status = Number(err?.status ?? err?.statusCode ?? 0);
  if ([429, 500, 502, 503, 504].includes(status)) return true;
  const msg = String(err?.message || '').toLowerCase();
  return (
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('502') ||
    msg.includes('504') ||
    msg.includes('high demand') ||
    msg.includes('unavailable') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('econnreset') ||
    msg.includes('fetch failed')
  );
}

function isInvalidApiKeyError(err: any): boolean {
  const msg = String(err?.message || '').toLowerCase();
  const status = Number(err?.status ?? err?.statusCode ?? 0);
  return (
    msg.includes('api_key_invalid') ||
    msg.includes('api key not valid') ||
    msg.includes('invalid api key') ||
    msg.includes('permission_denied') ||
    status === 401 ||
    status === 403
  );
}

function getErrorStatusCode(err: any): number {
  if (isInvalidApiKeyError(err)) {
    const status = Number(err?.status ?? err?.statusCode ?? 0);
    return status === 403 ? 403 : 401;
  }
  const status = Number(err?.status ?? err?.statusCode ?? 0);
  if (status >= 400 && status < 600) return status;
  const msg = String(err?.message || '').toLowerCase();
  if (msg.includes('timed out') || msg.includes('timeout')) return 504;
  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('quota')) return 429;
  if (msg.includes('503') || msg.includes('high demand') || msg.includes('unavailable')) return 503;
  return 502;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function geminiStatusHandler(req: ApiRequest, res: ApiResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method && req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed. Use GET.',
      code: 'METHOD_NOT_ALLOWED',
    });
  }

  const configured = Boolean(resolveServerGeminiApiKey());
  return res.status(200).json({
    configured,
    model: GEMINI_MODEL_ID,
  });
}

export async function researchAssistantHandler(req: ApiRequest, res: ApiResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method && req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed. Use POST with JSON body { message, context, history }.',
      code: 'METHOD_NOT_ALLOWED',
    });
  }

  try {
    const body = parseRequestBody(req);
    const { message, context, history } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        error: 'Valid non-empty message is required.',
        code: 'INVALID_INPUT',
      });
    }

    if (message.trim().length > 8000) {
      return res.status(400).json({
        error: 'Message exceeds maximum length of 8,000 characters.',
        code: 'MESSAGE_TOO_LONG',
      });
    }

    const aiClient = getGeminiClient();
    if (!aiClient) {
      return res.status(503).json({
        error: 'Gemini AI service is not configured on the server (GEMINI_API_KEY is missing).',
        code: 'MISSING_API_KEY',
        retryable: false,
      });
    }

    const systemInstruction = buildSystemInstruction(context);
    const contents = buildGeminiContents(message, history);

    const maxAttempts = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const timeoutMs = 24000;
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Gemini request timed out after ${timeoutMs}ms`)), timeoutMs)
        );

        const response = await Promise.race([
          aiClient.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents,
            config: {
              systemInstruction,
            },
          }),
          timeoutPromise,
        ]);

        const reply = (response.text || '').trim();
        if (!reply) {
          throw new Error('Gemini returned an empty response.');
        }

        return res.status(200).json({
          reply,
          model: GEMINI_MODEL_ID,
          isOffline: false,
        });
      } catch (err: any) {
        lastError = err;
        if (attempt < maxAttempts && isTransientError(err)) {
          await sleep(450 * attempt);
          continue;
        }
        break;
      }
    }

    const invalidKey = isInvalidApiKeyError(lastError);
    const statusCode = getErrorStatusCode(lastError);
    const rawMsg = String(lastError?.message || 'Upstream Gemini service error.');
    console.error('Gemini research assistant failure:', rawMsg);

    return res.status(statusCode).json({
      error: invalidKey
        ? 'The configured Gemini API key was rejected or lacks permission. Please verify GEMINI_API_KEY in server secrets.'
        : statusCode === 503
        ? 'Gemini model is temporarily busy due to high upstream demand. Please retry in a moment.'
        : statusCode === 429
        ? 'Gemini API rate limit reached. Please wait briefly and try again.'
        : statusCode === 504
        ? 'Gemini response timed out. Please retry your query.'
        : `Gemini service error: ${rawMsg}`,
      code: invalidKey ? 'INVALID_API_KEY' : 'GEMINI_UPSTREAM_ERROR',
      model: GEMINI_MODEL_ID,
      retryable: invalidKey ? false : isTransientError(lastError),
    });
  } catch (err: any) {
    console.error('Research assistant handler exception:', err);
    return res.status(500).json({
      error: err?.message || 'Internal server error processing research query.',
      code: 'INTERNAL_ERROR',
      retryable: true,
    });
  }
}
