# Orrery

*A System of Cells* — a work-management cockpit for one person first, and for teams running parallel sprints next.
One HTML file, local-first: it keeps its state in the browser, holds no account, runs no telemetry and talks to no
server unless you turn one connector on and it tells you which. It is the orchestrator between the apps of the
sovereign ecosystem (Fonebrew, Aarso, Baseline, Crocodyl, the shared libraries), and the desk you plan them from.

- `web/` — the page. `python3 build.py` writes `dist/personal-tracker.html` (the page) and `dist/test.html` (fonts
  from disk, for the test harness). See `web/README.md` for the build, the data split and the tests.
- The shared modules it draws with (cells, sounds, the rose, brand marks, the force graph, the gantt) live in
  [Shared-Libraries-asoc](https://github.com/mbaliga/Shared-Libraries-asoc) under `web/orrery-kit`; the build reads a
  sibling checkout and keeps a vendored snapshot in `web/src/vendor/orrery-kit`.
- The thinking — decisions, state, the competitive reading, the watch and dial briefs — is in the owner's private
  Personal-Tracker repo. The app is open; a person's workspace is theirs.

## What it is, in a screen

An ultrawide panorama (the chord of every project, its languages, libraries, agents and hours; the board; the day; the
crew; the signal), a tablet split and a phone stack of the same views, a Year with a force graph on the shared engine
and the runways to everything dated, a Dial for the phone (two rings round one centre: the lens, and how close), a
planner that derives your routine from your own commits, a body map and training segments, a notes compiler, an audit
of where work repeats, and a ceiling that follows the sun, the moon and — if you let it ask — the weather.

Licence: Apache-2.0.
