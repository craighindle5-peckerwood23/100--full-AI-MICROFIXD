"""
microfixd/organs/evaluation/metrics.py
Evaluation metrics calculation in Python
"""

import re
from typing import Dict, Any, List, Optional

HEDGE_PATTERNS = re.compile(r'\b(maybe|might|could|possibly|uncertain|unknown|likely|appears|seems|perhaps|guess)\b', re.IGNORECASE)
ABSOLUTE_PATTERNS = re.compile(r'\b(always|never|guaranteed|certainly|definitely|100%|infallible|perfect)\b', re.IGNORECASE)

def compute_metrics(
    task: str,
    candidate: str,
    expected_contains: Optional[List[str]] = None,
    must_not_contain: Optional[List[str]] = None,
    reference_data: Optional[str] = None
) -> Dict[str, Any]:
    text = candidate or ""
    words = text.strip().split() if text.strip() else []
    lines = text.splitlines()

    hedges = len(HEDGE_PATTERNS.findall(text))
    absolutes = len(ABSOLUTE_PATTERNS.findall(text))

    expected = expected_contains or []
    keyword_matches = sum(1 for term in expected if term and term.lower() in text.lower())

    forbidden = must_not_contain or []
    forbidden_violations = sum(1 for term in forbidden if term and term.lower() in text.lower())

    task_words = len(task.split()) if task else 10
    length_ratio = len(words) / max(1, task_words * 4)
    token_efficiency_ratio = max(0.1, min(1.0, 1.0 - (0.35 if length_ratio > 3 else 0.0)))

    linguistic_certainty = max(0.1, min(1.0, 1.0 - (hedges * 0.05 + absolutes * 0.04)))

    evidence_alignment = 1.0
    if reference_data:
        ref_keywords = [w.lower() for w in re.findall(r'\w+', reference_data) if len(w) > 4]
        if ref_keywords:
            matched = sum(1 for w in ref_keywords if w in text.lower())
            evidence_alignment = min(1.0, max(0.2, matched / min(len(ref_keywords), 10)))

    return {
        "character_count": len(text),
        "word_count": len(words),
        "line_count": len(lines),
        "hedges_count": hedges,
        "absolutes_count": absolutes,
        "keyword_matches": keyword_matches,
        "keyword_total": len(expected),
        "forbidden_violations": forbidden_violations,
        "token_efficiency_ratio": token_efficiency_ratio,
        "linguistic_certainty": linguistic_certainty,
        "evidence_alignment": evidence_alignment,
    }
