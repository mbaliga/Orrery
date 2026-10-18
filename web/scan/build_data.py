#!/usr/bin/env python3
"""
Turn scan.json and prs.json (both measured from git) plus a small curated table (names,
clusters, and what is known about repos the scan could not read) into the graph the page draws.

Every node and edge carries where it came from:
  "scan"  measured from git today
  "notes" filled from notes because the repo is private and was not scanned

Usage:  python3 -I build_data.py <scan.json> <prs.json> <out.js>
"""
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

scan_path, prs_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
META = json.load(open(scan_path))
SCAN = {r["name"]: r for r in META["repos"] if r.get("ok")}
PRS = json.load(open(prs_path))
IST = timezone(timedelta(hours=5, minutes=30))
SCANNED = datetime.fromisoformat(META["scanned_at"].replace("Z", "+00:00"))


def parse(t):
    return datetime.fromisoformat(t.replace("Z", "+00:00"))


# ---------------------------------------------------------------- projects
# id, display name, repo, cluster, state, visibility
P = [
    # Fonebrew family
    ("fonebrew", "Fonebrew", "Android-IDE-core", "fonebrew", "active", "public"),
    ("studio", "Fonebrew Studio", "Android-IDE-Studio", "fonebrew", "stalled", "private"),
    ("asom", "ASOM", "asystemofmodels", "fonebrew", "active", "public"),
    ("assay", "Assay", "assay", "fonebrew", "active", "public"),
    ("csapp", "CS App", "csapp", "fonebrew", "active", "public"),
    ("orrery", "Orrery", "Orrery", "fonebrew", "seeded", "public"),
    ("aarso", "Aarso", "Aarso", "fonebrew", "parked", "private"),
    # everyday tools
    ("fylz", "Fylz", "Fyl-Manager", "tools", "active", "public"),
    ("fotoz", "Fotoz", "Foto-Xplorr", "tools", "active", "public"),
    ("clackpad", "Clackpad", "Clackpad", "tools", "shipping", "private"),
    ("nooz", "Nooz", "nooz", "tools", "shipping", "public"),
    ("bos", "BOS Launcher", "BOS_launcher", "tools", "stalled", "public"),
    ("edge", "Redmagic Edge", "Redmagic-Edge", "tools", "parked", "public"),
    # maker tools
    ("alloy", "Alloy", "Alloy", "maker", "active", "public"),
    ("typewright", "Typewright", "Typewright", "maker", "active", "public"),
    ("hafx", "HAfx", "hnm_playground", "maker", "active", "public"),
    ("figma", "Figma plugins", "asystemofcells-figma", "maker", "seeded", "private"),
    # body and signal
    ("baseline", "Baseline", "baseline", "signal", "parked", "private"),
    ("ebbflow", "Ebbflow", "Ebbflow", "signal", "active", "public"),
    ("mw75", "mw75-streamer", "mw75-streamer", "signal", "parked", "public"),
    ("crocodyl", "Crocodyl", "Form-analyser", "signal", "active", "public"),
    ("bocal", "Bocal", "Bocal", "signal", "active", "public"),
    # play
    ("animalcules", "Animalcules", "Animalcules", "play", "shipping", "private"),
    ("argonautica", "Argonautica", "RTS-live-wallpapers", "play", "active", "private"),
    ("inrts", "IN-RTS", "IN-RTS", "play", "active", "private"),
    ("watch", "Watch faces", "Watch-Apps", "play", "active", "private"),
    ("runout", "Runout", "Music_Player", "play", "seeded", "public"),
    ("clavis", "Clavis", "Clavis", "play", "active", "private"),
    ("gearvr", "LG Gear VR port", "LG-Gear-VR-port", "play", "parked", "public"),
    # research
    ("chakravyuha", "Chakravyuha", "chakravyuha", "research", "active", "private"),
    # foundations
    ("hyle", "Hyle", "Hyle-Design-System", "foundations", "active", "public"),
    ("hyledeco", "Hyle Deco", "HyleDeco-gf", "foundations", "active", "public"),
    ("shared", "Shared Libraries", "Shared-Libraries-asoc", "foundations", "active", "public"),
    ("twa", "twa-template", "twa-template", "foundations", "seeded", "public"),
    ("tracker", "Personal Tracker", "Personal-Tracker", "foundations", "active", "private"),
    # web
    ("asoc", "asystemofcells.com", "asystemofcells", "web", "shipping", "public"),
    ("portfolio", "mdhv.xyz", "portfolio", "web", "shipping", "private"),
    ("artstudio", "Art Studio", "Art-Studio", "web", "seeded", "public"),
]
CLUSTERS = [
    ("fonebrew", "Fonebrew family"), ("tools", "Everyday tools"), ("maker", "Maker tools"),
    ("signal", "Body and signal"), ("play", "Play"), ("research", "Research"),
    ("foundations", "Foundations"), ("web", "Web"),
]
REPO_PID = {repo: pid for pid, _n, repo, _c, _s, _v in P}

