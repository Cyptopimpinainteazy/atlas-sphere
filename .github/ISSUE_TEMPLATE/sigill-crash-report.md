name: SIGILL crash report
about: Report an Illegal Instruction (SIGILL) crash observed in CI or local test runs
title: "SIGILL (Illegal instruction) observed — [short summary]"
labels: [bug, diagnostics]

---

**Summary**
- Short description of what happened (one sentence).

**Where**
- Repository/PR/branch: 
- CI job name / workflow: 
- Job run URL (link to workflow run/artifacts): 

**Reproduction steps**
1. Exact command(s) executed (include env vars): e.g. `CARGO_NET_OFFLINE=1 RUST_BACKTRACE=1 cargo test -p x3-evm-integration --features frontier-executor -- --nocapture`
2. Any special setup (fixtures, network access, auth tokens):

**Observed behavior**
- Error output and exit code (copy stderr/stdout snippet)
- Where the SIGILL was delivered (if visible in strace or logs)

**Attachments / links** (please include):
- [ ] Link to diagnostic gist (exec trace / strace) — e.g., https://gist.github.com/...
- [ ] Link to workflow artifacts package (evm-sigill-diagnostics)
- [ ] Core files (if present)
- [ ] dmesg/journal output extracted from artifacts

**Environment details**
- OS / runner (e.g., ubuntu-latest)
- Git commit: `{{commit}}`
- Rust toolchain: `rustc --version`
- Any relevant native libs version (openssl, libssl, git)

**Notes / hints**
- If the crash only happened when CI contacted external services, try re-running with `CARGO_NET_OFFLINE=1` to see if it is network related.

**Optional: quick triage checklist (to help triagers)**
- [ ] I attached artifacts and gist
- [ ] I ran a local repro (description)
- [ ] Any additional observations

---
Please include as much of the requested data as possible — it speeds up the diagnosis. A maintainer will triage this and request any missing artifacts.