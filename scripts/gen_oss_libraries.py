import json
import re

REPO = "/home/z/my-project/xcoder"
pkg = json.load(open(f"{REPO}/package.json", encoding="utf-8"))
deps = pkg.get("dependencies", {})

# Verified upstream — the package manifest omits the license field.
LICENSE_OVERRIDES = {
	"@emmetio/codemirror6-plugin": "MIT",
}

RE_UNIFIED = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")


def author_name(author):
	if isinstance(author, dict):
		return author.get("name") or ""
	if isinstance(author, str):
		return author
	return ""


def repo_url(repository):
	if isinstance(repository, dict):
		url = repository.get("url") or ""
	elif isinstance(repository, str):
		url = repository
	else:
		url = ""
	url = url.replace("git+", "").replace("git://", "https://")
	if url.endswith(".git"):
		url = url[: -len(".git")]
	if url.startswith("ssh://git@"):
		url = url.replace("ssh://git@", "https://")
	if url.startswith("git@"):
		url = url.replace("git@", "https://").replace(":", "/", 1)
	return url


def homepage_of(name, meta):
	homepage = (
		meta.get("homepage")
		or repo_url(meta.get("repository"))
		or f"https://www.npmjs.com/package/{name}"
	)
	if homepage.startswith("github:"):
		homepage = "https://github.com/" + homepage[len("github:"):]
	elif homepage.startswith("git+"):
		homepage = homepage[4:].replace("git://", "https://")
	elif homepage.startswith("git://"):
		homepage = homepage.replace("git://", "https://")
	if RE_UNIFIED.match(homepage):
		homepage = f"https://github.com/{homepage}"
	return homepage


out = []
missing = []
for name, range_ in sorted(deps.items()):
	base = f"{REPO}/node_modules/{name}/package.json"
	try:
		meta = json.load(open(base, encoding="utf-8"))
	except FileNotFoundError:
		missing.append(name)
		continue
	license_value = meta.get("license")
	entry = {
		"name": name,
		"version": meta.get("version") or "",
		"license": (
			LICENSE_OVERRIDES.get(name)
			or (license_value if isinstance(license_value, str) else None)
			or "Unknown"
		),
		"author": author_name(meta.get("author")),
		"homepage": homepage_of(name, meta),
		"required": range_,
	}
	out.append(entry)

out.sort(key=lambda item: item["name"].lower())
target = f"{REPO}/src/res/oss-libraries.json"
with open(target, "w", encoding="utf-8") as fh:
	json.dump(
		{
			"_generated": "From package.json dependencies (name/version/license/homepage read from node_modules). Regenerate with scripts/gen_oss_libraries.py",
			"libraries": out,
		},
		fh,
		indent="\t",
		ensure_ascii=False,
	)
	fh.write("\n")

print(f"generated {len(out)} libraries -> src/res/oss-libraries.json")
if missing:
	print("MISSING from node_modules:", missing)
lic_count = {}
for item in out:
	lic_count[item["license"]] = lic_count.get(item["license"], 0) + 1
print("top licenses:", sorted(lic_count.items(), key=lambda kv: -kv[1])[:6])
bad = [l["name"] for l in out if not l["homepage"].startswith("http")]
print("bad homepages:", bad)
