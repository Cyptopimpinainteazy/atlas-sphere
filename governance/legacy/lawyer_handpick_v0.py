"""ARCHIVED - DEPRECATED - NON-CALLABLE

THIS FILE IS FROZEN AND READ-ONLY.

⚖️ CONSTITUTIONAL RULE:
"Direct juror selection by any agent is permanently prohibited."

This module represents a known-bad governance primitive:
- Lawyers had unilateral selection power
- No adversarial review (DA vs. Defense)
- No anonymization (juror capture possible)
- No randomization (entropy destroyed)

REPLACED BY: swarm/jury/voir_dire.py

Use Cases for This File:
✅ Forensic comparison (why voir dire is better)
✅ Historical audit trail
✅ Teaching tool (how NOT to build jury systems)

DO NOT:
❌ Import this module
❌ Call any class or function
❌ Build on this code
❌ Expose this API

This file exists only as evidence of better choices made.

---

OLD DOCSTRING (KEPT FOR HISTORICAL RECORD):

Lawyer vetting system for jury member selection and approval.

Purpose:
- All jury members must be vetted and approved by a lawyer before seating
- Lawyers provide hard veto power (reject = member cannot be seated)
- Prevents placement of compromised, conflicted, or unsuitable jurors

Vetting Process:
1. Lawyer qualification check: reputation >= 0.7, no active conflicts
2. Member conflict check: no previous trials with opposing parties
3. Reputation baseline: candidate reputation >= 0.5
4. Diversity recommendation: section balance guidance

This enforces the principle: "Slow power, preserve legitimacy, surface errors early."
"""

# CODE FROZEN - DO NOT MODIFY OR IMPORT
# If you're reading this because you want to use direct selection, read voir_dire.py instead.

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Set
import time


class VettingStatus(Enum):
    """Vetting decision outcomes."""
    APPROVED = "approved"
    REJECTED = "rejected"
    FLAGGED = "flagged"  # Approved but with concerns recorded


@dataclass
class VettingRecord:
    """Record of lawyer vetting decision for a member."""
    lawyer_id: str
    candidate_id: str
    session_id: str
    status: VettingStatus
    timestamp: float = field(default_factory=time.time)
    reasoning: str = ""  # Why approved/rejected
    concerns: List[str] = field(default_factory=list)  # Warnings even if approved
    conflict_checks: Dict[str, bool] = field(default_factory=dict)  # Detailed checks run


@dataclass
class Lawyer:
    """Lawyer agent with vetting authority over jury member selection.
    
    Qualification Requirements:
    - reputation >= 0.7 (high standing)
    - no_active_conflicts = True (not disqualified)
    - Min 1 previous jury service (experience)
    """
    agent_id: str
    reputation: float  # 0-1 scale; min 0.7 to qualify
    no_active_conflicts: bool  # Can serve without disqualifying conflicts
    previous_jury_count: int = 0  # Number of juries previously served on
    vetting_authority: bool = field(init=False)
    
    def __post_init__(self):
        """Validate lawyer qualifications."""
        self.vetting_authority = (
            self.reputation >= 0.7
            and self.no_active_conflicts
            and self.previous_jury_count >= 1
        )
    
    def is_qualified(self) -> bool:
        """Check if lawyer meets vetting authority requirements."""
        return self.vetting_authority


