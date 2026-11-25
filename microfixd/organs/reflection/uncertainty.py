"""
microfixd/organs/reflection/uncertainty.py
Uncertainty calculation in Python
"""

import re
from typing import Dict, Any, List

HEDGE_PATTERNS = re.compile(r'\b(maybe|might|could|possibly|uncertain|unknown|likely|appears|seems)\b', re.IGNORECASE)
ABSOLUTE_PATTERNS = re.compile(r'\b(always|never|guaranteed|certainly|definitely|100%)\b', re.IGNORECASE)

def assess_uncertainty(text: str, evidence_count: int = 0) -> Dict[str, Any]:
    hedges = list(set(w.lower() for w in HEDGE_PATTERNS.findall(text)))
    absolutes = list(set(w.lower() for w in ABSOLUTE_PATTERNS.findall(text)))

    epistemic_gaps: List[str] = []
    if evidence_count == 0:
        epistemic_gaps.append("No grounding evidence provided.")
    if len(hedges) > 2:
        epistemic_gaps.append("Linguistic hedges suggest low confidence.")

    evidence_penalty = 0.35 if evidence_count == 0 else max(0.0, 0.2 - min(0.2, evidence_count * 0.04))
    linguistic_penalty = min(0.4, len(hedges) * 0.05 + len(absolutes) * 0.06)
    uncertainty_score = max(0.0, min(1.0, evidence_penalty + linguistic_penalty))

    return {
        "uncertainty_score": round(uncertainty_score, 3),
        "confidence_score": round(1.0 - uncertainty_score, 3),
        "hedges": hedges,
        "absolutes": absolutes,
        "epistemic_gaps": epistemic_gaps,
    }
