import os
import glob
from typing import Set

class VetoSystem:
    def __init__(self, queue_dir: str):
        self.queue_dir = queue_dir
        self._known_tasks: Set[str] = set()

    def is_vetoed(self, task_file_name: str) -> bool:
        """
        Check if a task file has been deleted (vetoed).
        Returns True if the file does NOT exist.
        """
        file_path = os.path.join(self.queue_dir, task_file_name)
        return not os.path.exists(file_path)

    def prune_invalid_tasks(self, active_tasks: list) -> list:
        """
        Filter out tasks that have been deleted from disk.
        """
        valid_tasks = []
        for task in active_tasks:
            # Assuming task.id maps to filename or we handle mapping elsewhere.
            # For this MVP, let's assume one must pass the filename or we iterate.
            # This is a conceptual implementation.
            pass
        return valid_tasks

    def get_vetoed_ids(self) -> list[str]:
        """
        In a real system, this would compare the On-Chain Ledger vs Filesystem.
        Any ID On-Chain but missing from Filesystem = Vetoed.
        """
        return []
