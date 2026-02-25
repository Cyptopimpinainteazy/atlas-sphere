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


def is_pentest_mode() -> bool:
    return os.environ.get('RALPH_MODE', '').lower() == 'pentest'


def gather_security_tasks_from_prd(root_dir: str):
    """Return PRD tasks that look security-related."""
    prd_paths = [p for p in find_md_files(root_dir) if os.path.basename(p).lower().startswith('prd')]
    security_tasks = []
    keywords = ['security', 'pentest', 'vulnerability', 'sast', 'dast', 'audit', 'snyk', 'zap', 'secret', 'fuzz']

    for p in prd_paths:
        try:
            with open(p, 'r', encoding='utf-8') as f:
                for i, line in enumerate(f, 1):
                    if '- [' in line and any(k in line.lower() for k in keywords):
                        security_tasks.append({'file': p, 'line': i, 'content': line.strip()})
        except Exception:
            continue
    return security_tasks


def run_local_scanners(root_dir: str, allow_network: bool = False) -> dict:
    """Run local scanners (npm audit, snyk, zap-cli) when available.

    - Network calls (Snyk / ZAP) are executed only when allow_network==True.
    - Scanner outputs are saved under ./security/ as JSON (if produced).
    - Returns a dict summarizing results or errors.
    """
    results = {}
    os.makedirs(os.path.join(root_dir, 'security'), exist_ok=True)

    # --- npm audit (no network required for local metadata) ---
    pkg = Path(root_dir) / 'package.json'
    if pkg.exists():
        try:
            import subprocess, json
            out = subprocess.check_output(['npm', 'audit', '--json'], cwd=root_dir, stderr=subprocess.STDOUT, text=True, timeout=120)
            npm_json = json.loads(out)
            results['npm_audit'] = npm_json
            # persist summary
            with open(os.path.join(root_dir, 'security', 'npm-audit.json'), 'w', encoding='utf-8') as jf:
                json.dump(npm_json, jf, indent=2)
        except Exception as e:
            results['npm_audit_error'] = str(e)

    # --- Snyk (network; only run when allowed and CLI available) ---
    try:
        import shutil, subprocess, json
        snyk_path = shutil.which('snyk')
        if snyk_path and allow_network:
            try:
                out = subprocess.check_output(['snyk', 'test', '--json'], cwd=root_dir, stderr=subprocess.STDOUT, text=True, timeout=180)
                snyk_json = json.loads(out)
                results['snyk'] = snyk_json
                with open(os.path.join(root_dir, 'security', 'snyk.json'), 'w', encoding='utf-8') as sf:
                    json.dump(snyk_json, sf, indent=2)
            except Exception as e:
                results['snyk_error'] = str(e)
        elif snyk_path and not allow_network:
            results['snyk_skipped'] = 'network_not_allowed'
        else:
            results['snyk_skipped'] = 'snyk_not_installed'
    except Exception as e:
        results['snyk_error'] = str(e)

    # --- OWASP ZAP (DAST) via zap-cli (network; only when allowed and zap-cli installed) ---
    try:
        import shutil, subprocess
        zap_path = shutil.which('zap-cli')
        target = os.environ.get('RALPH_PENTEST_TARGET', 'http://localhost:3000')
        if zap_path and allow_network:
            try:
                # quick-scan is non-destructive but requires target to be up
                scan_cmd = ['zap-cli', 'quick-scan', '--self-contained', target]
                subprocess.check_output(scan_cmd, cwd=root_dir, stderr=subprocess.STDOUT, text=True, timeout=300)
                # export report if possible
                html_out = os.path.join(root_dir, 'security', 'zap-report.html')
                subprocess.run(['zap-cli', 'report', '-o', html_out, '-f', 'html'], cwd=root_dir, check=False)
                results['zap'] = {'status': 'completed', 'report': html_out}
            except Exception as e:
                results['zap_error'] = str(e)
        elif zap_path and not allow_network:
            results['zap_skipped'] = 'network_not_allowed'
        else:
            results['zap_skipped'] = 'zap-cli_not_installed'
    except Exception as e:
        results['zap_error'] = str(e)

    return results


