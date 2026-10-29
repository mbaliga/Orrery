# Orrery — handoff for Claude Code (2026-10-29)

Read this file and nothing else first. Do **one task card** per session; start the session on **Sonnet, effort medium**; end it with a
commit and a three-line note appended to "Done" below. Do not carry a thread across tasks: write what must survive here, then `/clear`.

## Why this is written the way it is
The owner's plan limit is the scarce thing. The repo already ships a Usage ledger (`src/usage.js`) that showed one long session at
47% cache reads, 227 turns above 200k tokens of context and 91% at max effort. So: short sessions, narrow reads, Sonnet for build work,
and no screenshots unless a test fails. Read files by range (`sed -n 1,60p`, `grep -n`), never whole (`settings.js`, `ask.js`, `style.css` are long).

## What Orrery is
A single-file, local-first HTML work cockpit (notes, tasks, projects, a year graph, a map, a desk), built by `python3 build.py` from
`src/*.js` + `src/body.html` + `src/style.css` into `dist/personal-tracker.html` and `dist/test.html`. No bundler, no framework, no network
except opt-in calls (weather, a model the user attached). `window.T` is the namespace (`T.el`, `T.store.get/set`, `T.on/emit`, `T.toast`, `T.notes`,
`T.tasks`, `T.G` scan, `T.SEED`, `T.search`, `T.llm`, …). Module order is the `JS` list in `build.py`. Data (`src/graph.js`, `src/seed.js`) is private and
absent here; the build falls back to `src/*.sample.js`.

## Binding rules (do not relax)
1. No telemetry, analytics, or phoning home. Ever. 2. Local is the default; any hosted model is a **watched object**, opt-in per use, with
the exact payload shown first (`T.llm.preview`). 3. A key is encrypted at rest (AES-GCM, passphrase in memory only), never logged, exported,
or written into a note; sent only to its own provider. 4. Never compute what belongs to Baseline (EEG deviation): import and draw it.
5. Hue is never the only carrier of state (Hyle). 6. Never claim on-device behaviour works: the sandbox has no device, no live provider, no
microphone; say "owner-verified" for anything that is. 7. Notes and the message tree are append-only: fold, never overwrite.

## Orientation (module → job)
`usage.js` ledger (pure core `analyse/report`, runs in node) · `providers.js` models + vault (pure `build/read/derive/enc/dec`) ·
`recall.js` index: BM25, `T.search`, `T.similarNotes`, `T.foldNote`, wikilink refs, `T.indexDocs` · `desk.js` pinned notes, `H`, ties, stacks ·
`map.js` the Map (facet→mark table, lenses) over `ASOC.Graph` (kit; host draws nodes) · `bridge.js` Obsidian parse/zip, Baseline import,
`handoff/1`, voice out · `ask.js` Ask panel (results rows, `askLLM`, chips) · `settings.js` tabs → rows (`kind`: toggle range text secret file action
info; add a row, not a tab, unless told) · `compile.js` note→entity links · `board.js` kanban + notes · `look.js` sky/light/weather · `widgets.js` day measures.
Scripts: `scan/usage-collect.js` (content-free transcript digest), `scan/usage-hook.sh` (Claude Code Stop hook), `scan/sample.js`.

## Gate (run before every commit; all must print 0)
```
export NODE_PATH=$(npm root -g)          # needs playwright (npm i -g playwright; npx playwright install chromium)
python3 build.py
for t in usagetest providertest bridgetest; do node scan/$t.js | grep -c FAIL; done
for t in btest rtest deskt mtest xtest stest; do node tests/$t.js 2>&1 | grep -c "FAIL\|Error"; done
```
Tests write screenshots to `web/shots/` (gitignored); open one only when a test fails. Add a test for what you add; keep them fast.

## Hot-spot files (merge conflicts live here)
`settings.js` (rows), `body.html`, `style.css` (append at the end, under a `/* name */` comment), `app.js` (init calls), `build.py` (JS list), `ask.js` (results rows).
Rule for every card: put the work in **a new file**, wire it with at most ~10 lines in these, and say which lines in your note.

## The task cards

### T1 — Live provider check, streaming, honest failures · Sonnet/medium · needs the owner's device
Goal: the five providers work from a real browser. Add streaming (SSE) for Claude and OpenAI-compatible (`T.llm.chat` → optional `onToken`; Ask paints as it arrives),
a "Test the models" result that names CORS vs key vs model-name failures separately, and a fallback message with the one-line fix per provider (Ollama `OLLAMA_ORIGINS`).
Files: `providers.js` (+ ~40 lines), `ask.js` `askLLM`. Accept: unit tests for SSE chunk parsing (add to `scan/providertest.js`); mocked-server browser test streams tokens.
Cannot verify here: a live call. Leave a checklist in this file for the owner.

