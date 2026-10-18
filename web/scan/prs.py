#!/usr/bin/env python3
"""
tracker-index, pull requests: read pull-request state from git refs alone (no API token).

GitHub exposes every pull request as refs/pull/<n>/head, and keeps refs/pull/<n>/merge
only while the request is open and can be merged. So, for a repo we can already clone:
  - total pull requests            = count of refs/pull/*/head
  - open and mergeable             = count of refs/pull/*/merge   (a lower bound on "open")
  - which branch each open one is  = the branch whose tip equals the head sha
  - merged ones, with dates/titles = merge and squash commits on the default branch

Usage:  python3 -I prs.py <cache-dir> <scan.json> <out.json>
"""
import importlib.util
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("scan", os.path.join(HERE, "scan.py"))
scan = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scan)

SINCE = "2026-05-01"
FMT = "%H%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%(trailers:key=Co-authored-by,valueonly,separator=%x3B)"


def utc(iso):
    return datetime.fromisoformat(iso).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")


def commit_info(hist, sha, ref=""):
    rc, out, _ = scan.git(["log", "-1", f"--format={FMT}", sha], cwd=hist)
    p = out.rstrip("\n").split("\x1f")   # not strip(): \x1f counts as whitespace and an empty last field would vanish
    if rc != 0 or len(p) < 6:
        return None
    kind, label = scan.classify(p[1], p[2], [c for c in p[5].split(";") if c.strip()], "refs/heads/" + ref)
    return {"date": utc(p[3]), "subject": p[4][:140], "kind": kind, "who": label}


def main():
    cache, scan_path, outp = sys.argv[1], sys.argv[2], sys.argv[3]
    repos = [r for r in json.load(open(scan_path))["repos"] if r.get("ok")]
    res = {}
    for r in repos:
        full, name = r["repo"], r["name"]
        hist = os.path.join(cache, name + ".hist.git")
        rc, out, err = scan.git(["ls-remote", "https://github.com/" + full], timeout=120)
        if rc != 0:
            res[name] = {"error": err.strip()[-200:]}
            continue
        heads, merges, branch = {}, set(), {}
        for line in out.splitlines():
            sha, ref = line.split("\t")
            m = re.match(r"refs/pull/(\d+)/(head|merge)$", ref)
            if m:
                if m.group(2) == "head":
                    heads[int(m.group(1))] = sha
                else:
                    merges.add(int(m.group(1)))
            elif ref.startswith("refs/heads/"):
                branch.setdefault(sha, []).append(ref[11:])
        default = r.get("default") or "main"
        open_prs = []
        for n in sorted(merges):
            sha = heads.get(n)
            brs = branch.get(sha, [])
            br = brs[0] if brs else ""
            info = commit_info(hist, sha, br) or {"date": "", "subject": "", "kind": "", "who": ""}
            ahead, first = 0, ""
            rc2, cnt, _ = scan.git(["rev-list", "--count", f"{default}..{sha}"], cwd=hist)
            if rc2 == 0 and cnt.strip().isdigit():
                ahead = int(cnt.strip())
            rc3, dates, _ = scan.git(["log", "--format=%aI", f"{default}..{sha}"], cwd=hist)
            if rc3 == 0 and dates.strip():
                first = utc(dates.strip().splitlines()[-1])
            open_prs.append({"n": n, "branch": br, "ahead": ahead, "first": first, **info})
        # merged pull requests, read off the default branch
        merged = []
        rc4, log, _ = scan.git(["log", "--first-parent", f"--since={SINCE}", f"--format={FMT}%x1f%P", default], cwd=hist)
        for line in log.splitlines():
            p = line.split("\x1f")
            if len(p) < 7:
                continue
            sha, an, ae, when, subj, co, parents = p[:7]
            m = re.match(r"Merge pull request #(\d+) from [^/\s]+/(\S+)", subj)
            if m:
                br = m.group(2)
                par = parents.split()
                info = commit_info(hist, par[1], br) if len(par) > 1 else None
                merged.append({"n": int(m.group(1)), "date": utc(when), "branch": br, "title": "",
                               "kind": (info or {}).get("kind", "person"), "who": (info or {}).get("who", an),
                               "last": (info or {}).get("subject", "")})
                continue
            m = re.match(r"(.+?)\s*\(#(\d+)\)$", subj)
            if m:
                kind, label = scan.classify(an, ae, [c for c in co.split(";") if c.strip()], "")
                merged.append({"n": int(m.group(2)), "date": utc(when), "branch": "", "title": m.group(1)[:140],
                               "kind": kind, "who": label, "last": ""})
        res[name] = {"total": len(heads), "open": open_prs, "merged": merged, "highest": max(heads) if heads else 0}
        print(f"{full:40s} prs={len(heads):3d} open={len(open_prs):3d} merged-on-default={len(merged):3d}", flush=True)
    json.dump(res, open(outp, "w"), indent=1)
    print("total", sum(v.get("total", 0) for v in res.values()), "open", sum(len(v.get("open", [])) for v in res.values()),
          "merged seen", sum(len(v.get("merged", [])) for v in res.values()))


if __name__ == "__main__":
    main()
