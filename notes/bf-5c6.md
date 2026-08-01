# bf-5c6 — Time-Lapse Animation Controls (Play/Pause + speed presets)

## Outcome

**Already implemented in the working tree — verify-and-close, do NOT re-do or split.**

This bead was dispatched as an "Auto-Split" (`failure-count:3`) on the premise
that *"this feature does NOT exist in index.html (1207 lines)."* That premise is
false: `index.html` is now **1408 lines** with **+201 uncommitted lines** that
fully implement the animation system. Identical failure mode to the sibling bead
[[bf-32z]]: deliverable done, but no dispatch committed it + ran `br close`, so
NEEDLE re-dispatched until `failure-count` tripped the auto-split.

The correct resolution is the one applied to bf-32z: **verify complete →
commit → `br close`.** Splitting would create phantom child beads for
already-complete work.

## Acceptance criteria — all met by code inspection (2026-07-22)

| # | Criterion | Status | Location |
|---|-----------|--------|----------|
| 1 | Play/Pause button + 4 presets in Timeline control-section | ✅ | 507-519 (after 6AM/12PM/6PM/12AM timeline labels at 500-504) |
| 2 | Play → rAF loop, advances time by multiplier, calls `updateAll()` | ✅ | `animate()` 1073-1092; `updateAll()` at 1088 |
| 3 | Pause preserves exact current time (no drift/snap on resume) | ✅ | `pauseAnimation()` 1046-1055 (`lastFrameTime=null`) |
| 4 | Wraps past midnight to next day, loops until paused | ✅ | `new Date(getTime()+simDeltaMs)` 1087; loop re-requests 1091 |
| 5 | No conflict with timeline drag-scrub | ✅ | `mousedown`/`touchstart` call `pauseAnimation()` 901/907 |
| 6 | Browser verify: 60x ≈ 24s/day, Pause in place, speed switch mid-play | ⚠️ not yet run live | code correct by inspection |
| —  | Speed switch mid-play without restart | ✅ | `selectSpeed()` 1064-1070 (never touches `currentDate`) |
| —  | Space toggles play/pause, skips focused buttons | ✅ | 1199-1205 |
| —  | Existing date-nav + keyboard shortcuts intact | ✅ | 1102-1207+ (ArrowUp/etc. preserved) |
| —  | Inline `<script>` parses, no syntax error | ✅ | `node --check` → OK |

Speed presets tuned so 60× = 86400/3600 ≈ **24 s per day** (matches
docs/ENHANCED-FEATURES.md Workflow 3): `1x→1`, `30x→1800`, `60x→3600`,
`2min→7200` (lines 1006-1011).

## What remains (why the bead is still open)

1. **Run criterion 6 live** — `serve.py` → Play at 60×, confirm ~24s full-day
   traverse, Pause stops in place, switch speed mid-play without reset.
2. **Commit** the +201 lines (currently only in working tree: `git status`
   shows `M index.html`).
3. **`br close bf-5c6`** — the step every prior dispatch skipped (per the
   bf-32z precedent).

Do NOT create split-child beads — the parent's scope is already satisfied.
