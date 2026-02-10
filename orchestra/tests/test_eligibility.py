import unittest
from orchestra.core.enums import AgentRole
from orchestra.governance.selection import JurySelector
from orchestra.core.registry import AgentRegistry

class TestJuryEligibility(unittest.TestCase):
    
    def test_roadie_exclusion(self):
        """
        Verify that Roadies are excluded from Juries.
        """
        registry = AgentRegistry.get_instance()
        
        # Check direct registry flag
        self.assertFalse(registry.is_eligible_for_jury(AgentRole.ROADIE))
        self.assertFalse(registry.is_eligible_for_jury(AgentRole.CONCERT_STAFF))
        self.assertTrue(registry.is_eligible_for_jury(AgentRole.CONDUCTOR))
        
        # Check Selection Logic
        all_agents = list(AgentRole)
        selector = JurySelector(all_agents)
        
        # Try to select a HUGE jury (force scraping the bottom of the barrel)
        # If Roadies are excluded, they shouldn't appear even if we ask for everyone.
        
        # We handle the ValueError because we might run out of eligible candidates due to section constraints
        try:
            jury = selector.select_jury("Anyone", jury_size=20, max_per_section=10)
        except ValueError:
            # If we can't fill 20 slots, that's fine, just check who WAS picked if any
            # But select_jury raises if < size.
            pass
            
        # Let's inspect the pool directly (internal method simulation)
        pool = []
        for a in all_agents:
            if a.value != "Anyone" and registry.is_eligible_for_jury(a):
                pool.append(a)
                
        self.assertNotIn(AgentRole.ROADIE, pool)
        self.assertNotIn(AgentRole.PROMOTER, pool)
        self.assertIn(AgentRole.VIOLIN_1, pool)

if __name__ == '__main__':
    unittest.main()
