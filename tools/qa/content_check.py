"""Content checks on the built site.

    python3 tools/qa/content_check.py

- every species profile has: photo + credit, common name, scientific name, ecological
  role, at least two adaptations, and each adaptation has all five chain steps
- both ecosystem pages have sections 1-8 and every teacher-listed problem/solution
- no placeholders, em dashes or middots; every citation points at a listed source
"""
import os
import re

SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "site")
issues = []
pages = {f: open(os.path.join(SITE, f), encoding="utf-8").read() for f in os.listdir(SITE) if f.endswith(".html")}

STEPS = ["challenge", "adaptation", "how", "why", "payoff"]
for name in ("coniferous-forest.html", "estuary.html"):
    s = pages[name]
    cards = re.split(r'<article class="species"', s)[1:]
    for c in cards:
        sid = re.search(r'id="([^"]+)"', c).group(1)
        c = c.split("</article>")[0]
        need = {
            "photo": 'class="photo' in c,
            "credit": 'class="credit"' in c,
            "common name": 'class="species__name"' in c,
            "scientific name": bool(re.search(r'class="species__sci">[^\n]*?<i>', c)),
            "ecological role": "<h5>Ecological role</h5>" in c,
        }
        for k, ok in need.items():
            if not ok:
                issues.append(f"{name} {sid}: missing {k}")
        adapts = re.split(r'<section class="adapt">', c)[1:]
        if len(adapts) < 2:
            issues.append(f"{name} {sid}: only {len(adapts)} adaptation(s)")
        for i, a in enumerate(adapts, 1):
            for st in STEPS:
                m = re.search(rf'adapt__step--{st}"><dt>[^<]+</dt><dd>(.*?)</dd>', a, re.S)
                if not m or len(re.sub(r"<[^>]+>", "", m.group(1)).strip()) < 15:
                    issues.append(f"{name} {sid}: adaptation {i} weak/missing step '{st}'")
    print(f"{name}: {len(cards)} species profiles")
    for sec in ["climate", "soil", "distribution", "species", "problems", "solutions", "gallery", "sources"]:
        if f'id="{sec}"' not in s:
            issues.append(f"{name}: missing section #{sec}")

need_problems = {
    "coniferous-forest.html": ["Deforestation and commercial logging", "Habitat fragmentation", "Climate change", "Wildfire", "Insect outbreaks", "Mining", "Biodiversity loss"],
    "estuary.html": ["Agricultural runoff", "Fertilizer pollution", "Excess nitrogen and phosphorus", "Eutrophication and hypoxia", "Industrial and sewage pollution", "Plastic pollution", "Coastal development", "Dredging", "Sea-level rise and saltwater intrusion", "Overfishing"],
}
need_solutions = {
    "coniferous-forest.html": ["Sustainable forestry", "Reforestation", "Protected areas", "Wildlife corridors", "resource extraction", "Wildfire management", "Climate adaptation"],
    "estuary.html": ["Agricultural runoff reduction", "Better wastewater treatment", "Wetland and marsh restoration", "Living shorelines", "Pollution prevention", "Sustainable fishing", "Habitat protection", "monitoring and conservation programs"],
}
for name, items in need_problems.items():
    titles = " | ".join(re.findall(r'<h3 class="dossier__title">(.*?)</h3>', pages[name]))
    for it in items + need_solutions[name]:
        if it.lower() not in titles.lower():
            issues.append(f"{name}: no dossier titled like '{it}'")

for name, s in pages.items():
    text = re.sub(r"<(script|style)[\s\S]*?</\1>", "", s)
    for bad, label in [("—", "em dash"), ("·", "middot"), ("TODO", "TODO"), ("lorem", "lorem"), ("[image ", "missing image"), ("{{", "unreplaced directive")]:
        if bad in text:
            issues.append(f"{name}: contains {label}")
    n_sources = len(re.findall(r'<li id="src-\d+">', s))
    cites = {int(x) for x in re.findall(r'href="#src-(\d+)"', s)}
    if cites and max(cites) > n_sources:
        issues.append(f"{name}: citation {max(cites)} but only {n_sources} sources")

print("\n".join(issues) if issues else "content check: no issues")
