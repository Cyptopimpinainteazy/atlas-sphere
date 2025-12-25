SIGILL (Illegal instruction) triage playbook

Purpose
- This document explains how to triage SIGILL (Illegal instruction) failures observed in CI/testing runs and what artifacts to gather and analyze.

Quick triage steps
1. Confirm failing workflow and locate artifacts
   - Open the failing workflow run and download the `evm-sigill-diagnostics` artifact (artifacts.tgz) if present.

2. Inspect strace output
   - Search for `SIGILL` or `ILL_ILLOPN` in the strace outputs:
     - grep -n "SIGILL\|ILL_ILLOPN" strace.out*
   - Note the program that received the signal (PID/binary path) and the instruction address.

3. Check for core files and backtraces
   - If core files were captured, run:
     - gdb --batch -ex "set pagination 0" -ex "thread apply all bt full" -ex "quit" $(which cargo) corefile > corefile.gdb.bt
   - If no core exists, the strace and stderr logs are still valuable.

4. Inspect dmesg / kernel messages
   - Look for OOPS, SIGILL, or kernel messages near the test time: `dmesg | tail -n 200` (already included in artifacts)

5. Reproduce locally (best-effort)
   - Try running the same test command under strace locally (prefer in a fresh environment or container):
     - ulimit -c unlimited
     - strace -ff -o strace.out -s 200 -tt -f bash -lc 'cargo test -p atlas-evm-integration --features frontier-executor -- --nocapture'
   - If SIGILL reproduces, try to find minimal test or isolate the call causing the illegal instruction.

6. Narrow scope
   - Determine whether the crash happens only when network steps run (git TLS, remote updates). If so, try `CARGO_NET_OFFLINE=1` to see if skipping network avoids crash.
   - If native crypto/library calls are involved (OpenSSL, libgit2), suspect runner environment or compiled native code.

7. Escalation
   - If reproducible locally and stack shows a system/library issue, collect gdb bt and add to the PR/issue.
   - If only observed in CI and reproduction fails locally, gather runner details and open an issue for infra team with artifacts.

Best-effort commands
- Find SIGILL in strace:
  - grep -n "SIGILL\|ILL_ILLOPN" strace.out*
- Generate gdb backtrace (core present):
  - gdb --batch -ex "thread apply all bt full" -ex "quit" $(which cargo) path/to/core

Notes & recommendations
- Many SIGILLs are due to native code which may depend on CPU features or a bad build artifact; verify runner CPU arch and toolchain.
- Running tests offline (`CARGO_NET_OFFLINE=1`) can help isolate network-related code paths that might trigger an external binary to run.

Contact & next steps
- Add a comment to the PR linking the diagnostic artifact and gist; assign a reviewer/owner to complete the triage.
- If we find a reproducible minimal case, open a follow-up issue with steps to reproduce and a proposed fix (e.g., disable a failing path or pin a dependency).

---
This playbook is minimal and meant to be used as a quick checklist for PR triage — update it with any lessons learned.

Note: The 'SIGILL triage integration test' workflow (see .github/workflows/sigill-triage-integration.yml) validates our duplicate-protection behavior and prefers checking the created issue by number before falling back to a list-based retry. It also uploads a small telemetry artifact (`sigill-fallback-telemetry`) containing `fallback_used` and `fallback_attempts` to help diagnose timing-related flakiness.

Note: A scheduled aggregator (`.github/workflows/sigill-fallback-aggregator.yml`) collects recent `sigill-fallback-telemetry` artifacts and can open an alert if the fallback rate exceeds a configured threshold; PR commenting is opt-in via `SIGILL_FALLBACK_COMMENT_ENABLED`.