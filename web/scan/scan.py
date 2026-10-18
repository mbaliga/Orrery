#!/usr/bin/env python3
"""
tracker-index: scan a set of GitHub repos from git alone (no API token) and emit
one JSON graph of what each repo is made of and who worked on it.

For every repo it records
  - branches and their last commit dates
  - a language histogram (source files by extension) of the working branch
  - build manifests -> third-party libraries and internal shared modules
  - git submodules
  - commits per ISO week, split by actor (person, Claude models, other agents, bots)

It needs only anonymous git read access, so it works for public repos as-is and for
private repos wherever `git clone` already works (a PAT in a credential helper, or
inside a GitHub Action with a token).

Usage:  python3 -I scan.py <cache-dir> <out.json> owner/repo [owner/repo ...]
"""
import json
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

SINCE = "2026-05-01"
OWNER_NAMES = ("madhav baliga", "mbaliga")
DEPTH = "400"

EXT_LANG = {
    ".kt": "Kotlin", ".kts": "Kotlin", ".java": "Java", ".py": "Python",
    ".js": "JavaScript", ".mjs": "JavaScript", ".cjs": "JavaScript", ".jsx": "JavaScript",
    ".ts": "TypeScript", ".tsx": "TypeScript", ".html": "HTML", ".htm": "HTML",
    ".css": "CSS", ".scss": "CSS", ".rs": "Rust", ".c": "C", ".h": "C",
    ".cpp": "C++", ".cc": "C++", ".hpp": "C++", ".cxx": "C++",
    ".glsl": "GLSL", ".frag": "GLSL", ".vert": "GLSL", ".agsl": "GLSL",
    ".mc": "Monkey C", ".sh": "Shell", ".bash": "Shell", ".swift": "Swift",
    ".dart": "Dart", ".go": "Go", ".rb": "Ruby", ".lua": "Lua", ".gd": "GDScript",
    ".qml": "QML", ".astro": "Astro", ".vue": "Vue", ".svelte": "Svelte",
    ".rhai": "Rhai", ".aidl": "AIDL", ".cmake": "CMake", ".sql": "SQL",
    ".toml": None, ".json": None, ".md": None, ".yml": None, ".yaml": None,
    ".xml": None, ".svg": None, ".png": None, ".jpg": None, ".webp": None,
}
SKIP_DIRS = ("node_modules/", "build/", "dist/", ".gradle/", "gradle/wrapper/", "vendor/",
             "third_party/", "third-party/", ".idea/", "target/")
# Kind of work, read from the commit subject. First match wins; anything else is "build".
KIND_RULES = [
    ("merge", r"^merge (pull request|branch|remote-tracking|main|origin)"),
    ("ci", r"^(ci|build|chore\(ci\))(\(|:)|\bci\b|workflow|github actions|setup-android|\brunner\b|artifact|pipeline|gradle wrapper|\bagp\b|dependabot|^bump "),
    ("release", r"\brelease\b|store listing|play store|f-droid|fastlane|changelog|version ?code|signing|keystore|\bpublish"),
    ("test", r"^test(\(|:)|\btests?\b|conformance|acceptance|\bevidence\b|\bverif(y|ied|ication)\b|\bproving\b|benchmark"),
    ("docs", r"^docs?(\(|:)|\breadme\b|\bplan\b|\bbrief\b|handoff|state\.md|\baudit\b|\brecord\b|\bspec\b|decision|roadmap|registry|\bnotes?\b|\bguide\b|document"),
    ("fix", r"^fix(\(|:)|\bfix(es|ed)?\b|\bbug\b|\bcrash|regression|\brevert\b|\bcorrect\b|hotfix"),
    ("design", r"\bui\b|\bux\b|\bthem(e|es|ing)\b|\bdesign\b|\blayout\b|\bicons?\b|animation|\bvisual|\bstyl(e|es|ing)\b|typograph|\bfonts?\b|\bglyph|\bcolou?rs?\b|palette|haptic|gesture"),
]
KIND_RES = [(k, re.compile(r)) for k, r in KIND_RULES]


def kind_of_work(subject):
    low = subject.lower()
    for k, rx in KIND_RES:
        if rx.search(low):
            return k
    return "build"


MANIFEST_PATTERNS = [
    "/gradle/libs.versions.toml", "build.gradle.kts", "build.gradle", "settings.gradle.kts",
    "package.json", "pyproject.toml", "requirements*.txt", "Cargo.toml", "/.gitmodules",
    "go.mod", "pubspec.yaml", "/README.md", "manifest.xml",
]


