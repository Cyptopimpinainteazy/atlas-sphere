# Design Notes — add-swarm-orchestra-platform

This change turns the swarm-orchestra idea into a bounded platform model. The design intent is to keep the system modular enough for specialized execution while preventing role confusion, silent privilege growth, and undocumented side channels between services.

The platform uses a conductor pattern rather than a hive-mind pattern. The conductor accepts intents, routes work to role-typed agents, enforces policy, and records the resulting evidence. Agents do not gain legitimacy merely because they can do work. They gain legitimacy only when they remain inside the approval, security, and audit path.

Compute routing is part of the design, not an implementation afterthought. GPU-heavy work such as inference, graph analytics, and backtesting should be schedulable across on-prem and cloud resources, while low-latency control services remain on CPU-oriented infrastructure. The orchestrator therefore needs metadata about sensitivity, latency budget, determinism class, and cost ceiling before assigning work.

The security swarm is not a sidecar. It is the enforcement substrate for the entire platform. Every financially meaningful execution path, externally visible publication path, and exceptional infrastructure action should emit lineage that the security and evidence layers can consume.
