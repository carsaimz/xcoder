#!/usr/bin/env python3
"""
Generate alias CSS rules for compound class names in the icon font CSS.

The icomoon-style generator concatenated alternative glyph names into a
single class (e.g. `.remove_red_eyevisibility`), so the plain names
(`visibility`, `launch`, `close`…) used by the app JSX/CSS had no rule and
rendered nothing. For every compound `.icon.<a><b>:before` we emit
`.icon.<a>:before` and `.icon.<b>:before` with the same codepoint.

Idempotent: names already defined keep their original rule.
"""
import json
import re

CSS = "src/res/icons/style.css"

css = open(CSS, encoding="utf-8").read()

# remove previously generated/manual alias blocks FIRST so their rules are
# not treated as original definitions
css = re.sub(
    r"/\* Xcoder generated aliases.*?$",
    "",
    css,
    flags=re.S,
)
css = re.sub(
    r"/\* Xcoder alias classes.*?$",
    "",
    css,
    flags=re.S,
)

names = set(json.load(open("src/res/iconNames.json"))["mi"])

# get compound -> codepoint
rules = re.findall(r"\.icon\.([a-z_0-9]+):before \{\s*content: .\\([0-9a-f]{4}).;", css)
codepoints = dict(rules)

aliases = {}
for cls, cp in codepoints.items():
    if cls == "facebook":
        continue  # genuine brand glyph (face+book false positive)
    for i in range(2, len(cls) - 1):
        a, b = cls[:i], cls[i:]
        if a in names and b in names:
            for part in (a, b):
                if part not in codepoints:
                    aliases.setdefault(part, cp)
            break

lines = [
    "",
    "/* Xcoder generated aliases — compound icon-font class names split into",
    " * their plain names so `<span class=\"icon <name>\">` renders everywhere.",
    " * Regenerate with: python3 scripts/gen_icon_aliases.py */",
]
for name, cp in sorted(aliases.items()):
    lines.append(f".icon.{name}:before {{")
    lines.append(f'  content: "\\{cp}";')
    lines.append("}")

block = "\n".join(lines) + "\n"

# remove previously generated/manual alias block if present, then append
css = re.sub(
    r"/\* Xcoder generated aliases.*?$",
    "",
    css,
    flags=re.S,
)
css = re.sub(
    r"/\* Xcoder alias classes.*?$",
    "",
    css,
    flags=re.S,
)
css = css.rstrip("\n") + "\n" + block
open(CSS, "w", encoding="utf-8").write(css)
print(f"added {len(aliases)} alias rules:")
for name, cp in sorted(aliases.items()):
    print(f"  {name} -> \\{cp}")
