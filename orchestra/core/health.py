from typing import List
from orchestra.evals.judgment import SafetyMetrics
from orchestra.core.enums import JuryVote

class InstitutionalHealthcheck:
    
    def check_health(self, recent_votes: List[List[JuryVote]]) -> List[str]:
        warnings = []
        
        # 1. Groupthink Detection
        total_consensus = 0.0
        for session_votes in recent_votes:
            total_consensus += SafetyMetrics.calculate_consensus_rate(session_votes)
            
        avg_consensus = total_consensus / len(recent_votes) if recent_votes else 0
        
        if avg_consensus > 0.95:
            warnings.append("WARNING: High Consensus (Groupthink Risk). Brass Section may be sleeping.")
        elif avg_consensus < 0.3:
            warnings.append("WARNING: Gridlock. System unable to reach agreement.")
            
        # 2. Silence Detector (Mock implementation)
        # In real world, check if Brass section has generated any 'Comments' recently.
        brass_active = True 
        if not brass_active:
            warnings.append("CRITICAL: Brass Section Silent. Adversarial filter offline.")
            
        return warnings
