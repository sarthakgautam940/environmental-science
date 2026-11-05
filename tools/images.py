"""Image pipeline for the site.

Sources (free licenses only: CC0, public domain, CC BY, CC BY-SA — no NC/ND):
  * iNaturalist research-grade observation photos (species), via https://api.inaturalist.org/v1
  * Openverse (https://openverse.org — Flickr, Wikimedia Commons and other open collections)
  * Wikimedia Commons file pages (when a specific Commons file is chosen)

  python3 tools/images.py search <queries.json> <outdir>
      queries.json: {"key": {"inat": "Scientific name"} | {"ov": "search words"} | {"commons": "words"}}
      Writes <outdir>/<key>.json (candidates with license + attribution) and a numbered contact sheet
      <outdir>/<key>.jpg for visual inspection.

  python3 tools/images.py fetch <selections.json>
      selections.json: {"key": {"from": "<outdir>/<key>.json", "pick": 3, "alt": ..., "caption": ...,
                                "focal": "50% 40%", "crop": [l,t,r,b], "hero": false}}
      Downloads the chosen image, converts to WebP (800, 1600 and for heroes 2400 px wide) and records
      author, license and source page in src/data/images.json.
"""
import html
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = "Group6EcosystemsSite/1.0 (student educational static website; image credits kept) python-urllib"
OK = {"cc0", "pdm", "pd", "by", "by-sa", "cc-by", "cc-by-sa"}
LICENSE_NAME = {
    "cc0": "CC0 1.0", "pdm": "Public domain", "pd": "Public domain",
    "by": "CC BY", "cc-by": "CC BY", "by-sa": "CC BY-SA", "cc-by-sa": "CC BY-SA",
}
LICENSE_URL = {
    "cc0": "https://creativecommons.org/publicdomain/zero/1.0/",
    "pdm": "https://creativecommons.org/publicdomain/mark/1.0/",
    "cc-by": "https://creativecommons.org/licenses/by/4.0/",
    "cc-by-sa": "https://creativecommons.org/licenses/by-sa/4.0/",
}


def get(url, binary=False, tries=5):
    for i in range(tries):
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                data = r.read()
                return data if binary else data.decode("utf-8")
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500:
                wait = min(int(e.headers.get("Retry-After") or 0) or (4 * (i + 1)), 90)
                print(f"  {e.code} {url[:60]}; waiting {wait}s", file=sys.stderr)
                time.sleep(wait + 1)
                continue
            raise
    raise RuntimeError("too many retries: " + url)


def strip_html(s):
    s = re.sub(r"<[^>]+>", "", s or "")
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def inat(taxon, n=16):
    url = ("https://api.inaturalist.org/v1/observations?" + urllib.parse.urlencode({
        "taxon_name": taxon, "photo_license": "cc-by,cc-by-sa,cc0", "quality_grade": "research",
        "order_by": "votes", "per_page": str(n), "photos": "true",
    }))
    d = json.loads(get(url))
    out = []
    for o in d.get("results", []):
        for p in o.get("photos", [])[:1]:
            lic = (p.get("license_code") or "").lower()
            if lic not in OK:
                continue
            dims = p.get("original_dimensions") or {}
            out.append({
                "source": "iNaturalist", "id": p["id"],
                "thumb": p["url"].replace("square", "medium"),
                "full": p["url"].replace("square", "original"),
                "w": dims.get("width"), "h": dims.get("height"),
                "license": lic, "author": re.sub(r"^\(c\)\s*", "", p.get("attribution", "")).split(",")[0],
                "attribution": p.get("attribution"),
                "page": f"https://www.inaturalist.org/photos/{p['id']}",
                "obs": o.get("uri"), "place": o.get("place_guess"),
                "title": f"{o.get('taxon', {}).get('name', taxon)} — iNaturalist observation {o['id']}",
            })
    return out


