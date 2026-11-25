export * from "./rag/retriever";
export * from "./memory/memory_bridge";
export * from "./vector_store/vector_client";

import { knowledgeRetriever } from "./rag/retriever";
import { knowledgeMemoryBridge } from "./memory/memory_bridge";

export class KnowledgeOrgan {
  public async retrieve(query: string, tenant_id = "global") {
    const documents = await knowledgeRetriever.retrieve(query);
    const context = await knowledgeMemoryBridge.getRelevantContext(query, tenant_id);
    return {
      documents,
      context,
      query,
      timestamp: new Date().toISOString(),
    };
  }
}

export const knowledgeOrgan = new KnowledgeOrgan();
