from orchestra.infra.task_ingestion import TaskIngestion
from orchestra.views.cli import OrchestraCLI

def main():
    # Initialize Ingestion
    ingestion = TaskIngestion(queue_dir=".taskmaster/queue")
    
    # Load Tasks
    tasks = ingestion.scan_queue()
    
    # Convert Pydantic models to dicts for the simple CLI view
    task_dicts = [{"id": t.id, "intent": t.intent} for t in tasks]
    
    # Show CLI
    OrchestraCLI.print_banner()
    OrchestraCLI.show_queue(task_dicts)

if __name__ == "__main__":
    main()
