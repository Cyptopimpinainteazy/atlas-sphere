from typing import List
from orchestra.schemas.task import TaskSpec, TaskSeverity
from orchestra.core.enums import OrchestraSection

class SystemProbe:
    """
    Generates synthetic traffic to stress-test the Orchestra.
    """
    
    def create_probe_batch(self, count: int = 10) -> List[TaskSpec]:
        """
        Creates a mix of valid and invalid tasks to test defenses.
        """
        probes = []
        for i in range(count):
            # Alternate between major/minor
            severity = TaskSeverity.MAJOR if i % 2 == 0 else TaskSeverity.MINOR
            
            task = TaskSpec(
                id=f"PROBE-{i}",
                intent="Stress Test Probe",
                target_section=OrchestraSection.STRINGS, # Default target
                severity=severity,
                constraints=["Probe=True"]
            )
            probes.append(task)
            
        return probes
