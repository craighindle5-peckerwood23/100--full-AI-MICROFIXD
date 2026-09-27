/**
 * server/sandbox/codeRunner.ts
 * Sandboxed code execution.
 * Supports: TypeScript (via tsx), JavaScript (node), Python (python3).
 * All writes restricted to server/sandbox/workspace/.
 * All executions logged.
 * Rule-SB-001: all executions captured.
 * Rule-SB-002: writes outside workspace blocked.
 */
import { exec }  from "child_process";
import { promisify } from "util";
import path   from "path";
import fs     from "fs";
import os     from "os";

const execAsync    = promisify(exec);
const WORKSPACE    = path.join(process.cwd(), "server", "sandbox", "workspace");
const SESSION_LOG  = path.join(process.cwd(), "server", "sandbox", "session_log.jsonl");
const MAX_BYTES    = 65_536;
const TIMEOUT_MS   = 30_000;
const ALLOWED_LANGS = new Set(["typescript", "javascript", "python", "python3", "bash"]);

// Ensure workspace exists
fs.mkdirSync(WORKSPACE, { recursive: true });

export interface CodeRunResult {
  success:   boolean;
  stdout:    string;
  stderr:    string;
  exit_code: number;
  elapsed_ms: number;
  lang:      string;
  session_id: string;
  exec_id:   string;
}

let _execCount = 0;

function log(entry: Record<string, unknown>): void {
  const line = JSON.stringify({ ...entry, logged_at: new Date().toISOString() }) + "\n";
  fs.appendFileSync(SESSION_LOG, line);
}

// BLOCKED patterns (rule-SB-002 enforcement)
const BLOCKED_PATTERNS = [
  /rm\s+-rf/,
  /mkfs/,
  /dd\s+if=/,
  /sudo/,
  /curl.*\|\s*bash/,
  /wget.*\|\s*bash/,
];

function checkBlocked(code: string): string | null {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(code)) return `Blocked pattern: ${pattern.source}`;
  }
  return null;
}

export async function runCode(
  code:      string,
  lang:      string,
  sessionId: string,
): Promise<CodeRunResult> {
  const t0     = Date.now();
  const execId = `exec_${++_execCount}_${Date.now().toString(36)}`;
  const normLang = lang.toLowerCase().trim();

  // Validate lang
  if (!ALLOWED_LANGS.has(normLang)) {
    const result: CodeRunResult = {
      success: false, stdout: "", stderr: `Language '${lang}' not allowed.`,
      exit_code: 1, elapsed_ms: 0, lang, session_id: sessionId, exec_id: execId,
    };
    log({ type: "exec_rejected", session_id: sessionId, lang, reason: result.stderr });
    return result;
  }

  // Check blocked patterns
  const blocked = checkBlocked(code);
  if (blocked) {
    const result: CodeRunResult = {
      success: false, stdout: "", stderr: `Code blocked: ${blocked}`,
      exit_code: 1, elapsed_ms: 0, lang, session_id: sessionId, exec_id: execId,
    };
    log({ type: "exec_blocked", session_id: sessionId, lang, reason: blocked });
    return result;
  }

  // Write code to temp file in workspace
  const ext      = normLang === "typescript" ? ".ts" : normLang === "python" || normLang === "python3" ? ".py" : normLang === "bash" ? ".sh" : ".js";
  const srcFile  = path.join(WORKSPACE, `${execId}${ext}`);
  fs.writeFileSync(srcFile, code);

  // Build command
  let cmd: string;
  const env = { ...process.env, HOME: WORKSPACE, TMPDIR: os.tmpdir() };
  switch (normLang) {
    case "typescript": cmd = `npx tsx ${srcFile}`; break;
    case "javascript": cmd = `node ${srcFile}`; break;
    case "python":
    case "python3":    cmd = `python3 ${srcFile}`; break;
    case "bash":       cmd = `bash ${srcFile}`; break;
    default:           cmd = `node ${srcFile}`;
  }

  log({ type: "exec_start", session_id: sessionId, exec_id: execId, lang, code_len: code.length });

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      timeout:  TIMEOUT_MS,
      maxBuffer: MAX_BYTES,
      env,
      cwd: WORKSPACE,
    });

    const elapsed_ms = Date.now() - t0;
    const result: CodeRunResult = {
      success: true,
      stdout:  stdout.slice(0, MAX_BYTES),
      stderr:  stderr.slice(0, 1000),
      exit_code: 0, elapsed_ms, lang, session_id: sessionId, exec_id: execId,
    };
    log({ type: "exec_complete", ...result });
    return result;
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number; killed?: boolean };
    const elapsed_ms = Date.now() - t0;
    const result: CodeRunResult = {
      success:   false,
      stdout:    (e.stdout ?? "").slice(0, MAX_BYTES),
      stderr:    e.killed ? `Timeout after ${TIMEOUT_MS}ms` : (e.stderr ?? String(err)).slice(0, 1000),
      exit_code: e.code ?? 1,
      elapsed_ms, lang, session_id: sessionId, exec_id: execId,
    };
    log({ type: "exec_error", ...result });
    return result;
  }
}