def openverse(q, n=16, source=None):
    params = {"q": q, "license": "by,by-sa,cc0,pdm", "page_size": str(n), "mature": "false"}
    if source:
        params["source"] = source
    d = json.loads(get("https://api.openverse.org/v1/images/?" + urllib.parse.urlencode(params)))
    out = []
    for r in d.get("results", []):
        lic = (r.get("license") or "").lower()
        if lic not in OK:
            continue
        out.append({
            "source": r.get("source"), "id": r["id"],
            "thumb": r.get("thumbnail"), "full": r.get("url"),
            "w": r.get("width"), "h": r.get("height"),
            "license": lic, "license_version": r.get("license_version"),
            "license_url": r.get("license_url"),
            "author": strip_html(r.get("creator") or "") or "Unknown",
            "attribution": strip_html(r.get("attribution") or ""),
            "page": r.get("foreign_landing_url"), "title": strip_html(r.get("title") or ""),
        })
    return out


def wm_thumb(url, width=330):
    """Build a standard-size Wikimedia thumbnail URL from an original upload URL."""
    m = re.match(r"https://upload\.wikimedia\.org/wikipedia/commons/(\w)/(\w\w)/([^?]+)", url or "")
    if not m:
        return None
    name = m.group(3)
    suffix = ".png" if name.lower().endswith((".tif", ".tiff", ".svg")) else ""
    return f"https://upload.wikimedia.org/wikipedia/commons/thumb/{m.group(1)}/{m.group(2)}/{name}/{width}px-{name}{suffix}"