# What is known about the private repos (not scanned). Activity is a rough guess and is drawn
# as an outline, never as a measured value. "pushed" is the real last-push date of the repo.
NOTES = {
    "studio": dict(langs={"Kotlin": 1}, tech=["Jetpack Compose", "Room", "OkHttp", "llama.cpp"],
                   shared=["hyle", "crash-recovery"], est=22, pushed="2026-09-16"),
    "aarso": dict(langs={"Kotlin": 1}, tech=[], shared=[], est=4, pushed="2026-09-12"),
    "clackpad": dict(langs={"Kotlin": .55, "JavaScript": .3, "HTML": .15},
                     tech=["ML Kit", "MediaPipe", "Play Billing", "WebView bridge"],
                     shared=["crash-recovery", "diagnostics"], est=46, pushed="2026-09-30"),
    "figma": dict(langs={"TypeScript": 1}, tech=["Figma Plugin API"], shared=["hyle", "twa-template"],
                  est=6, pushed="2026-09-12"),
    "baseline": dict(langs={"Kotlin": 1}, tech=[], shared=["evidence-schema", "mw75-stream"], est=6,
                     pushed="2026-09-16"),
    "animalcules": dict(langs={"Kotlin": .5, "JavaScript": .4, "Rust": .1},
                        tech=["Canvas and WebGL", "Tauri", "Play Billing"], shared=["crash-recovery"],
                        est=34, pushed="2026-09-28"),
    "argonautica": dict(langs={"JavaScript": .7, "GLSL": .2, "HTML": .1}, tech=["Canvas and WebGL"],
                        shared=[], est=30, pushed="2026-09-29"),
    "inrts": dict(langs={}, tech=[], shared=[], est=14, pushed="2026-09-16"),
    "watch": dict(langs={"Monkey C": .4, "JavaScript": .35, "Python": .15, "HTML": .1},
                  tech=["Connect IQ", "Wear OS WFF", "Canvas and WebGL"], shared=[], est=10,
                  pushed="2026-09-12"),
    "clavis": dict(langs={"JavaScript": .8, "HTML": .2}, tech=["AntV G6", "Canvas and WebGL"], shared=[],
                   est=40, pushed="2026-10-01"),
    "chakravyuha": dict(langs={"JavaScript": .6, "Python": .4}, tech=["D3"], shared=[], est=3,
                        pushed="2026-05-23"),
    "tracker": dict(langs={"Shell": 1}, tech=["GitHub Actions"], shared=[], est=12, pushed="2026-10-06"),
    "portfolio": dict(langs={"JavaScript": .9, "CSS": .1}, tech=["React", "Vite", "Three.js", "Vercel"],
                      shared=[], est=8, pushed="2026-09-12"),
}

