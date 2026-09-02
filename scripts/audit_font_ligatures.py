#!/usr/bin/env python3
"""
Audit: icon names available as ligatures in icons.ttf vs classes defined in
style.css. Names that exist as ligatures but have no `.icon.<name>:before`
rule get an alias rule so `<span class="icon <name>">` renders.

Reads GSUB ligature mappings: text glyph sequences -> single icon glyph.
"""
import re
import sys

from fontTools.ttLib import TTFont

FONT = "src/res/icons/icons.ttf"
CSS = "src/res/icons/style.css"

font = TTFont(FONT)
cmap = font.getBestCmap()
glyph_order = font.getGlyphOrder()
rev = {g: cp for cp, g in cmap.items()}

# Collect ligatures from GSUB (format: ligature sets per first glyph)
ligs = []
gsub = font["GSUB"].table
lookup_types = set()
for lookup in gsub.LookupList.Lookup:
    lookup_types.add(lookup.LookupType)
    if lookup.LookupType == 4:  # Ligature Substitution
        for st in lookup.SubTable:
            for first, sets in st.ligatures.items():
                for lig in sets:
                    seq = [first] + list(lig.Component)
                    cps = []
                    ok = True
                    for g in seq:
                        cp = rev.get(g)
                        if cp is None:
                            ok = False
                            break
                        cps.append(cp)
                    if not ok:
                        continue
                    # target glyph codepoint
                    target = rev.get(lig.LigGlyph)
                    text = "".join(chr(c) for c in cps)
                    ligs.append((text, target))

print("lookup types present:", sorted(lookup_types))
print("ligatures found:", len(ligs))

css = open(CSS, encoding="utf-8").read()
defined = set(re.findall(r"\.icon\.([a-z_0-9]+):before", css))

missing = []
for text, target in ligs:
    if not re.fullmatch(r"[a-z_0-9]+", text):
        continue
    if text in defined:
        continue
    missing.append((text, target))

print("names missing a CSS class:")
for text, target in sorted(missing):
    print(f"  {text} -> \\{target:04x}")
print("total missing:", len(missing))
