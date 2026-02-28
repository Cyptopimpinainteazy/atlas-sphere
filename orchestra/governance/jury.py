from typing import Dict, List, Optional
import hashlib
import time
from datetime import datetime
from orchestra.schemas.jury import JurySession, VoteCommit, VoteReveal
from orchestra.core.enums import JuryVote, AgentRole

class JuryStateMachine:
    def __init__(self, session: JurySession):
        self.session = session
        
    def add_commit(self, agent_id: str, vote_hash: str):
        """
        Agents submit a hash of their vote + salt.
        Only allowed in COMMIT_PHASE.
        """
        if self.session.status != "COMMIT_PHASE":
            raise ValueError("Commit rejected: Session not in COMMIT_PHASE")
            
        # Prevent double voting
        if agent_id in self.session.commits:
            raise ValueError(f"Agent {agent_id} has already committed.")
        
        # Verify agent is a juror
        if agent_id not in self.session.jurors:
             raise ValueError(f"Agent {agent_id} is not a selected juror.")

        self.session.commits[agent_id] = VoteCommit(
            task_id=self.session.task_id,
            juror_id=agent_id,
            commitment_hash=vote_hash,
            timestamp=datetime.utcnow()
        )
        
    def open_reveal_phase(self):
        """
        Transition from COMMIT -> REVEAL.
        Requires minimum quorum commits (e.g. 100% of assigned jurors).
        """
        # (Simplification: Manual transition for now)
        self.session.status = "REVEAL_PHASE"
        
    def add_reveal(self, agent_id: str, vote: JuryVote, salt: str):
        """
        Agents reveal their vote + salt.
        Must match the stored hash from COMMIT phase.
        """
        if self.session.status != "REVEAL_PHASE":
            raise ValueError("Reveal rejected: Session not in REVEAL_PHASE")
            
        # Find the commit
        commit = self.session.commits.get(agent_id)
        if not commit:
            raise ValueError(f"No commit found for agent {agent_id}")
            
        # Verify Hash
        # Format: sha256(vote + salt)
        # Assuming vote.value is the string representation like "APPROVE"
        payload = f"{vote.value}{salt}".encode('utf-8')
        computed_hash = hashlib.sha256(payload).hexdigest()
        
        if computed_hash != commit.commitment_hash:
            # THIS IS A CRITICAL VIOLATION - potential scrapping offense
            raise ValueError("CRYPTOGRAPHIC MISMATCH: Reveal does not match Commit.")
            
        self.session.reveals[agent_id] = VoteReveal(
            task_id=self.session.task_id,
            juror_id=agent_id,
            vote=vote,
            salt=salt
        )
        
    def tally_votes(self) -> Dict[str, int]:
        """
        Count the votes.
        Only allowed once all reveals are in or timeout.
        """
        results = {
            JuryVote.YES.value: 0,
            JuryVote.NO.value: 0,
            JuryVote.ABSTAIN.value: 0
        }
        
        for reveal in self.session.reveals.values():
            results[reveal.vote.value] += 1
            
        return results
