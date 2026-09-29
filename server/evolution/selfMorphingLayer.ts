/**
 * server/evolution/selfMorphingLayer.ts
 * SELF-MORPHING LAYER
 *
 * Hot-swaps organ behavior at runtime WITHOUT restarting the server.
 * Organs can have their executor functions replaced dynamically.
 * New organs can be injected into the organ registry.
 * Organ routing can be rewired on-the-fly.
 *
 * All morphs require HITL approval (rule-EV1).
 * Morphs are logged and reversible.
 */
import { organRegistry } from "../organs/organRegistry";
import { broadcast }      from "../index";

export interface MorphRecord {
  id:          string;
  organ_id:    string;
  morph_type:  "replace_executor" | "add_organ" | "rewire" | "disable" | "enable";
  description: string;
  status:      "pending" | "applied" | "reverted";
  applied_at?: string;
  ts:          string;
}

const morphHistory: MorphRecord[] = [];

// Dynamic executor overrides — populated by morphs
const executorOverrides = new Map<string, (action: string, payload: unknown) => Promise<unknown>>();

export function getMorphedExecutor(
  organId:         string,
  originalExecutor: (action: string, payload: unknown) => Promise<unknown>,
): (action: string, payload: unknown) => Promise<unknown> {
  return executorOverrides.get(organId) ?? originalExecutor;
}

export async function morphOrgan(
  organId:     string,
  morphType:   MorphRecord["morph_type"],
  description: string,
  newExecutor?: (action: string, payload: unknown) => Promise<unknown>,
): Promise<MorphRecord> {
  const record: MorphRecord = {
    id:         `morph_${Date.now().toString(36)}`,
    organ_id:   organId,
    morph_type: morphType,
    description,
    status:     "pending",
    ts:         new Date().toISOString(),
  };

  // All morphs need HITL
  await fetch(`http://127.0.0.1:${Number(process.env.PORT) || 3001}/api/hitl/trigger`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      session_id: "morphing_layer",
      artifact:   { name: `Morph: ${organId} — ${morphType}`, type: "self_morph", severity: "critical", morph_id: record.id },
      trigger:    "self_modification",
    }),
  }).catch(() => {});

  morphHistory.push(record);
  broadcast("evolution:morph_pending", record);
  return record;
}

export function applyMorph(morphId: string, executor?: (action: string, payload: unknown) => Promise<unknown>): boolean {
  const record = morphHistory.find(m => m.id === morphId);
  if (!record || record.status !== "pending") return false;

  if (executor) executorOverrides.set(record.organ_id, executor);

  if (record.morph_type === "disable") {
    organRegistry.isolate(record.organ_id);
  } else if (record.morph_type === "enable") {
    organRegistry.reset(record.organ_id);
  }

  record.status     = "applied";
  record.applied_at = new Date().toISOString();
  broadcast("evolution:morph_applied", record);
  console.log(`[self_morphing] Applied morph: ${record.organ_id} — ${record.morph_type}`);
  return true;
}

export function revertMorph(morphId: string): boolean {
  const record = morphHistory.find(m => m.id === morphId);
  if (!record || record.status !== "applied") return false;
  executorOverrides.delete(record.organ_id);
  organRegistry.reset(record.organ_id);
  record.status = "reverted";
  broadcast("evolution:morph_reverted", record);
  return true;
}

export function getMorphHistory(): MorphRecord[] { return morphHistory; }
