import { createServer } from "mcp";

createServer({
  tools: {
    "microfixd-runtime": {
      health: async () => fetch("/health").then(r => r.json()),
      ready: async () => fetch("/readyz").then(r => r.json()),
      login: async (body) => fetch("/api/login", { method: "POST", body }),
      registry: async () => fetch("/api/registry").then(r => r.json()),
      sandbox: async (body) => fetch("/api/sandbox", { method: "POST", body }),
      deploy: async () => fetch("/api/deploy").then(r => r.json()),
      migrations: async () => fetch("/api/migrations").then(r => r.json())
    }
  }
});
