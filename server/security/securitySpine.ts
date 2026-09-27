/**
 * server/security/securitySpine.ts
 * SECURITY SPINE — Master security coordinator.
 *
 * Coordinates all security subsystems:
 *   - Identity Lock
 *   - Anti-Drift Engine
 *   - Anti-Tamper Engine
 *   - RBAC
 *   - Audit log
 *   - Security telemetry
 *
 * Every request flows through securitySpine.checkInput().
 * Every response flows through securitySpine.checkOutput().
 */
import { checkTamper }        from "./antiTamper";
import { checkAndCorrect }    from "./antiDrift";
import { checkIdentityDrift } from "./identityLock";
import { getIdentityHeader }  from "./identityLock";
import { broadcast }          from "../index";

export interface SecurityCheckResult {
  allowed:        boolean;
  tamper:         ReturnType<typeof checkTamper>;
  drift?:         Awaited<ReturnType<typeof checkAndCorrect>>;
  sanitized_input: string;
  output?:        string;
  latency_ms:     number;
}

class SecuritySpine {
  private inputCount  = 0;
  private blockedCount = 0;
  private driftCount  = 0;

  // ── Check inbound input ───────────────────────────────────────────────
  checkInput(input: string): { allowed: boolean; sanitized: string; threats: unknown[] } {
    this.inputCount++;
    const tamper = checkTamper(input);
    if (tamper.blocked) {
      this.blockedCount++;
      broadcast("security:input_blocked", { threats: tamper.threats, ts: new Date().toISOString() });
      console.warn(`[security_spine] INPUT BLOCKED: ${tamper.threats.map(t => t.type).join(", ")}`);
    }
    return { allowed: !tamper.blocked, sanitized: tamper.sanitized, threats: tamper.threats };
  }

  // ── Check + correct outbound output ──────────────────────────────────
  async checkOutput(output: string): Promise<{ clean: boolean; output: string }> {
    const drift = await checkAndCorrect(output, true);
    if (!drift.clean) {
      this.driftCount++;
    }
    return {
      clean:  drift.clean,
      output: drift.corrected_output ?? output,
    };
  }

  // ── Full pipeline check (input + output together) ─────────────────────
  async fullCheck(input: string, output: string): Promise<SecurityCheckResult> {
    const t0     = Date.now();
    const tamper = checkTamper(input);
    let drift: Awaited<ReturnType<typeof checkAndCorrect>> | undefined;
    let finalOutput = output;

    if (!tamper.blocked) {
      drift = await checkAndCorrect(output, true);
      finalOutput = drift.corrected_output ?? output;
    }

    return {
      allowed:         !tamper.blocked,
      tamper,
      drift,
      sanitized_input: tamper.sanitized,
      output:          finalOutput,
      latency_ms:      Date.now() - t0,
    };
  }

  getIdentityHeaders() { return getIdentityHeader(); }

  getStats() {
    return {
      total_inputs:    this.inputCount,
      blocked_inputs:  this.blockedCount,
      drift_events:    this.driftCount,
      block_rate:      this.inputCount > 0 ? this.blockedCount / this.inputCount : 0,
      ts:              new Date().toISOString(),
    };
  }
}

export const securitySpine = new SecuritySpine();
