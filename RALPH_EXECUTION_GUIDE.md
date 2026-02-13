# Ralph Execution Guide - Atlas Sphere Project

## Quick Start

You now have **two PRDs** to choose from based on your priorities:

### 1. Critical Path (4 weeks) → **START HERE**
**File:** `PRD_CRITICAL_PATH.md`  
**Focus:** Get core blockchain operational with dual-VM  
**Tasks:** 30 high-priority items  
**Goal:** Functional MVP with real EVM + SVM execution

### 2. Complete Project (16 weeks)
**File:** `PRD_COMPLETE_PROJECT.md`  
**Focus:** Full production-ready system  
**Tasks:** 250+ comprehensive items  
**Goal:** Enterprise-grade deployment

---

## Recommended Execution Strategy

### Phase 1: Critical Path First (RECOMMENDED)
1. Rename `PRD_CRITICAL_PATH.md` to `PRD.md`
2. Start Ralph and let it work through Week 1-4
3. After completion, save as `PRD_CRITICAL_PATH_COMPLETE.md`
4. Move to Phase 2

### Phase 2: Full Completion
1. Rename `PRD_COMPLETE_PROJECT.md` to `PRD.md`
2. Start Ralph from Phase 5 (skip Phases 1-4 as done in critical path)
3. Let Ralph work through remaining 13 phases
4. Mark project complete!

---

## Using Ralph

### Step 1: Open Ralph Control Panel

**Option A - Activity Bar:**
- Click Ralph icon in VS Code left sidebar

**Option B - Command Palette:**
- Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
- Type "Ralph: Open Control Panel"
- Press Enter

### Step 2: Start Execution

Choose your approach:

#### Approach A: Use Critical Path PRD (Recommended)
```bash
# Rename critical path to be the active PRD
cd /home/lojak/Desktop/atlas-sphere-master
mv PRD.md PRD_sample_old.md  # backup original sample
mv PRD_CRITICAL_PATH.md PRD.md
```

Then in Ralph Control Panel:
1. Click **"Start"**
2. Watch Ralph work through Week 1-4

#### Approach B: Use Complete Project PRD
```bash
# Rename complete project to be the active PRD
cd /home/lojak/Desktop/atlas-sphere-master
mv PRD.md PRD_sample_old.md  # backup original sample
mv PRD_COMPLETE_PROJECT.md PRD.md
```

Then in Ralph Control Panel:
1. Click **"Start"**
2. Watch Ralph work through all 13 phases

### Step 3: Monitor Progress

Ralph Control Panel shows:
- ▶️ Current task being executed
- 📊 Progress timeline
- ⏱️ Time per task
- 📝 Execution logs

**View Detailed Logs:**
- Command Palette → "Ralph: View Logs"
- Or check output as Ralph works

---

## Ralph Workflow

### How Ralph Works
1. **Read PRD.md** - Scans for unchecked tasks `- [ ]`
2. **Pick Next Task** - Finds first incomplete task
3. **Execute** - Uses GitHub Copilot Agent Mode to implement
4. **Complete** - Marks task done `- [x]`
5. **Repeat** - Continues to next task automatically

### What Ralph Does
- ✅ Reads and writes code
- ✅ Runs tests and fixes failures
- ✅ Commits changes with good messages
- ✅ Updates documentation
- ✅ Creates new files as needed
- ✅ Installs dependencies
- ✅ Fixes compilation errors

### What Ralph Needs
- ✅ GitHub Copilot Chat extension (already installed)
- ✅ Clear, actionable tasks in PRD
- ✅ Proper workspace setup
- ✅ Required tools installed (Rust, Node.js, etc.)

---

## During Execution

### If Ralph Gets Stuck

1. **Pause Ralph:**
   - Click ⏸️ Pause in Control Panel

2. **Check Logs:**
   - Command Palette → "Ralph: View Logs"
   - Look for error messages

3. **Common Issues:**
   - Missing dependencies → Install manually
   - Compilation errors → Fix and resume
   - Test failures → Review test output
   - Unclear task → Edit PRD to clarify

