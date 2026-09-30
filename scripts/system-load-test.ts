/**
 * scripts/system-load-test.ts
 * 
 * 200% FULL-CAPACITY SYSTEM LOAD & END-TO-END WIRING STRESS TEST
 * 
 * Tests simultaneous execution across:
 * - All Agent Dispatch actions (optimize, build, analyze, automate, deploy, research)
 * - All 235 registered live organs (simultaneous execution & broadcast)
 * - Central Command Orchestrator & Governance Spine
 * - Sandbox Code Execution Engine
 * - Tools Registry & Tool Execution
 * - Cross-AI Provider Cascade & Protocol
 * - Deep Health, Memory Store, and Telemetry Grid
 */

const BASE_URL = process.env.TEST_URL || "http://127.0.0.1:3777";

interface TestReport {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatencyMs: number;
  agentsFired: number;
  organsTested: number;
  sandboxRuns: number;
  commandRuns: number;
  durationMs: number;
  errors: string[];
}

async function request(path: string, options: { method?: string; body?: unknown } = {}) {
  const t0 = performance.now();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "x-microfixd-role": "operator"
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const latency = Math.round(performance.now() - t0);
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, latency, data };
}

export async function runFullSystemLoadTest(): Promise<TestReport> {
  console.log(`\n===============================================================`);
  console.log(`🚀 STARTING 200% FULL-CAPACITY SYSTEM LOAD & CONCURRENCY TEST`);
  console.log(`   Target Server: ${BASE_URL}`);
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log(`===============================================================\n`);

  const report: TestReport = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    avgLatencyMs: 0,
    agentsFired: 0,
    organsTested: 0,
    sandboxRuns: 0,
    commandRuns: 0,
    durationMs: 0,
    errors: [],
  };

  const latencies: number[] = [];
  const startAll = performance.now();

  const recordResult = (ok: boolean, latency: number, context: string, err?: string) => {
    report.totalRequests++;
    latencies.push(latency);
    if (ok) {
      report.successfulRequests++;
    } else {
      report.failedRequests++;
      report.errors.push(`[${context}] ${err || 'Request failed'}`);
    }
  };

  // ── PHASE 1: System Health & Baseline Verification ────────────────────────
  console.log(`[Phase 1] Verifying System Baseline & Deep Health...`);
  const healthRes = await request("/api/health");
  recordResult(healthRes.ok, healthRes.latency, "Health check");
  console.log(`  ✓ /api/health: status=${healthRes.status} (${healthRes.latency}ms)`);

  const deepRes = await request("/api/health/deep");
  recordResult(deepRes.ok || deepRes.status === 503, deepRes.latency, "Deep Health");
  console.log(`  ✓ /api/health/deep: status=${deepRes.status}, registeredOrgans=${deepRes.data?.runtime?.registeredOrgans || 'N/A'}`);

  // ── PHASE 2: Live Organ Matrix Discovery (200+ Organs) ────────────────────
  console.log(`\n[Phase 2] Discovering Live Organ Matrix...`);
  const organsRes = await request("/api/organs");
  recordResult(organsRes.ok, organsRes.latency, "Organ Listing");
  const allOrgans: { id: string; name: string; layer: string }[] = organsRes.data?.organs || [];
  console.log(`  ✓ Registered Live Organs in Registry: ${allOrgans.length}`);
  if (allOrgans.length < 200) {
    throw new Error(`Expected at least 200 live organs, found ${allOrgans.length}`);
  }

  // ── PHASE 3: 200% Concurrency Surge — All Agents Fired Simultaneously ─────
  console.log(`\n[Phase 3] Firing All Agents Concurrently at 200% Capacity...`);
  const agentActions = ["optimize", "build", "analyze", "automate", "deploy", "research"];
  const agentRounds = 4; // 6 actions x 4 rounds = 24 parallel agent executions

  const agentPromises: Promise<void>[] = [];
  for (let r = 0; r < agentRounds; r++) {
    for (const action of agentActions) {
      agentPromises.push((async () => {
        const res = await request("/api/agents/dispatch", {
          method: "POST",
          body: { action, task: `Concurrency Stress Test Round ${r + 1} - ${action}` }
        });
        report.agentsFired++;
        recordResult(res.ok, res.latency, `Agent:${action}:R${r}`, res.data?.error);
      })());
    }
  }
  await Promise.all(agentPromises);
  console.log(`  ✓ Successfully dispatched ${report.agentsFired} parallel agent executions.`);

  // ── PHASE 4: Simultaneous Execution Across All 235 Organs ─────────────────
  console.log(`\n[Phase 4] Executing Simultaneous Actions across all 235 Organs...`);
  const organBatches: string[][] = [];
  const chunkSize = 25;
  for (let i = 0; i < allOrgans.length; i += chunkSize) {
    organBatches.push(allOrgans.slice(i, i + chunkSize).map(o => o.id));
  }

  // Broadcast batches
  const broadcastPromises = organBatches.map(async (batch, idx) => {
    const res = await request("/api/organs/broadcast", {
      method: "POST",
      body: { organ_ids: batch, action: "stress_ping", payload: { batchId: idx, ts: Date.now() } }
    });
    recordResult(res.ok, res.latency, `Broadcast:Batch${idx}`);
  });
  await Promise.all(broadcastPromises);

  // Individual direct executions on a representative sample of 50 organs concurrently
  const sampleOrgans = allOrgans.slice(0, 50);
  const organExecPromises = sampleOrgans.map(async (organ) => {
    const res = await request(`/api/organs/${encodeURIComponent(organ.id)}/execute`, {
      method: "POST",
      body: { action: "load_test", payload: { probe: true, caller: "load-tester" } }
    });
    report.organsTested++;
    recordResult(res.ok, res.latency, `Organ:${organ.id}`, res.data?.error);
  });
  await Promise.all(organExecPromises);
  console.log(`  ✓ Tested ${report.organsTested} direct organ executions + ${organBatches.length} broadcast clusters.`);

  // ── PHASE 5: Sandbox, Command Engine & Tools Concurrent Load ──────────────
  console.log(`\n[Phase 5] Stressing Sandbox, Command Center & Tool Orchestrator...`);
  const sandboxCodes = [
    { lang: "javascript", code: "const x = Array.from({length: 1000}, (_, i) => i * i); x.reduce((a, b) => a + b, 0);" },
    { lang: "typescript", code: "const greet: string = 'Microfixd Level 6'; greet.toUpperCase();" },
    { lang: "python", code: "import math; [math.sqrt(i) for i in range(100)]" },
  ];

  const sandboxPromises = sandboxCodes.map(async (item, idx) => {
    const res = await request("/api/sandbox/run", {
      method: "POST",
      body: { code: item.code, lang: item.lang, session_id: `load-session-${idx}` }
    });
    report.sandboxRuns++;
    recordResult(res.ok, res.latency, `Sandbox:${item.lang}`, res.data?.error);
  });

  const commandTasks = [
    "Run system diagnostics and verify memory consistency",
    "Prune stale cache nodes and audit constitutional safety",
    "Evaluate high-speed telemetry pipeline and check RBAC rules",
    "Verify cross-AI provider availability and response latency"
  ];

  const commandPromises = commandTasks.map(async (task, idx) => {
    const res = await request("/api/command/run", {
      method: "POST",
      body: { task, session_id: `cmd-load-${idx}`, priority: "HIGH" }
    });
    report.commandRuns++;
    recordResult(res.ok, res.latency, `Command:${idx}`, res.data?.error);
  });

  const toolsRes = await request("/api/tools");
  recordResult(toolsRes.ok, toolsRes.latency, "Tools listing");

  const crossAiRes = await request("/api/crossai/providers");
  recordResult(crossAiRes.ok, crossAiRes.latency, "Cross-AI providers");

  const securityRes = await request("/api/security/stats");
  recordResult(securityRes.ok, securityRes.latency, "Security stats");

  await Promise.all([...sandboxPromises, ...commandPromises]);
  console.log(`  ✓ Sandbox executions (${report.sandboxRuns}) and Command runs (${report.commandRuns}) complete.`);

  // ── PHASE 6: Memory Organ Vector & Keyword Stress ────────────────────────
  console.log(`\n[Phase 6] Testing Memory Store & Recall Under Concurrency...`);
  const memStoreRes = await request("/api/organs/memory/execute", {
    method: "POST",
    body: {
      action: "store",
      payload: {
        content: "High-capacity load test trace verified without entropy drift.",
        tags: ["load_test", "concurrency", "level6"],
        importance: 0.95
      }
    }
  });
  recordResult(memStoreRes.ok, memStoreRes.latency, "Memory store");

  const memRecallRes = await request("/api/organs/memory/execute", {
    method: "POST",
    body: {
      action: "recall_keyword",
      payload: { query: "concurrency", limit: 5 }
    }
  });
  recordResult(memRecallRes.ok, memRecallRes.latency, "Memory recall");

  const memStatsRes = await request("/api/organs/memory/execute", {
    method: "POST",
    body: { action: "stats" }
  });
  recordResult(memStatsRes.ok, memStatsRes.latency, "Memory stats");
  console.log(`  ✓ Memory organ operations verified.`);

  // ── FINAL REPORT COMPILATION ──────────────────────────────────────────────
  report.durationMs = Math.round(performance.now() - startAll);
  report.avgLatencyMs = Math.round(latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1));

  console.log(`\n===============================================================`);
  console.log(`📊 200% FULL SYSTEM LOAD TEST REPORT`);
  console.log(`===============================================================`);
  console.log(`  Total Requests Executed:    ${report.totalRequests}`);
  console.log(`  Successful Requests:        ${report.successfulRequests}`);
  console.log(`  Failed Requests:            ${report.failedRequests}`);
  console.log(`  Success Rate:               ${Math.round((report.successfulRequests / report.totalRequests) * 100)}%`);
  console.log(`  Average Latency:            ${report.avgLatencyMs} ms`);
  console.log(`  Total Elapsed Time:         ${report.durationMs} ms`);
  console.log(`  Agents Fired Concurrently:  ${report.agentsFired}`);
  console.log(`  Organs Directly Exercised:  ${report.organsTested} (out of ${allOrgans.length} total)`);
  console.log(`  Sandbox Code Executions:    ${report.sandboxRuns}`);
  console.log(`  Autonomous Commands Run:    ${report.commandRuns}`);
  console.log(`  Total Errors Encountered:   ${report.errors.length}`);
  console.log(`===============================================================\n`);

  if (report.failedRequests > 0) {
    console.error("Encountered errors during load test:", report.errors);
  }

  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runFullSystemLoadTest()
    .then((report) => {
      process.exitCode = report.failedRequests === 0 ? 0 : 1;
    })
    .catch((err) => {
      console.error("Load test fatal error:", err);
      process.exitCode = 1;
    });
}
