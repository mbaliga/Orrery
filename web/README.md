# Orrery — the page

## Build
```
python3 build.py            # → dist/personal-tracker.html, dist/test.html
```
No bundler. `build.py` concatenates the shared kit (`cells.js sfx.js rose.js brands.js graph.js gantt.js`, read from a
sibling `Shared-Libraries-asoc/web/orrery-kit` checkout or from `src/vendor/orrery-kit`) and then `src/*.js` in the
order the file lists, into one page with `src/body.html` and `src/style.css`. Fonts come from Google Fonts in the page
and from `fonts/node_modules/@fontsource-variable/*` in `dist/test.html` (`cd fonts && npm install`).

## The data split — the app is open, the workspace is yours
Two files are *data*, not code, and are not in this repository:

| file | what | where it comes from |
|---|---|---|
| `src/graph.js` | the scan: projects, commits by day and hour, languages, libraries, shared modules, agents, PRs | `scan/scan.py` (git alone, no token) → `scan/build_data.py` |
| `src/seed.js` | the curated content: tasks, dated things, notes, ambitions, aliases, completion | written by hand, or by the page's own Export |

The build reads them from `$ORRERY_DATA` if set, else from `src/`, else falls back to `src/graph.sample.js` and
`src/seed.sample.js` — derived from a real workspace by `node scan/sample.js` with every project, group, module, task,
note and page renamed, so the page builds and runs for anyone. Keep your own two files in a private repo and point
`ORRERY_DATA` at it.

Still in code and due to move into data: the per-project store-readiness entries in `src/targets.js` and the dated
notes in the wiring sheet of `src/body.html`.

## Make it yours (no rebuild)
Open `dist/personal-tracker.html`. On a sample build a welcome sheet appears; it is also under Settings > Data > Show the welcome sheet.
```
# 1. scan your repos with git alone (no token). The window and who "you" are come from you:
export ORRERY_ME="Your Name,you@example.com"      # your commits count as yours
export ORRERY_SINCE=2026-05-01                    # default: the last 180 days
python3 scan/scan.py cache scan.json owner/repo owner/other-repo
python3 scan/prs.py  cache scan.json prs.json
python3 scan/build_data.py scan.json prs.json graph.js [workspace.json]   # see scan/workspace.example.json for names and groups

# 2. optional: your own tasks, dates and notes, as JSON (seed.js is code; the page only ever reads JSON)
node scan/tojson.js seed.js > seed.json
```
Then load `graph.js` (and `seed.json`) in the welcome sheet, or Settings > Data > Load my workspace, and name your GitHub account so links
point at it. They stay in this browser (localStorage) and nothing is sent anywhere. Settings > Data > Where each project runs lets you
tick platforms a scan cannot see; your choice wins over the scan. Settings > Data > Back to the built-in data undoes all of it.
Putting your platforms, targets and facts in your own seed (`platforms`, `platformsNot`, `targets`, `facts`) keeps them across rebuilds.

## Tests (Playwright, headless Chromium)
```
node tests/steps.js <size> '<json steps>' [hash]   # sizes: g9 g9low ipad ipadp pane phone laptop desk
node tests/gtest.js    # the Year's graph: brush, drag+pin, wheel, focus, context menu
node tests/glost.js    # the view cannot lose the graph; the minimap shows itself when part of it is out of view
node tests/dtest.js    # the phone's Dial: turn the lens ring, tap a level, every level renders
```
Shots land in `shots/`. The scripts expect `dist/test.html` and the Playwright module path used in the sandbox;
adjust the `require` at the top for your machine.
