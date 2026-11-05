"""Check every link, anchor and image reference in the built site.

    python3 tools/qa/check_links.py            # internal checks only
    python3 tools/qa/check_links.py --external # also request every external URL
"""
import concurrent.futures as cf
import html
import os
import re
import sys
import urllib.error
import urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
SITE = os.path.normpath(os.path.join(ROOT, "site"))
UA = "Mozilla/5.0 (X11; Linux x86_64) Group6EcosystemsLinkCheck/1.0"

pages = sorted(f for f in os.listdir(SITE) if f.endswith(".html"))
ids = {}
docs = {}
for p in pages:
    s = open(os.path.join(SITE, p), encoding="utf-8").read()
    docs[p] = s
    found = re.findall(r'\sid="([^"]+)"', s)
    dupes = {i for i in found if found.count(i) > 1}
    if dupes:
        print(f"DUPLICATE ids in {p}: {sorted(dupes)}")
    ids[p] = set(found)

problems = 0
external = set()
for p, s in docs.items():
    for href in re.findall(r'href="([^"]+)"', s):
        href = html.unescape(href)
        if href.startswith(("http://", "https://")):
            external.add(href)
            continue
        if href.startswith(("mailto:", "tel:")):
            continue
        path, _, frag = href.partition("#")
        target = path or p
        fp = os.path.join(SITE, target)
        if not os.path.exists(fp):
            print(f"{p}: missing file {href}")
            problems += 1
            continue
        if frag and target.endswith(".html") and frag not in ids.get(target, set()):
            print(f"{p}: missing anchor {href}")
            problems += 1
    for src in re.findall(r'\ssrc="([^"]+)"', s) + [u.split()[0] for ss in re.findall(r'srcset="([^"]+)"', s) for u in ss.split(",")]:
        src = src.strip()
        if src.startswith("http"):
            external.add(src)
            continue
        if not os.path.exists(os.path.join(SITE, src)):
            print(f"{p}: missing asset {src}")
            problems += 1
    # aria-labelledby / aria-describedby targets
    for ref in re.findall(r'aria-(?:labelledby|describedby)="([^"]+)"', s):
        for i in ref.split():
            if i not in ids[p]:
                print(f"{p}: aria reference to missing id {i}")
                problems += 1

print(f"internal check: {len(pages)} pages, {problems} problem(s), {len(external)} external URLs")

if "--external" in sys.argv:
    def check(url):
        for method in ("HEAD", "GET"):
            try:
                req = urllib.request.Request(url, method=method, headers={"User-Agent": UA, "Accept": "*/*"})
                with urllib.request.urlopen(req, timeout=30) as r:
                    return url, r.status
            except urllib.error.HTTPError as e:
                if method == "GET":
                    return url, e.code
            except Exception as e:  # noqa: BLE001
                if method == "GET":
                    return url, f"ERR {type(e).__name__}"
        return url, "?"

    bad = []
    with cf.ThreadPoolExecutor(12) as ex:
        for url, code in ex.map(check, sorted(external)):
            if code != 200:
                bad.append((code, url))
    for code, url in sorted(bad, key=str):
        print(code, url)
    print(f"external check: {len(external) - len(bad)} OK, {len(bad)} not 200")
