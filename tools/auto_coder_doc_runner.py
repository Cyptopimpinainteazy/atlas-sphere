#!/usr/bin/env python3
import os
import re
import json
import subprocess
import shlex
from pathlib import Path
from datetime import datetime

REPO_ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = REPO_ROOT / "reports"
REPORT_DIR.mkdir(exist_ok=True)

OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "codemate-ai/mini-coder")
USE_OLLAMA = os.getenv("USE_OLLAMA", "1") == "1"

MD_TASK_RE = re.compile(r"^(?P<prefix>\s*[-*]\s\[\s\]\s)(?P<task>.+)$")

DOC_KEYWORDS = ["doc", "docs", "documentation", "readme", "typo", "fix", "update", "clarify", "example", "format"]


def run_ollama(prompt: str, timeout: int = 120):
    """Run local Ollama model and return the output text."""
    if not USE_OLLAMA:
        return None
    cmd = ["ollama", "run", OLLAMA_MODEL, prompt]
    try:
        completed = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True, timeout=timeout)
        return completed.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Ollama failed: {e.stderr}")
        return None
    except subprocess.TimeoutExpired:
        print("Ollama call timed out")
        return None


def git_ls_md_files():
    """Return tracked and untracked .md files (tracked first)."""
    try:
        out = subprocess.check_output(["git", "ls-files", "*.md"], cwd=REPO_ROOT, text=True)
        tracked = [REPO_ROOT / p for p in out.splitlines() if p.strip()]
    except subprocess.CalledProcessError:
        tracked = []

    # include other .md files (tracked + untracked)
    all_md = set(tracked)
    for p in REPO_ROOT.rglob("*.md"):
        all_md.add(p)

    # Filter out any non-existing or unsafe paths returned by git
    def _valid_path(p: Path):
        try:
            rp = p.resolve()
            # ensure the path is inside the repo
            if not rp.is_relative_to(REPO_ROOT):
                return False
            s = str(p)
            if '\x00' in s:
                return False
            return p.exists()
        except Exception:
            return False

    filtered = [p for p in all_md if _valid_path(p)]
    return sorted(filtered)


def parse_tasks_from_file(path: Path):
    tasks = []
    lines = path.read_text(encoding='utf-8').splitlines()
    heading_stack = []
    for i, line in enumerate(lines):
        # update heading stack
        h = re.match(r"^(#{1,6})\s+(.*)$", line)
        if h:
            level = len(h.group(1))
            heading_text = h.group(2).strip()
            # simplify heading stack
            while len(heading_stack) >= level:
                heading_stack.pop()
            heading_stack.append(heading_text)

        m = MD_TASK_RE.match(line)
        if m:
            task_text = m.group('task').strip()
            tasks.append({
                'file': str(path.relative_to(REPO_ROOT)),
                'line_no': i+1,
                'prefix': m.group('prefix'),
                'task': task_text,
                'heading': list(heading_stack)
            })
    return tasks


def is_doc_task(task_text: str):
    t = task_text.lower()
    return any(k in t for k in DOC_KEYWORDS)


def safe_branch_name(base: str):
    s = re.sub(r"[^a-z0-9-]", "-", base.lower())
    s = re.sub(r"-+", "-", s).strip("-")
    if len(s) > 120:
        s = s[:120]
    return s


def git_current_branch():
    out = subprocess.check_output(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=REPO_ROOT, text=True).strip()
    return out


def git_create_branch(branch_name):
    subprocess.check_call(["git", "checkout", "-b", branch_name], cwd=REPO_ROOT)


def git_commit_file(path: Path, message: str):
    subprocess.check_call(["git", "add", str(path)], cwd=REPO_ROOT)
    subprocess.check_call(["git", "commit", "-m", message], cwd=REPO_ROOT)
    sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO_ROOT, text=True).strip()
    return sha


