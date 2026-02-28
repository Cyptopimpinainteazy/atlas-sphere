import random
from typing import List, Set
from orchestra.core.enums import OrchestraSection, AgentRole
from orchestra.core.registry import AgentRegistry

class JurySelector:
    def __init__(self, all_agents: List[AgentRole]):
        self.all_agents = all_agents
        self.registry = AgentRegistry.get_instance()

    def select_jury(self, 
                    author_agent: str, 
                    jury_size: int = 5, 
                    max_per_section: int = 2) -> List[AgentRole]:
        """
        Selects a random jury with constraints.
        1. Exclude author (Conflict of Interest).
        2. Enforce max agents per section (Diversity).
        """
        
        # 1. Exclusion (Author + Ineligible Roles)
        pool = []
        for a in self.all_agents:
            # Conflict of Interest check
            if a.value == author_agent:
                continue
                
            # Eligibility check
            if not self.registry.is_eligible_for_jury(a):
                continue
                
            pool.append(a)
        
        selected: List[AgentRole] = []
        section_counts: dict[OrchestraSection, int] = {
            OrchestraSection.STRINGS: 0,
            OrchestraSection.WOODWINDS: 0,
            OrchestraSection.BRASS: 0,
            OrchestraSection.PERCUSSION: 0
        }

        # Shuffle for randomness
        random.shuffle(pool)
        
        for candidate in pool:
            if len(selected) >= jury_size:
                break
                
            try:
                section = self.registry.get_section(candidate)
            except ValueError:
                # Log error and skip invalid agent
                print(f"Skipping {candidate} - Section unknown.")
                continue
            
            if section_counts[section] < max_per_section:
                selected.append(candidate)
                section_counts[section] += 1
                
        if len(selected) < jury_size:
            # We might fail if the pool is too small relative to constraints
            raise ValueError(f"Could not form a valid jury of size {jury_size} due to constraints (Found {len(selected)}).")
            
        return selected