def contact_sheet(cands, path, key):
    cell_w, cell_h, cols = 300, 220, 4
    rows = (len(cands) + cols - 1) // cols or 1
    sheet = Image.new("RGB", (cols * cell_w, rows * (cell_h + 34) + 30), "white")
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
    except OSError:
        font = ImageFont.load_default()
    d.text((6, 6), key, fill="black", font=font)
    for i, c in enumerate(cands):
        x, y = (i % cols) * cell_w, 30 + (i // cols) * (cell_h + 34)
        try:
            turl = wm_thumb(c["full"]) if c.get("source") == "wikimedia" else c["thumb"]
            im = Image.open(io.BytesIO(get(turl, binary=True))).convert("RGB")
            im.thumbnail((cell_w - 6, cell_h - 4))
            sheet.paste(im, (x + 3, y))
        except Exception as e:  # noqa: BLE001
            d.text((x + 6, y + 20), f"err {e}"[:40], fill="red", font=font)
        d.text((x + 4, y + cell_h + 2), f"#{i} {c['w']}x{c['h']} {c['license']} {c['source'][:10]}", fill="black", font=font)
        d.text((x + 4, y + cell_h + 16), (c.get("place") or c["title"] or "")[:44], fill="#444", font=font)
        time.sleep(0.25)
    sheet.save(path, quality=72)


def cmd_search(qfile, outdir, only=None):
    os.makedirs(outdir, exist_ok=True)
    queries = json.load(open(qfile))
    for key, q in queries.items():
        if only and key not in only:
            continue
        safe = key.replace("/", "__")
        jpath = os.path.join(outdir, safe + ".json")
        if os.path.exists(jpath) and not only:
            continue
        try:
            if "inat" in q:
                cands = inat(q["inat"], q.get("n", 12))
            else:
                cands = openverse(q["ov"], q.get("n", 12), q.get("source"))
        except Exception as e:  # noqa: BLE001
            print("search failed", key, e, file=sys.stderr)
            continue
        cands = [c for c in cands if c.get("thumb")][:16]
        contact_sheet(cands, os.path.join(outdir, safe + ".jpg"), key)
        json.dump(cands, open(jpath, "w"), indent=1)
        print("ok", key, len(cands), flush=True)
        time.sleep(1.0)


def license_label(c):
    lic = c["license"]
    name = LICENSE_NAME.get(lic, lic.upper())
    if c.get("license_version") and lic not in ("cc0", "pdm"):
        name += " " + c["license_version"]
    return name


def cmd_fetch(sel_file, only=None):
    sel = json.load(open(sel_file))
    man_path = os.path.join(ROOT, "src", "data", "images.json")
    manifest = json.load(open(man_path)) if os.path.exists(man_path) else {}
    for key, s in sel.items():
        if only and key not in only:
            continue
        cands = json.load(open(s["from"]))
        c = cands[s["pick"]]
        try:
            fetch_one(key, s, c, manifest, man_path, only)
        except Exception as e:  # noqa: BLE001
            print("FAILED", key, e, flush=True)


def fetch_one(key, s, c, manifest, man_path, only):
    if True:
        if key in manifest and manifest[key].get("id") == c["id"] and not s.get("force") and not only:
            return
        hero = s.get("hero", False)
        url = c["full"]
        if c["source"] == "wikimedia":
            # standard thumbnail sizes come from a cache that rate-limits far less than original files
            w0 = c.get("w") or 0
            tw = s.get("thumb") or (1920 if w0 >= 1920 else 1280 if w0 >= 1280 else 960 if w0 >= 960 else 0)
            if tw:
                url = wm_thumb(url, tw) or url
                if url.lower().endswith((".tif.png", ".tiff.png")):
                    url = re.sub(r"/(\d+px-)([^/]+)\.png$", r"/lossy-page1-\1\2.jpg", url)
        if c["source"] == "flickr" and s.get("flickr_size"):
            url = re.sub(r"_[a-z]\.jpg$", f"_{s['flickr_size']}.jpg", url)
        im = Image.open(io.BytesIO(get(url, binary=True)))
        im = ImageOps.exif_transpose(im).convert("RGB")
        if s.get("crop"):  # [left, top, right, bottom] as fractions
            l, t, r, b = s["crop"]
            W, H = im.size
            im = im.crop((int(l * W), int(t * H), int(r * W), int(b * H)))
        folder, name = key.split("/")
        outdir = os.path.join(ROOT, "site", "assets", "img", folder)
        os.makedirs(outdir, exist_ok=True)
        for old in os.listdir(outdir):
            if re.fullmatch(re.escape(name) + r"-\d+\.webp", old):
                os.remove(os.path.join(outdir, old))
        widths = [800, 1600] + ([2400] if hero else [])
        made = []
        for w in widths:
            if im.width < w * 0.9 and w != 800:
                continue
            cp = im.copy()
            if cp.width > w:
                cp = cp.resize((w, round(cp.height * w / cp.width)), Image.LANCZOS)
            cp.save(os.path.join(outdir, f"{name}-{w}.webp"), "WEBP", quality=78, method=6)
            made.append(w)
        W = min(im.width, max(made))
        H = round(im.height * W / im.width)
        lic_url = c.get("license_url") or LICENSE_URL.get(c["license"], "")
        manifest[key] = {
            "file": f"assets/img/{folder}/{name}",
            "widths": made, "width": W, "height": H,
            "alt": s["alt"], "caption": s["caption"],
            "author": s.get("author") or c["author"],
            "license": license_label(c), "license_url": lic_url,
            "source_url": c["page"], "host": s.get("host") or ("iNaturalist" if c["source"] == "iNaturalist" else ("Wikimedia Commons" if c["source"] == "wikimedia" else "Flickr" if c["source"] == "flickr" else c["source"])),
            "title": c["title"], "id": c["id"],
            "focal": s.get("focal", "50% 50%"),
        }
        json.dump(manifest, open(man_path, "w"), indent=1, ensure_ascii=False)
        print("fetched", key, made, manifest[key]["license"], flush=True)
        time.sleep(0.8)


if __name__ == "__main__":
    only = set(sys.argv[4:]) if len(sys.argv) > 4 else None
    if sys.argv[1] == "search":
        cmd_search(sys.argv[2], sys.argv[3], only)
    elif sys.argv[1] == "fetch":
        cmd_fetch(sys.argv[2], set(sys.argv[3:]) or None)
