from orchestra.schemas.task import TaskSpec
from orchestra.core.enums import TaskSeverity

class TaskRouter:
    @staticmethod
    def route(task: TaskSpec) -> str:
        """
        Determines the destination for a task.
        Returns "JURY" or "SECTION_EXECUTION".
        """
        if task.severity == TaskSeverity.MAJOR:
            return "JURY"
        else:
            return f"SECTION_EXECUTION:{task.target_section.value}"

    @staticmethod
    def classify_severity(impact_score: int, funds_involved: float) -> TaskSeverity:
        """
        Logic to auto-classify severity if not explicitly set.
        (Future enhancement)
        """
        if impact_score > 8 or funds_involved > 1000.0:
            return TaskSeverity.MAJOR
        return TaskSeverity.MINOR
