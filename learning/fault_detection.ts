/**
 * learning/fault_detection.ts
 * Step 1-2 in Self-Healing Pipeline: Monitor & Detect Failure
 */

export interface FaultSignal {
  faultId: string;
  source: string;
  errorType: "CRASH" | "TIMEOUT" | "INVARIANT_BREACH" | "PERFORMANCE_DEGRADATION" | "EVALUATION_FAILURE";
  message: string;
  stackTrace?: string;
  timestamp: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

class FaultDetector {
  private activeFaults: FaultSignal[] = [];

  detectFromError(source: string, error: unknown, severity: FaultSignal["severity"] = "HIGH"): FaultSignal {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    let errorType: FaultSignal["errorType"] = "CRASH";
    if (message.includes("timeout") || message.includes("ETIMEDOUT")) errorType = "TIMEOUT";
    else if (message.includes("invariant") || message.includes("violat")) errorType = "INVARIANT_BREACH";
    else if (message.includes("score") || message.includes("eval")) errorType = "EVALUATION_FAILURE";

    const fault: FaultSignal = {
      faultId: `fault_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      source,
      errorType,
      message,
      stackTrace: stack,
      timestamp: new Date().toISOString(),
      severity,
    };

    this.activeFaults.unshift(fault);
    if (this.activeFaults.length > 50) this.activeFaults.pop();
    return fault;
  }

  getActiveFaults(): FaultSignal[] {
    return [...this.activeFaults];
  }

  clearFault(faultId: string) {
    this.activeFaults = this.activeFaults.filter(f => f.faultId !== faultId);
  }
}

export const faultDetector = new FaultDetector();