def process_doc_task(task, dry_run=True):
    file_path = REPO_ROOT / task['file']
    lines = file_path.read_text(encoding='utf-8').splitlines()
    idx = task['line_no'] - 1
    original_line = lines[idx]
    summary = "Implemented documentation task"

    # Call Ollama to get a short summary if available. Skip calling Ollama in dry-run mode to avoid long runs.
    ollama_out = None
    if not dry_run and USE_OLLAMA:
        prompt = f"Implement the following documentation task in file {task['file']} under heading {' > '.join(task['heading'])}: {task['task']}. Return a one-line summary of changes and a short suggested text (max 2 sentences) to add after the task line. Respond in plain text."
        ollama_out = run_ollama(prompt)
        if ollama_out:
            # take first non-empty line as summary
            first_line = [ln.strip() for ln in ollama_out.splitlines() if ln.strip()]
            if first_line:
                summary = first_line[0]
    else:
        if dry_run and USE_OLLAMA:
            # Indicate we would call Ollama if not a dry-run
            summary = "dry-run: ollama summary skipped"
    # Prepare new content: mark done and add note
    new_line = re.sub(r"\[\s\]", "[x]", original_line)
    note_line = f"    <!-- Implemented by auto-coder: {summary} -->"

    new_lines = lines[:idx] + [new_line, note_line] + lines[idx+1:]

    branch_name = safe_branch_name(f"auto/docfix/{Path(task['file']).stem}-{task['line_no']}")
    current_branch = git_current_branch()

    try:
        if not dry_run:
            git_create_branch(branch_name)
            file_path.write_text("\n".join(new_lines), encoding='utf-8')
            commit_msg = f"docs: implement task in {task['file']} - {summary}"
            sha = git_commit_file(file_path, commit_msg)
            # return details
            return {"status": "committed", "branch": branch_name, "commit": sha, "summary": summary}
        else:
            # In dry-run, don't change files; return what would be done
            return {"status": "dry-run", "branch": branch_name, "summary": summary, "new_line": new_line, "note_line": note_line}
    finally:
        # return to original branch if we created one
        if not dry_run:
            subprocess.check_call(["git", "checkout", current_branch], cwd=REPO_ROOT)


def main(dry_run=True, limit=None, start=0, sleep=0.2, all_tasks=False):
    md_files = git_ls_md_files()
    print(f"Found {len(md_files)} markdown files to scan")
    tasks = []
    for md in md_files:
        tlist = parse_tasks_from_file(md)
        for t in tlist:
            if t['task'].lower().startswith('x'):
                continue
            if all_tasks or is_doc_task(t['task']):
                tasks.append(t)

    print(f"Discovered {len(tasks)} doc tasks")
    total = len(tasks)

    # Apply start and limit slicing
    if start:
        tasks = tasks[start:]
    if limit:
        tasks = tasks[:limit]

    print(f"Processing tasks range start={start} limit={limit} -> {len(tasks)} tasks")
    results = []

    for i, task in enumerate(tasks, start+1):
        print(f"Processing {i}/{total}: {task['file']}:{task['line_no']} - {task['task']}")
        try:
            res = process_doc_task(task, dry_run=dry_run)
            results.append({**task, **res})
        except Exception as e:
            print(f"Error processing task: {e}")
            results.append({**task, "status": "error", "error": str(e)})

        # Throttle Ollama calls to avoid overwhelming the local daemon
        if not dry_run and sleep:
            time.sleep(sleep)

    # Write reports
    timestamp = datetime.utcnow().isoformat() + "Z"
    report = {"generated_at": timestamp, "dry_run": dry_run, "results": results}
    report_path = REPORT_DIR / "md-task-run.json"
    with report_path.open("w", encoding='utf-8') as f:
        json.dump(report, f, indent=2)

    # Write human summary
    summary_md = REPORT_DIR / "md-task-summary.md"
    with summary_md.open("w", encoding='utf-8') as f:
        f.write(f"# MD Task Run Summary ({timestamp})\n\n")
        for r in results:
            status = r.get('status')
            f.write(f"- {r['file']}:{r['line_no']} - {r['task']} -> **{status}**\n")
            if 'branch' in r:
                f.write(f"  - branch: {r['branch']}\n")
            if 'commit' in r:
                f.write(f"  - commit: {r['commit']}\n")
            if 'summary' in r:
                f.write(f"  - note: {r['summary']}\n")
            if 'error' in r:
                f.write(f"  - error: {r['error']}\n")

    print(f"Report written to {report_path} and {summary_md}")
    return report


if __name__ == '__main__':
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument('--apply', action='store_true', help='Apply changes (create branches and commit). Default: dry-run')
    p.add_argument('--limit', type=int, default=None, help='Limit number of tasks to process')
    p.add_argument('--start', type=int, default=0, help='Start offset for tasks (0-based)')
    p.add_argument('--sleep', type=float, default=0.2, help='Seconds to sleep between Ollama calls when applying')
    p.add_argument('--all-tasks', action='store_true', help='Process all unchecked tasks, not only ones detected as docs')
    args = p.parse_args()
    dry = not args.apply
    main(dry_run=dry, limit=args.limit, start=args.start, sleep=args.sleep, all_tasks=args.all_tasks)
