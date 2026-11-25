/**
 * microfixd/organs/knowledge/rag/retriever.ts
 * Retrieval-Augmented Generation retrieval engine
 */

export interface RAGDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  score: number;
}

export class KnowledgeRetriever {
  private corpus: RAGDocument[] = [
    {
      id: "doc-01",
      title: "Microfyxd Architecture Specification",
      content: "Microfyxd operates with high-order Evaluation, Reflection, Adaptation, Verification, and Memory organs.",
      category: "architecture",
      score: 1.0,
    },
    {
      id: "doc-02",
      title: "Constitutional Safety Guidelines",
      content: "All state mutations require verification. Critical parameter drift triggers immediate isolation.",
      category: "constitution",
      score: 0.95,
    },
    {
      id: "doc-03",
      title: "Self-Healing Pipeline",
      content: "Self-healing requires: Monitor, Detect Failure, Locate Cause, Generate Fix, Sandbox Test, Deploy, Verify.",
      category: "self_healing",
      score: 0.98,
    },
  ];

  public async retrieve(query: string, limit = 5): Promise<RAGDocument[]> {
    const q = query.toLowerCase();
    const matches = this.corpus
      .map(doc => {
        let matchScore = 0;
        const words = q.split(/\W+/).filter(w => w.length > 2);
        for (const w of words) {
          if (doc.content.toLowerCase().includes(w) || doc.title.toLowerCase().includes(w)) {
            matchScore += 0.2;
          }
        }
        return { ...doc, score: Math.min(1.0, doc.score * (matchScore || 0.1)) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return matches;
  }
}

export const knowledgeRetriever = new KnowledgeRetriever();
