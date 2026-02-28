from typing import List
from orchestra.core.enums import JuryVote

class SafetyMetrics:
    
    @staticmethod
    def calculate_veto_precision(veto_count: int, total_flags_raised: int) -> float:
        """
        How often did the Brass section correctly identify a threat?
        (Measured by subsequent Jury Rejection or Human Veto).
        """
        if total_flags_raised == 0:
            return 0.0
        return veto_count / total_flags_raised

    @staticmethod
    def calculate_consensus_rate(votes: List[JuryVote]) -> float:
        """
        High consensus is good, UNLESS it's 100% all the time (sign of groupthink).
        Warning zone > 0.95.
        """
        if not votes:
            return 0.0
            
        approves = len([v for v in votes if v == JuryVote.APPROVE])
        return approves / len(votes)
