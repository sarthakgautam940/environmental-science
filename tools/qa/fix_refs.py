"""Fill/verify journal citation details (journal, volume, issue, pages, year) from Crossref for every DOI ref."""
import json, sys, time, urllib.request, urllib.parse, re
UA = "Group6EcosystemsSite/1.0 (educational; citation check)"
def cr(doi):
    for i in range(4):
        try:
            req = urllib.request.Request("https://api.crossref.org/works/" + urllib.parse.quote(doi), headers={"User-Agent": UA})
            return json.load(urllib.request.urlopen(req, timeout=40))["message"]
        except Exception as e:
            time.sleep(3 + 3 * i)
    return None
for path in sys.argv[1:]:
    refs = json.load(open(path))
    for k, r in refs.items():
        m = re.match(r"https://doi\.org/(.+)$", r.get("url", ""))
        if not m:
            continue
        msg = cr(m.group(1))
        if not msg:
            print("FAIL", k); continue
        j = "".join(msg.get("container-title", [""]))
        vol, iss, pg = msg.get("volume", ""), msg.get("issue", ""), msg.get("page", "") or msg.get("article-number", "")
        yr = str((msg.get("issued", {}).get("date-parts") or [[""]])[0][0])
        cont = j + (f", {vol}" if vol else "") + (f"({iss})" if iss else "") + (f", {pg.replace('-', '–')}" if pg else "")
        if cont != r.get("container") or yr != r.get("year"):
            print(f"{k}: '{r.get('container')}' ({r.get('year')}) -> '{cont}' ({yr})")
        r["container"], r["year"] = cont, yr
        time.sleep(0.6)
    json.dump(refs, open(path, "w"), indent=1, ensure_ascii=False)
