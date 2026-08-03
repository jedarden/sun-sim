# bf-wkr: Forgejo Migration + GitHub Actions Cleanup - ASSESSMENT COMPLETE

## Date: 2026-08-03

## Executive Summary

**STATUS**: Forgejo migration ✅ COMPLETE | GitHub mirror & Actions shutdown ❌ OPS-GATED

This bead assessed the sun-sim repository's git hosting and CI state. The Forgejo migration has been completed, but critical follow-up work (GitHub push mirror setup + GitHub Actions disable) is blocked by credential access and requires human decisions.

---

## Current State (2026-08-03)

### ✅ COMPLETED: Forgejo Migration
- **Git origin**: `git.ardenone.com/jedarden/sun-sim.git` (Forgejo)
- **Migration date**: Sometime between 2026-07-28 and 2026-08-03
- **Evidence**: `git remote -v` shows Forgejo origin only

### ❌ MISSING: GitHub Push Mirror
- **No GitHub remote configured** in checkout
- **Forgejo repo-level mirror**: Not configured (requires admin UI access)
- **Impact**: github.com/jedarden/sun-sim is now stale/abandoned

### ⚠️ CRITICAL: GitHub Actions Still Active
**GitHub Actions continues running on the abandoned GitHub repo:**

**Evidence from GitHub API:**
```
Recent workflow runs (all SUCCESS):
  b2c9af7 - Docker Build and Publish - completed
  071afe9 - Docker Build and Publish - completed  
  c14c6ac - Docker Build and Publish - completed
  5ebc2a2 - Docker Build and Publish - completed
  347fdb5 - Docker Build and Publish - completed
```

**Historical evidence in Forgejo repo:**
- `f5753cc` "ci: auto-bump version to 0.1.5" (2026-07-28)
- `9d6ed5e` "ci: auto-bump version to 0.1.4" (2026-07-27)

These commits were created by GitHub Actions when GitHub was still the origin.

### 📊 Version Drift Detected
- **Local VERSION file**: `0.1.5`
- **Deployed pod**: `ghcr.io/jedarden/sun-sim:0.1.6`
- **Latest git tag**: `v0.1.3`
- **Discrepancy**: Deployed version doesn't match VERSION file or git tags

---

## What Happened (Timeline)

### Pre-2026-07-27 (Historical State)
- GitHub was origin: `github.com/jedarden/sun-sim.git`
- GitHub Actions `.github/workflows/docker-publish.yml` actively running
- Auto-bumping VERSION on code changes
- Pushing images to `ghcr.io/jedarden/sun-sim:latest`

### 2026-07-22
- Argo Events sensor `sun-sim-sensor.yml` added to declarative-config (per bf-3gw notes)
- Cascade guard implemented: filters out `^ci: auto-bump` commits

### 2026-07-27-28
- GitHub Actions still active, producing auto-bump commits
- Images built and pushed to ghcr.io

### 2026-07-28-? (Forgejo Migration Window)
- Git origin migrated to Forgejo: `git.ardenone.com/jedarden/sun-sim.git`
- **Missing**: GitHub push mirror not configured
- **Missing**: GitHub Actions not disabled

### 2026-08-03 (Current State)
- Forgejo is origin ✅
- GitHub repo is stale ❌
- GitHub Actions still watching stale repo ⚠️
- No cascade loop (good!), but GitHub Actions is pushing to an abandoned target

---

## Remaining Work (OPS-GATED)

### 1. Forgejo Push Mirror Setup (Requires Forgejo Admin Access)
**Per CLAUDE.md Git Hosting section:**
```
Forgejo repo: git.ardenone.com/jedarden/sun-sim
Mirror target: https://github.com/jedarden/sun-sim.git
Direction: One-way push (Forgejo → GitHub)
```

**Steps:**
1. Access Forgejo admin UI: https://git.ardenone.com/jedarden/sun-sim/settings
2. Navigate to "Repository Mirrors" section
3. Add push mirror: `https://github.com/jedarden/sun-sim.git`
4. Configure as one-way push (not pull)
5. Test with a push to Forgejo main branch

**Blocking:** Requires Forgejo admin credentials

### 2. GitHub Actions Disable (Requires GitHub Repo Admin Access)
**Per hub-git reference: `reference_gh_actions_repo_level_drift`**

**Options:**
- **Option A (Recommended)**: Disable Actions at repo level
  - Navigate to: https://github.com/jedarden/sun-sim/settings/actions
  - Set "Workflow permissions" to "Read-only" or disable entirely
  
- **Option B**: Delete workflow file only
  - `rm .github/workflows/docker-publish.yml`
  - ⚠️ **WARNING**: Per hub-git, file deletion is NOT sufficient - must use repo settings

- **Option C**: Keep as emergency fallback
  - Disable temporarily, re-enable if Argo CI fails
  - Requires manual coordination with bf-2bc verification

**Blocking:** Requires GitHub repo admin credentials + human decision on fallback strategy

### 3. Cutover Timing Decision (Human Judgment Required)

**Scenario A: Immediate Cutover**
- Disable GitHub Actions now
- Rely entirely on Argo CI (not yet verified per bf-2bc)
- Risk: No CI if Argo has issues

**Scenario B: Gradual Cutover**
- Keep GitHub Actions disabled but ready
- Complete bf-2bc (verify Argo CI green)
- Then fully decommission GitHub Actions
- Coordinate with bf-4ke (remove .github/workflows)