# ------------------------------------------------------------ tech mapping
TECH_RULES = [
    ("androidx.compose", "Jetpack Compose"), ("org.jetbrains.compose", "Compose Multiplatform"),
    ("androidx.room", "Room"), ("app.cash.sqldelight", "SQLDelight"), ("io.ktor", "Ktor"),
    ("com.squareup.okhttp3", "OkHttp"), ("io.coil-kt", "Coil"), ("com.google.mlkit", "ML Kit"),
    ("com.google.android.gms:play-services-mlkit", "ML Kit"), ("com.google.mediapipe", "MediaPipe"),
    ("androidx.camera", "CameraX"), ("com.google.dagger:hilt", "Hilt"), ("org.maplibre", "MapLibre"),
    ("androidx.media3", "Media3"), ("androidx.work", "WorkManager"),
    ("com.hierynomus", "sshj and smbj"), ("com.microsoft.onnxruntime", "ONNX Runtime"),
    ("net.java.dev.jna", "JNA"), ("org.jetbrains.skiko", "Skiko"), ("py:fonttools", "fontTools"),
    ("crate:uniffi", "UniFFI"), ("crate:cxx-qt", "cxx-qt"), ("npm:react", "React"),
    ("npm:next", "Next.js"), ("npm:vite", "Vite"), ("npm:three", "Three.js"),
    ("npm:@react-three", "Three.js"), ("npm:astro", "Astro"), ("npm:tailwindcss", "Tailwind"),
    ("npm:lit", "Lit"), ("npm:storybook", "Storybook"), ("npm:style-dictionary", "Style Dictionary"),
    ("npm:@capacitor", "Capacitor"), ("npm:playwright", "Playwright"), ("npm:@axe-core", "Playwright"),
    ("npm:drizzle-orm", "Drizzle"), ("npm:wrangler", "Cloudflare Workers"),
    ("npm:@vercel", "Vercel"), ("npm:iwanthue", "iwanthue"), ("npm:@mozilla/readability", "Readability"),
    ("py:bleak", "bleak"), ("py:pylsl", "Lab Streaming Layer"),
    ("com.google.androidbrowserhelper", "Trusted Web Activity"),
    ("io.github.takahirom.roborazzi", "Roborazzi"), ("org.robolectric", "Robolectric"),
    ("com.google.crypto.tink", "Tink"), ("net.lingala.zip4j", "zip4j"),
]
SUBMODULE_TECH = {
    "llama.cpp": "llama.cpp", "stable-diffusion.cpp": "stable-diffusion.cpp",
    "OrcaSlicer": "OrcaSlicer", "libarchive": "libarchive", "zstd": "libarchive",
    "lz4": "libarchive", "xz": "libarchive", "zlib": "libarchive", "bzip2": "libarchive",
}
SHARED_RULES = {
    "dev.aarso:hyle": "hyle", "includeBuild:hyle-design-system": "hyle",
    "dev.aarso:crash-recovery": "crash-recovery", "dev.aarso:cell-shell": "cell-shell",
    "dev.aarso:search-core": "search-core", "dev.aarso:evidence-schema": "evidence-schema",
    "dev.aarso:feedback": "feedback",
}
# Shared links that live outside build files (documented in READMEs and the registry).
SHARED_EXTRA = {
    "fonebrew": ["model-catalogue", "asom-router", "search-core"], "nooz": ["model-catalogue", "asom-router"],
    "ebbflow": ["mw75-stream", "baseline-engine", "evidence-schema"],
    "crocodyl": ["baseline-engine", "evidence-schema", "crash-recovery"],
    "baseline": ["mw75-stream"], "asoc": ["asoc-kit"], "bos": ["crash-recovery"],
    "hafx": ["crash-recovery"], "bocal": ["local-session"], "clackpad": ["asom-router"],
    "assay": ["evidence-bus"], "csapp": ["evidence-bus"], "orrery": ["evidence-bus"],
    "studio": ["evidence-bus"], "hyle": ["hyle-fonts"], "typewright": ["hyle-fonts"],
    "fylz": ["search-core"], "fotoz": ["search-core"],
}
SHARED_LABEL = {
    "hyle": "Hyle tokens", "crash-recovery": "crash-recovery", "cell-shell": "cell-shell",
    "search-core": "search-core", "evidence-schema": "evidence-schema", "feedback": "feedback",
    "diagnostics": "diagnostics", "model-catalogue": "model catalogue", "asom-router": "ASOM router",
    "mw75-stream": "MW75 stream", "baseline-engine": "Baseline engine", "asoc-kit": "@asoc/kit",
    "local-session": "local-session", "evidence-bus": "audit bus", "hyle-fonts": "Hyle fonts",
    "twa-template": "TWA template",
}
SHARED_HOME = {  # which project owns the shared thing
    "hyle": "hyle", "crash-recovery": "shared", "cell-shell": "shared", "search-core": "shared",
    "evidence-schema": "shared", "feedback": "shared", "diagnostics": "shared",
    "model-catalogue": "nooz", "asom-router": "asom", "mw75-stream": "mw75",
    "baseline-engine": "baseline", "asoc-kit": "asoc", "local-session": "shared",
    "evidence-bus": "assay", "hyle-fonts": "hyledeco", "twa-template": "twa",
}
LANG_FOLD = {"CMake": None, "AIDL": None, "CSS": "HTML and CSS", "HTML": "HTML and CSS", "Astro": "JavaScript",
             "Java": "Java", "C": "C and C++", "C++": "C and C++"}

