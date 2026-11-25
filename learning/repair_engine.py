"""
learning/repair_engine.py
Python repair engine for generating self-healing patches
"""

import time
from typing import Dict, Any

def generate_repair_patch(diagnosis: Dict[str, Any]) -> Dict[str, Any]:
    strategy = diagnosis.get("recommended_strategy", "RESTART_CONTAINER")
    component = diagnosis.get("suspected_component", "system")

    action_script = f"organRegistry.reset('{component}')"
    requires_hitl = False

    if strategy == "FALLBACK_PROVIDER":
        action_script = "switch_provider_fallback('groq', 'gemini')"
    elif strategy == "ISOLATE_ORGAN":
        action_script = f"organRegistry.isolate('{component}')"
        requires_hitl = True
    elif strategy == "MUTATE_PROMPT":
        action_script = "inject_adaptation_directives(['Strict schema enforcement'])"

    return {
        "patch_id": f"patch_{int(time.time() * 1000)}",
        "strategy": strategy,
        "action_script": action_script,
        "reversible": True,
        "requires_hitl": requires_hitl,
    }
