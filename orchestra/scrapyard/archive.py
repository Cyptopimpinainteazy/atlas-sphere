import json
import os
from orchestra.schemas.audit import ScrapYardCase

class ScrapArchive:
    """
    Permanent storage for retired/scrapped agent cases.
    """
    def __init__(self, archive_dir: str = ".orchestra/scrapyard"):
        self.archive_dir = archive_dir
        os.makedirs(self.archive_dir, exist_ok=True)

    def store_case(self, case: ScrapYardCase) -> str:
        """
        Persists a ScrapYardCase to disk in JSON format.
        Returns the file path.
        """
        filename = f"{case.case_id}.json"
        filepath = os.path.join(self.archive_dir, filename)
        
        with open(filepath, 'w') as f:
            f.write(case.json(indent=2))
            
        return filepath
        
    def load_case(self, case_id: str) -> ScrapYardCase:
        filename = f"{case_id}.json"
        filepath = os.path.join(self.archive_dir, filename)
        
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Case {case_id} not found in archive.")
            
        with open(filepath, 'r') as f:
            data = json.load(f)
            return ScrapYardCase(**data)
            
    def list_cases(self) -> list[str]:
        return [f.replace('.json', '') for f in os.listdir(self.archive_dir) if f.endswith('.json')]
