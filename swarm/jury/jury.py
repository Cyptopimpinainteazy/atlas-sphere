import time
import uuid
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Any

@dataclass
class JuryVote:
    member_id: str
    commitment: str  # commitment hash
    revealed: Optional[bool] = False
    vote: Optional[bool] = None

@dataclass
class JurySession:
    session_id: str
    tasks: List[str]
    members: List[str]
    reveals: Dict[str, JuryVote]
    created_at: float
    state: str = 'commit'  # commit -> reveal -> completed
    reveal_deadline: Optional[float] = None
    result: Optional[bool] = None

class JuryManager:
    """In-memory jury session manager (local-only minimal implementation)

    This implementation provides compatibility with minimal API used by the
    `SwarmAPIServer` handlers: create_session(tasks=...), submit_commit(...),
    submit_reveal(...), aggregate(...), advance_to_reveal(...), get_session(...).
    """

    def __init__(self):
        self.sessions: Dict[str, JurySession] = {}

    def create_session(self, tasks: List[str], members: Optional[List[str]] = None, reveal_timeout_s: int = 60) -> JurySession:
        session_id = str(uuid.uuid4())
        if members is None:
            # Default small jury
            members = [f'juror-{i+1}' for i in range(3)]
        reveals = {m: JuryVote(member_id=m, commitment='') for m in members}
        session = JurySession(
            session_id=session_id,
            tasks=tasks,
            members=members,
            reveals=reveals,
            created_at=time.time(),
            reveal_deadline=time.time() + reveal_timeout_s
        )
        self.sessions[session_id] = session
        return session

    def get_session(self, session_id: str) -> Optional[JurySession]:
        return self.sessions.get(session_id)

    def submit_commit(self, session_id: str, member_id: str, commitment: str) -> bool:
        s = self.sessions.get(session_id)
        if not s or member_id not in s.reveals:
            return False
        if s.state != 'commit':
            return False
        s.reveals[member_id].commitment = commitment
        return True

    def submit_reveal(self, session_id: str, member_id: str, vote: bool, nonce: Optional[str] = None) -> bool:
        s = self.sessions.get(session_id)
        if not s or member_id not in s.reveals:
            return False
        if s.state != 'reveal':
            return False
        s.reveals[member_id].vote = bool(vote)
        s.reveals[member_id].revealed = True
        # Tally if all revealed or deadline passed
        if all(v.revealed for v in s.reveals.values()) or time.time() > (s.reveal_deadline or 0):
            self._tally(s)
        return True

    def advance_to_reveal(self, session_id: str) -> bool:
        s = self.sessions.get(session_id)
        if not s:
            return False
        s.state = 'reveal'
        return True

    def aggregate(self, session_id: str) -> Optional[bool]:
        s = self.sessions.get(session_id)
        if not s:
            return None
        self._tally(s)
        return s.result

    def _tally(self, s: JurySession):
        yes = sum(1 for v in s.reveals.values() if v.vote)
        no = sum(1 for v in s.reveals.values() if v.vote is False)
        s.result = yes > no
        s.state = 'completed'

    def list_sessions(self) -> List[JurySession]:
        return list(self.sessions.values())
