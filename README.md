# SPHEREx ATLAS — Explore the Infrared Universe

**SPHEREx ATLAS** is an astronomical research and infrared observatory workspace built for the NASA Space Apps Challenge. It integrates **NASA/IPAC IRSA TAP (`spherex.obscore`)**, **IVOA DataLink**, **CDS Sesame**, an interactive client-side FITS image renderer, and a **Gemini 4 Hydrogen** AI Scientific Research Assistant with strict scientific provenance tracking.

---

## Key Features & Scientific Provenance

Every dataset, image, spectrum, and export in SPHEREx ATLAS carries explicit provenance:
- **`REAL ARCHIVE DATA` / `REAL SPHEREx ARCHIVE DATA`**: Retrieved live from NASA/IPAC IRSA (`spherex.obscore` / IVOA DataLink) and validated (`SIMPLE  =` FITS header).
- **`EXTERNAL CATALOG DATA`**: Resolved from external astronomical catalogs (CDS Sesame / SIMBAD).
- **`SIMULATED DEMO DATA`**: Synthetic FITS buffers and educational 102-band spectral models, strictly isolated from real archive results.
- **`UNAVAILABLE DATA`**: Honest state when no SPHEREx observations exist for a sky region or an upstream service is unreachable.

---

## Architecture (Local Node + Vercel Serverless)

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, HTML5 Canvas FITS engine (`src/services/fitsEngine.ts`), full English/Arabic RTL/LTR support.
- **API Layer (`api/` & `server.ts`)**: Shared backend handlers in `api/_lib/` power both the local Express + Vite development server (`server.ts`, port `3000`) and Vercel Serverless Functions (`api/**/*.ts`):
  - `POST /api/gemini/research-assistant` (`api/gemini/research-assistant.ts`) — Server-side `@google/genai` integration using **`gemini-4-hydrogen`** (`User-Agent: aistudio-build`), multi-turn history, active workspace context grounding, automatic retry/backoff on transient upstream errors, and honest JSON error states (never mock responses).
  - `GET /api/archive/status` (`api/archive/status.ts`) — Live IRSA TAP connectivity & `TAP_SCHEMA.tables` verification.
  - `POST /api/archive/search` (`api/archive/search.ts`) — ADQL spatial cone search (`CONTAINS(POINT('ICRS', s_ra, s_dec), CIRCLE(...))`) against `spherex.obscore`.
  - `GET /api/archive/fits?url=...` (`api/archive/fits.ts`) — SSRF-protected FITS proxy with IVOA DataLink VOTable resolution, HTTPS-only host allowlisting, and `SIMPLE  =` header validation (`4.2 MB` synchronous ceiling on Vercel due to platform payload limits vs `100 MB` on local Node/Express; returns an actionable 413 JSON response with `directArchiveUrl` when exceeded).
  - `GET /api/astronomy/resolve?target=...` (`api/astronomy/resolve.ts`) — CDS Sesame target name resolver.
  - `GET /api/archive/benchmark-simulation` (`api/archive/benchmark-simulation.ts`) — Isolated educational benchmark endpoint.

---

## Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Set `GEMINI_API_KEY` in `.env` (server-side only; never commit `.env` or prefix with `VITE_`).
3. **Start the development server** (runs Express + Vite on port `3000`):
   ```bash
   npm run dev
   ```
4. **Type-check, build, and test**:
   ```bash
   npm run lint
   npm run build
   npm test
   ```

---

## Deploying to Vercel (GitHub → Vercel)

The repository is configured for zero-config Vercel deployment via `vercel.json` and `api/**/*.ts`:
- `vercel.json` builds the Vite SPA into `dist/`, allocates `maxDuration: 30` seconds for all `api/**/*.ts` serverless functions, applies security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`), and rewrites non-API routes to `/index.html`.
- Files inside `api/_lib/` are shared utilities automatically bundled into the serverless functions without being exposed as endpoints.

### Deployment Steps
1. Push your repository to GitHub (confirm `.env` is ignored and no secrets are committed).
2. Open [Vercel](https://vercel.com) → **Add New → Project** and import your GitHub repository.
3. Keep the detected **Vite** framework preset (`Build Command: npm run build`, `Output Directory: dist`).
4. Under **Environment Variables**, add:
   - `GEMINI_API_KEY` = your Google Gemini API key (available to Production, Preview, and Development).
5. Click **Deploy**.
6. Verify after deployment:
   - `GET https://<your-domain>/api/archive/status` returns JSON.
   - `GET https://<your-domain>/api/astronomy/resolve?target=Betelgeuse` returns JSON.
   - `POST https://<your-domain>/api/gemini/research-assistant` answers astronomical and follow-up questions with JSON (`model: "gemini-4-hydrogen"`).

---

## Scientific Limitations

- **2D Spectral-Image Products**: `spherex.obscore` provides 2D spectral-image/cutout FITS products (`2040 × 2040`, `BITPIX = -32`, `RA---TAN-SIP` / `DEC--TAN-SIP` WCS) rather than pre-extracted 1D 102-channel spectral tables. `SpectralStudio` therefore retains its `SIMULATED DEMO DATA` 102-band model.
- **Image Comparison**: `ImageComparison` defaults to `SIMULATED DEMO DATA` pairs and enforces WCS, dimension, filter, and unit compatibility checks before subtraction.
- **Vercel Serverless Payload Cap**: Vercel enforces a ~4.5 MB synchronous serverless response limit; large raw FITS files downloaded via `/api/archive/fits` on Vercel return a `413` JSON payload with the direct NASA/IPAC IRSA URL for native download, whereas running `npm start` on a persistent Node host supports up to `100 MB`.
