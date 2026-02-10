from typing import Any, List
import logging

class SandboxEnvironment:
    """
    Isolates jurors from the outside world during a trial.
    Enforces READ-ONLY access to the Task Spec.
    Prevents communication with other agents.
    """
    def __init__(self, agent_id: str, case_files: List[str]):
        self.agent_id = agent_id
        self.case_files = case_files
        self.access_log = []
        self._is_active = False

    def enter(self):
        """
        Agent enters the clean room.
        Network access is cut (simulated).
        """
        logging.info(f"Agent {self.agent_id} entering Sandbox.")
        self._is_active = True
        
    def exit(self):
        """
        Agent leaves the clean room.
        Memory wipe of session data (simulated).
        """
        logging.info(f"Agent {self.agent_id} exiting Sandbox.")
        self._is_active = False

    def read_file(self, filename: str) -> str:
        """
        Safe read access to allowed case files only.
        """
        if not self._is_active:
             raise PermissionError("Agent is not inside the Sandbox.")
             
        if filename not in self.case_files:
            raise PermissionError(f"Access Denied: {filename} is not part of case evidence.")
            
        logging.info(f"Sandbox Read: {filename} by {self.agent_id}")
        # In a real impl, this would read actual file content
        return f"[SANDBOX MOCK CONTENT FOR {filename}]"
        
    def write_file(self, filename: str, content: str):
        """
        BLOCKED. Jurors cannot write to disk.
        """
        raise PermissionError("WRITE ACCESS DENIED: Jurors are read-only.")
        
    def send_network_request(self, url: str):
        """
        BLOCKED. Jurors cannot communicate externally.
        """
        raise PermissionError("NETWORK ACCESS DENIED: Jurors are isolated.")
