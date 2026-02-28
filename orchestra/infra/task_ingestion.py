import os
import yaml
import hashlib
from typing import List, Optional
from orchestra.schemas.task import TaskSpec
from orchestra.core.enums import TaskSeverity, OrchestraSection
from orchestra.core.registry import AgentRegistry

class TaskIngestion:
    def __init__(self, queue_dir: str):
        self.queue_dir = queue_dir
        if not os.path.exists(queue_dir):
            os.makedirs(queue_dir)
        self.registry = AgentRegistry.get_instance()

    def scan_queue(self) -> List[TaskSpec]:
        """
        Scan the queue directory for new task files (.md or .yaml) and parse them.
        """
        tasks = []
        for filename in os.listdir(self.queue_dir):
            file_path = os.path.join(self.queue_dir, filename)
            try:
                if filename.endswith(".md"):
                    task = self.parse_task_file(file_path)
                    tasks.append(task)
                elif filename.endswith(".yaml") or filename.endswith(".yml"):
                    task = self.parse_yaml_file(file_path, filename)
                    tasks.append(task)
            except Exception as e:
                print(f"Error parsing {filename}: {e}")
        # Sort by ID if possible to maintain order
        tasks.sort(key=lambda x: x.id)
        return tasks

    def parse_yaml_file(self, file_path: str, filename: str) -> TaskSpec:
        """
        Parse a simplified YAML ticket into a formal TaskSpec.
        """
        with open(file_path, "r") as f:
            data = yaml.safe_load(f)
        
        # Map fields
        task_id = str(data.get("id", filename))
        assignee = data.get("assignee", "Conductor")
        
        # Determine Section from Assignee (Role)
        try:
            role_enum = self.registry.get_role_enum(assignee)
            section = self.registry.get_section(role_enum)
        except:
             # Fallback: Default to Strings (Roadies/Staff are there) or Woodwinds (Promoter)
             section = OrchestraSection.STRINGS

        # Map Severity
        priority = data.get("priority", "medium").lower()
        severity = TaskSeverity.MINOR
        if priority == "high" or priority == "critical":
            severity = TaskSeverity.MAJOR
            
        description = data.get("description", "No description")
        title = data.get("title", "Untitled Task")
        
        return TaskSpec(
            id=f"TASK-{task_id}",
            proposer_id=data.get("reporter", "system"),
            target_section=section,
            severity=severity,
            intent=f"{title}: {description}",
            constraints=["Standard Operating Procedure"], # Default constraint
            expected_impact="Internal workflow execution",
            payload_hash=hashlib.sha256(str(data).encode()).hexdigest()
        )

    def parse_task_file(self, file_path: str) -> TaskSpec:
        """
        Parse a Markdown file with YAML front-matter into a TaskSpec.
        """
        with open(file_path, "r") as f:
            content = f.read()

        # Split Front Matter
        if not content.startswith("---"):
            raise ValueError("Invalid format: Missing front-matter")
        
        parts = content.split("---", 2)
        if len(parts) < 3:
            raise ValueError("Invalid format: Incomplete front-matter")
            
        yaml_content = parts[1]
        body_content = parts[2].strip()
        
        meta = yaml.safe_load(yaml_content)
        
        # Calculate Payload Hash (of the body)
        payload_hash = hashlib.sha256(body_content.encode()).hexdigest()
        
        return TaskSpec(
            proposer_id=meta.get("proposer_id"),
            target_section=OrchestraSection(meta.get("section")),
            severity=TaskSeverity(meta.get("severity")),
            intent=meta.get("intent", "No intent specified"),
            constraints=meta.get("constraints", []),
            expected_impact=meta.get("impact", ""),
            payload_hash=payload_hash
        )