4. **Resume:**
   - Click ▶️ Start to continue

### Monitoring Progress

**Check Task Status:**
- Open `PRD.md` to see which tasks are complete `[x]`
- Unchecked tasks `[ ]` are remaining

**View Changes:**
```bash
# See what Ralph has done
git log --oneline -20

# View current diff
git diff

# Check test results
cargo test --workspace
```

**System Health:**
```bash
# Check compilation
cargo build --release

# Run linters
cargo clippy --workspace

# Format check
cargo fmt --all -- --check
```

---

## After Critical Path Complete

When `PRD_CRITICAL_PATH.md` is done (all tasks `[x]`):

1. **Test the MVP:**
   ```bash
   # Start node
   ./run-dev-node.sh
   
   # In another terminal, test RPC
   curl http://127.0.0.1:9944 -H "Content-Type: application/json" \
        -d '{"id":1,"jsonrpc":"2.0","method":"system_chain","params":[]}'
   
   # Test with Polkadot.js
   # Open: https://polkadot.js.org/apps/?rpc=ws://127.0.0.1:9944
   ```

2. **Verify Core Features:**
   - [ ] WebSocket RPC working
   - [ ] EVM contracts deployable
   - [ ] SVM programs deployable
   - [ ] Cross-VM transactions working
   - [ ] Wallet UI functional
   - [ ] Explorer showing blocks

3. **Switch to Full PRD:**
   ```bash
   # Save completed critical path
   mv PRD.md PRD_CRITICAL_PATH_COMPLETE.md
   
   # Activate complete project PRD
   mv PRD_COMPLETE_PROJECT.md PRD.md
   
   # Edit PRD.md and mark Phases 1-4 as complete manually
   # since they were covered in critical path
   ```

4. **Resume Ralph:**
   - Open Ralph Control Panel
   - Click **Start**
   - Ralph continues from Phase 5

---

## Customizing PRDs

### Adding Tasks

Add new tasks in proper markdown format:
```markdown
- [ ] Task description with clear action
```

### Organizing Tasks

Group related tasks:
```markdown
### Category Name
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3
```

### Task Format Best Practices

**Good Tasks:**
- `- [ ] Implement WebSocket server in node/src/rpc.rs`
- `- [ ] Add unit tests for X3 VM global variable storage`
- `- [ ] Deploy wallet UI to testnet`

**Bad Tasks:**
- `- [ ] Fix stuff` (too vague)
- `- [ ] Do the thing` (unclear what "thing" is)
- `- [ ] Everything` (too broad)

### Acceptance Criteria

Add after tasks to define "done":
```markdown
## Acceptance Criteria
- ✅ All tests pass
- ✅ Code compiles without warnings
- ✅ Documentation updated
```

---

## Troubleshooting

### Ralph Not Starting

**Problem:** Ralph shows but doesn't execute tasks

**Solutions:**
1. Check PRD.md exists in workspace root
2. Verify PRD has unchecked tasks `- [ ]`
3. Check GitHub Copilot is signed in
4. Reload VS Code window: `Ctrl+Shift+P` → "Developer: Reload Window"

### Tasks Not Completing

**Problem:** Ralph works but doesn't mark tasks complete

**Solutions:**
1. Check task format is exactly `- [ ]` with space
2. Ensure task descriptions are clear and actionable
3. Check Ralph logs for errors
4. Manually mark task complete if Ralph succeeded but didn't update

### Compilation Errors

**Problem:** Ralph creates code that doesn't compile

**Solutions:**
1. Pause Ralph
2. Fix compilation errors manually
3. Run `cargo build` to verify
4. Resume Ralph or mark task complete manually

### Test Failures

**Problem:** Ralph's code fails tests

**Solutions:**
1. Review test output: `cargo test`
2. Fix test failures manually or let Ralph retry
3. Ensure test expectations are correct
4. Update tests if implementation is correct

---

## Best Practices

### Before Starting

