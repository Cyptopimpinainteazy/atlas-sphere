from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, List
from datetime import datetime
import uuid
from orchestra.core.enums import TaskSeverity, OrchestraSection, AgentRole

class TaskSpec(BaseModel):
    """
    Immutable specification for a unit of work in the Orchestra.
    Corresponds to an on-chain .md file input.
    """
    id: str = Field(default_factory=lambda: f"TASK-{uuid.uuid4().hex[:8].upper()}")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Metadata
    proposer_id: str
    target_section: OrchestraSection
    severity: TaskSeverity
    
    # Content
    intent: str = Field(..., description="Clear statement of goal.")
    constraints: List[str] = Field(..., description="Referenced Score clauses.")
    expected_impact: str = Field(..., description="State, funds, agents, or rules impacted.")
    
    # Technical
    payload_hash: str = Field(..., description="Hash of the execution payload/script")
    
    @validator("constraints")
    def constraints_must_not_be_empty(cls, v):
        if not v:
            raise ValueError("Task must reference at least one Score constraint.")
        return v

    class Config:
        frozen = True # Immutable once created
