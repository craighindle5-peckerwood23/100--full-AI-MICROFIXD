import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const targets = [
  "microfixd/core",
  "microfixd/core/agents",
  "microfixd/core/autonomy",
  "microfixd/core/execution",
  "microfixd/core/federation",
  "microfixd/core/governance",
  "microfixd/core/interpretation",
  "microfixd/core/memory",
  "microfixd/core/voice",
  "microfixd/core/wiring",
  "microfixd/core/crossai",
  "microfixd/core/crossai/providers",
  "microfixd/core/episodes",
  "microfixd/core/metacognition",
  "microfixd/backend/core",
  "microfixd/backend/core/agents",
  "microfixd/backend/core/governance",
  "microfixd/backend/core/memory",
  "microfixd/backend/core/mission",
  "microfixd/backend/core/telemetry",
  "microfixd/backend/routes",
  "microfixd/backend/routes/agents",
  "server/crawl",
  "server/crossai",
  "server/evolution",
  "server/execution",
  "server/github",
  "server/hitl",
  "server/mcp",
  "server/orchestration",
  "server/organs",
  "server/organs/organs",
  "server/playwright",
  "server/sandbox",
  "server/security",
  "server/skin",
  "server/tools",
  "microfyxd/core",
  "microfyxd/core/agents",
  "microfyxd/core/interpretation"
];

for (const directory of targets) {
  const exports = readdirSync(directory)
    .filter((entry) => entry !== "index.ts")
    .filter((entry) => {
      const path = join(directory, entry);
      return (statSync(path).isFile() && entry.endsWith(".ts")) ||
        (statSync(path).isDirectory() && readdirSync(path).some((child) => child === "index.ts" || child.endsWith(".ts")));
    })
    .sort()
    .map((entry) => {
      const moduleName = entry.replace(/\.ts$/, "");
      const exportName = moduleName.replace(/[^a-zA-Z0-9_$]/g, "_");
      return `export * as ${exportName} from "./${moduleName}";`;
    });
  writeFileSync(join(directory, "index.ts"), `${exports.join("\n")}\n`);
}