class LawyerVetter:
    """Manages lawyer vetting of jury members and session approval.
    
    Responsibilities:
    - Confirm lawyer qualifications
    - Vet candidates against conflict-of-interest, reputation, and diversity criteria
    - Grant/deny seating permission
    - Record all vetting decisions for audit trail
    """
    
    MIN_LAWYER_REPUTATION = 0.7
    MIN_CANDIDATE_REPUTATION = 0.5
    MIN_LAWYER_PREVIOUS_JURIES = 1
    
    def __init__(self):
        """Initialize vetting system."""
        self.vetting_records: List[VettingRecord] = []
        self.conflict_map: Dict[str, Set[str]] = {}  # agent_id -> set of conflicting agent_ids
        self.candidate_history: Dict[str, List[str]] = {}  # candidate_id -> list of previous jury sessions
    
    def register_conflict(self, agent_a: str, agent_b: str):
        """Register a conflict of interest between two agents.
        
        Args:
            agent_a: First agent ID
            agent_b: Second agent ID (conflict is bidirectional)
        """
        if agent_a not in self.conflict_map:
            self.conflict_map[agent_a] = set()
        if agent_b not in self.conflict_map:
            self.conflict_map[agent_b] = set()
        
        self.conflict_map[agent_a].add(agent_b)
        self.conflict_map[agent_b].add(agent_a)
    
    def record_jury_participation(self, candidate_id: str, session_id: str):
        """Record that a candidate served on a jury.
        
        Args:
            candidate_id: Agent ID of jury member
            session_id: Jury session ID
        """
        if candidate_id not in self.candidate_history:
            self.candidate_history[candidate_id] = []
        self.candidate_history[candidate_id].append(session_id)
    
    def vet_candidate(
        self,
        lawyer: Lawyer,
        candidate_id: str,
        candidate_reputation: float,
        session_id: str,
        other_members: Optional[List[str]] = None,
    ) -> VettingRecord:
        """Vet a candidate for jury membership.
        
        Process:
        1. Confirm lawyer qualifications
        2. Check candidate reputation >= MIN (0.5)
        3. Check for personal conflicts with opposing parties
        4. Review section diversity
        5. Issue approval/rejection/flagged decision
        
        Args:
            lawyer: Lawyer agent performing vetting
            candidate_id: ID of candidate to vet
            candidate_reputation: Candidate's reputation score (0-1)
            session_id: Jury session ID
            other_members: List of other jury member IDs (for conflict checking)
            
        Returns:
            VettingRecord: Vetting decision with status and reasoning
            
        Raises:
            ValueError: If lawyer is not qualified
        """
        if not lawyer.is_qualified():
            raise ValueError(
                f"Lawyer {lawyer.agent_id} not qualified for vetting: "
                f"reputation={lawyer.reputation}, conflicts={not lawyer.no_active_conflicts}, "
                f"previous_juries={lawyer.previous_jury_count}"
            )
        
        record = VettingRecord(
            lawyer_id=lawyer.agent_id,
            candidate_id=candidate_id,
            session_id=session_id,
            status=VettingStatus.APPROVED,
        )
        
        # Check 1: Candidate reputation baseline
        if candidate_reputation < self.MIN_CANDIDATE_REPUTATION:
            record.status = VettingStatus.REJECTED
            record.reasoning = (
                f"Candidate reputation {candidate_reputation:.2f} below minimum {self.MIN_CANDIDATE_REPUTATION}"
            )
            record.conflict_checks["reputation_baseline"] = False
            self.vetting_records.append(record)
            return record
        record.conflict_checks["reputation_baseline"] = True
        
        # Check 2: Personal conflicts with other members
        conflicts_found = []
        if other_members:
            for other_id in other_members:
                if self._has_conflict(candidate_id, other_id):
                    conflicts_found.append(other_id)
        
        if conflicts_found:
            record.status = VettingStatus.REJECTED
            record.reasoning = f"Candidate has conflicts with jury members: {conflicts_found}"
            record.conflict_checks["peer_conflicts"] = False
            record.concerns.append(f"Conflicts: {', '.join(conflicts_found)}")
            self.vetting_records.append(record)
            return record
        record.conflict_checks["peer_conflicts"] = True
        
        # Check 3: Recency (not seated too many times recently)
        recent_sessions = self._get_recent_jury_count(candidate_id, days=30)
        if recent_sessions >= 3:
            record.status = VettingStatus.FLAGGED
            record.reasoning = f"Candidate served on {recent_sessions} juries in past 30 days"
            record.concerns.append(f"High recent jury load ({recent_sessions} sessions)")
        record.conflict_checks["recency"] = recent_sessions < 3
        
        # Final outcome
        if record.status == VettingStatus.APPROVED:
            record.reasoning = "Candidate meets all vetting criteria"
        
        self.vetting_records.append(record)
        return record
    
    def approve_all_members(
        self,
        lawyer: Lawyer,
        candidate_ids: List[str],
        candidate_reputations: Dict[str, float],
        session_id: str,
    ) -> tuple[bool, List[VettingRecord]]:
        """Vet all members for a jury session.
        
        All members must receive APPROVED status (FLAGGED is allowed);
        any REJECTED member blocks session approval.
        
        Args:
            lawyer: Lawyer performing vetting
            candidate_ids: List of candidate IDs
            candidate_reputations: Dict mapping candidate_id -> reputation score
            session_id: Jury session ID
            
        Returns:
            Tuple:
                - bool: True if all approved/flagged (no rejections); False if any rejected
                - List[VettingRecord]: Vetting records for each candidate
        """
        records = []
        all_approved = True
        
        for candidate_id in candidate_ids:
            reputation = candidate_reputations.get(candidate_id, 0.5)
            other_members = [c for c in candidate_ids if c != candidate_id]
            
            record = self.vet_candidate(
                lawyer=lawyer,
                candidate_id=candidate_id,
                candidate_reputation=reputation,
                session_id=session_id,
                other_members=other_members,
            )
            records.append(record)
            
            if record.status == VettingStatus.REJECTED:
                all_approved = False
        
        return all_approved, records
    
    def _has_conflict(self, agent_a: str, agent_b: str) -> bool:
        """Check if two agents have a registered conflict."""
        if agent_a not in self.conflict_map:
            return False
        return agent_b in self.conflict_map[agent_a]
    
    def _get_recent_jury_count(self, candidate_id: str, days: int = 30) -> int:
        """Count how many juries candidate served on in past N days."""
        # Simplified: just count all recorded sessions (in production, check timestamps)
        return len(self.candidate_history.get(candidate_id, []))
    
    def get_vetting_audit_trail(self, session_id: str) -> List[VettingRecord]:
        """Retrieve all vetting records for a session."""
        return [r for r in self.vetting_records if r.session_id == session_id]
