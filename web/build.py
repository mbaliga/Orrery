#!/usr/bin/env python3
"""Assemble the single-file page, plus a local test copy wrapped the way the publisher wraps it."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "src")
# the data: the owner's own scan and content live outside the public tree (ORRERY_DATA, or src/ when present);
# the public tree carries derived samples so the app builds and runs for anyone
DATA = os.environ.get("ORRERY_DATA") or os.path.join(HERE, "src")
def data_file(name):
    for d in (DATA, os.path.join(HERE, "src")):
        f = os.path.join(d, name)
        if os.path.exists(f): return f
    return os.path.join(HERE, "src", name.replace(".js", ".sample.js"))
DIST = os.path.join(HERE, "dist")
os.makedirs(DIST, exist_ok=True)


def read(name):
    f = data_file(name) if name in ("graph.js", "seed.js") else os.path.join(SRC, name)
    with open(f, encoding="utf-8") as fh:
        return fh.read()


FONTS = ('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
         'family=Archivo:wdth,wght@62..125,100..900&family=JetBrains+Mono:wght@300..600&display=swap">')
# the shared kit (Shared-Libraries-asoc/web/orrery-kit): read from the sibling checkout when it is there, else the vendored copy
KIT = ["cells.js", "sfx.js", "rose.js", "brands.js", "graph.js", "gantt.js"]
KIT_SRC = next((d for d in [os.path.join(HERE, "..", "..", "..", "..", "..", "..", "home", "claude", "shared-libraries-asoc", "web", "orrery-kit"),
                             "/home/claude/shared-libraries-asoc/web/orrery-kit", os.path.join(SRC, "vendor", "orrery-kit")] if os.path.isdir(d)), None)
def read_kit(name):
    with open(os.path.join(KIT_SRC, name), encoding="utf-8") as f:
        return f.read()
JS = ["graph.js", "seed.js", "core.js", "sfx.js", "rhythm.js", "board.js", "plan.js", "deps.js", "horizon.js", "pulse.js", "space.js", "ask.js", "sky.js", "look.js", "settings.js", "year.js", "runway.js", "dial.js", "body.js", "compile.js", "targets.js", "releases.js", "audit.js", "resume.js", "app.js"]
script = ("\n".join(read_kit(k) for k in KIT) + "\n" + "\n".join(read(j) for j in JS)).replace("</script", "<\\/script")
# keep a vendored snapshot beside the sources so the build works without the sibling checkout
vend = os.path.join(SRC, "vendor", "orrery-kit")
if KIT_SRC and not KIT_SRC.startswith(vend):
    os.makedirs(vend, exist_ok=True)
    for k in KIT:
        with open(os.path.join(vend, k), "w", encoding="utf-8") as f:
            f.write(read_kit(k))

page = "\n".join([
    "<title>Orrery</title>",
    FONTS,
    "<style>\n" + read("style.css") + "</style>",
    read("body.html"),
    "<script>\n" + script + "\n</script>",
    "",
])
out = os.path.join(DIST, "personal-tracker.html")
with open(out, "w", encoding="utf-8") as f:
    f.write(page)

# local test copy: same skeleton the publisher adds, fonts from disk because the sandbox has no route to Google Fonts
fd = os.path.join(HERE, "fonts", "node_modules", "@fontsource-variable")
local_fonts = ("<style>"
               '@font-face{font-family:"Archivo";font-style:normal;font-weight:100 900;font-stretch:62% 125%;'
               'src:url("file://' + fd + '/archivo/files/archivo-latin-standard-normal.woff2") format("woff2")}'
               '@font-face{font-family:"JetBrains Mono";font-style:normal;font-weight:100 800;'
               'src:url("file://' + fd + '/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2") format("woff2")}'
               "</style>")
skeleton = ('<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">'
            '<style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}'
            'body{margin:0;font:14px system-ui,sans-serif;background:#faf9f5}img{max-width:100%}[hidden]{display:none!important}</style></head><body>')
with open(os.path.join(DIST, "test.html"), "w", encoding="utf-8") as f:
    f.write(skeleton + page.replace(FONTS, local_fonts) + "</body></html>")
print("built", out, len(page), "bytes")
