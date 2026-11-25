/**
 * microfixd/organs/knowledge/memory/memory_bridge.ts
 * Bridge connecting knowledge queries to durable episodic and semantic memory
 */

import { semanticGraphStore } from "../../../memory/semantic/graph_store";
import { experienceMemory } from "../../../memory/experiences/patterns";

export class KnowledgeMemoryBridge {
  public async getRelevantContext(topic: string, tenant_id = "global") {
    const triples = semanticGraphStore.query(topic);
    const lessons = experienceMemory.getRecentLessons(5, tenant_id);
    return {
      triples,
      lessons,
      timestamp: new Date().toISOString(),
    };
  }
}

export const knowledgeMemoryBridge = new KnowledgeMemoryBridge();
