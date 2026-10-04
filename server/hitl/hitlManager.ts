import { randomUUID } from "node:crypto";
/**
 * server/hitl/hitlManager.ts
 * HITL (Human-in-the-Loop) queue manager.
 * rule-SB-003: triggered on every completed build/artifact.
 * All records append-only (doctrine-002).
 */
import fs   from "fs";
import path from "path";
import { broadcast } from "../events";

const HITL_DIR   = path.join(process.cwd(), "server", "hitl", "data");
const QUEUE_FILE = path.join(HITL_DIR, "hitl_queue.jsonl");
const LOG_FILE   = path.join(HITL_DIR, "hitl_log.jsonl");

fs.mkdirSync(HITL_DIR, { recursive: true });

export interface HITLRecord {
  hitl_id:    string;
  session_id: string;
  trigger:    string;
  artifact:   { name: string; type: string; files?: string[]; [key: string]: unknown };
  status:     "pending" | "approved" | "rejected";
  ts:         string;
  decided_at?: string;
  decided_by?: string;
  notes?:     string;
}

const _queue: HITLRecord[] = [];

function appendFile(filePath: string, record: HITLRecord): void {
  fs.appendFileSync(filePath, JSON.stringify(record) + "\n");
}

export function trigger(
  sessionId: string,
  artifact:  HITLRecord["artifact"],
  triggerType = "build_complete",
): HITLRecord {
  const record: HITLRecord = {
    hitl_id:    randomUUID(),
    session_id: sessionId,
    trigger:    triggerType,
    artifact,
    status:     "pending",
    ts:         new Date().toISOString(),
  };
  _queue.push(record);
  appendFile(QUEUE_FILE, record);

  // Broadcast to React UI
  broadcast("hitl:review_required", record);
  console.log(`[hitl] Review required: ${record.hitl_id} — ${artifact.name}`);
  return record;
}

export function decide(
  hitlId:    string,
  decision:  "approved" | "rejected",
  notes?:    string,
): HITLRecord | null {
  const record = _queue.find(r => r.hitl_id === hitlId);
  if (!record || record.status !== "pending") return null;

  record.status     = decision;
  record.decided_at = new Date().toISOString();
  record.notes      = notes;
  appendFile(LOG_FILE, record);

  broadcast("hitl:decision", { hitl_id: hitlId, decision, notes });
  console.log(`[hitl] ${decision.toUpperCase()}: ${hitlId}`);
  return record;
}

export function getPending(): HITLRecord[] {
  return _queue.filter(r => r.status === "pending");
}

export function getAll(): HITLRecord[] {
  return [..._queue];
}
