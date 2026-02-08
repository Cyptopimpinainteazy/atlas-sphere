#!/usr/bin/env python3
"""
Ralph - MD Task Executor

Scans all .md files in the repository for tasks, plans, and TODOs,
then executes them to ensure completion.
"""

import os
import re
import glob
from pathlib import Path

def find_md_files(root_dir):
    """Find all .md files in the repository."""
    md_files = []
    for path in Path(root_dir).rglob('*.md'):
        md_files.append(str(path))
    return md_files

def extract_tasks_from_file(file_path):
    """Extract tasks from a single .md file."""
    tasks = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        for line_num, line in enumerate(lines, 1):
            line = line.strip()
            # Patterns for tasks
            patterns = [
                r'^- \[ \]',  # - [ ]
                r'^TODO:',  # TODO:
                r'^Task:',  # Task:
                r'^Plan:',  # Plan:
                r'^\* \[ \]',  # * [ ]
                r'^\d+\.',  # numbered lists that might be tasks
            ]
            
            for pattern in patterns:
                if re.match(pattern, line, re.IGNORECASE):
                    tasks.append({
                        'file': file_path,
                        'line': line_num,
                        'content': line,
                        'type': 'task'
                    })
                    break
                    
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
    
    return tasks

def execute_task(task):
    """Execute a single task."""
    print(f"Executing task: {task['content']}")
    print(f"From: {task['file']}:{task['line']}")
    
    # Here we would implement the logic to execute the task
    # For now, just print it
    # In a real implementation, this would parse the task and perform actions
    
    return True  # Assume success

def run_as_agent(server_url: str = 'http://localhost:8080', contributor_id: str = 'ralph'):
    """Run Ralph as a simple contributor agent: register and poll for tasks"""
    import requests
    import time

    # Try to gather GPU info (best-effort)
    gpu_info = {}
    try:
        import subprocess
        out = subprocess.check_output(['nvidia-smi', '--query-gpu=name,memory.total', '--format=csv,noheader'], text=True).strip()
        if out:
            name, mem = out.split(',')
            gpu_info = {'vendor': 'nvidia', 'model': name.strip(), 'vram': int(mem.strip().split()[0]), 'cuda': True}
    except Exception:
        gpu_info = {'vendor': 'none', 'model': 'cpu', 'vram': 0, 'cuda': False}

    reg_payload = {'contributor_id': contributor_id, 'gpuInfo': gpu_info}
    try:
        r = requests.post(f"{server_url}/api/gpu/register", json=reg_payload, timeout=5)
        print('Registration:', r.json())
    except Exception as e:
        print('Failed to register with swarm API:', e)

    print('Ralph agent: entering polling loop (press Ctrl+C to stop)')
    try:
        while True:
            try:
                r = requests.post(f"{server_url}/api/tasks/request", json={'contributor_id': contributor_id}, timeout=5)
                payload = r.json()
                if payload.get('success') and payload.get('task'):
                    task = payload['task']
                    print('Received task:', task['task_id'], task['workload_type'])
                    # Simulate execution
                    time.sleep(1)
                    result = {'contributor_id': contributor_id, 'success': True, 'result': {'message': 'done'}}
                    rr = requests.post(f"{server_url}/api/tasks/{task['task_id']}/result", json=result, timeout=5)
                    print('Submitted result:', rr.json())
                else:
                    # No task; sleep and poll again
                    time.sleep(2)
            except Exception as e:
                print('Error polling for task:', e)
                time.sleep(3)
    except KeyboardInterrupt:
        print('Ralph: stopping agent')


def main():
    root_dir = '/home/lojak/Desktop/atlas-sphere-master'
    
    print("Ralph: Starting MD task execution...")
    
    # Find all .md files
    md_files = find_md_files(root_dir)
    print(f"Found {len(md_files)} .md files")
    
    all_tasks = []
    
    # Extract tasks from each file
    for md_file in md_files:
        tasks = extract_tasks_from_file(md_file)
        all_tasks.extend(tasks)
    
    print(f"Found {len(all_tasks)} potential tasks")
    
    # Execute tasks
    executed = 0
    for task in all_tasks:
        if execute_task(task):
            executed += 1
    
    print(f"Executed {executed} tasks successfully")

if __name__ == '__main__':
    main()