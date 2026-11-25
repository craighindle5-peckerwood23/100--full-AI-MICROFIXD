"""
learning/self_healing.py
Python Self-Healing Pipeline orchestrator
"""

from typing import Dict, Any
from .fault_detection import fault_detector
from .root_cause import diagnose_root_cause
from .repair_engine import generate_repair_patch
from .verification import verify_patch

class SelfHealingPipeline:
    def run_healing_cycle(self, source: str, error_msg: str) -> Dict[str, Any]:
        fault = fault_detector.detect_from_error(source, error_msg)
        diagnosis = diagnose_root_cause(fault)
        patch = generate_repair_patch(diagnosis)
        verification = verify_patch(patch)

        deployed = False  # This planner does not apply a patch.

        return {
            "fault": fault,
            "diagnosis": diagnosis,
            "patch": patch,
            "verification": verification,
            "deployed": deployed,
            "verified_live": deployed,
        }

self_healing_pipeline = SelfHealingPipeline()