AGENTS = [
    ("you", "You", "person"), ("claude-sonnet", "Claude Sonnet", "cloud"),
    ("claude-opus", "Claude Opus", "cloud"), ("claude-fable", "Claude Fable", "cloud"),
    ("claude-other", "Claude, model not recorded", "cloud"), ("codex", "Codex", "cloud"),
    ("named", "Named build agents", "cloud"),
]
# Kinds of work, read from commit subjects by the rules in scan.py.
KINDS = [("build", "Build"), ("docs", "Plans and docs"), ("ci", "CI and tooling"), ("test", "Test and evidence"),
         ("fix", "Fix"), ("design", "Design"), ("release", "Release")]


def agent_of(label):
    l = (label or "").lower()
    if l in ("madhav baliga", "mbaliga"):
        return "you"
    if "codex" in l:
        return "codex"
    if "sonnet" in l:
        return "claude-sonnet"
    if "opus" in l:
        return "claude-opus"
    if "fable" in l or "mythos" in l:
        return "claude-fable"
    if "claude" in l:
        return "claude-other"
    if "[bot]" in l:
        return None
    return "named"


# ---------------------------------------------------------------- branch names -> titles
WORDS = {"fylz": "Fylz", "fotoz": "Fotoz", "asom": "ASOM", "ci": "CI", "ui": "UI", "ut": "UT", "mvp": "MVP",
         "crocodyl": "Crocodyl", "fonebrew": "Fonebrew", "hyle": "Hyle", "alloy": "Alloy", "nooz": "Nooz",
         "mw75": "MW75", "api": "API", "ime": "IME", "p1": "P1", "pr7": "PR 7", "g1": "G1", "vr": "VR",
         "b": "B", "prusa": "Prusa"}
REAL_WORDS = {"status", "update", "system", "design", "layout", "module", "engine", "schema", "search", "launch",
              "widget", "plugin", "visual", "render", "native", "mobile", "tablet", "export", "import", "remote",
              "review", "branch", "mirror", "colour", "colors", "themes", "tokens", "studio", "parity", "splits"}


def human(branch):
    b = re.sub(r"^(claude|codex|agent|batch|feat|feature|fix|chore|docs|release)/", "", branch)
    m = re.search(r"-([A-Za-z0-9]{5,6})$", b)
    if branch.startswith("claude/") and m and m.group(1).lower() not in REAL_WORDS:
        b = b[:m.start()]
    b = re.sub(r"(?<=[a-z])(?=\d)", " ", b) if re.match(r"stage\d", b) else b
    words = [WORDS.get(w.lower(), w) for w in re.split(r"[-_/]+", b) if w]
    t = " ".join(words)
    t = t.replace("multi platform", "Multi-platform").replace("phone first", "phone-first")
    t = t.replace("Fylz Fotoz complete", "Fylz and Fotoz, complete")
    return t[:1].upper() + t[1:]


