/**
 * Microfixd health and operations client.
 *
 * This file is intentionally dependency-free so it can run with tsx, Node 18+,
 * or be imported by another TypeScript service. It provides typed access to the
 * system's mounted API surface and a safe deep-health report.
 *
 * Usage:
 *   npx tsx healthscript.ts
 *   MICROFIXD_URL=http://localhost:3001 npx tsx healthscript.ts
 */

export type HttpMethod = "GET" | "POST" | "DELETE";

export type HealthResponse = {
  status: string;
  version?: string;
  ts?: string;
  services?: string[];
  [key: string]: unknown;
};

export type HealthCheck = {
  name: string;
  path: string;
  ok: boolean;
  status: number | null;
  latencyMs: number;
  error?: string;
  data?: unknown;
};

export type SystemHealth = {
  ok: boolean;
  checkedAt: string;
  baseUrl: string;
  checks: HealthCheck[];
};

export type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  signal?: AbortSignal;
};

const DEFAULT_BASE_URL = "http://localhost:3001";

function normaliseBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

export class MicrofixdClient {
  readonly baseUrl: string;
  readonly token?: string;

  constructor(baseUrl = DEFAULT_BASE_URL, token = process.env.MICROFIXD_TOKEN) {
    this.baseUrl = normaliseBaseUrl(baseUrl);
    this.token = token;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        accept: "application/json",
        ...(options.body === undefined ? {} : { "content-type": "application/json" }),
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });

    const text = await response.text();
    let payload: unknown = undefined;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (!response.ok) {
      const detail = typeof payload === "string" ? payload : JSON.stringify(payload);
      throw new Error(`${options.method ?? "GET"} ${path} failed (${response.status}): ${detail}`);
    }

    return payload as T;
  }

  health() {
    return this.request<HealthResponse>("/api/health");
  }

  deepHealth() {
    return this.request<unknown>("/api/health/deep");
  }

  organs() {
    return this.request<unknown>("/api/organs");
  }

  organStatus(id: string) {
    return this.request<unknown>(`/api/organs/${encodeURIComponent(id)}/status`);
  }

  organMetrics(id: string) {
    return this.request<unknown>(`/api/organs/${encodeURIComponent(id)}/metrics`);
  }

  executeOrgan(id: string, action: string, payload: unknown = {}) {
    return this.request<unknown>(`/api/organs/${encodeURIComponent(id)}/execute`, {
      method: "POST",
      body: { action, payload },
    });
  }

  runCommand(task: string, options: { session_id?: string; source?: string; priority?: string } = {}) {
    return this.request<unknown>("/api/command/run", {
      method: "POST",
      body: { task, ...options },
    });
  }

  runExecution(task: string, steps: unknown[], priority?: string) {
    return this.request<unknown>("/api/execution/run", {
      method: "POST",
      body: { task, steps, ...(priority ? { priority } : {}) },
    });
  }

  listTools() {
    return this.request<unknown>("/api/tools");
  }

  runTools(message: string, system_prompt?: string) {
    return this.request<unknown>("/api/tools/run", {
      method: "POST",
      body: { message, ...(system_prompt ? { system_prompt } : {}) },
    });
  }

  crossAiCall(body: Record<string, unknown>) {
    return this.request<unknown>("/api/crossai/call", { method: "POST", body });
  }

  securityFullCheck(input: unknown, output: unknown) {
    return this.request<unknown>("/api/security/full-check", {
      method: "POST",
      body: { input, output },
    });
  }

  startCrawl(url: string, options: Record<string, unknown> = {}) {
    return this.request<unknown>("/api/crawl/start", {
      method: "POST",
      body: { url, ...options },
    });
  }

  runSandbox(code: string, lang: "typescript" | "javascript" | "python" | "bash", session_id?: string) {
    return this.request<unknown>("/api/sandbox/run", {
      method: "POST",
      body: { code, lang, ...(session_id ? { session_id } : {}) },
    });
  }

  hitlPending() {
    return this.request<unknown>("/api/hitl/pending");
  }

  async check(name: string, path: string): Promise<HealthCheck> {
    const started = Date.now();
    try {
      const data = await this.request<unknown>(path);
      return { name, path, ok: true, status: 200, latencyMs: Date.now() - started, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const match = message.match(/failed \((\d+)\)/);
      return {
        name,
        path,
        ok: false,
        status: match ? Number(match[1]) : null,
        latencyMs: Date.now() - started,
        error: message,
      };
    }
  }

  async systemHealth(): Promise<SystemHealth> {
    const endpoints = [
      ["core", "/api/health"],
      ["deep", "/api/health/deep"],
      ["organs", "/api/organs"],
      ["security", "/api/security/stats"],
      ["execution", "/api/execution/stats"],
      ["tools", "/api/tools"],
      ["crossai", "/api/crossai/providers"],
    ] as const;

    const checks = await Promise.all(endpoints.map(([name, path]) => this.check(name, path)));
    return {
      ok: checks.every((check) => check.ok),
      checkedAt: new Date().toISOString(),
      baseUrl: this.baseUrl,
      checks,
    };
  }
}

export async function runHealthScript(): Promise<SystemHealth> {
  const client = new MicrofixdClient(process.env.MICROFIXD_URL ?? DEFAULT_BASE_URL);
  const report = await client.systemHealth();
  console.log(JSON.stringify(report, null, 2));
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runHealthScript()
    .then((report) => {
      process.exitCode = report.ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
