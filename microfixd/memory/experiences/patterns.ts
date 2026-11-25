/**
 * microfixd/memory/experiences/patterns.ts
 * Organ 4: Autonomous Memory Consolidation
 * Stores Failure Patterns, Success Patterns, Lessons Learned, and Verified Corrections.
 */

export interface FailurePattern {
  id: string;
  timestamp: string;
  triggerCondition: string;
  rootCause: string;
  associatedFailureModes: string[];
  tenant_id: string;
}

export interface SuccessPattern {
  id: string;
  timestamp: string;
  taskCategory: string;
  optimalSequence: string[];
  verifiedOverallScore: number;
  tenant_id: string;
}

export interface LessonLearned {
  id: string;
  timestamp: string;
  topic: string;
  lesson: string;
  actionableRule: string;
  verifiedImprovementDelta: number;
  tenant_id: string;
}

export interface CorrectionRecord {
  id: string;
  timestamp: string;
  beforeSnippet: string;
  afterSnippet: string;
  correctionRATIONALE: string;
  promotedToPermanent: boolean;
  tenant_id: string;
}

class ExperienceMemoryStore {
  private failurePatterns: FailurePattern[] = [];
  private successPatterns: SuccessPattern[] = [];
  private lessonsLearned: LessonLearned[] = [];
  private corrections: CorrectionRecord[] = [];

  recordFailure(pattern: Omit<FailurePattern, "id" | "timestamp">): FailurePattern {
    const item: FailurePattern = {
      id: `fail_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...pattern,
    };
    this.failurePatterns.unshift(item);
    if (this.failurePatterns.length > 200) this.failurePatterns.pop();
    return item;
  }

  recordSuccess(pattern: Omit<SuccessPattern, "id" | "timestamp">): SuccessPattern {
    const item: SuccessPattern = {
      id: `succ_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...pattern,
    };
    this.successPatterns.unshift(item);
    if (this.successPatterns.length > 200) this.successPatterns.pop();
    return item;
  }

  recordLesson(lesson: Omit<LessonLearned, "id" | "timestamp">): LessonLearned {
    const item: LessonLearned = {
      id: `lsn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...lesson,
    };
    this.lessonsLearned.unshift(item);
    if (this.lessonsLearned.length > 300) this.lessonsLearned.pop();
    return item;
  }

  recordCorrection(correction: Omit<CorrectionRecord, "id" | "timestamp">): CorrectionRecord {
    const item: CorrectionRecord = {
      id: `corr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...correction,
    };
    this.corrections.unshift(item);
    if (this.corrections.length > 300) this.corrections.pop();
    return item;
  }

  getRecentLessons(limit = 10, tenant_id = "global"): LessonLearned[] {
    return this.lessonsLearned
      .filter(l => tenant_id === "global" || l.tenant_id === tenant_id)
      .slice(0, limit);
  }

  getRecentCorrections(limit = 10, tenant_id = "global"): CorrectionRecord[] {
    return this.corrections
      .filter(c => tenant_id === "global" || c.tenant_id === tenant_id)
      .slice(0, limit);
  }

  getAllStats(tenant_id = "global") {
    return {
      totalFailuresLogged: this.failurePatterns.length,
      totalSuccessesLogged: this.successPatterns.length,
      totalLessonsLearned: this.lessonsLearned.length,
      totalCorrectionsActive: this.corrections.length,
    };
  }
}

export const experienceMemory = new ExperienceMemoryStore();
