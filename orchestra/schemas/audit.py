from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Dict, Any

class RotationRecord(BaseModel):
    """
    Log of agent movement between Execution (On-chain) and Judgment (Off-chain).
    """
    agent_id: str
    epoch_id: int
    direction: str # "ON_TO_OFF" or "OFF_TO_ON"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    state_snapshot_hash: str # Merkle root of agent state at rotation time

class ScrapYardCase(BaseModel):
    """
    Forensic file format for a retired agent.
    """
    case_id: str
    agent_id: str
    retirement_reason: str # "BAD_VOTES", "SCORE_VIOLATION", etc.
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Evidence
    vote_history: List[Dict[str, Any]]
    action_log: List[Dict[str, Any]]
    
    # Analysis
    failure_class: str = "UNKNOWN"
    notes: str = ""
