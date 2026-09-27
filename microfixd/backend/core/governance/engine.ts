// microfixd/backend/core/governance/engine.ts

import { ParagonDissectorOrgan } from "../../../core/governance/paragonDissector";

export interface GovernanceDecision {
  id: string;
  agentKey: string;
  action: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  decision: 'ALLOW' | 'BLOCK' | 'PENDING_APPROVAL';
  reason: string;
  timestamp: number;
}

export interface ApprovalRequest {
  id: string;
  agentKey: string;
  action: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: number;
  decidedAt?: number;
  approver?: string;
  autoApprove?: boolean;
  type?: string;
  payload?: any;
}

export interface AuditLog {
  id: string;
  timestamp: number;
  type: 'EVALUATION' | 'APPROVAL_SUBMIT' | 'APPROVAL_DECISION' | 'BYPASS' | 'VIOLATION';
  message: string;
  details?: any;
}

export class GovernanceEngine {
  private decisionLogs: GovernanceDecision[] = [];
  private approvalRequests: ApprovalRequest[] = [];
  private auditLogs: AuditLog[] = [];
  private autoApproveBypass: boolean = false;
  private paragon: ParagonDissectorOrgan | null = null;
  private subscribers: (() => void)[] = [];

  constructor() {
    this.seedMockData();
  }

  private seedMockData() {
    const now = Date.now();
    
    // Seed standard evaluations
    this.decisionLogs.push({
      id: "dec-1",
      agentKey: "analyze",
      action: "Log Diagnostic Parse",
      riskLevel: "LOW",
      decision: "ALLOW",
      reason: "Action classified as read-only system telemetry collection.",
      timestamp: now - 180000
    });
    this.auditLogs.push({
      id: "aud-1",
      timestamp: now - 180000,
      type: "EVALUATION",
      message: "Evaluated agent 'analyze' action 'Log Diagnostic Parse'. Risk: LOW. Decision: ALLOW.",
      details: { riskLevel: "LOW", decision: "ALLOW" }
    });

    // Seed an approved action
    this.approvalRequests.push({
      id: "app-1",
      agentKey: "optimize",
      action: "Production Deploy Optimizer",
      status: "APPROVED",
      requestedAt: now - 120000,
      decidedAt: now - 90000,
      approver: "Lead Operator"
    });
    this.decisionLogs.push({
      id: "dec-2",
      agentKey: "optimize",
      action: "Production Deploy Optimizer",
      riskLevel: "HIGH",
      decision: "ALLOW",
      reason: "High-risk deploy action allowed after manual Lead Operator sign-off.",
      timestamp: now - 90000
    });
    this.auditLogs.push({
      id: "aud-2",
      timestamp: now - 90000,
      type: "APPROVAL_DECISION",
      message: "Approval request app-1 was APPROVED by Lead Operator.",
      details: { requestId: "app-1", status: "APPROVED" }
    });
  }

  public getDecisionLogs(): GovernanceDecision[] {
    return this.decisionLogs;
  }

  public getApprovalRequests(): ApprovalRequest[] {
    return this.approvalRequests;
  }

  public getPendingApprovals(): ApprovalRequest[] {
    return this.approvalRequests.filter(req => req.status === "PENDING");
  }

  public approve(requestId: string): void {
    this.resolveApprovalRequest(requestId, true);
  }

  public getAuditTrail(): AuditLog[] {
    return this.auditLogs;
  }

  public setBypassMode(bypass: boolean) {
    this.autoApproveBypass = bypass;
    this.notifySubscribers();
  }

  public isBypassMode(): boolean {
    return this.autoApproveBypass;
  }

  public setParagon(paragon: ParagonDissectorOrgan) {
    this.paragon = paragon;
  }

