from orchestra.core.agent import BaseAgent
from orchestra.core.enums import AgentRole, OrchestraSection, TaskSeverity
from orchestra.schemas.report import AgentReport

# --- SAMPLE AGENTS ---

class OboeAgent(BaseAgent): # User Research
    def __init__(self):
        super().__init__(AgentRole.OBOE)
        
    def perform_job(self, context: dict) -> AgentReport:
        # Represents doing research...
        return AgentReport(
            author_role=self.role,
            summary="User feedback indicates confusion about the 'Jury' concept.",
            details="Interviewed 5 users. 4/5 thought 'Jury' meant legal trouble.",
            suggested_intent="Update UI Copy for Jury",
            suggested_target_section=OrchestraSection.STRINGS, # Frontend needs to fix it
            suggested_severity=TaskSeverity.MINOR
        )

class TrumpetAgent(BaseAgent): # Loud Critic
    def __init__(self):
        super().__init__(AgentRole.TRUMPET)
        
    def perform_job(self, context: dict) -> AgentReport:
        # Represents checking for flaws...
        return AgentReport(
            author_role=self.role,
            summary="CRITICAL: The Veto System has no authentication delay.",
            details="If a hacker gains file access, they can nuke the entire queue instantly. We need a time-lock.",
            suggested_intent="Implement Veto Time-Lock",
            suggested_target_section=OrchestraSection.STRINGS, # Security/Backend fix
            suggested_severity=TaskSeverity.MAJOR # Major flaw!
        )

class TimpaniAgent(BaseAgent): # Governance
    def __init__(self):
        super().__init__(AgentRole.TIMPANI)
        
    def perform_job(self, context: dict) -> AgentReport:
        return AgentReport(
            author_role=self.role,
            summary="Quarterly Rotation Schedule is due.",
            details="Current epoch 0 is ending. Need to prepare roster for Epoch 1.",
            suggested_intent="Execute Rotation Protocol",
            suggested_target_section=OrchestraSection.PERCUSSION,
            suggested_severity=TaskSeverity.MAJOR
        )

# --- SIMULATION ---

from orchestra.core.conductor import Conductor

def run_rehearsal():
    print(">>> ORCHESTRA REHEARSAL STARTED <<<")
    
    # 1. Initialize Agents
    oboe = OboeAgent()
    trumpet = TrumpetAgent()
    timpani = TimpaniAgent()
    
    # 2. Agents do their jobs
    print("\n[1] Agents performing jobs...")
    r1 = oboe.perform_job({})
    r2 = trumpet.perform_job({})
    r3 = timpani.perform_job({})
    
    # 3. Conductor processes reports
    print("\n[2] Conductor receiving reports...")
    maestro = Conductor()
    maestro.fill_queue([r1, r2, r3])
    
    print("\n>>> REHEARSAL COMPLETE. CHECK QUEUE. <<<")

if __name__ == "__main__":
    run_rehearsal()
