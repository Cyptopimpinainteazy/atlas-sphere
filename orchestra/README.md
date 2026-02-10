# The Orchestra: Operational Manual

**Status:** System Online
**Constitution:** `SCORE_v1.md`
**Governance:** `Commit-Reveal Jury`

## 1. How to Direct (Create Tasks)
You don't need to write code to direct the Orchestra. Just drop a Markdown file into `.taskmaster/queue/`.

**Template:**
```yaml
---
proposer_id: USER_001
section: STRINGS  # Execution Section
severity: MINOR   # or MAJOR (triggers Jury)
intent: "Deploy the new frontend"
constraints:
  - "Must pass CI/CD"
  - "No downtime"
impact: "Updates the UI for users"
---
# Action
Detailed instructions here...
```

## 2. How to Perform (Run the System)
To process the queue and execute tasks/juries:

```bash
python3 -m orchestra.concert
```

## 3. How to Observe (CLI Dashboard)
To see what is currently pending or the status of the ensemble:

```bash
python3 -m orchestra.views.cli
```

## 4. How to Extend (Add Agents)
1. Inherit from `orchestra.core.agent.BaseAgent`.
2. Implement `perform_job()`.
3. Return an `AgentReport`.
4. Feed to `orchestra.core.conductor.Conductor`.

## 5. Governance Interaction
- **Veto:** Delete any `.md` file in the queue to trigger an immediate Veto cancellation.
- **Jury:** Major tasks automatically convene a pseudo-anonymous 5-agent jury.
