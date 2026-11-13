import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  researchAssistantHandler,
  geminiStatusHandler,
  getGeminiClient,
  buildGeminiContents,
  buildSystemInstruction,
} from './api/_lib/geminiAssistant';
import {
  resolveTargetHandler,
  archiveStatusHandler,
  archiveSearchHandler,
  fitsProxyHandler,
  benchmarkSimulationHandler,
} from './api/_lib/archiveHandlers';
import { gaiaCrossMatchHandler } from './api/_lib/gaiaHandlers';
import { neossatArchiveHandler } from './api/_lib/neossatHandlers';

dotenv.config();
dotenv.config({ path: '.env.local', override: false });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json({ limit: '15mb' }));

// Module 09: AI Scientific Research Assistant endpoints (shared with Vercel api/gemini/*)
app.get('/api/gemini/status', (req: Request, res: Response) =>
  geminiStatusHandler(req as any, res as any)
);

app.post('/api/gemini/research-assistant', (req: Request, res: Response) =>
  researchAssistantHandler(req as any, res as any)
);

// Module 04: Astronomical Target Resolver (CDS Sesame / SIMBAD / NED proxy with calibrated fallback)
app.get('/api/astronomy/resolve', (req: Request, res: Response) =>
  resolveTargetHandler(req as any, res as any)
);

// NASA / IPAC IRSA TAP Archive Status Endpoint
app.get('/api/archive/status', (req: Request, res: Response) =>
  archiveStatusHandler(req as any, res as any)
);

// NASA / IPAC IRSA TAP / SIA2 Archive Query Endpoint
app.post('/api/archive/search', (req: Request, res: Response) =>
  archiveSearchHandler(req as any, res as any)
);

// Safe Backend Proxy for Real FITS Product & IBE MEF Cutout Retrieval from NASA/IPAC IRSA
app.get('/api/archive/fits', (req: Request, res: Response) =>
  fitsProxyHandler(req as any, res as any)
);

// ESA Gaia DR3 Live Astrometric Cross-Match Endpoint
app.all('/api/catalog/gaia-crossmatch', (req: Request, res: Response) =>
  gaiaCrossMatchHandler(req as any, res as any)
);

// CSA NEOSSat / CADC Supplementary Moving-Object Optical Archive Endpoint (NOT SPHEREx)
app.all('/api/archive/neossat', (req: Request, res: Response) =>
  neossatArchiveHandler(req as any, res as any)
);

// Dedicated Benchmark Simulation Endpoint (Completely isolated from real archive search)
app.get('/api/archive/benchmark-simulation', (req: Request, res: Response) =>
  benchmarkSimulationHandler(req as any, res as any)
);

// Development Vite Middleware setup or static production serving
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`SPHEREx ATLAS server running at http://localhost:${port}`);
  });
}

const isMainModule =
  process.argv[1] && (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'));

if (isMainModule && process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('Failed to start SPHEREx ATLAS server:', err);
    process.exit(1);
  });
}

export { app, getGeminiClient, buildGeminiContents, buildSystemInstruction };
