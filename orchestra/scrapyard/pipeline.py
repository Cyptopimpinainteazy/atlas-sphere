from typing import List
import uuid
from datetime import datetime
from orchestra.core.enums import AgentRole
from orchestra.schemas.audit import ScrapYardCase
from orchestra.scrapyard.archive import ScrapArchive
from orchestra.scrapyard.forensics import ForensicsEngine

class ScrapPipeline:
    def __init__(self, archive: ScrapArchive):
        self.archive = archive
        self.forensics = ForensicsEngine()

    def scrap_agent(self, agent_id: str, reason: str, evidence_files: List[str]) -> str:
        """
        Executes the scrapping protocol.
        1. Create Case.
        2. Run Forensics.
        3. Archive.
        Returns the Case ID.
        """
        
        # 1. Create Case Object
        case_id = f"CASE-{uuid.uuid4().hex[:8].upper()}"
        case = ScrapYardCase(
            case_id=case_id,
            agent_id=agent_id,
            reason=reason,
            timestamp=datetime.utcnow(),
            evidence_files=evidence_files,
            forensics_report="Pending Analysis..."
        )
        
        # 2. Run Forensics
        report = self.forensics.analyze_failure(case)
        case.forensics_report = report
        
        # 3. Archive
        self.archive.store_case(case)
        
        # 4. Notify (Mock)
        print(f"Scrapping Complete. Agent {agent_id} moved to Scrap Yard. Case: {case_id}")
        
        return case_id
