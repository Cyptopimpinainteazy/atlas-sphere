# BMAD Phase 2: Workflow Consolidation - Analysis Plan

**Objective**: Analyze 24 GitHub workflow files and design consolidation strategy  
**Status**: 🔄 **IN PROGRESS (Phase 2a)**  
**Previous**: Phase 1 completed (steps consolidation ✅)  
**Next**: Phase 2b (Build integration)

---

## Scope

**Target Files**: `.github/workflows/*.yml` (24 files, 92.6 KB)

```
.github/workflows/
├── alembic-roundtrip.yml           (1.4 KB)
├── bmad.yml                        (0.7 KB)
├── ci-swarm.yml                    (6.7 KB)
├── ci.yml                          (2.2 KB)
├── docker-publish.yml              (1.2 KB)
├── e2e-integration-tests.yml       (9.4 KB)
├── e2e-kms-regtest.yml             (2.8 KB)
├── ollama-build-image.yml          (1.7 KB)
├── ollama-integration-scheduled.yml (8.1 KB)
├── ollama-integration.yml          (1.7 KB)
├── ollama-triage-scheduled.yml     (1.4 KB)
├── ollama-triage-test.yml          (4.6 KB)
├── playwright-e2e.yml              (? KB)
├── production-deploy.yml           (? KB)
├── real-vm-integration.yml         (? KB)
├── run-aggregate-telemetry.yml     (? KB)
├── sigill-fallback-aggregator.yml  (? KB)
├── sigill-triage-integration.yml   (? KB)
├── startup_smoke.yml               (? KB)
├── summary.yml                     (? KB)
├── swarm-dashboard-axe-triage.yml  (? KB)
├── swarm-dashboard-e2e.yml         (? KB)
├── swarm-dashboard-pipeline-smoke.yml (? KB)
└── swarm-media-integration.yml     (? KB)
```

**Total**: 24 files, 92.6 KB, ~23,150 tokens

---

## Phase 2 Analysis Tasks

### Task 1: Duplication Pattern Analysis
- [ ] Examine each workflow file structure
- [ ] Identify common patterns:
  - Trigger patterns (on: push, pull_request, schedule, manual)
  - Job structure (runs-on, steps, env vars)
  - Common step types (checkout, cache, build, test, deploy)
  - Repeated tool configurations

### Task 2: Consolidation Strategy Design
- [ ] Identify template-able sections
- [ ] Design YAML configuration structure
- [ ] Plan variable substitution approach
- [ ] Define configuration schema

### Task 3: Template Design
- [ ] Create base workflow template
- [ ] Define placeholders for:
  - Workflow name/description
  - Triggers
  - Job names and types
  - Step sequences
  - Environment variables
  - Secrets and authentication

### Task 4: Risk Assessment
- [ ] GitHub Actions behavior with generated workflows
- [ ] Compatibility with trigger types
- [ ] Status check dependencies
- [ ] Rollback strategy for failed runs

---

## Why Phase 2 Matters

**Phase 1 Success Metrics**:
- 14 files → 7 files (50% file reduction)
- 31.9 KB → 17.6 KB (44.8% content reduction)
- Infrastructure investment: 10.2K tokens

**Phase 2 Projected Benefits**:
- 24 files → 24 files (same generation, consolidation via config)
- 92.6 KB → 55 KB (40% estimated reduction)
- Cumulative savings: ~20K tokens
- **Infrastructure ROI**: Break-even achieved at Phase 2 scale

**Phase 3 Vision** (Agents):
- Follow same pattern with agent definition files
- Cumulative savings at 3-phase scale: ~40K+ tokens
- Framework proven for other duplication patterns

---

## Key Questions to Answer

1. **What is the duplication pattern in workflows?**
   - Expected: 70-80% structural similarity (based on Phase 1 findings)
   
2. **Are workflows suitable for consolidation?**
   - Challenge: GitHub Actions may have stricter YAML parsing
   - Solution: Generate workflows at git push time (not runtime)

3. **How do we maintain clarity?**
   - Challenge: Generated code can be opaque
   - Solution: Keep human-readable generated files in git

4. **What about workflow-specific secrets?**
   - Challenge: Each workflow may have different secret needs
   - Solution: Configuration specifies which secrets are needed

---

## Phase 2 Timeline

**Phase 2a (Analysis)** - THIS PHASE
- Duration: 1 hour
- Tasks: Analyze patterns, design strategy, create config schema
- Output: Type analysis report, config schema, template design

**Phase 2b (Build Integration)**
- Duration: 1.5 hours
- Tasks: Implement processor, create templates, integrate build
- Output: Working processor, templates, Makefile targets

**Phase 2c (Testing & Validation)**
- Duration: 2 hours
- Tasks: Unit tests, validation, integration tests
- Output: Test suite, validation reports

**Phase 2d (Finalization)**
- Duration: 0.5 hours
- Tasks: Documentation, sign-off, handoff to Phase 3
- Output: Completion report, Phase 3 readiness

**Total Phase 2 Duration**: ~5 hours

---

## Success Criteria

- [ ] All 24 workflows analyzed
- [ ] Consolidation strategy designed
- [ ] YAML configuration schema created
- [ ] Template structure designed
- [ ] Risk assessment completed
- [ ] Phase 2a report documented
- [ ] Ready to proceed to Phase 2b

---

## Navigation

- [Phase 1 Completion Report](.bmad/PHASE_1_COMPLETION_REPORT.md)
- [Phase 1 Timeline](./TEAM_MILESTONE_ROADMAP.md)
- [BMAD System Documentation](.bmad/TEMPLATE_SYSTEM.md)
