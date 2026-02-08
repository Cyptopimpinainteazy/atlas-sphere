import json
from governance.courtroom.llm import call_llm


def run_courtroom(change: dict) -> dict:
    planner = call_llm('PLANNER_PROMPT', change.get('intent', '') + '\n' + change.get('summary', ''))
    builder = call_llm('BUILDER_PROMPT', change.get('diff', ''))
    auditor = call_llm('AUDITOR_PROMPT', change.get('diff', ''))

    # Compose evidence for judge
    evidence = {
        'planner': json.loads(planner) if planner else {},
        'builder': json.loads(builder) if builder else {},
        'auditor': json.loads(auditor) if auditor else {},
    }

    judge_input = json.dumps(evidence)
    judgment_raw = call_llm('JUDGE_PROMPT', judge_input)
    try:
        judgment = json.loads(judgment_raw)
    except Exception:
        judgment = {"ruling": "ERROR", "reason": judgment_raw}

    # Persist transcript
    from pathlib import Path
    path = Path('.md_supervisor/courtroom.jsonl')
    path.parent.mkdir(parents=True, exist_ok=True)
    record = {
        'change_id': change.get('id'),
        'evidence': evidence,
        'judgment': judgment
    }
    with path.open('a') as f:
        f.write(json.dumps(record) + '\n')

    return judgment
