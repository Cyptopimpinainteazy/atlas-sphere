from typing import List, Dict
# In a real app: from fastapi import APIRouter
# router = APIRouter()

class OrchestraAPI:
    """
    Read-only API for traversing the state of the Orchestra.
    """
    
    def get_queue(self) -> List[Dict]:
        """
        Returns pending tasks.
        """
        # Mock connection to Task Ingestion
        return [{"id": "TASK-001", "intent": "Analyze Security"}]

    def get_jury_status(self, task_id: str) -> Dict:
        """
        Returns the state of the jury for a task.
        """
        return {
            "task_id": task_id,
            "status": "REVEAL_PHASE",
            "commits": 5,
            "reveals": 3
        }

    def get_scrapyard_cases(self) -> List[str]:
        # Mock connection to Archive
        return ["CASE-829A", "CASE-110B"]
