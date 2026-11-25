"""
microfixd/organs/reflection/improvement_generator.py
Improvement generator in Python
"""

from typing import Dict, Any, List

def generate_improvement_plan(critique: Dict[str, Any], task: str) -> Dict[str, Any]:
    key_directives: List[str] = []
    missing_evidence = critique.get("missing_evidence", [])
    failure_modes = critique.get("failure_modes", [])

    suggested_prompt = None
    recommended_tool = None

    if missing_evidence:
        recommended_tool = "knowledge_retriever.retrieve"
        key_directives.append("Retrieve grounding facts prior to synthesizing output.")

    if any("Incorrect assertion" in m for m in failure_modes):
        suggested_prompt = "Validate output against constraints prior to emitting response."
        key_directives.append("Enforce explicit verification gate.")

    if not key_directives:
        key_directives.append("Strategy optimal; maintain parameters.")

    return {
        "suggested_prompt": suggested_prompt,
        "recommended_tool": recommended_tool,
        "key_directives": key_directives,
    }