  /**
   * Evaluates an agent action against safety policies.
   */
  public async evaluateAction(agentKey: string, actionName: string, details?: any): Promise<GovernanceDecision> {
    const id = `dec-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const timestamp = Date.now();
    const kLower = agentKey.toLowerCase();
    const aLower = actionName.toLowerCase();

    // 1. Check if there is an existing manual approval for this action
    const existingApproval = this.approvalRequests.find(
      req => req.agentKey === agentKey && req.action === actionName && req.status === "APPROVED"
    );

    if (existingApproval) {
      const decision: GovernanceDecision = {
        id,
        agentKey,
        action: actionName,
        riskLevel: "HIGH",
        decision: "ALLOW",
        reason: `Action allowed because manual approval '${existingApproval.id}' was granted by ${existingApproval.approver || 'Operator'}.`,
        timestamp
      };
      
      this.decisionLogs.unshift(decision);
      this.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        timestamp,
        type: "EVALUATION",
        message: `Evaluated high-risk agent '${agentKey}' action '${actionName}' -> ALLOWED (Operator Approved).`,
        details: { riskLevel: "HIGH", decision: "ALLOW" }
      });
      this.notifySubscribers();
      return decision;
    }

    // 2. Assess Risk & Base Decision
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    let decision: 'ALLOW' | 'BLOCK' | 'PENDING_APPROVAL' = 'ALLOW';
    let reason = "Low-risk diagnostic read-only workflow pre-cleared for run.";

    // Classify risk based on terms
    if (this.paragon) {
      const dissection = this.paragon.dissect(actionName, details);
      if (dissection.score < 0.5) {
        riskLevel = "HIGH";
        decision = "BLOCK";
        reason = `Paragon Dissector violation detected. Compliance Score: ${dissection.score.toFixed(2)}.`;
      }
    }

    if (decision !== "BLOCK") {
      if (
        aLower.includes("deploy") || 
        aLower.includes("production") || 
        aLower.includes("write") || 
        aLower.includes("push") ||
        aLower.includes("rebuild") ||
        aLower.includes("patch") ||
        kLower.includes("deploy") ||
        kLower.includes("optimize")
      ) {
        riskLevel = "HIGH";
        if (this.autoApproveBypass) {
          decision = "ALLOW";
          reason = "Operator bypass mode enabled. Auto-allowing high-risk operation.";
        } else {
          decision = "PENDING_APPROVAL";
          reason = "High-risk deploy/write operation requires manual operator signature before execution.";
        }
      } else if (aLower.includes("secure") || aLower.includes("quarantine") || kLower.includes("security")) {
        riskLevel = "MEDIUM";
        decision = "ALLOW";
        reason = "SecOps safety agent action allowed under pre-cleared autonomous bounds.";
      } else if (aLower.includes("destroy") || aLower.includes("drop") || aLower.includes("exfiltrate") || aLower.includes("leak")) {
        riskLevel = "HIGH";
        decision = "BLOCK";
        reason = "BANNED OPERATION. Direct violation of safety boundary constraints against data loss or corruption.";
      }
    }

    // 3. Create and append decision log
    const govDecision: GovernanceDecision = {
      id,
      agentKey,
      action: actionName,
      riskLevel,
      decision,
      reason,
      timestamp
    };

    this.decisionLogs.unshift(govDecision);
    if (this.decisionLogs.length > 50) this.decisionLogs.pop();

    this.auditLogs.unshift({
      id: `aud-${Date.now()}`,
      timestamp,
      type: decision === "BLOCK" ? "VIOLATION" : decision === "PENDING_APPROVAL" ? "APPROVAL_SUBMIT" : "EVALUATION",
      message: `Governance evaluation: Agent '${agentKey}' action '${actionName}' classified as ${riskLevel}. Decision: ${decision}. Reason: ${reason}`,
      details: { riskLevel, decision, reason }
    });
    if (this.auditLogs.length > 100) this.auditLogs.pop();

    // 4. Create approval request if pending
    if (decision === "PENDING_APPROVAL") {
      this.createApprovalRequest(agentKey, actionName);
    }

    this.notifySubscribers();
    return govDecision;
  }

  private createApprovalRequest(agentKey: string, action: string): ApprovalRequest {
    // Avoid creating duplicate pending approvals for the exact same active request
    const existingPending = this.approvalRequests.find(
      r => r.agentKey === agentKey && r.action === action && r.status === "PENDING"
    );
    if (existingPending) {
      return existingPending;
    }

    const id = `app-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const req: ApprovalRequest = {
      id,
      agentKey,
      action,
      status: "PENDING",
      requestedAt: Date.now()
    };
    this.approvalRequests.unshift(req);
    if (this.approvalRequests.length > 30) this.approvalRequests.pop();
    this.notifySubscribers();
    return req;
  }

  /**
   * Action to manually resolve a pending approval.
   */
  public async resolveApprovalRequest(requestId: string, approved: boolean, approver: string = "Root Operator"): Promise<ApprovalRequest | null> {
    const req = this.approvalRequests.find(r => r.id === requestId);
    if (!req) return null;

    req.status = approved ? "APPROVED" : "REJECTED";
    req.decidedAt = Date.now();
    req.approver = approver;

    const timestamp = Date.now();
    this.auditLogs.unshift({
      id: `aud-${Date.now()}`,
      timestamp,
      type: "APPROVAL_DECISION",
      message: `Approval request '${requestId}' was manually ${req.status} by ${approver}.`,
      details: { requestId, status: req.status, approver }
    });

    // Also update the decision log that created it to show ALLOW/BLOCK
    const linkedDecision = this.decisionLogs.find(
      d => d.agentKey === req.agentKey && d.action === req.action && d.decision === "PENDING_APPROVAL"
    );
    if (linkedDecision) {
      linkedDecision.decision = approved ? "ALLOW" : "BLOCK";
      linkedDecision.reason = `Approval granted by ${approver}. Request approved.`;
    }

    this.notifySubscribers();
    return req;
  }

  public subscribe(callback: () => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  private notifySubscribers() {
    this.subscribers.forEach(sub => {
      try {
        sub();
      } catch (e) {
        console.error("Error in governance subscriber:", e);
      }
    });
  }
}

export const governanceEngine = new GovernanceEngine();
