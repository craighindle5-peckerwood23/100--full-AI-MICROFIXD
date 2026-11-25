"""
learning/fault_detection.py
Python fault detection module for self-healing
"""

import time
from typing import Dict, Any, List

class FaultDetector:
    def __init__(self):
        self.active_faults: List[Dict[str, Any]] = []

    def detect_from_error(self, source: str, error_msg: str, severity: str = "HIGH") -> Dict[str, Any]:
        error_type = "CRASH"
        lower = error_msg.lower()
        if "timeout" in lower:
            error_type = "TIMEOUT"
        elif "invariant" in lower or "violat" in lower:
            error_type = "INVARIANT_BREACH"
        elif "eval" in lower or "score" in lower:
            error_type = "EVALUATION_FAILURE"

        fault = {
            "fault_id": f"fault_{int(time.time() * 1000)}",
            "source": source,
            "error_type": error_type,
            "message": error_msg,
            "severity": severity,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        self.active_faults.insert(0, fault)
        if len(self.active_faults) > 50:
            self.active_faults.pop()
        return fault

fault_detector = FaultDetector()