projects = []
tech_count, lang_total, agent_total = Counter(), Counter(), Counter()
model_total = Counter()
all_days = defaultdict(Counter)
all_times = []
recent_all = []
hours_ist = Counter()
hours_ag = Counter()
wdays_you = Counter()
wdays_ag = Counter()
named_labels = Counter()
agent_last = {}
lately_all = []      # (utc, pid, agent, branch, subject, work)
kind_total = Counter()
lane_share = {}

for pid, name, repo, cluster, state, vis in P:
    s = SCAN.get(repo)
    node = dict(id=pid, name=name, repo=repo, cluster=cluster, state=state, vis=vis)
    langs, tech, shared, agents = Counter(), set(), set(), Counter()
    if s:
        node["src"] = "scan"
        node["branch"] = s["tree_branch"]
        node["branches"] = s["branch_count"]
        node["files"] = s["files"]
        node["commits"] = s["commits"]
        node["last"] = s["last_commit"]
        for l, n in s["langs"].items():
            l2 = LANG_FOLD.get(l, l)
            if l2:
                langs[l2] += n
        node["source_files"] = sum(langs.values())
        for dep in s["deps"]:
            for pref, t in TECH_RULES:
                if dep.startswith(pref) or (pref.startswith(("npm:", "py:", "crate:")) and dep == pref):
                    tech.add(t)
        for sm in s["submodules"]:
            leaf = sm["url"].rstrip("/").split("/")[-1].replace(".git", "")
            for k, t in SUBMODULE_TECH.items():
                if k.lower() == leaf.lower():
                    tech.add(t)
        for dep in s["internal"]:
            if dep in SHARED_RULES:
                shared.add(SHARED_RULES[dep])
        for label, n in s["actor_labels"].items():
            a = agent_of(label)
            if a:
                agents[a] += n
                if a.startswith("claude"):
                    model_total[label] += n
                if a == "named":
                    named_labels[label] += n
        for d, c in s["days_by_kind"].items():
            all_days[d].update(c)
        for t, k, lab in s["times"]:
            all_times.append((t, k, pid))
            ag = agent_of(lab)
            if ag and t[:10] > agent_last.get(ag, ""):
                agent_last[ag] = t[:10]
        for h, n in s["person_hours_ist"].items():
            hours_ist[int(h)] += n
        # when this project gets worked on: your commits by IST hour and weekday (author clock is IST, checked
        # against person_hours_ist), the agents' by the same, read from their UTC author clocks
        hy, ha, wy, wa = [0] * 24, [0] * 24, [0] * 7, [0] * 7
        hk, wk = s.get("hours_ist_by_kind"), s.get("wdays_by_kind")
        if hk:
            # a scan that recorded every actor's IST hour itself
            for k, arr in hk.items():
                for h in range(24):
                    (hy if k == "person" else ha)[h] += arr[h] if k in ("person", "claude", "codex", "named") else 0
            for k, arr in wk.items():
                for w in range(7):
                    (wy if k == "person" else wa)[w] += arr[w] if k in ("person", "claude", "codex", "named") else 0
        for t, k, lab in ([] if hk else s["times"]):
            if k == "person":
                hy[int(t[11:13])] += 1
                wy[datetime.fromisoformat(t).weekday()] += 1
            elif k in ("claude", "codex", "named"):
                dt = datetime.fromisoformat(t).replace(tzinfo=timezone.utc).astimezone(IST)
                ha[dt.hour] += 1
                wa[dt.weekday()] += 1
        node["hours"] = dict(you=hy, ag=ha)
        node["wdays"] = dict(you=wy, ag=wa)
        for h in range(24):
            hours_ag[h] += ha[h]
        for w in range(7):
            wdays_you[w] += wy[w]
            wdays_ag[w] += wa[w]
        for c in s["recent"]:
            recent_all.append(dict(t=c["t"], p=pid, s=c["s"], a=agent_of(c["who"]) or "bot", who=c["who"],
                                   ref=c["ref"]))
        for t, k, lab, ref, subj, work in s.get("lately", []):
            ag = agent_of(lab)
            if ag:
                lately_all.append((t, pid, ag, ref, subj, work))
        node["weeks"] = s["weeks"]
        kinds = {k: v for k, v in (s.get("kinds") or {}).items()}
        tot = sum(kinds.values()) or 1
        lane_share[pid] = {k: round(v / tot, 3) for k, v in kinds.items() if v / tot >= 0.04}
        for k, v in kinds.items():
            kind_total[k] += v
        pr = PRS.get(repo) or {}
        node["prs"] = pr.get("total", 0)
        node["prs_open"] = len(pr.get("open", []))
        node["prs_merged"] = len(pr.get("merged", []))
    else:
        n = NOTES.get(pid, {})
        node["src"] = "notes"
        node["commits"] = n.get("est", 2)
        node["last"] = n.get("pushed", "")
        node["source_files"] = 0
        for l, share in n.get("langs", {}).items():
            l2 = LANG_FOLD.get(l, l)
            if l2:
                langs[l2] += share * 100
        tech.update(n.get("tech", []))
        shared.update(n.get("shared", []))
    shared.update(SHARED_EXTRA.get(pid, []))
    if pid in NOTES:
        tech.update(NOTES[pid].get("tech", []))
    # an owner never "depends on" its own shared thing
    shared = {x for x in shared if SHARED_HOME.get(x) != pid}
    # keep languages that are at least 4 percent of the source files, at most five
    tot = sum(langs.values()) or 1
    langs = {l: round(v / tot, 3) for l, v in langs.most_common(5) if v / tot >= 0.04}
    node["langs"] = langs
    node["tech"] = sorted(tech)
    node["shared"] = sorted(shared)
    node["agents"] = dict(agents)
    for t in tech:
        tech_count[t] += 1
    for l, v in langs.items():
        lang_total[l] += v
    for a, v in agents.items():
        agent_total[a] += v
    projects.append(node)