def git(args, cwd=None, timeout=240, check=False):
    env = dict(os.environ, GIT_LFS_SKIP_SMUDGE="1", GIT_TERMINAL_PROMPT="0")
    try:
        p = subprocess.run(["git"] + args, cwd=cwd, env=env, capture_output=True,
                           text=True, timeout=timeout, errors="replace")
    except subprocess.TimeoutExpired:
        return 124, "", "timeout"
    if check and p.returncode != 0:
        raise RuntimeError(p.stderr.strip()[:400])
    return p.returncode, p.stdout, p.stderr


def week_start(iso):
    d = datetime.fromisoformat(iso).astimezone(timezone.utc).date()
    return (d - timedelta(days=d.weekday())).isoformat()


def classify(author, email, coauthors, ref):
    """Who did this commit. Trailer beats author, author beats branch name."""
    co = " ".join(coauthors).lower()
    m = re.search(r"claude\s+(sonnet|opus|haiku|fable|mythos)\s*([\d.]+)?", co)
    if m:
        return "claude", ("Claude " + m.group(1).title() + (" " + m.group(2) if m.group(2) else "")).strip()
    a = (author + " " + email).lower()
    if "noreply@anthropic.com" in a or author.strip().lower() == "claude":
        return "claude", "Claude"
    if "codex" in a or "codex" in co or "chatgpt" in a or "openai" in a:
        return "codex", "Codex"
    if "copilot" in a or "copilot" in co:
        return "copilot", "Copilot"
    if "[bot]" in a or "github-actions" in a or "dependabot" in a:
        return "bot", author
    r = (ref or "").replace("refs/heads/", "")
    if r.startswith(("codex/", "agent/", "batch/")):
        return "codex", "Codex (by branch)"
    if author.strip().lower() not in OWNER_NAMES:
        return "named", author
    return "person", author