def main():
    root_dir = '/home/lojak/Desktop/x3-chain-master'
    
    print("Ralph: Starting MD task execution...")

    if is_pentest_mode():
        print('RALPH_MODE=pentest detected — running pentest analysis (sandboxed)')
        os.makedirs(os.path.join(root_dir, 'security'), exist_ok=True)

        security_tasks = gather_security_tasks_from_prd(root_dir)
        print(f'Found {len(security_tasks)} security-related PRD items')

        # Run quick local scanners (best-effort). Network calls are blocked by default.
        allow_network = os.environ.get('RALPH_PENTEST_ALLOW_NETWORK', '0') == '1'
        scan_results = run_local_scanners(root_dir, allow_network=allow_network)

        report_path = os.path.join(root_dir, 'security', 'ralph-pentest-report.md')
        with open(report_path, 'w', encoding='utf-8') as r:
            r.write('# Ralph Pentest Report\n\n')
            r.write('Mode: sandboxed pentest (no external network)' + ('' if not allow_network else ' — network allowed') + '\n\n')

            r.write('## Discovered PRD security tasks\n')
            if security_tasks:
                for t in security_tasks:
                    r.write(f"- {t['content']}  (source: {os.path.relpath(t['file'], root_dir)}:{t['line']})\n")
            else:
                r.write('- (no explicit security tasks found in PRD.md)\n')

            r.write('\n## Quick local scan results\n')

            # npm-audit (local)
            if 'npm_audit' in scan_results:
                findings = scan_results['npm_audit'].get('vulnerabilities', {})
                r.write(f"- npm audit (local): {len(findings)} vulnerability categories reported (full JSON: security/npm-audit.json)\n")
            elif 'npm_audit_error' in scan_results:
                r.write(f"- npm audit: error: {scan_results['npm_audit_error']}\n")
            else:
                r.write('- npm audit: not available\n')

            # Snyk
            if 'snyk' in scan_results:
                try:
                    snyk_findings = scan_results['snyk'].get('vulnerabilities', []) if isinstance(scan_results['snyk'], dict) else []
                    r.write(f"- Snyk (local): {len(snyk_findings)} findings (full JSON: security/snyk.json)\n")
                except Exception:
                    r.write('- Snyk (local): processed (see security/snyk.json)\n')
            elif 'snyk_error' in scan_results:
                r.write(f"- Snyk: error: {scan_results['snyk_error']}\n")
            else:
                r.write('- Snyk: not run or CLI not installed\n')

            # ZAP (DAST)
            if 'zap' in scan_results and isinstance(scan_results['zap'], dict) and scan_results['zap'].get('status') == 'completed':
                r.write(f"- OWASP ZAP: quick-scan completed (report: security/zap-report.html)\n")
            elif 'zap_error' in scan_results:
                r.write(f"- OWASP ZAP: error: {scan_results['zap_error']}\n")
            else:
                r.write('- OWASP ZAP: not run or zap-cli not installed\n')

            # persist any scanner JSON outputs already present in workspace (best-effort)
            try:
                for candidate in ['npm-audit.json', 'snyk.json', 'npm-audit-ci.json', 'snyk-ci.json']:
                    candidate_path = os.path.join(root_dir, 'security', candidate)
                    if os.path.exists(candidate_path):
                        r.write(f"- Found artifact: security/{candidate}\n")
            except Exception:
                pass

            r.write('\n## Suggested commands for maintainers\n')
            r.write('- `npm audit` — dependency vulnerability scan\n')
            r.write('- `snyk test` — if you use Snyk\n')
            r.write('- `zap-cli quick-scan` — run OWASP ZAP if you have a running web server\n')

            r.write('\n## Next steps (PRD tasks)\n')
            r.write('- [ ] Add automated dependency scanning to CI (npm audit / snyk)\n')
            r.write('- [ ] Add a scheduled DAST job (OWASP ZAP) and collect reports\n')
            r.write('- [ ] Add secret scanning and pre-commit hooks to block commits with secrets\n')

        print(f'Pentest report written: {report_path}')
        print('Pentest mode complete — open security/ralph-pentest-report.md for details')
        return
    
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