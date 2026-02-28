# Orchestra Naming Conventions

Canonical mapping for the Orchestra architecture.

## 1. Top-Level Structure
- **Orchestra**: The entire system (formerly Swarm).
- **Score**: The rules (Score v1).
- **Section**: A functional grouping of agents.

## 2. Sections (Behavioral Groups)

| Section Name | Instrument Family/Symbology | Role | Behavior |
| :--- | :--- | :--- | :--- |
| **Strings** | 🎻 Core Execution | Doing work, State transitions | Steady, Reliable, Deterministic |
| **Woodwinds** | 🎷 Prediction & Analysis | Observing, Interpreting | Insightful, Subtle, Historical |
| **Brass** | 🎺 Adversarial Pressure | Attacking, Stress-testing | Loud, Disruptive, Skeptical |
| **Percussion** | 🥁 Governance & Safety | Enforcing, Judging, Timing | Strict, Binary, Final |

## 3. Agent Naming
Agents do not have names (e.g., "Bob"). They have **Roles**.
Format: `Section-Role` (e.g., `Strings-StateExecutor`).
IDs: UUIDv4.

## 4. Task Naming
- Tasks are `.md` files.
- ID Format: `TASK-<YYYYMMDD>-<UUID-SHORT>`
- Example: `TASK-20260208-A1B2C.md`

## 5. File Usage
- **Score (Constitution)**: `orchestra/constitution/SCORE_v1.md`
- **Impl Plans**: `ORCHESTRA_IMPLEMENTATION_PLAN.md`
- **Schemas**: `orchestra/schemas/*.py`
- **Agents**: `orchestra/core/agents.py`
