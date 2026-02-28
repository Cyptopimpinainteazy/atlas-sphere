from typing import List, Dict, Set
from datetime import datetime
from orchestra.core.enums import AgentRole

class RotationManager:
    """
    Manages the lifecycle of agents rotating between Section work and Jury Duty.
    """
    def __init__(self, all_agents: List[AgentRole]):
        self.all_agents = all_agents
        self.active_roster: Set[AgentRole] = set(all_agents) # Agents working in sections
        self.jury_pool: Set[AgentRole] = set() # Agents currently on jury duty
        self.rotation_log: List[dict] = []

    def sequester_jurors(self, jurors: List[AgentRole]):
        """
        Moves agents from Active Roster -> Jury Pool.
        """
        for juror in jurors:
            if juror in self.jury_pool:
                raise ValueError(f"Agent {juror} is already on jury duty.")
            
            if juror not in self.active_roster:
                # Could happen if agent is suspended/scrapped
                raise ValueError(f"Agent {juror} is not active and cannot serve.")
                
            self.active_roster.remove(juror)
            self.jury_pool.add(juror)
            
            self._log_event(juror, "SEQUESTERED")

    def release_jurors(self, jurors: List[AgentRole]):
        """
        Moves agents froom Jury Pool -> Active Roster.
        """
        for juror in jurors:
            if juror not in self.jury_pool:
                raise ValueError(f"Agent {juror} is not currently on jury duty.")
                
            self.jury_pool.remove(juror)
            self.active_roster.add(juror)
            
            self._log_event(juror, "RELEASED")

    def _log_event(self, agent: AgentRole, event_type: str):
        self.rotation_log.append({
            "agent": agent.value,
            "event": event_type,
            "timestamp": datetime.utcnow()
        })
        
    def get_eligible_jurors(self) -> List[AgentRole]:
        """
        Returns list of agents currently available for selection 
        (i.e., in active roster, not already serving).
        """
        return list(self.active_roster)