def scan_repo(full, cache):
    owner, name = full.split("/")
    out = {"repo": full, "name": name, "ok": False}
    hist = os.path.join(cache, name + ".hist.git")
    url = f"https://github.com/{full}"
    if not os.path.isdir(hist):
        rc, _, err = git(["clone", "--bare", "--filter=tree:0", "--depth", DEPTH,
                          "--no-single-branch", url, hist], timeout=300)
        if rc != 0:
            out["error"] = err.strip()[-300:]
            return out
    rc, head, _ = git(["symbolic-ref", "--short", "HEAD"], cwd=hist)
    default = head.strip() or "main"
    rc, refs, _ = git(["for-each-ref", "--sort=-committerdate",
                       "--format=%(refname:short)|%(committerdate:iso-strict)|%(objectname)",
                       "refs/heads"], cwd=hist)
    branches = []
    for line in refs.splitlines():
        p = line.split("|")
        if len(p) == 3:
            branches.append({"name": p[0], "date": p[1][:10], "sha": p[2]})
    out["default"] = default
    out["branches"] = [{"name": b["name"], "date": b["date"]} for b in branches[:40]]
    out["branch_count"] = len(branches)
    pref = Counter()
    for b in branches:
        pref[b["name"].split("/")[0] if "/" in b["name"] else "(trunk)"] += 1
    out["branch_prefixes"] = dict(pref)

    # commits, all branches, with the ref each was first reached from
    fmt = "%H%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%(trailers:key=Co-authored-by,valueonly,separator=%x3B)%x1f%S"
    rc, log, _ = git(["log", "--all", "--source", f"--since={SINCE}", f"--format={fmt}"], cwd=hist)
    weeks = defaultdict(Counter)
    days = Counter()
    days_kind = defaultdict(Counter)
    hours = Counter()
    hours_kind = defaultdict(Counter)
    wdays_kind = defaultdict(Counter)
    actors = Counter()
    labels = Counter()
    last = None
    n = 0
    recent = []
    times = []
    kinds = Counter()
    lately = []
    cutoff = (datetime.now(timezone.utc) - timedelta(days=9)).isoformat()
    for line in log.splitlines():
        p = line.split("\x1f")
        if len(p) < 7:
            continue
        sha, an, ae, when, subj, co, ref = p[:7]
        kind, label = classify(an, ae, [c for c in co.split(";") if c.strip()], ref)
        utc = datetime.fromisoformat(when).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
        w = week_start(when)
        weeks[w][kind] += 1
        days[when[:10]] += 1 if kind != "bot" else 0
        days_kind[when[:10]][kind] += 1
        ist = datetime.fromisoformat(when).astimezone(timezone(timedelta(hours=5, minutes=30)))
        if kind == "person":
            hours[ist.hour] += 1
        # every actor's hour and weekday in IST, from the author date's own offset, so no clock is assumed later
        hours_kind[kind][ist.hour] += 1
        wdays_kind[kind][ist.weekday()] += 1
        actors[kind] += 1
        labels[label] += 1
        n += 1
        work = kind_of_work(subj)
        if kind != "bot" and work != "merge":
            kinds[work] += 1
        if kind != "bot" and utc >= cutoff[:16]:
            lately.append([utc, kind, label, (ref or "").replace("refs/heads/", "")[:70], subj[:120], work])
        if last is None or when > last:
            last = when
        if kind != "bot":
            times.append([when[:16], kind, label])
            if len(recent) < 60:
                recent.append({"t": utc, "s": subj[:140], "k": kind, "who": label,
                               "ref": (ref or "").replace("refs/heads/", "")[:60]})
    out["commits_since"] = SINCE
    out["commits"] = n
    out["last_commit"] = (last or "")[:10]
    out["weeks"] = {w: dict(c) for w, c in sorted(weeks.items())}
    out["days"] = dict(sorted(days.items()))
    out["days_by_kind"] = {d: dict(c) for d, c in sorted(days_kind.items())}
    out["person_hours_ist"] = dict(sorted(hours.items()))
    out["hours_ist_by_kind"] = {k: [c.get(h, 0) for h in range(24)] for k, c in hours_kind.items()}
    out["wdays_by_kind"] = {k: [c.get(w, 0) for w in range(7)] for k, c in wdays_kind.items()}
    out["recent"] = sorted(recent, key=lambda x: x["t"], reverse=True)[:25]
    out["times"] = sorted(times)
    out["kinds"] = dict(kinds)
    out["lately"] = sorted(lately, reverse=True)
    out["actors"] = dict(actors)
    out["actor_labels"] = dict(labels.most_common(12))
    rc, total, _ = git(["rev-list", "--all", "--count"], cwd=hist)
    out["commits_all_depth"] = int(total.strip() or 0)

    # the working tree: the default branch and the four most recently pushed branches; keep the fullest
    cands = [default]
    for b in branches[:4]:
        if b["name"] not in cands:
            cands.append(b["name"])
    best = None
    for br in cands:
        tdir = os.path.join(cache, name + ".tree." + re.sub(r"[^A-Za-z0-9]+", "_", br))
        if not os.path.isdir(tdir):
            rc, _, err = git(["clone", "--depth", "1", "--filter=blob:none", "--no-checkout",
                              "--branch", br, url, tdir], timeout=300)
            if rc != 0:
                continue
        rc, names, _ = git(["ls-tree", "-r", "--name-only", "HEAD"], cwd=tdir)
        files = [f for f in names.splitlines() if f]
        if best is None or len(files) > len(best[2]):
            best = (br, tdir, files)
    if best is None:
        out["error"] = "no tree"
        return out
    br, tdir, files = best
    out["tree_branch"] = br
    out["files"] = len(files)
    langs = Counter()
    for f in files:
        if any(("/" + f).find("/" + d) >= 0 for d in SKIP_DIRS):
            continue
        ext = os.path.splitext(f)[1].lower()
        lang = EXT_LANG.get(ext)
        if lang:
            langs[lang] += 1
        elif f.endswith("CMakeLists.txt"):
            langs["CMake"] += 1
    out["langs"] = dict(langs.most_common())
    out["top_dirs"] = dict(Counter(f.split("/")[0] for f in files if "/" in f).most_common(14))

    # manifests: one batched blob fetch through a sparse checkout
    git(["sparse-checkout", "init", "--no-cone"], cwd=tdir)
    git(["sparse-checkout", "set", "--no-cone"] + MANIFEST_PATTERNS, cwd=tdir)
    git(["checkout", "-q", "HEAD"], cwd=tdir, timeout=300)
    deps = Counter()
    internal = Counter()
    catalog = {}
    used_aliases = set()
    subs = []
    readme = ""
    manifests = []
    for root, _dirs, fs in os.walk(tdir):
        if "/.git" in root or root.endswith("/.git"):
            continue
        for fn in fs:
            path = os.path.join(root, fn)
            rel = os.path.relpath(path, tdir)
            if any(("/" + rel).find("/" + d) >= 0 for d in SKIP_DIRS):
                continue
            try:
                if os.path.getsize(path) > 400_000:
                    continue
                txt = open(path, "r", errors="replace").read()
            except OSError:
                continue
            manifests.append(rel)
            if fn == ".gitmodules":
                for m in re.finditer(r'path\s*=\s*(.+)\n\s*url\s*=\s*(.+)', txt):
                    subs.append({"path": m.group(1).strip(), "url": m.group(2).strip()})
            elif fn == "README.md" and rel == "README.md":
                readme = " ".join(l.strip() for l in txt.splitlines()[:14] if l.strip())[:420]
            elif fn == "libs.versions.toml":
                # version catalog: remember alias -> module; only count what build files use
                for m in re.finditer(r'^\s*([A-Za-z0-9_.\-]+)\s*=\s*\{[^}]*?module\s*=\s*"([^":]+:[^":]+)', txt, re.M):
                    catalog[re.sub(r"[-_]", ".", m.group(1))] = m.group(2)
                for m in re.finditer(r'^\s*([A-Za-z0-9_.\-]+)\s*=\s*\{[^}]*?group\s*=\s*"([^"]+)"\s*,\s*name\s*=\s*"([^"]+)"', txt, re.M):
                    catalog[re.sub(r"[-_]", ".", m.group(1))] = m.group(2) + ":" + m.group(3)
                for m in re.finditer(r'^\s*([A-Za-z0-9_.\-]+)\s*=\s*"([A-Za-z0-9_.\-]+:[A-Za-z0-9_.\-]+)(?::[^"]*)?"', txt, re.M):
                    catalog[re.sub(r"[-_]", ".", m.group(1))] = m.group(2)
            elif fn.endswith((".gradle.kts", ".gradle")):
                for m in re.finditer(r'["\']([A-Za-z0-9_.\-]+):([A-Za-z0-9_.\-]+)(?::[^"\']*)?["\']', txt):
                    g, a = m.group(1), m.group(2)
                    if "." not in g:
                        continue
                    (internal if g.startswith(("dev.aarso", "xyz.mdhv", "com.asoc")) else deps)[g + ":" + a] += 1
                for m in re.finditer(r'includeBuild\(\s*"([^"]+)"', txt):
                    internal["includeBuild:" + m.group(1)] += 1
                for m in re.finditer(r'\blibs\.([A-Za-z0-9_.]+)', txt):
                    used_aliases.add(m.group(1))
            elif fn == "package.json":
                try:
                    pj = json.loads(txt)
                    for k in ("dependencies", "devDependencies"):
                        for d in (pj.get(k) or {}):
                            deps["npm:" + d] += 1
                except ValueError:
                    pass
            elif fn == "pyproject.toml" or fn.startswith("requirements"):
                for m in re.finditer(r'^\s*["\']?([A-Za-z][A-Za-z0-9_.\-]+)\s*(?:\[[^\]]*\])?\s*(?:[<>=!~]=?[^"\',]*)?["\']?,?\s*$', txt, re.M):
                    d = m.group(1).lower()
                    if d not in ("name", "version", "description", "readme", "license", "dependencies", "python"):
                        deps["py:" + d] += 1
            elif fn == "Cargo.toml":
                sect = ""
                for line in txt.splitlines():
                    s = line.strip()
                    if s.startswith("["):
                        sect = s
                    elif "dependencies" in sect and "=" in s and not s.startswith("#"):
                        deps["crate:" + s.split("=")[0].strip()] += 1
    for alias in used_aliases:
        mod = catalog.get(alias)
        if mod is None and alias.startswith("bundles."):
            continue
        if mod:
            g = mod.split(":")[0]
            (internal if g.startswith(("dev.aarso", "xyz.mdhv", "com.asoc")) else deps)[mod] += 1
    out["manifests"] = sorted(manifests)[:40]
    out["deps"] = dict(deps.most_common(80))
    out["internal"] = dict(internal)
    out["submodules"] = subs
    out["readme"] = readme
    out["ok"] = True
    return out


def main():
    cache, outp, repos = sys.argv[1], sys.argv[2], sys.argv[3:]
    os.makedirs(cache, exist_ok=True)
    res = []
    for r in repos:
        try:
            o = scan_repo(r, cache)
        except Exception as e:  # keep going; one broken repo must not sink the scan
            o = {"repo": r, "ok": False, "error": str(e)[:300]}
        res.append(o)
        print(f"{r:44s} ok={o.get('ok')} files={o.get('files')} commits={o.get('commits')} "
              f"branch={o.get('tree_branch')} langs={list((o.get('langs') or {}).items())[:4]} "
              f"{o.get('error', '')}", flush=True)
    json.dump({"scanned_at": datetime.now(timezone.utc).isoformat()[:19] + "Z", "since": SINCE, "repos": res},
              open(outp, "w"), indent=1)


if __name__ == "__main__":
    main()
