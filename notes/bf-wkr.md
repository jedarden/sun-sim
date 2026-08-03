# bf-wkr: Forgejo Migration + GitHub Actions Shutdown Assessment

## Date: 2026-08-03

## Current State Analysis

### ✅ Forgejo Migration: ALREADY COMPLETE
- Git origin is already **Forgejo**: `git.ardenone.com/jedarden/sun-sim.git`
- This contradicts the bead description's claim that origin was GitHub
- The Forgejo migration was completed sometime between bead creation and now

### ❌ GitHub Mirror: NOT CONFIGURED
- No GitHub remote exists in the checkout
- No `github.com` mirror configured
- This violates CLAUDE.md Git Hosting policy requirement

### ⚠️ CRITICAL: Split-Brain CI Scenario
**GitHub Actions is STILL ACTIVE** on github.com/jedarden/sun-sim:

**Evidence:**
1. GitHub API shows recent successful runs:
   - `b2c9af7` - push - completed (success)
   - `071afe9` - push - completed (success)
   - `c14c6ac` - push - completed (success)
   - `5ebc2a2` - push - completed (success)
   - `347fdb5` - push - completed (success)

2. Recent auto-bump commits in Forgejo origin:
   - `f5753cc` "ci: auto-bump version to 0.1.5"
   - `9d6ed5e` "ci: auto-bump version to 0.1.4"

3. Version drift detected:
   - Local `VERSION` file: `0.1.5`
   - Deployed pod: `ghcr.io/jedarden/sun-sim:0.1.6`
   - Latest git tag: `v0.1.3`

4. `.github/workflows/docker-publish.yml` still exists and uses `:latest` tag (line 164)

### ⚠️ Dual-CI Cascade Risk: LIVE
Both systems are watching the **same GitHub.com repo** but the Forgejo repo is now the origin:

**GitHub Actions workflow (`.github/workflows/docker-publish.yml`):**
- Triggers on: push to `main` branch
- Auto-bumps VERSION when code files change
- Commit message: `"chore: bump version to X [skip ci]"` (line 122)
- Pushes `:latest` tag to ghcr.io (line 164) - **banned pattern**

**Argo sensor (`sun-sim-sensor.yml` in declarative-config):**
- Filters out: `^ci: auto-bump` commits (regex match)
- **Does NOT filter**: `"chore: bump version to X [skip ci]"`
- Would re-trigger on GH Actions commits

**Current cascade risk:**
1. Dev commits to Forgejo origin → pushes to mirror (not yet set up)
2. Mirror push triggers GitHub Actions → bump commit
3. Bump commit syncs back to Forgejo → triggers Argo build
4. Argo build's VERSION push syncs to mirror → re-triggers GitHub Actions
5. **Loop until manual intervention**

## What Needs to Happen

### 1. Set Up GitHub Push Mirror (Forgejo-side)
Per CLAUDE.md Git Hosting section:
- Add push mirror on git.ardenone.com/jedarden/sun-sim
- Target: https://github.com/jedarden/sun-sim.git
- Direction: Forgejo → GitHub (one-way push mirror)
- This requires Forgejo admin UI access

### 2. Disable GitHub Actions (GitHub-side)
**Must be done via GitHub repo settings, not just file deletion:**
- Navigate to: https://github.com/jedarden/sun-sim/settings/actions
- Disable "Workflow permissions" or set to "Read-only"
- Per hub-git reference: `reference_gh_actions_repo_level_drift`

### 3. Decide on Cutover Timing
Options:
- **A. Immediate shutdown**: Disable GH Actions now, rely only on Argo
- **B. Gradual**: Keep GH Actions disabled but ready as fallback
- **C. Parallel run**: Keep both active until Argo fully verified (risky cascade)

### 4. Version Cleanup
- Reconcile VERSION file with deployed version
- Tag current deployed version (0.1.6) if not already tagged
- Update deployment to use Forgejo-built images

## Blocking Issues

1. **Credentials required**: Cannot access Forgejo admin UI or GitHub repo settings
2. **Human decision needed**: Cutover timing strategy
3. **Coordination**: bf-2bc (verify Argo CI) and bf-4ke (remove .github/workflows) are separate beads
4. **Risk**: Disabling GH Actions before Argo is verified leaves no CI

## Recommendation

**DO NOT proceed with migration work - it's already done but incomplete:**

1. The Forgejo migration happened, but the mirror setup was missed
2. GitHub Actions is still active, creating a split-brain scenario
3. This bead should be closed with a note that:
   - Migration is 50% complete (Forgejo origin ✅, GitHub mirror ❌)
   - Requires human intervention for:
     - Forgejo push mirror setup
     - GitHub Actions repo-level disable
     - Cutover timing decision
   - Coordinate with bf-2bc (Argo verification) and bf-4ke (cleanup)

**Alternative**: Re-scope this bead to document-only, create new OPS-GATED bead for the remaining infra work.
