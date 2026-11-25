/**
 * microfixd/organs/knowledge/vector_store/vector_client.ts
 * Vector store client abstraction for durable embeddings
 */

export interface VectorRecord {
  id: string;
  embedding: number[];
  metadata: Record<string, any>;
  content: string;
}

export class VectorStoreClient {
  private inMemoryVectors: VectorRecord[] = [];

  public async insert(record: VectorRecord): Promise<void> {
    this.inMemoryVectors.push(record);
  }

  public async similaritySearch(queryEmbedding: number[], topK = 5): Promise<VectorRecord[]> {
    // Cosine similarity search
    const scored = this.inMemoryVectors.map(v => {
      let dot = 0;
      let magA = 0;
      let magB = 0;
      for (let i = 0; i < Math.min(v.embedding.length, queryEmbedding.length); i++) {
        dot += v.embedding[i] * queryEmbedding[i];
        magA += v.embedding[i] * v.embedding[i];
        magB += queryEmbedding[i] * queryEmbedding[i];
      }
      const sim = (magA && magB) ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
      return { record: v, similarity: sim };
    });

    return scored.sort((a, b) => b.similarity - a.similarity).slice(0, topK).map(s => s.record);
  }
}

export const vectorStoreClient = new VectorStoreClient();
