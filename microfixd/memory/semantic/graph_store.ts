/**
 * microfixd/memory/semantic/graph_store.ts
 * Semantic graph store for concept relations and domain ontology
 */

export interface SemanticTriple {
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
}

class SemanticGraphStore {
  private triples: SemanticTriple[] = [
    { subject: "EvaluationOrgan", predicate: "precedes", object: "ReflectionOrgan", confidence: 1.0 },
    { subject: "ReflectionOrgan", predicate: "informs", object: "AdaptationOrgan", confidence: 1.0 },
    { subject: "AdaptationOrgan", predicate: "verified_by", object: "VerificationOrgan", confidence: 1.0 },
    { subject: "VerificationOrgan", predicate: "promotes_to", object: "MemoryWrite", confidence: 1.0 },
  ];

  addTriple(triple: SemanticTriple) {
    this.triples.push(triple);
  }

  query(subject?: string, predicate?: string): SemanticTriple[] {
    return this.triples.filter(t => 
      (!subject || t.subject.toLowerCase() === subject.toLowerCase()) &&
      (!predicate || t.predicate.toLowerCase() === predicate.toLowerCase())
    );
  }

  getAll(): SemanticTriple[] {
    return [...this.triples];
  }
}

export const semanticGraphStore = new SemanticGraphStore();