**Scenario C: Parallel Run (NOT RECOMMENDED)**
- Keep both active until Argo verified
- Risk: Cascade loop if mirror setup triggers GitHub Actions
- GitHub Actions commits use `[skip ci]` but Argo filter only catches `^ci: auto-bump`

**Recommendation**: Scenario B (Gradual Cutover)

---

## Coordination With Other Beads

### bf-2bc (Verify Argo CI Green End-to-End)
- **Status**: Likely still pending
- **Dependency**: Should complete before GitHub Actions shutdown
- **Coordination**: Once bf-2bc confirms Argo is working, proceed with GitHub Actions disable

### bf-4ke (Remove .github/workflows After Argo Verified)
- **Status**: Pending
- **Dependency**: Blocked on bf-2bc completion
- **Coordination**: This bead (bf-wkr) handles repo-level disable; bf-4ke handles file cleanup

### bf-11s, bf-p9k, bf-3gw (Argo CI Implementation)
- **Status**: Complete (Argo sensor and cascade guard implemented)
- **Evidence**: Commits bc8df73, 726569f, 2eb4e5e
- **Coordination**: These are done, just need verification

---

## Technical Details

### GitHub Actions Workflow Behavior (`.github/workflows/docker-publish.yml`)

**Trigger**: Push to `main` branch
**Auto-bump condition**: Code files changed (`index.html|serve.py|Dockerfile|docs/`)
**Bump commit message**: `"chore: bump version to X [skip ci]"` (line 122)
**Image tags pushed**: 
- `:version` (e.g., `:0.1.5`)
- `:latest` ← **Banned pattern per workspace policy** (line 164)

### Argo Sensor Behavior (`sun-sim-sensor.yml` in declarative-config)

**Filter regex**: `^ci: auto-bump`
**Blocks**: Commits matching that pattern
**Does NOT block**: `"chore: bump version to X [skip ci]"`

**Cascade risk scenario** (if mirror is set up without disabling GH Actions):
1. Dev commits to Forgejo → mirror pushes to GitHub
2. GitHub push triggers GitHub Actions → creates bump commit with `[skip ci]`
3. Bump commit syncs back to Forgejo via mirror
4. Argo sensor sees `[skip ci]` commit → does NOT filter it out
5. Argo triggers build → creates VERSION bump commit
6. Loop continues...

**Current state**: No loop because mirror not set up, but GitHub Actions is pushing to an abandoned repo.

---

## Why This Is OPS-GATED

### Credential Access Required
1. **Forgejo admin UI**: Cannot access from CLI
2. **GitHub repo settings**: Cannot modify via API/CLI without proper PAT scopes

### Human Decisions Required
1. **Cutover timing**: Immediate vs gradual vs parallel
2. **Fallback strategy**: Keep GitHub Actions as emergency backup?
3. **Risk tolerance**: Argo CI not yet verified per bf-2bc

### Risk of Automation
- Wrong mirror direction could wipe Forgejo history
- Disabling Actions before Argo verified leaves no CI
- Improper cascade guard could trigger infinite build loop

---

## Acceptance Criteria (From Bead Description)

Original criteria:
- [ ] sun-sim hosted on git.ardenone.com as origin ✅ **DONE**
- [ ] GitHub as automated read-only push mirror ❌ **OPS-GATED**
- [ ] GitHub Actions disabled at repo-settings level ❌ **OPS-GATED**  
- [ ] Confirm no further concurrent GH-Actions-vs-Argo builds ❌ **NOT APPLICABLE** (no cascade loop yet)

**Status**: 1 of 4 criteria complete (25%)

---

## Recommendations

### For This Bead (bf-wkr)
**CLOSE AS DOCUMENTATION COMPLETE** with the following notes:
1. Forgejo migration assessment: ✅ Complete
2. GitHub mirror setup: ❌ OPS-GATED (requires Forgejo admin access)
3. GitHub Actions disable: ❌ OPS-GATED (requires GitHub admin access + human decision)
4. Coordinate with bf-2bc (Argo verification) and bf-4ke (file cleanup)

### For Human Operator
**Immediate actions:**
1. Decide on cutover timing (Scenario A/B/C above)
2. Access Forgejo admin UI and configure push mirror
3. Access GitHub repo settings and disable Actions (or decide to keep as fallback)
4. Coordinate with bf-2bc verification status

**Future actions:**
1. Complete bf-2bc (verify Argo CI green)
2. Complete bf-4ke (remove .github/workflows files)
3. Reconcile version drift (VERSION vs deployed vs git tags)

---

## Files Referenced

- `.github/workflows/docker-publish.yml` - GitHub Actions workflow (still active)
- `declarative-config/k8s/iad-ci/argo-events/sun-sim-sensor.yml` - Argo sensor (cascade guard)
- `VERSION` - Current version file (0.1.5)
- `notes/bf-wkr.md` - This file

## Related Beads

- `bf-2bc`: Verify Argo CI green end-to-end
- `bf-4ke`: Remove .github/workflows after Argo verified
- `bf-11s`: EventSource implementation
- `bf-p9k`: Sensor implementation with cascade guard
- `bf-3gw`: sun-sim entry added to Argo CI

---

**Bead Status**: ASSESSMENT COMPLETE, WAITING FOR HUMAN OPERATOR

**Next Action**: Human operator to decide on cutover timing and execute OPS-GATED steps
