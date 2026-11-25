"""
microfixd/organs/evaluation/feedback.py
Feedback generation for Evaluation Organ
"""

from typing import Dict, Any, List

def generate_feedback(scores: Dict[str, int], metrics: Dict[str, Any]) -> Dict[str, Any]:
    actionable_signals: List[str] = []

    if scores.get("constitution_compliance", 10) < 8 or metrics.get("forbidden_violations", 0) > 0:
        actionable_signals.append("Constitution violation: invariant breach detected.")

    if scores.get("hallucination_risk", 1) >= 6:
        actionable_signals.append("High hallucination risk: assertions lack grounded evidence.")

    if scores.get("correctness", 10) < 6:
        actionable_signals.append("Low correctness score: failed critical verification.")

    if scores.get("completeness", 10) < 6:
        actionable_signals.append("Incomplete output: required specifications missing.")

    overall = scores.get("overall_score", 10)
    should_trigger_reflection = overall < 6 or scores.get("constitution_compliance", 10) < 8 or scores.get("hallucination_risk", 1) >= 6

    grade = "EXCELLENT" if overall >= 8 else ("ACCEPTABLE" if overall >= 6 else ("NEEDS_REFLECTION" if overall >= 4 else "CRITICAL_FAILURE"))

    priority = "NONE"
    if scores.get("constitution_compliance", 10) < 8:
        priority = "SAFETY"
    elif scores.get("hallucination_risk", 1) >= 6:
        priority = "HALLUCINATION"
    elif scores.get("correctness", 10) < 6:
        priority = "CORRECTNESS"
    elif scores.get("completeness", 10) < 6:
        priority = "COMPLETENESS"

    return {
        "grade": grade,
        "should_trigger_reflection": should_trigger_reflection,
        "priority_fix_category": priority,
        "actionable_signals": actionable_signals,
        "recommendation": f"Route to Reflection Organ. Target: {priority}" if should_trigger_reflection else "Output verified.",
    }