### T2 — Embeddings seam, hybrid retrieval · Sonnet/medium (decision made below) · depends on none
`T.embedder = { name, dim, embed(texts) → Promise<Float32Array[]> }`; first backends: the Llama endpoint's `/v1/embeddings` (Ollama) and any OpenAI-compatible provider the user
attached (watched, with the preview sheet). Cache vectors in IndexedDB keyed by doc id + text hash; compute lazily in idle batches of ≤32; never block typing.
`T.search` and `T.similarNotes` fuse BM25 and cosine by reciprocal rank when vectors exist, and fall back to words when not. Settings row: "Meaning search" (off by default, names the backend).
Files: new `src/embed.js`, small hooks in `recall.js` (`Index.prototype.search/similar`). Accept: node test with a fake embedder showing a rephrasing with no shared words is found
("one prefs file…" ↔ "a single preferences file…") only when vectors exist; off ⇒ identical to today.

### T3 — Usage ledger, week view and fitting · Sonnet/medium · none
This week / this month filter; per-day stacked bar (kinds); per-session table (top 8, with peak context); "what Sonnet would have cost" line from the same tokens; import dedupe by
`requestId` across files; a "Fit weights" row: the owner types the plan's own percentage used on several days, the page solves the model multipliers by least squares and shows the
residual, and says plainly if it does not fit. Files: `usage.js` (+ a new `usagefit.js` for the solver, pure, node-tested). Accept: tests for the solver on synthetic data.

### T4 — Themes by the sky · Sonnet/medium · **run alone, not in parallel** (touches every CSS rule)
Implement `docs/themes-by-the-sky.md` in its order: `T.theme()` tokens, `[data-theme]` CSS, continuous sky blend (never a step), Day light as a multiply dapple, contrast pass,
`themetest.js`. Do not start it while another card is open on `style.css`.

### T5 — Desk and Map polish · Sonnet/low · none
Screen-reader lists for the desk and the map (`#notesSr` pattern); keyboard: arrows move a focused desk note, Enter edits, Delete takes it off; Map on a phone (panel as a bottom sheet already
in CSS — verify at 390 px); "Save this view" from the Map to a named lens already works, add rename/delete. Files: `desk.js`, `map.js`. Accept: extend `deskt.js`/`mtest.js`.

### T6 — Obsidian polish · Sonnet/medium · none
Read-only vault keeps 800 excerpts in localStorage; move it to IndexedDB (no cap), re-read on demand by File System Access API where available (`showDirectoryPicker`), refresh button,
Tasks-plugin lines (`- [ ] … 📅 date`) offered as tasks (opt-in, never silently), `.canvas` cards optional as desk notes. Never write into the vault without a per-write confirm. Files: `bridge.js`.
Accept: parser tests for tasks/canvas; vault of 3000 synthetic notes imports without a quota error.

### T7 — Workspace persistence (git as the store) · **Opus/Fable for the design, then Sonnet** · design first, no code until the owner rules
Notes, desk places, usage digests, check-ins to `local/…` in the user's repo (envelope per the personal-data-repo spec; `notes/<id>.md` with front matter; merge driver per field). Deliverable of the
design session: a one-page contract and a migration, not code. Out of scope for a Sonnet session until written.

### T8 — Fonebrew side (other repo: `android-ide-studio`) · Sonnet/medium in *that* repo
(a) write a per-request `usage/1` ledger (same shape as `scan/usage-collect.js` output: session, project, time, model, tokens by kind, no content) so Orrery's Usage covers on-device and cloud;
(b) an entry point that takes a `handoff/1` file (`T.handoff` in `bridge.js` defines it) and opens the Agent with the task and context. Kotlin, JVM-tested. Do not touch Orrery in that session.

### Waiting on the owner (do not start)
The art-direction reference (video/screenshots); which step counter he wears (Health Connect vs watch; lives in Crocodyl); the "slanted toggle" (which Hyle switch); D-X/D-AL–D-AN follow-ups.

## Parallel or not
Total tokens are **higher** in parallel, not lower: each agent loads its own context and re-reads the repo; nothing is shared. Parallel buys wall-clock time only, at a cost in merges.
If you still want it: at most three agents, each in its own `git worktree`, on **T1, T2, T3** (disjoint: `providers.js`/`ask.js`, `embed.js`/`recall.js`, `usage.js`/`usagefit.js`), Sonnet, medium,
then one short integration session merges the ~10-line wirings. T5 and T6 can follow in the same way. T4 alone. T7 is a thinking session. T8 is another repo and can run any time.
Cheapest of all: one card at a time, fresh session each, in this order — T3, T1, T2, T5, T6, T4.

## Done (append: date · card · commit · what is still owner-verified)
- 2026-10-29 · usage ledger, five models, index, desk, map, vault, Baseline, handoff, voice · see git log · live provider calls, microphone, Notification flow: unverified here.