- [ ] Commit any pending changes: `git commit -am "checkpoint before Ralph"`
- [ ] Ensure all dependencies installed: `cargo build`, `npm install`
- [ ] Run tests to verify baseline: `cargo test --workspace`
- [ ] Back up important files
- [ ] Read through PRD to understand scope

### During Execution

- [ ] Monitor Ralph regularly (don't just leave it)
- [ ] Check compilation after major changes
- [ ] Run tests periodically to catch issues early
- [ ] Review Ralph's commits: `git log -p`
- [ ] Pause if you see concerning changes

### After Tasks Complete

- [ ] Review all changes: `git diff`
- [ ] Run full test suite: `./tests/run-all.sh`
- [ ] Check documentation was updated
- [ ] Test features manually
- [ ] Commit if needed: `git commit -am "completed task batch"`

---

## Progress Tracking

### Current Status

Check these files to see progress:
- `PRD.md` - Active PRD with current task status
- `git log` - Recent commits by Ralph
- `tests/` - Test results and coverage

### Metrics

Track these metrics:
- **Tasks Complete:** Count `[x]` in PRD
- **Tasks Remaining:** Count `[ ]` in PRD
- **Compilation:** `cargo build --release` succeeds?
- **Tests Passing:** `cargo test --workspace` passes?
- **Coverage:** Run `cargo tarpaulin` for percentage

### Weekly Reviews

Every week:
1. Review Ralph's commits
2. Test core functionality manually
3. Update stakeholders on progress
4. Adjust PRD if priorities change
5. Plan next week's goals

---

## Example Session

Here's a typical Ralph session:

```bash
# Day 1: Setup
cd /home/lojak/Desktop/atlas-sphere-master
mv PRD_CRITICAL_PATH.md PRD.md
code .  # Open in VS Code

# In VS Code:
# 1. Click Ralph icon
# 2. Click "Start"
# 3. Watch Week 1, Task 1.1 execute
# 4. Ralph fixes build errors
# 5. Ralph commits: "fix: resolve all compiler warnings"
# 6. Task 1.1 marked [x]
# 7. Ralph moves to Task 1.2
# ... continues automatically

# Day 2: Check progress
git log --oneline -20
# See Ralph's commits

cargo test --workspace
# Verify all tests pass

# Day 3: Week 1 complete
# All Week 1 tasks marked [x]
# Ralph automatically starts Week 2

# Weeks 2-4: Continue monitoring
# Ralph works through remaining critical path

# Month 1 complete
# Switch to PRD_COMPLETE_PROJECT.md
# Continue to production ready!
```

---

## Getting Help

### Documentation
- **Ralph README:** `ralph-repo/README.md`
- **Complete Setup Guide:** `RALPH_SETUP_COMPLETE.md`
- **Quick Reference:** `RALPH_COMPLETE_REFERENCE.md`

### Commands
- **View Logs:** `Ctrl+Shift+P` → "Ralph: View Logs"
- **Open Panel:** `Ctrl+Shift+P` → "Ralph: Open Control Panel"
- **Quick Start:** `./ralph-quickstart.sh`

### Support
- **GitHub Issues:** Report problems with Ralph
- **VS Code Copilot Docs:** https://code.visualstudio.com/docs/copilot/
- **Ralph Repository:** https://github.com/aymenfurter/ralph

---

## Summary

### TL;DR - Get Started Now

1. **Choose PRD:**
   ```bash
   mv PRD_CRITICAL_PATH.md PRD.md  # Start with critical path
   ```

2. **Open Ralph:**
   - Click Ralph icon in VS Code sidebar

3. **Start Execution:**
   - Click "Start" button

4. **Monitor:**
   - Watch tasks get checked off
   - Review commits regularly
   - Run tests periodically

5. **Complete:**
   - After 4 weeks, critical path done
   - Switch to complete project PRD
   - Continue to production!

---

**You're ready!** Ralph will autonomously work through the entire Atlas Sphere project. 🚀

Open Ralph now and click Start to begin!
