"""
learning/root_cause.py
Python root cause diagnosis for self-healing
"""

from typing import Dict, Any

def diagnose_root_cause(fault: Dict[str, Any]) -> Dict[str, Any]:
    msg = fault.get("message", "").lower()
    suspected = fault.get("source", "system")
    strategy = "RESTART_CONTAINER"
    mechanism = "Runtime execution exception."

    if "isolated" in msg or "circuit" in msg:
        strategy = "ISOLATE_ORGAN"
        mechanism = "Circuit breaker triggered."
    elif "rate limit" in msg or "429" in msg:
        strategy = "FALLBACK_PROVIDER"
        mechanism = "Upstream provider rate limit reached."
    elif "invariant" in msg or "safety" in msg:
        strategy = "MUTATE_PROMPT"
        mechanism = "Constitutional safety boundary triggered."

    return {
        "fault_id": fault.get("fault_id"),
        "suspected_component": suspected,
        "underlying_mechanism": mechanism,
        "is_recoverable": True,
        "recommended_strategy": strategy,
    }