# tech shown on the chord: used by two or more projects, or one of a few that define a project
KEEP_SINGLE = {"llama.cpp", "OrcaSlicer", "MapLibre", "CameraX", "Ktor", "Astro", "Capacitor", "Connect IQ",
               "ONNX Runtime", "Tauri", "D3", "AntV G6", "Lab Streaming Layer", "fontTools", "cxx-qt",
               "Media3", "Lit"}
DROP = {"Robolectric", "Roborazzi", "Playwright", "JNA", "Tink", "zip4j", "Storybook", "Style Dictionary",
        "iwanthue", "Readability", "Drizzle", "Skiko", "UniFFI", "Hilt", "stable-diffusion.cpp", "bleak",
        "Wear OS WFF", "Figma Plugin API", "WebView bridge", "GitHub Actions", "Next.js", "Tailwind",
        "Trusted Web Activity", "Cloudflare Workers", "SQLDelight", "libarchive", "Vercel"}
tech_nodes = [t for t, n in tech_count.most_common() if t not in DROP and (n >= 2 or t in KEEP_SINGLE)]
folded = sorted(t for t in tech_count if t not in tech_nodes)

lang_nodes = [l for l, _ in lang_total.most_common()]
shared_ids = sorted({s for p in projects for s in p["shared"]})

# --------------------------------------------------------------- activity
today = SCANNED.astimezone(IST).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
days = []
for i in range(16 * 7 - 1, -1, -1):
    d = (today - timedelta(days=i)).strftime("%Y-%m-%d")
    c = all_days.get(d, {})
    days.append([d, c.get("person", 0), c.get("claude", 0), c.get("codex", 0), c.get("named", 0)])

# hours of work, derived: sessions of person commits with gaps under 2 h, plus 30 min lead-in
by_day = defaultdict(list)
for t, k, pid in all_times:
    if k == "person":
        by_day[t[:10]].append(datetime.fromisoformat(t))
