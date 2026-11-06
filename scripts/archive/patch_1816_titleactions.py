#!/usr/bin/env python3
"""v1.8.16 patch: pass view title actions through the sidebarApps registry."""

PATH = "src/sidebarApps/index.js"

src = open(PATH, encoding="utf-8").read()
orig = src

# 1. Float-closed event: clear title AND actions (2-tab base)
old1 = (
	"\t\tsidebarModule()\n"
	'\t\t\t.then(({ default: SidebarModule }) => SidebarModule.setPanelTitle?.(""))\n'
	"\t\t\t.catch(() => {});"
)
new1 = (
	"\t\tsidebarModule()\n"
	"\t\t\t.then(({ default: SidebarModule }) =>\n"
	'\t\t\t\tSidebarModule.setPanelTitle?.("", []),\n'
	"\t\t\t)\n"
	"\t\t\t.catch(() => {});"
)
assert old1 in src, "float-closed call site not found"
src = src.replace(old1, new1, 1)

# 2. langchange handler (3-tab base)
old2 = (
	"\t\t\tsidebarModule()\n"
	"\t\t\t\t.then(({ default: SidebarModule }) =>\n"
	'\t\t\t\t\tSidebarModule.setPanelTitle?.(usesFloat(app) ? "" : app.title),\n'
	"\t\t\t\t)\n"
	"\t\t\t\t.catch(() => {});"
)
new2 = (
	"\t\t\tsidebarModule()\n"
	"\t\t\t\t.then(({ default: SidebarModule }) =>\n"
	"\t\t\t\t\tSidebarModule.setPanelTitle?.(\n"
	'\t\t\t\t\t\tusesFloat(app) ? "" : app.title,\n'
	"\t\t\t\t\t\tusesFloat(app) ? [] : app.titleActions,\n"
	"\t\t\t\t\t),\n"
	"\t\t\t\t)\n"
	"\t\t\t\t.catch(() => {});"
)
assert old2 in src, "langchange call site not found"
src = src.replace(old2, new2, 1)

# 3. setActiveApp (1-tab base)
old3 = (
	"\tsidebarModule()\n"
	"\t\t.then(({ default: SidebarModule }) =>\n"
	'\t\t\tSidebarModule.setPanelTitle?.(floatMode ? "" : app.title),\n'
	"\t\t)\n"
	"\t\t.catch(() => {});"
)
new3 = (
	"\tsidebarModule()\n"
	"\t\t.then(({ default: SidebarModule }) =>\n"
	"\t\t\tSidebarModule.setPanelTitle?.(\n"
	'\t\t\t\tfloatMode ? "" : app.title,\n'
	"\t\t\t\tfloatMode ? [] : app.titleActions,\n"
	"\t\t\t),\n"
	"\t\t)\n"
	"\t\t.catch(() => {});"
)
assert old3 in src, "setActiveApp call site not found"
src = src.replace(old3, new3, 1)

assert src != orig
open(PATH, "w", encoding="utf-8").write(src)
print("patched", PATH)
