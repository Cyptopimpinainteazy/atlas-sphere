import unittest
from orchestra.core.enums import AgentRole, OrchestraSection
from orchestra.governance.selection import JurySelector
from orchestra.core.registry import AgentRegistry

class TestJurySelection(unittest.TestCase):
    
    def test_registry_loading(self):
        """
        Verify that the new roles (e.g. Roadie) are correctly mapped.
        """
        registry = AgentRegistry.get_instance()
        
        # Test a standard role
        self.assertEqual(registry.get_section(AgentRole.CONDUCTOR), OrchestraSection.STRINGS)
        
        # Test a new role
        self.assertEqual(registry.get_section(AgentRole.ROADIE), OrchestraSection.STRINGS)
        
        # Test another section
        self.assertEqual(registry.get_section(AgentRole.PROMOTER), OrchestraSection.WOODWINDS)

    def test_jury_constraints(self):
        """
        Test that we can form a jury and constraints hold.
        """
        # Create a pool of all available agents
        all_agents = list(AgentRole)
        selector = JurySelector(all_agents)
        
        jury = selector.select_jury(
            author_agent=AgentRole.CONDUCTOR.value,
            jury_size=5,
            max_per_section=2
        )
        
        self.assertEqual(len(jury), 5)
        self.assertNotIn(AgentRole.CONDUCTOR, jury)
        
        # Check Sections
        registry = AgentRegistry.get_instance()
        sections = [registry.get_section(j) for j in jury]
        
        from collections import Counter
        counts = Counter(sections)
        
        for section, count in counts.items():
            self.assertLessEqual(count, 2, f"Section {section} has {count} members (Max 2)")

if __name__ == '__main__':
    unittest.main()