work_hours = {}
for d, ts in by_day.items():
    ts.sort()
    total, start, prev = 0.0, ts[0], ts[0]
    for x in ts[1:]:
        if (x - prev).total_seconds() > 7200:
            total += (prev - start).total_seconds() / 3600 + 0.5
            start = x
        prev = x
    total += (prev - start).total_seconds() / 3600 + 0.5
    work_hours[d] = round(min(total, 14), 1)

# agent hours: the same session rule per repo and per kind, summed (agents run in parallel)
agent_hours = defaultdict(lambda: defaultdict(float))
grp = defaultdict(list)
for t, k, pid in all_times:
    if k in ("claude", "codex", "named"):
        grp[(t[:10], k, pid)].append(datetime.fromisoformat(t))
for (d, k, pid), ts in grp.items():
    ts.sort()
    total, start, prev = 0.0, ts[0], ts[0]
    for x in ts[1:]:
        if (x - prev).total_seconds() > 5400:
            total += (prev - start).total_seconds() / 3600 + 0.25
            start = x
        prev = x
    total += (prev - start).total_seconds() / 3600 + 0.25
    agent_hours[d]["codex" if k == "codex" else "claude"] += total
agent_hours = {d: {k: round(v, 1) for k, v in c.items()} for d, c in agent_hours.items()}

recent_all.sort(key=lambda x: x["t"], reverse=True)

# ---------------------------------------------------------------- pull requests -> change sets
# One piece of work often spans several repos under the same branch name. Group the open
# pull requests that way: a change set is a branch name and every repo it has a request in.
open_rows = []
for repo, v in PRS.items():
    pid = REPO_PID.get(repo)
    if not pid:
        continue
    for o in v.get("open", []):
        open_rows.append(dict(o, p=pid))
sets = defaultdict(list)
for o in open_rows:
    key = ("dependabot:" + o["p"]) if o["branch"].startswith("dependabot/") else (o["branch"] or f"pr:{o['p']}:{o['n']}")
    sets[key].append(o)
changes = []
for key, rows in sets.items():
    rows.sort(key=lambda o: o["date"], reverse=True)
    head = rows[0]
    who = Counter(agent_of(o["who"]) or "bot" for o in rows).most_common(1)[0][0]
    if key.startswith("dependabot:"):
        title = "Dependency bumps"
    else:
        title = human(head["branch"]) if head["branch"] else head["subject"]
    firsts = [o["first"] for o in rows if o["first"]]
    changes.append(dict(
        id="c:" + re.sub(r"[^a-z0-9]+", "-", key.lower()).strip("-"), branch=head["branch"], title=title, agent=who,
        who=sorted({o["who"] for o in rows}), repos=[[o["p"], o["n"], o["ahead"]] for o in sorted(rows, key=lambda o: o["p"])],
        last=head["date"], first=min(firsts) if firsts else head["date"], commits=sum(o["ahead"] for o in rows),
        sub=head["subject"]))
changes.sort(key=lambda c: c["last"], reverse=True)

age = Counter()
for o in open_rows:
    d = (SCANNED - parse(o["date"])).days
    age["week" if d <= 7 else "month" if d <= 30 else "quarter" if d <= 90 else "older"] += 1

merged = []
cut = (SCANNED - timedelta(days=30)).strftime("%Y-%m-%dT%H:%MZ")
for repo, v in PRS.items():
    pid = REPO_PID.get(repo)
    if not pid:
        continue
    for m in v.get("merged", []):
        if m["date"] >= cut:
            title = m["title"] or human(m["branch"])
            title = re.sub(r"^Merge\s+", "", title)
            merged.append(dict(p=pid, pr=m["n"], title=title[:1].upper() + title[1:], date=m["date"],
                               agent=agent_of(m["who"]) or "bot"))
merged.sort(key=lambda m: m["date"], reverse=True)

