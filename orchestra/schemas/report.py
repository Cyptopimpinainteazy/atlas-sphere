from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from orchestra.core.enums import AgentRole, OrchestraSection, TaskSeverity

class AgentReport(BaseModel):
    """
    Standardized output from an Agent's work session.
    The Conductor uses this to generate Tasks.
    """
    author_role: AgentRole
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # What did the agent find or do?
    summary: str
    details: str
    
    # What should happen next? (Recommendation to Conductor)
    suggested_intent: str
    suggested_severity: TaskSeverity = TaskSeverity.MINOR
    suggested_target_section: OrchestraSection
    
    # Evidence
    supporting_files: List[str] = []
