#!/bin/sh
# usage-hook.sh — a Claude Code Stop / SessionEnd hook that keeps a content-free usage record of the session that just
# ran, in ~/.orrery/usage/<session>.jsonl, to import into Orrery (Settings → Data → Import usage) or commit to your own
# workspace repo. Add to ~/.claude/settings.json (adjust the path):
#   { "hooks": { "Stop": [ { "hooks": [ { "type": "command", "command": "sh /path/to/orrery/scan/usage-hook.sh" } ] } ] } }
# Claude Code passes the hook a JSON object on stdin that includes `transcript_path`.
set -e
P=$(cat | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).transcript_path||"")}catch(e){}})')
[ -n "$P" ] && [ -f "$P" ] || exit 0
mkdir -p "$HOME/.orrery/usage"
node "$(dirname "$0")/usage-collect.js" "$P" > "$HOME/.orrery/usage/$(basename "$P")" 2>/dev/null || true
