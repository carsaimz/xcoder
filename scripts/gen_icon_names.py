#!/usr/bin/env python3
"""
Generate src/res/iconNames.json — icon name lists for editor autocompletion.

Sources (fetched from CDN / raw GitHub, cached in /tmp):
  - Font Awesome 6 free   (metadata icons.yml)
  - Bootstrap Icons 1.11  (font CSS)
  - Remix Icon 4.6        (font CSS)
  - Material Icons        (codepoints)
  - Material Symbols      (codepoints)

Usage: python3 scripts/gen_icon_names.py
"""
import json
import os
import re
import urllib.request

TMP = "/tmp/icon_autocomplete_cache"
OUT = "src/res/iconNames.json"
os.makedirs(TMP, exist_ok=True)


def fetch(url, name):
    path = os.path.join(TMP, name)
    if not os.path.exists(path) or os.path.getsize(path) < 100:
        print(f"fetching {url}")
        req = urllib.request.Request(url, headers={"User-Agent": "xcoder-build"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    return path


def dedupe_sorted(items):
    seen = set()
    out = []
    for it in items:
        if it and it not in seen:
            seen.add(it)
            out.append(it)
    out.sort()
    return out


# ---------------------------------------------------------------- Font Awesome
fa_yml = fetch(
    "https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.7.2/metadata/icons.yml",
    "fa.yml",
)

fa_styles = {"solid": [], "regular": [], "brands": []}
style_keys = ("solid", "regular", "brands")
# minimal YAML parse — FA6 FREE package icons.yml per icon (all entries are
# free since this is the free package metadata):
#   name:
#     styles:
#       - solid
current_name = None
in_styles = False
with open(fa_yml, encoding="utf-8") as f:
    for line in f:
        indent = len(line) - len(line.lstrip(" "))
        stripped = line.strip()
        if indent == 0:
            if stripped.endswith(":"):
                current_name = stripped[:-1].strip("'\"")
                in_styles = False
            continue
        if not current_name:
            continue
        if indent == 2 and stripped.endswith(":"):
            in_styles = stripped == "styles:"
        elif in_styles and indent >= 4 and stripped.startswith("- "):
            style = stripped[2:]
            if style in style_keys:
                fa_styles[style].append(current_name)

print(
    "FA free:",
    {k: len(v) for k, v in fa_styles.items()},
)

# ------------------------------------------------------------- Bootstrap Icons
bi_css = open(
    fetch(
        "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css",
        "bi.css",
    ),
    encoding="utf-8",
).read()
bi = dedupe_sorted(
    m.group(1) for m in re.finditer(r"^\.bi-([a-z0-9-]+)::before", bi_css, re.M)
)
print("BI:", len(bi))

# ------------------------------------------------------------------ Remix Icon
ri_css = open(
    fetch(
        "https://cdn.jsdelivr.net/npm/remixicon@4.6.0/fonts/remixicon.css",
        "remix.css",
    ),
    encoding="utf-8",
).read()
ri_bases = set()
for m in re.finditer(r"^\.ri-([a-z0-9-]+)-(?:line|fill):(?:::)?before", ri_css, re.M):
    ri_bases.add(m.group(1))
ri = dedupe_sorted(ri_bases)
print("RI bases:", len(ri))

# --------------------------------------------------------- Material codepoints
def read_codepoints(path):
    names = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            parts = line.split()
            if len(parts) >= 2:
                names.append(parts[0])
    return dedupe_sorted(names)

mi = read_codepoints(
    fetch(
        "https://raw.githubusercontent.com/google/material-design-icons/master/font/MaterialIcons-Regular.codepoints",
        "mi.cp",
    )
)
ms = read_codepoints(
    fetch(
        "https://raw.githubusercontent.com/google/material-design-icons/master/variablefont/MaterialSymbolsRounded%5BFILL%2CGRAD%2Copsz%2Cwght%5D.codepoints",
        "ms.cp",
    )
)
print("MI:", len(mi), "MS:", len(ms))

data = {
    "_meta": {
        "generated": "2026-09-02",
        "fa": "6.7.2 free",
        "bi": "1.11.3",
        "ri": "4.6.0",
        "mi": "google/material-design-icons font",
        "ms": "google/material-design-icons variablefont",
    },
    "fa": fa_styles,
    "bi": bi,
    "ri": ri,
    "mi": mi,
    "ms": ms,
}

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(data, f, separators=(",", ":"))
print("written", OUT, os.path.getsize(OUT), "bytes")
