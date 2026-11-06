"""Content checks on the built site.

    python3 tools/qa/content_check.py

- each ecosystem page has its numbered sections, 5-6 organism profiles, and every
  teacher-listed problem and solution
- every organism has a photo with credit, common and scientific name, a role, and at
  least two adaptations, each with a challenge, how it works and why it helps
- 15-25 sources per page, listed as plain URLs; every citation points at a listed source
- no em dashes, middots, placeholders or the old site name
"""
import os
import re

SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "site")
issues = []
pages = {f: open(os.path.join(SITE, f), encoding="utf-8").read() for f in os.listdir(SITE) if f.endswith(".html")}

for name in ("coniferous-forest.html", "estuary.html"):
    s = pages[name]
    orgs = re.split(r'<article class="org"', s)[1:]
    if not 5 <= len(orgs) <= 6:
        issues.append(f"{name}: {len(orgs)} organisms (want 5-6)")
    for c in orgs:
        oid = re.search(r'id="([^"]+)"', c).group(1)
        c = c.split("</article>")[0]
        for label, ok in {
            "photo": 'class="photo' in c,
            "credit": 'class="credit"' in c,
            "common name": 'class="org__name"' in c,
            "scientific name": 'class="org__sci"><i>' in c,
            "role": 'class="org__role"' in c,
        }.items():
            if not ok:
                issues.append(f"{name} {oid}: missing {label}")
        traits = re.split(r'<div class="trait">', c)[1:]
        if len(traits) < 2:
            issues.append(f"{name} {oid}: only {len(traits)} adaptation(s)")
        for i, t in enumerate(traits, 1):
            for lab in ("Challenge", "How it works", "Why it helps"):
                m = re.search(rf'data-l="{lab}">(.*?)</p>', t, re.S)
                if not m or len(re.sub(r"<[^>]+>|\{\{[^}]*\}\}", "", m.group(1)).strip()) < 12:
                    issues.append(f"{name} {oid}: adaptation {i} missing '{lab}'")
    print(f"{name}: {len(orgs)} organisms")
    for sec in ["overview", "climate", "soil", "location", "species", "ecology", "problems", "sources"]:
        if f'id="{sec}"' not in s:
            issues.append(f"{name}: missing section #{sec}")
    n_src = len(re.findall(r'<li id="src-\d+">', s))
    print(f"{name}: {n_src} sources")
    if not 15 <= n_src <= 25:
        issues.append(f"{name}: {n_src} sources (want 15-25)")
    for li in re.findall(r'<li id="src-\d+">(.*?)</li>', s):
        if not re.fullmatch(r'<a href="https?://[^"]+" rel="noopener">https?://[^<]+</a>', li):
            issues.append(f"{name}: source not a plain URL: {li[:80]}")

need = {
    "coniferous-forest.html": ["Deforestation and commercial logging", "Habitat fragmentation", "Climate change", "Wildfire changes", "Insect outbreaks", "Mining", "Biodiversity loss",
                               "Sustainable forestry", "reforestation", "Protected areas", "Wildlife corridors", "Responsible extraction", "Wildfire management", "Climate adaptation"],
    "estuary.html": ["Agricultural runoff", "fertilizer pollution", "excess nitrogen and phosphorus", "Eutrophication and hypoxia", "Industrial and sewage pollution", "Plastic pollution", "Coastal development", "dredging", "Sea-level rise and saltwater intrusion", "Overfishing",
                     "Agricultural runoff reduction", "Better wastewater treatment", "Wetland restoration", "Living shorelines", "Pollution prevention", "Sustainable fishing", "habitat protection", "monitoring and conservation programs"],
}
for name, items in need.items():
    titles = " | ".join(re.findall(r'<div class="ps__row"[^>]*>(.*?)</div>\s*</div>', pages[name], re.S))
    heads = " | ".join(re.findall(r"<h3>(.*?)</h3>", titles))
    for it in items:
        if it.lower() not in heads.lower():
            issues.append(f"{name}: no problem/solution heading containing '{it}'")

for name, s in pages.items():
    text = re.sub(r"<(script|style)[\s\S]*?</\1>", "", s)
    for bad, label in [("—", "em dash"), ("·", "middot"), ("TODO", "TODO"), ("lorem", "lorem"), ("[image ", "missing image"), ("{{", "unreplaced directive"), ("Spartina &amp; ", "old site name"), ("<details><summary>", "study Q&A")]:
        if bad in text:
            issues.append(f"{name}: contains {label}")
    n_sources = len(re.findall(r'<li id="src-\d+">', s))
    cites = {int(x) for x in re.findall(r'href="#src-(\d+)"', s)}
    if cites and max(cites) > n_sources:
        issues.append(f"{name}: citation {max(cites)} but only {n_sources} sources")

print("\n".join(issues) if issues else "content check: no issues")
