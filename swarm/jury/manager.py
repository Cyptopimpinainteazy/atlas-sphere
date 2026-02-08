"""Simple in-memory Jury manager (local only)

Features:
- Create sessions with tasks
- Commit-reveal voting (commit -> reveal -> aggregate)
- Query session status/results

This is a minimal implementation intended for local testing only.
"""

import hashlib
import time
import uuid
from dataclasses import dataclass, field
from typing import Dict, Optional, List


@dataclass
class VoteCommit:
    contributor_id: str
    commitment: str  # hex digest of hash(vote|nonce)
    timestamp: float = field(default_factory=time.time)


@dataclass
class VoteReveal:
    contributor_id: str
    vote: bool
    nonce: str
    timestamp: float = field(default_factory=time.time)


@dataclass
class JurySession:
    session_id: str
    tasks: List[Dict]
    state: str = "commit"  # commit | reveal | closed
    commitments: Dict[str, VoteCommit] = field(default_factory=dict)
    reveals: Dict[str, VoteReveal] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)
    result: Optional[bool] = None


class JuryManager:
    def __init__(self):
        self.sessions: Dict[str, JurySession] = {}

    def create_session(self, tasks: List[Dict], session_id: Optional[str] = None) -> JurySession:
        sid = session_id or str(uuid.uuid4())
        s = JurySession(session_id=sid, tasks=tasks)
        self.sessions[sid] = s
        return s

    def get_session(self, session_id: str) -> Optional[JurySession]:
        return self.sessions.get(session_id)

    def submit_commit(self, session_id: str, contributor_id: str, commitment: str) -> bool:
        s = self.get_session(session_id)
        if not s or s.state != "commit":
            return False
        s.commitments[contributor_id] = VoteCommit(contributor_id=contributor_id, commitment=commitment)
        return True

    def advance_to_reveal(self, session_id: str):
        s = self.get_session(session_id)
        if not s:
            return False
        s.state = "reveal"
        return True

    def submit_reveal(self, session_id: str, contributor_id: str, vote: bool, nonce: str) -> bool:
        s = self.get_session(session_id)
        if not s or s.state != "reveal":
            return False
        # Verify commitment
        expected = hashlib.sha256((str(int(vote)) + "|" + nonce).encode()).hexdigest()
        commit = s.commitments.get(contributor_id)
        if not commit or commit.commitment != expected:
            return False
        s.reveals[contributor_id] = VoteReveal(contributor_id=contributor_id, vote=vote, nonce=nonce)
        return True

    def aggregate(self, session_id: str) -> Optional[Dict]:
        s = self.get_session(session_id)
        if not s or s.state != "reveal":
            return None
        yes = sum(1 for r in s.reveals.values() if r.vote)
        no = sum(1 for r in s.reveals.values() if not r.vote)
        s.result = yes > no
        s.state = "closed"
        return {"yes": yes, "no": no, "result": s.result}

    def list_sessions(self) -> List[JurySession]:
        return list(self.sessions.values())
