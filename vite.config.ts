import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { WebSocketServer } from 'ws';
import { app } from './server/index';
import { registerWsClient, unregisterWsClient } from './server/events';

const backendPlugin = (): Plugin => ({
  name: 'microfixd-backend-unified',
  configureServer(server) {
    // 1. Mount complete Express backend routes (/api/*) directly on dev server
    server.middlewares.use(app);

    // 2. Attach WebSocket server natively to Vite dev server HTTP instance (/ws)
    if (server.httpServer) {
      const wss = new WebSocketServer({ noServer: true });

      server.httpServer.on('upgrade', (req, socket, head) => {
        const url = req.url || '';
        if (url === '/ws' || url.startsWith('/ws?')) {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
          });
        }
      });

      wss.on('connection', (ws) => {
        registerWsClient(ws);
        ws.send(JSON.stringify({ type: 'connected', ts: new Date().toISOString() }));

        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
          } catch {
            // ignore
          }
        });

        ws.on('close', () => {
          unregisterWsClient(ws);
        });
      });
    }
  },
});

export default defineConfig(() => {
  const groqKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || '';
  const supabaseUrl = process.env.SUPABASE_URL || 'https://caiiajbxslllrgeexbaw.supabase.co';
  const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_IAqedYdeAhdsX475RhxUMg_EUE2Merq';

  return {
    plugins: [react(), tailwindcss(), backendPlugin()],
    define: {
      'import.meta.env.VITE_GROQ_API_KEY': JSON.stringify(groqKey),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
