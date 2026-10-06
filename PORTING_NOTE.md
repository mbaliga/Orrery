# Orrery: multi-platform porting note

> Part of the constellation-wide porting program (`Personal-Tracker/PORTING_PROGRAM.md`, 2026-10-06).
> Status: **PLAN. Nothing in this note was built or run.** A disposition note, not a full plan: this repo has no
> product to port. Every platform cell below carries the evidence label `PLAN`.

## 1. What this repo is

On 2026-10-06 the checkout holds four commits and two files: the stock Apache-2.0 `LICENSE` (appendix still reading
`Copyright [yyyy] [name of copyright owner]`) and `.github/workflows/cleanup-artifacts.yml`, a six-hourly job that
deletes all but the three newest Actions artifacts per name, and all Actions caches. That is account-storage housekeeping
(program OQ-20), not product code, and this note does not touch it. No README, source, build file or state file exists,
so there is no stack, size or test count to measure. The repo is public (program §5, from the GitHub API on 2026-10-06).

The product is unreconciled: `Personal-Tracker/DECISIONS.md` D-W is still OPEN. Three descriptions of "Orrery" exist:

- **A, read-only pipeline viewer.** Assay's docs (PR #1 `docs/INTEGRATIONS.md`, `docs/V2-ROADMAP.md` Epic O; summarised in
  `Personal-Tracker/CONSTELLATION.md`): reads Assay's audit bus, shows status, holds no mutation capability.
- **B, coordination layer.** Owner-stated 2026-08-03 (`Android-IDE-Studio/docs/FONEBREW_OVERVIEW.md` §9.4): detect sibling
  apps, observe their performance locally, coordinate sync. That section flags it as not matching A.
- **C, watchface.** The roster's original brief; `asystemofcells/packages/roster/README.md` omits Orrery on purpose
  and says the constellation notes suggest a renamed Assay.

## 2. Target matrix (owner's order)

Effort is 0 now, unknown after D-W: nothing exists to build, which does not mean any platform was found easy.

| Target | Feasibility | Approach and blockers | Evidence today |
|---|---|---|---|
| Ubuntu Touch | not-applicable (no source) | None; a Waydroid answer would route through OQ-21 | PLAN |
| Linux desktop | not-applicable (no source) | None; a Kotlin A or B would use program §4.2's Compose desktop head | PLAN |
| iOS / iPadOS | not-applicable (no source) | None; viability of A or B under iOS rules is unknown, not assessed | PLAN |
| macOS | not-applicable (no source) | None; would ride the Linux JVM binaries (§4.2, §7) | PLAN |
| Windows | not-applicable (no source) | None; same as macOS | PLAN |

## 3. Tier, wave and rules that bind later

Tier **skip**, matching the program's §5 row (gate: D-W reconciliation); no §7 wave includes it. When D-W defines a
product, a full plan replaces this note and R8 (§4.6) is applied by source stack then: a Kotlin + Compose app with a
pure-Kotlin domain goes KMP + CMP (the likely case for A); B is OS-service-shaped, a labelled reframe (R12); C falls under
the program's watch-face reframe row (OQ-6). Binding on any future Orrery: no telemetry, so B's "performance tracking" stays local
observation (I-1); colour never carries meaning alone (I-3; OQ-29 omits Orrery, so its Hyle status is undecided); no
identifier in a manifest before a `NAMES.md` row exists (R11); no device claims (I-4). F12's roster work must not add
Orrery, since roster changes need owner confirmation. Program §6 foundation: consumes and provides none today; if A is
ruled, F5, F9 and F11 apply (F1 only if it becomes a Hyle consumer); Assay's proposed `console-core` is the candidate validator.

## 4. Open questions for the owner

1. **Which Orrery, or none (PT:D-W; no separate master OQ id, OQ-30 names the same reconciliation).** A, B, C or stale.
   PROPOSAL, not a ruling: once decided, correct the out-of-date "No repo exists" in `CONSTELLATION.md` and `NAMES.md`; if
   stale, consider archiving this repo (D-H's reversible precedent). *Blocks:* every Orrery plan, the Orrery row, the roster.
2. **What an A-shaped Orrery reads (OQ-30).** Assay's `orrery-status` projection or PR #3's `.assay/assay-index.v1.json`;
   is any off-Android viewer wanted before Assay's V2 Epic B? *Blocks:* any Orrery viewer plan; Assay's viewer rows.

## 5. Sources read

This repo: `LICENSE`, `.github/workflows/cleanup-artifacts.yml`, `git log`. Program and registry: `Personal-Tracker/PORTING_PROGRAM.md`,
`CONSTELLATION.md`, `NAMES.md`, `DECISIONS.md`, `STATE.md` (all under `Personal-Tracker/`). Definitions: Assay PR #1 `docs/INTEGRATIONS.md`
and `docs/V2-ROADMAP.md`; `Android-IDE-Studio/docs/FONEBREW_OVERVIEW.md` §9.4; `asystemofcells/packages/roster/README.md`;
`assay/docs/PORTING-PLAN.md`. No README or state file exists here, so no pointer line was added to any file.
