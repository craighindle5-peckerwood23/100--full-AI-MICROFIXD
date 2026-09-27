// server.ts
//
// Production entrypoint for Microfyxd OS.
//
// This is the piece that was missing for the Render deployment: the app had a
// Vite *dev* server (via `npm run dev`) but nothing that served the built,
// production assets on the port Render actually assigns. Render (and most
// PaaS hosts) run `npm start` and expect the process to bind to
// `process.env.PORT` — if it doesn't, health checks fail and the service is
// never reachable from the outside, which is exactly what was happening here.
//
// This server:
//   1. Serves the static production build produced by `vite build` (./dist).
//   2. Mounts the existing (previously unused) `/api/agents/dispatch` route.
//   3. Falls back to index.html for any non-API route so client-side routing
//      keeps working.
//   4. Binds to 0.0.0.0:$PORT so Render's router can reach it.

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dispatchRouter from './microfixd/backend/routes/agents/dispatch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// --- API routes ---
app.use('/api/agents', dispatchRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Static production build ---
const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));

// SPA fallback: any non-API GET request returns index.html so client-side
// routing (React) can take over.
app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Microfyxd OS server listening on http://${HOST}:${PORT}`);
});
