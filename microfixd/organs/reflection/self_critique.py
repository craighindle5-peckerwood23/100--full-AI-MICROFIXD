"""
microfixd/organs/reflection/self_critique.py
Root cause analysis and self critique in Python
"""

from typing import Dict, Any, List
from .uncertainty import assess_uncertainty

def perform_self_critique(
    task: str,
    output: str,
    scores: Dict[str, int],
    feedback: Dict[str, Any],
    evidence: List[Any] = None
) -> Dict[str, Any]:
    uncertainty = assess_uncertainty(output, len(evidence) if evidence else 0)
    failure_modes: List[str] = []
    assumptions: List[str] = []
    missing_evidence: List[str] = []

    if scores.get("correctness", 10) < 7:
        failure_modes.append("Incorrect assertion failing validation.")
        missing_evidence.append("Authoritative evidence anchor.")

    if scores.get("completeness", 10) < 7:
        failure_modes.append("Omission of essential steps or parameters.")
        assumptions.append("Assumed caller had implicit knowledge.")

    if scores.get("hallucination_risk", 1) >= 5:
        failure_modes.append("Extrapolation beyond supplied context.")

    root_cause = "Nominal performance."
    if scores.get("constitution_compliance", 10) < 8:
        root_cause = "Constitutional boundary breach."
    elif scores.get("hallucination_risk", 1) >= 6:
        root_cause = "Groundedness failure: elevated hallucination risk."
    elif scores.get("correctness", 10) < 6:
        root_cause = "Factual discrepancy against verified facts."

    return {
        "root_cause": root_cause,
        "assumptions": assumptions,
        "missing_evidence": missing_evidence,
        "failure_modes": failure_modes,
        "uncertainty": uncertainty,
    }
