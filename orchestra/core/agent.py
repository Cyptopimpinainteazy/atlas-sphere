from abc import ABC, abstractmethod
from orchestra.core.enums import AgentRole
from orchestra.schemas.report import AgentReport

class BaseAgent(ABC):
    def __init__(self, role: AgentRole):
        self.role = role

    @abstractmethod
    def perform_job(self, context: dict) -> AgentReport:
        """
        Execute the agent's specific job function.
        Must return an AgentReport.
        """
        pass
