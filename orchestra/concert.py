import os
import time
from typing import List
from orchestra.infra.task_ingestion import TaskIngestion
from orchestra.core.routing import TaskRouter
from orchestra.schemas.task import TaskSpec
from orchestra.core.enums import TaskSeverity, OrchestraSection, AgentRole
from orchestra.governance.jury import JuryStateMachine
from orchestra.schemas.jury import JurySession
from orchestra.governance.selection import JurySelector # To pick jurors
from orchestra.core.registry import AgentRegistry

class Concert:
    """
    The main execution loop of the Orchestra.
    Processing the queue -> Routing -> Execution/Jury.
    """
    def __init__(self, queue_dir: str = ".taskmaster/queue", archive_dir: str = ".taskmaster/archive"):
        self.ingestion = TaskIngestion(queue_dir)
        self.archive_dir = archive_dir
        self.router = TaskRouter()
        
        # Jury Helper
        self.registry = AgentRegistry.get_instance() # Loads all roles
        # Get all roles from registry to form selection pool
        # Currently registry stores map, we can get keys
        self.all_agents = [AgentRole(r) for r in self.registry.role_map.keys()]
        self.jury_selector = JurySelector(self.all_agents)

        os.makedirs(self.archive_dir, exist_ok=True)

    def start_performance(self):
        print(">>> CONCERT STARTING: PROCESS QUEUE <<<")
        tasks = self.ingestion.scan_queue()
        
        if not tasks:
            print("Silence. (Queue is empty)")
            return

        for task in tasks:
            self._handle_movement(task)
            
    def _handle_movement(self, task: TaskSpec):
        print(f"\n[MOVEMENT] Processing {task.id}: {task.intent} ({task.target_section.value})")
        destination = self.router.route(task)
        
        if destination == "JURY":
            self._conduct_jury_trial(task)
        else:
            self._conduct_section_performance(task)
            
        # Move to archive (Simulated completion)
        self._archive_task(task)

    def _conduct_section_performance(self, task: TaskSpec):
        """
        Minor tasks are executed immediately by the Section.
        """
        print(f" -> Routing to {task.target_section.value} for immediate execution.")
        # In a real system, this would dispatch to a specific Agent container.
        # Here we simulate success.
        print(f" -> [EXECUTION] Agent from {task.target_section.value} is performing task...")
        time.sleep(0.5)
        print(f" -> [SUCCESS] Task {task.id} completed.")

    def _conduct_jury_trial(self, task: TaskSpec):
        """
        Major tasks require a Jury.
        """
        print(f" -> MAJOR SEVERITY DETECTED. Convening Jury.")
        
        # 1. Select Jury
        try:
            jurors = self.jury_selector.select_jury(task.proposer_id, jury_size=5)
            juror_ids = [j.value for j in jurors]
            print(f" -> [JURY SELECTED] Jurors: {juror_ids}")
        except ValueError as e:
            print(f" -> [ERROR] Could not select jury: {e}")
            return
            
        # 2. Init Session
        import datetime
        session = JurySession(
            task_id=task.id,
            jurors=juror_ids,
            start_time=datetime.datetime.utcnow(),
            commit_deadline=datetime.datetime.utcnow(), # simplified
            reveal_deadline=datetime.datetime.utcnow()
        )
        machine = JuryStateMachine(session)
        
        # 3. Simulate Voting (All Approve for now, to enable flow)
        print(" -> [VOTING] Jurors are deliberating (Sandbox Mode)...")
        machine.session.status = "COMMIT_PHASE"
        
        # Mock Commits
        import hashlib
        salts = {j: "salt123" for j in juror_ids}
        votes = {j: "Yes" for j in juror_ids} # Everyone votes YES
        
        for juror in juror_ids:
            payload = f"{votes[juror]}{salts[juror]}".encode('utf-8')
            vote_hash = hashlib.sha256(payload).hexdigest()
            machine.add_commit(juror, vote_hash)
            
        print(" -> [COMMITS] All votes committed anonymously.")
        
        # 4. Reveal
        machine.open_reveal_phase()
        from orchestra.core.enums import JuryVote
        
        for juror in juror_ids:
            # agent_id, vote_enum, salt
            machine.add_reveal(juror, JuryVote(votes[juror]), salts[juror])
            
        print(" -> [REVEALS] Votes revealed and verified.")
        
        # 5. Tally
        results = machine.tally_votes()
        print(f" -> [VERDICT] Results: {results}")
        
        if results["Yes"] > results["No"]:
            print(" -> [APPROVED] The Motion Passes.")
        else:
            print(" -> [REJECTED] The Motion Fails.")

    def _archive_task(self, task: TaskSpec):
        # We need to find the file again (inefficient lookup but fine for MVP)
        # In ingestion we don't store filename in TaskSpec, we should have.
        # For now, we search by ID content or just skip file move to avoid errors.
        # print(" -> (Archiving skipped in Simulation)")
        pass

if __name__ == "__main__":
    Concert().start_performance()
