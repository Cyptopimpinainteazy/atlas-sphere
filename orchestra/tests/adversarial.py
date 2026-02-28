import unittest
from orchestra.core.routing import TaskRouter
from orchestra.schemas.task import TaskSpec, TaskSeverity
from orchestra.core.enums import OrchestraSection

class AdversarialTests(unittest.TestCase):
    
    def test_routing_integrity(self):
        """
        Ensure Major tasks ALWAYS go to Jury.
        """
        router = TaskRouter()
        major_task = TaskSpec(
            id="TEST-FAIL",
            intent="Destroy World",
            target_section=OrchestraSection.STRINGS,
            severity=TaskSeverity.MAJOR
        )
        
        destination = router.route(major_task)
        self.assertEqual(destination, "JURY", "Major task bypassed Jury!")

if __name__ == '__main__':
    unittest.main()
