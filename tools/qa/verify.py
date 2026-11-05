"""Source verification helpers used while researching the site.

  python3 tools/qa/verify.py url <url> [phrase ...]
      Fetch the page (following redirects), print status, final URL and <title>, then for each phrase
      report whether it occurs (case/whitespace-insensitive) with a short snippet of context.
      Phrases may be regular expressions when prefixed with "re:".

  python3 tools/qa/verify.py doi <doi> [phrase ...]
      Print Crossref metadata (authors, year, title, journal, volume, pages) and search the OpenAlex
      abstract for the phrases.

  python3 tools/qa/verify.py text <url> [start] [length]
      Print the page's visible text (for reading a source directly).
"""
import html
import io
import json
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/pdf,*/*"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.geturl(), r.headers.get("Content-Type", ""), r.read()
    except urllib.error.HTTPError as e:
        return e.code, url, e.headers.get("Content-Type", ""), e.read() if e.fp else b""
    except Exception as e:  # noqa: BLE001
        return 0, url, "", f"<title>FETCH ERROR {e}</title>".encode()


def to_text(ctype, body):
    if "pdf" in ctype or body[:4] == b"%PDF":
        try:
            p = subprocess.run(["pdftotext", "-layout", "-", "-"], input=body, capture_output=True, timeout=120)
            return p.stdout.decode("utf-8", "ignore"), "(pdf)"
        except FileNotFoundError:
            try:
                from pypdf import PdfReader  # type: ignore
                r = PdfReader(io.BytesIO(body))
                return "\n".join(pg.extract_text() or "" for pg in r.pages), "(pdf)"
            except Exception as e:  # noqa: BLE001
                return "", f"(pdf unreadable: {e})"
    s = body.decode("utf-8", "ignore")
    title = re.search(r"<title[^>]*>(.*?)</title>", s, re.S | re.I)
    s = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", " ", s, flags=re.S | re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s), (html.unescape(title.group(1)).strip() if title else "")


def check(text, phrases):
    norm = re.sub(r"\s+", " ", text)
    low = norm.lower()
    for ph in phrases:
        if ph.startswith("re:"):
            m = re.search(ph[3:], norm, re.I)
            i = m.start() if m else -1
        else:
            i = low.find(re.sub(r"\s+", " ", ph.lower()))
        if i < 0:
            print(f"  [MISSING] {ph}")
        else:
            print(f"  [ok] {ph}\n       …{norm[max(0, i - 160): i + 260]}…")


def cmd_url(url, phrases):
    st, final, ctype, body = fetch(url)
    text, title = to_text(ctype, body)
    print(f"{st} {final}\n  title: {title}  ({len(text)} chars)")
    check(text, phrases)


def cmd_text(url, start=0, length=4000):
    st, final, ctype, body = fetch(url)
    text, title = to_text(ctype, body)
    print(f"{st} {final} | {title}\n")
    print(text[int(start): int(start) + int(length)])


def cmd_doi(doi, phrases):
    st, _, _, body = fetch("https://api.crossref.org/works/" + urllib.parse.quote(doi))
    if st != 200:
        print("crossref status", st)
    else:
        m = json.loads(body)["message"]
        authors = "; ".join(f"{a.get('family', '')}, {a.get('given', '')}" for a in m.get("author", []))
        year = (m.get("issued", {}).get("date-parts") or [[None]])[0][0]
        print(f"{authors}\n  ({year}) {''.join(m.get('title', ['']))}\n  {''.join(m.get('container-title', ['']))} {m.get('volume', '')}({m.get('issue', '')}) {m.get('page', '')}\n  https://doi.org/{doi}")
    st, _, _, body = fetch("https://api.openalex.org/works/https://doi.org/" + doi)
    if st == 200:
        w = json.loads(body)
        inv = w.get("abstract_inverted_index") or {}
        words = sorted(((p, wd) for wd, ps in inv.items() for p in ps))
        abstract = " ".join(wd for _, wd in words)
        print(f"  abstract ({len(abstract)} chars): {abstract[:1600]}")
        check(abstract, phrases)
    else:
        print("  openalex status", st)


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "url":
        cmd_url(sys.argv[2], sys.argv[3:])
    elif cmd == "doi":
        cmd_doi(sys.argv[2], sys.argv[3:])
    elif cmd == "text":
        cmd_text(*sys.argv[2:])


def cmd_find(query, rows=4):
    st, _, _, body = fetch("https://api.crossref.org/works?rows=" + str(rows) + "&query.bibliographic=" + urllib.parse.quote(query))
    if st != 200:
        print("crossref", st)
        return
    for it in json.loads(body)["message"]["items"]:
        a = it.get("author", [{}])
        first = a[0].get("family", "?") if a else "?"
        year = (it.get("issued", {}).get("date-parts") or [[None]])[0][0]
        print(f"{it.get('DOI')} | {first} {year} | {''.join(it.get('title', ['']))[:110]} | {''.join(it.get('container-title', ['']))[:50]}")


if __name__ == "__main__" and sys.argv[1] == "find":
    cmd_find(" ".join(sys.argv[2:]))


def cmd_after(url, marker, length=3500):
    st, final, ctype, body = fetch(url)
    text, title = to_text(ctype, body)
    i = text.find(marker)
    print(f"{st} {title}")
    print(text[i: i + int(length)] if i >= 0 else "(marker not found)")


if __name__ == "__main__" and sys.argv[1] == "after":
    cmd_after(*sys.argv[2:])
