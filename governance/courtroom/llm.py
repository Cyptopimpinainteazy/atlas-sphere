import json
import hashlib
from typing import Dict, Any

# Deterministic, local LLM-emulator: produces consistent outputs for auditing.
# This avoids network dependencies while giving repeatable behavior.


def _hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:8]


def call_llm(prompt: str, content: str) -> str:
    """Produce deterministic responses based on prompt type heuristics."""
    key = _hash(prompt + "|" + content)

    if 'PLANNER' in prompt.upper() or 'Planner' in prompt:
        # Summarize intent and produce a short rationale
        return json.dumps({"planner_id": key, "rationale": f"Proposed because {content[:200]}"})

    if 'BUILDER' in prompt.upper() or 'Builder' in prompt:
        return json.dumps({"builder_id": key, "summary": f"Diff details: {len(content)} chars"})

    if 'AUDITOR' in prompt.upper() or 'Auditor' in prompt:
        # Heuristics: block if suspicious keywords present
        issues = []
        for kw in ['exec', 'subprocess', 'os.system', 'open(']:
            if kw in content:
                issues.append(f"unsafe:{kw}")
        if len(content) > 5000:
            issues.append('large_change')
        return json.dumps({"auditor_id": key, "issues": issues})

    if 'JUDGE' in prompt.upper() or 'Judge' in prompt:
        # Expect composed evidence in content; if auditor flagged issues -> REJECT
        try:
            data = json.loads(content)
            # If auditor indicates issues
            aud = data.get('auditor', {})
            issues = aud.get('issues', [])
            if issues:
                return json.dumps({"ruling": "REJECT", "reason": ",".join(issues), "confidence": 0.9})
        except Exception:
            pass
        return json.dumps({"ruling": "ACCEPT", "reason": "No blocking flags", "confidence": 0.7})

    # Fallback reply
    return json.dumps({"id": key, "text": content[:140]})
