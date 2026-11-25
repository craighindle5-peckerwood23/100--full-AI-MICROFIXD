"""
microfixd/organs/evaluation/evaluator.py
Evaluation Organ Orchestrator in Python
"""

from typing import Dict, Any, List, Optional
from .metrics import compute_metrics
from .scoring import calculate_evaluation_scores
from .feedback import generate_feedback
from .evaluation_memory import evaluation_memory

class Evaluator:
    def evaluate(
        self,
        task: str,
        candidate: str,
        expected_contains: Optional[List[str]] = None,
        must_not_contain: Optional[List[str]] = None,
        reference_data: Optional[str] = None,
        tenant_id: str = "global"
    ) -> Dict[str, Any]:
        metrics = compute_metrics(task, candidate, expected_contains, must_not_contain, reference_data)
        scores = calculate_evaluation_scores(metrics)
        feedback = generate_feedback(scores, metrics)
        record = evaluation_memory.record(task, candidate, scores, metrics, feedback, tenant_id)

        return {
            "success": scores.get("overall_score", 0) >= 6 and scores.get("constitution_compliance", 0) >= 8,
            "scores": scores,
            "metrics": metrics,
            "feedback": feedback,
            "record": record,
        }

evaluator = Evaluator()
