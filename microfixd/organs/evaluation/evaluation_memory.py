"""
microfixd/organs/evaluation/evaluation_memory.py
In-memory and durable evaluation records in Python
"""

import time
from typing import Dict, Any, List

class EvaluationMemory:
    def __init__(self, max_capacity: int = 500):
        self.records: List[Dict[str, Any]] = []
        self.max_capacity = max_capacity

    def record(self, task: str, candidate: str, scores: Dict[str, int], metrics: Dict[str, Any], feedback: Dict[str, Any], tenant_id: str = "global") -> Dict[str, Any]:
        item = {
            "id": f"eval_{int(time.time() * 1000)}",
            "task": task,
            "candidate_snippet": candidate[:300],
            "scores": scores,
            "metrics": metrics,
            "feedback": feedback,
            "tenant_id": tenant_id,
        }
        self.records.insert(0, item)
        if len(self.records) > self.max_capacity:
            self.records.pop()
        return item

    def get_recent(self, limit: int = 20) -> List[Dict[str, Any]]:
        return self.records[:limit]

evaluation_memory = EvaluationMemory()
