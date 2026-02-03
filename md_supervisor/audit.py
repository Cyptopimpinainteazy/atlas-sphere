"""Audit logging and event tracking for md_supervisor."""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Global audit log storage
_audit_events: List[Dict[str, Any]] = []
_max_events = 1000

def log_event(event_type: str, data: Dict[str, Any], level: str = "info") -> None:
    """Log an audit event."""
    event = {
        "timestamp": datetime.now().isoformat(),
        "event_type": event_type,
        "data": data,
        "level": level,
        "id": f"{event_type}_{int(datetime.now().timestamp() * 1000)}"
    }

    _audit_events.append(event)

    # Keep only the most recent events
    if len(_audit_events) > _max_events:
        _audit_events.pop(0)

    # Also log to file if data directory exists
    try:
        data_dir = Path("data")
        data_dir.mkdir(exist_ok=True)
        audit_file = data_dir / "audit.log"

        with audit_file.open("a") as f:
            f.write(json.dumps(event) + "\n")
    except Exception:
        pass  # Ignore file logging errors

    # Log to Python logger as well
    if level == "error":
        logger.error(f"Audit event: {event_type} - {data}")
    elif level == "warning":
        logger.warning(f"Audit event: {event_type} - {data}")
    else:
        logger.info(f"Audit event: {event_type} - {data}")

def get_audit_logs(limit: int = 100, event_type: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get recent audit logs."""
    events = _audit_events[-limit:]

    if event_type:
        events = [e for e in events if e["event_type"] == event_type]

    return events

def clear_audit_logs() -> None:
    """Clear the audit log."""
    global _audit_events
    _audit_events = []