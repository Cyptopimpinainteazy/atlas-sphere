from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from orchestra.core.enums import JuryVote, AgentRole

class VoteCommit(BaseModel):
    """
    Sealed vote commitment.
    """
    task_id: str
    juror_id: str
    commitment_hash: str # Hash(vote + salt)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class VoteReveal(BaseModel):
    """
    Revealed vote data.
    """
    task_id: str
    juror_id: str
    vote: JuryVote
    salt: str
    
class JurySession(BaseModel):
    """
    State of a jury session for a specific task.
    """
    task_id: str
    jurors: list[str] # List of Agent IDs
    commits: dict[str, VoteCommit] = {} # juror_id -> Commit
    reveals: dict[str, VoteReveal] = {} # juror_id -> Reveal
    status: str = "PENDING" # PENDING -> COMMITTED -> REVEALED -> FINALIZED
    
    start_time: datetime
    commit_deadline: datetime
    reveal_deadline: datetime
