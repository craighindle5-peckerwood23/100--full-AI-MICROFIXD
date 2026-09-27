import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';
import {agentRegistry} from './microfixd/backend/core/agents/registry';
import {missionEngine} from './microfixd/backend/core/mission/engine';
import {memory} from './microfixd/backend/core/memory/state';
import {telemetry} from './microfixd/backend/core/telemetry/grid';
import {governanceEngine} from './microfixd/backend/core/governance/engine';

const apiPlugin = (): Plugin => ({
  name: 'microfixd-api',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const pathname = (req.url || '').split('?')[0];
      if (
        pathname === '/api/agents/dispatch' ||
        pathname === '/api/agents/dispatch/' ||
        pathname.endsWith('/api/agents/dispatch')
      ) {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const parsed = body ? JSON.parse(body) : {};
              const action = parsed.action;
              if (!action) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({error: "Missing 'action' in request body."})
                );
                return;
              }
              const agent = (agentRegistry as any)[action.toLowerCase()];
              if (!agent) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    error: `No agent found for action '${action}'.`,
                  })
                );
                return;
              }
              const decision = await governanceEngine.evaluateAction(action.toLowerCase(), agent.name || action);

              if (decision.decision === "BLOCK") {
                res.statusCode = 403;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    error: `Blocked by Governance: ${decision.reason}`,
                    decision
                  })
                );
                return;
              }

              if (decision.decision === "PENDING_APPROVAL") {
                res.statusCode = 403;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    error: `Requires Manual Approval: ${decision.reason}`,
                    decision
                  })
                );
                return;
              }

              const result = await agent.execute({
                mission: missionEngine.getCurrentMission(),
                memory,
                telemetry,
              });
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  status: 'ok',
                  agent: agent.name,
                  action,
                  result,
                })
              );
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  error: 'Agent dispatch failed.',
                  details: err?.message || String(err),
                })
              );
            }
          });
          return;
        }
      }
      next();
    });
  },
});

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