# branches that moved in the last nine days: the same grouping, whether or not a request is open
open_branch = {(o["p"], o["branch"]) for o in open_rows}
moving = defaultdict(list)
for t, pid, ag, ref, subj, work in lately_all:
    moving[ref].append((t, pid, ag, subj, work))
moves = []
for ref, rows in moving.items():
    rows.sort(reverse=True)
    ps = sorted({r[1] for r in rows})
    with_pr = [p for p in ps if (p, ref) in open_branch]
    who = Counter(r[2] for r in rows).most_common()
    on_trunk = ref in ("main", "master", "HEAD", "")
    moves.append(dict(
        id="m:" + re.sub(r"[^a-z0-9]+", "-", ref.lower()).strip("-"), branch=ref,
        title=(rows[0][3] if on_trunk else human(ref)), agent=who[0][0], agents=[w for w, _ in who],
        ps=ps, n=len(rows), last=rows[0][0], first=rows[-1][0], sub=rows[0][3], prs=len(with_pr),
        trunk=on_trunk, kind=Counter(r[4] for r in rows).most_common(1)[0][0]))
moves.sort(key=lambda m: m["last"], reverse=True)

since_ist = (SCANNED.astimezone(IST).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=1))
digest_since = since_ist.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")

in_p = [p for p in projects if p["src"] == "scan"]
totals = dict(
    repos_scanned=len(SCAN), projects=len(projects),
    commits=sum(p["commits"] for p in in_p),
    by_agent=dict(agent_total), by_model=dict(model_total.most_common()),
    named=dict(named_labels.most_common()), branches=sum(p.get("branches", 0) for p in projects),
    source_files=sum(p.get("source_files", 0) for p in projects),
    prs=sum(p.get("prs", 0) for p in in_p), prs_open=len(open_rows),
    prs_merged=sum(p.get("prs_merged", 0) for p in in_p), pr_age=dict(age), kinds=dict(kind_total),
)

out = dict(
    scanned_at=META["scanned_at"], since=META["since"], clusters=CLUSTERS, projects=projects,
    langs=lang_nodes, tech=tech_nodes, tech_folded=folded,
    shared=[dict(id=s, name=SHARED_LABEL.get(s, s), home=SHARED_HOME.get(s)) for s in shared_ids],
    agents=[dict(id=a, name=n, kind=k, commits=agent_total.get(a, 0)) for a, n, k in AGENTS],
    lanes=KINDS, lane_share=lane_share, days=days, work_hours=work_hours, agent_hours=agent_hours,
    hours_ist=[hours_ist.get(h, 0) for h in range(24)], hours_ag=[hours_ag.get(h, 0) for h in range(24)],
    wdays=dict(you=[wdays_you.get(w, 0) for w in range(7)], ag=[wdays_ag.get(w, 0) for w in range(7)]),
    recent=recent_all[:60], totals=totals,
    changes=changes, merged=merged, moves=moves, digest_since=digest_since, agent_last=agent_last,
)
open(out_path, "w").write("window.TRACKER_GRAPH = " + json.dumps(out, separators=(",", ":"), ensure_ascii=False) + ";\n")
print("projects", len(projects), "scanned", len(in_p), "langs", lang_nodes)
print("tech", len(tech_nodes), "shared", len(shared_ids))
print("agents", dict(agent_total))
print("kinds", kind_total.most_common())
print("totals", {k: v for k, v in totals.items() if k not in ("by_model", "by_agent", "named")})
print("change sets", len(changes))
for c in changes[:14]:
    print("  ", c["last"], f"{c['title'][:44]:44s}", c["agent"], "repos", len(c["repos"]), "commits", c["commits"])
print("merged last 30 days", len(merged))
for m in merged[:8]:
    print("  ", m["date"], m["p"], m["pr"], m["title"][:60], m["agent"])
print("moves", len(moves))
for m in moves:
    print("  ", m["last"], f"{m['title'][:44]:44s}", m["agent"], "repos", len(m["ps"]), "n", m["n"], "prs", m["prs"])
print("digest since", digest_since, "bytes", len(open(out_path).read()))
