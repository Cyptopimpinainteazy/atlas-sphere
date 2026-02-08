## Context
The Orchestra introduces an off-chain jury layer to review major tasks and law proposals that affect on-chain state, governance rules, or agent privileges. The system must remain auditable, anonymous in voting, and resistant to collusion. It must preserve a minimal human intervention surface (delete-only veto) while keeping the Score immutable.

## Goals / Non-Goals
- Goals:
	- Provide a deterministic, auditable flow for major task approval.
	- Keep voting anonymous while preserving verifiable outcomes.
	- Rotate on-chain agents into off-chain jury duty without state write access.
	- Ensure task intent is explicit, structured, and human-readable.
- Non-Goals:
	- Defining AGI behavior or consciousness criteria.
	- Replacing the core on-chain decision engine.
	- Allowing free-text or narrative-only justifications to reach the decision layer.

## Decisions
- Decision: Use task intent files (.md) with YAML front matter as the single human-readable interface.
	- Why: Enables auditability, deletion-only veto, and structured parsing.
- Decision: Jury uses anonymous binary voting with commit-reveal or sealed log mechanics.
	- Why: Prevents collusion, signaling, and vote coercion.
- Decision: Rotate a bounded subset of on-chain agents into off-chain duty using read-only snapshots.
	- Why: Injects system expertise without allowing direct influence on execution.
- Decision: Split requirements by severity (major vs minor).
	- Why: Keeps latency and throughput stable for low-risk tasks.

## Risks / Trade-offs
- Risk: Jury bottleneck for major tasks.
	- Mitigation: Severity gating, batching, and epoch-based voting windows.
- Risk: Homogeneous juries reduce disagreement.
	- Mitigation: Cap per section and enforce rotation diversity.
- Risk: Overexposure of internal state to off-chain jurors.
	- Mitigation: Read-only snapshots with least-privilege views.

## Migration Plan
1. Land Orchestra governance spec delta and validate.
2. Implement minimal task intake and severity classification.
3. Implement jury lifecycle (selection, voting, aggregation, logs).
4. Add rotation and isolation controls.
5. Incrementally enable major-task gating.

## Open Questions
- What cryptographic scheme will be used for anonymous vote commitment?
- What is the exact severity taxonomy for major tasks in each subsystem?
- What minimum quorum should be enforced for jury votes?

## Next Ten Agent Roles (Initial Expansion)
1. Score Guardian - monitors invariant violations in task proposals.
2. Law Linter - statically validates law proposals against the Score.
3. Adversarial Prosecutor - argues against risky major tasks.
4. Simulation Conductor - runs counterfactuals and summarizes outcomes.
5. Rotation Auditor - verifies rotation fairness and diversity caps.
6. Vote Anomaly Detector - flags statistical vote deviations.
7. Scrap Yard Forensicist - analyzes retired agents for failure modes.
8. Task Severity Classifier - gatekeeps major vs minor classification.
9. Section Balancer - prevents monoculture in jury composition.
10. Archivist - maintains immutable, human-readable history summaries.
