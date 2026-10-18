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

## Tests (Playwright, headless Chromium)
```
node tests/steps.js <size> '<json steps>' [hash]   # sizes: g9 g9low ipad ipadp pane phone laptop desk
node tests/gtest.js    # the Year's graph: brush, drag+pin, wheel, focus, context menu
node tests/glost.js    # the view cannot lose the graph; the minimap shows itself when part of it is out of view
node tests/dtest.js    # the phone's Dial: turn the lens ring, tap a level, every level renders
```
Shots land in `shots/`. The scripts expect `dist/test.html` and the Playwright module path used in the sandbox;
adjust the `require` at the top for your machine.
