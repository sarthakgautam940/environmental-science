# Authoring conventions (Group 6 ecosystems site)

Project root: `/home/user/group6-ecosystems`. Source fragments live in `src/`; `tools/build.mjs` assembles them
into the static site in `site/`. Audience: AP Environmental Science students (high school) and their teacher.
Voice: clear, precise, editorial (think National Geographic / Smithsonian explainer) — no hype, no filler, no
second-person "you will learn". Use American spelling. Metric first, US units in parentheses where helpful
(e.g. "−22 °C (−8 °F)"). Use real Unicode: en dash for ranges (5–18), minus sign (−), degree (°), ×.

## 1. Build directives (the build replaces these)

| Directive | Output |
|---|---|
| `{{cite:key}}` or `{{cite:key1,key2}}` | superscript numbered citation(s) linking to the page's source list. Numbers are assigned automatically in order of first use on the page. Put it right after the claim it supports, before the period if mid-sentence is awkward: `…in 2013.{{cite:mills2013}}` |
| `{{figure:key}}` | full `<figure>` for photo `key` (image + caption + credit, captions come from the image manifest) |
| `{{figure:key|wide}}` / `|full` / `|inline` / `|portrait` | same, with a layout modifier |
| `<!-- @svg figures/name.svg -->` | inlines an SVG diagram file from `src/figures/` |

Never type citation numbers or reference lists by hand. Never invent a citation key that is not defined in your
references JSON file.

## 2. References JSON (one file per author area, in `src/data/refs/`)

```json
{
  "krebs2001": {
    "authors": "Krebs, C. J., Boonstra, R., Boutin, S., & Sinclair, A. R. E.",
    "year": "2001",
    "title": "What drives the 10-year cycle of snowshoe hares?",
    "container": "BioScience, 51(1), 25–35",
    "publisher": "",
    "url": "https://doi.org/10.1641/0006-3568(2001)051[0025:WDTYCO]2.0.CO;2",
    "kind": "journal",
    "verified": "Abstract fetched 2026-11-05; supports: hare cycle 8–11 yr; predation + food interaction."
  }
}
```
- `kind`: one of `journal`, `government`, `university`, `museum`, `ngo`, `book`, `dataset`.
- Organization-authored pages: `"authors": "NOAA National Ocean Service"`, `"year": "n.d."` if undated.
- `url` must be a real, working URL that you have actually fetched (HTTP 200 after redirects) and whose content
  supports the claims you attach to it. Prefer DOIs (`https://doi.org/...`) for papers. Check with
  `curl -sS -o /dev/null -w "%{http_code}" -L "<url>"` and read content with WebFetch.
- `verified`: a short note of what the source actually says that you relied on (for the human QA pass).
- Keys: lowercase, `authoryear` or `orgtopic` style, unique within your file.
- Priority sources: NOAA, NASA, NPS, EPA, USGS, USDA Forest Service (incl. Fire Effects Information System
  `www.fs.usda.gov/database/feis/...` and *Silvics of North America*), USDA NRCS, US Fish & Wildlife Service,
  Smithsonian, peer-reviewed journals, universities (e.g. Cornell Lab *All About Birds*, VIMS, UMCES), ADF&G,
  Chesapeake Bay Program, Animal Diversity Web (U. Michigan), state natural-resource agencies, Parks Canada,
  Natural Resources Canada.
- **No invented statistics, titles, authors, years or URLs.** If you cannot verify a number, write the sentence
  without the number or drop it.

## 3. Species profile markup (Requirement 4)

Each organism = one `<article class="species">`. All eight required items must be present:
(1) common name, (2) scientific name, (3) ecological role, (4) adaptations, (5) environmental challenge,
(6) how it works, (7) why advantageous here, (8) survival & reproduction. Give **2–3 adaptations per species**
(each as a full chain). Be species-specific; never generic.

```html
<article class="species" id="sp-black-spruce" data-kind="plant">
  {{figure:forest/black-spruce|species}}
  <div class="species__body">
    <header class="species__head">
      <p class="species__role-tag">Primary producer · Lowland peatland dominant</p>
      <h4 class="species__name">Black spruce</h4>
      <p class="species__sci"><i>Picea mariana</i></p>
    </header>
    <dl class="species__facts">
      <div><dt>Range</dt><dd>…</dd></div>
      <div><dt>Habitat</dt><dd>…</dd></div>
      <div><dt>Size / lifespan</dt><dd>…</dd></div>
    </dl>
    <div class="species__role">
      <h5>Ecological role</h5>
      <p>… {{cite:key}}</p>
    </div>
    <div class="adaptations">
      <section class="adapt">
        <h5 class="adapt__title"><span class="adapt__type">Reproductive · Fire</span> Semi-serotinous cones</h5>
        <dl class="adapt__chain">
          <div class="adapt__step adapt__step--challenge"><dt>Environmental challenge</dt><dd>…</dd></div>
          <div class="adapt__step adapt__step--adaptation"><dt>Adaptation</dt><dd>…</dd></div>
          <div class="adapt__step adapt__step--how"><dt>How it works</dt><dd>…</dd></div>
          <div class="adapt__step adapt__step--why"><dt>Why it helps here</dt><dd>…</dd></div>
          <div class="adapt__step adapt__step--payoff"><dt>Survival &amp; reproduction</dt><dd>…</dd></div>
        </dl>
      </section>
      <!-- 1–2 more .adapt sections -->
    </div>
    <aside class="species__note"><strong>Exam tip:</strong> … (optional; a likely teacher question or a common misconception)</aside>
  </div>
</article>
```
`adapt__type` is one of: Structural, Physiological, Behavioral, Reproductive, Life history (optionally with a
second word after " · ", e.g. "Physiological · Salt"). Length: each chain step 1–3 sentences; each profile
roughly 350–600 words. Mechanisms must be biologically specific (name the tissue, molecule, organ, hormone,
cue, or behavior). Cite each profile with at least 2 reputable sources.

### Optional small diagram inside a profile
```html
<figure class="diagram diagram--inline">
  <svg viewBox="0 0 640 260" role="img" aria-labelledby="dg-x-title dg-x-desc" class="dg">
    <title id="dg-x-title">…</title><desc id="dg-x-desc">…</desc>
    …
  </svg>
  <figcaption>… (say "Schematic, not to scale" when appropriate)</figcaption>
</figure>
```
SVG style kit (styled by site CSS; do not hard-code fonts): text classes `lbl` (13px), `lbl-sm` (11.5px),
`lbl-b` (bold), `lbl-i` (italic), `lbl-mute`; shape classes `ln` (1.25px ink stroke, no fill), `ln-thin`,
`ln-dash`, `arrow` (stroke with arrowhead; add `marker-end="url(#ah)"` and define
`<defs><marker id="ah" …>` yourself with a unique id per SVG), fills `f-ink`, `f-paper`, `f-a1` (darkest theme
color), `f-a2`, `f-a3`, `f-a4` (lightest accent), `f-earth` (brown), `f-water` (blue-green), `f-snow`
(white/pale), `f-warn` (muted rust, for problems). Keep diagrams simple, labeled, and legible at 360px wide.

## 4. Problem / solution markup (Requirements 5 and 6)

```html
<article class="dossier" id="p-logging">
  <header class="dossier__head">
    <p class="dossier__num">5.1</p>
    <h3 class="dossier__title">Deforestation and commercial logging</h3>
  </header>
  <dl class="dossier__rows">
    <div><dt>Cause</dt><dd>…</dd></div>
    <div><dt>Environmental mechanism</dt><dd>…</dd></div>
    <div><dt>Organisms &amp; processes affected</dt><dd>…</dd></div>
    <div><dt>Ecological consequences</dt><dd>…</dd></div>
    <div><dt>Real-world example</dt><dd>… {{cite:key}}</dd></div>
  </dl>
</article>

<article class="dossier dossier--solution" id="s-sustainable-forestry">
  <header class="dossier__head">
    <p class="dossier__num">6.1</p>
    <h3 class="dossier__title">Sustainable forestry</h3>
    <p class="dossier__addresses">Addresses <a href="#p-logging">5.1</a> <a href="#p-fragmentation">5.2</a></p>
  </header>
  <dl class="dossier__rows">
    <div><dt>How it works</dt><dd>…</dd></div>
    <div><dt>Problem it addresses</dt><dd>…</dd></div>
    <div><dt>Real-world example</dt><dd>… {{cite:key}}</dd></div>
    <div><dt>Limits &amp; trade-offs</dt><dd>…</dd></div>
  </dl>
</article>
```

## 5. Image keys (photo manifest `src/data/images.json`)
Use only these keys in `{{figure:…}}`. The image curator fills the manifest.
- Forest: `forest/hero`, `forest/black-spruce`, `forest/white-spruce`, `forest/balsam-fir`,
  `forest/lodgepole-pine`, `forest/eastern-hemlock`, `forest/tamarack`, `forest/moose`,
  `forest/snowshoe-hare-winter`, `forest/snowshoe-hare-summer`, `forest/canada-lynx`, `forest/gray-wolf`,
  `forest/brown-bear`, `forest/boreal-owl`, `forest/red-squirrel`, `forest/taiga-siberia`, `forest/scandinavia`,
  `forest/pnw-rainforest`, `forest/muskeg`, `forest/podzol`, `forest/wildfire`, `forest/pine-beetle`,
  `forest/clearcut`, `forest/oil-sands`, `forest/wildlife-overpass`, `forest/replanting`,
  `forest/prescribed-burn`, `forest/hemlock-adelgid`, `forest/caribou`, `forest/winter-forest`
- Estuary: `estuary/hero`, `estuary/smooth-cordgrass`, `estuary/eelgrass`, `estuary/phytoplankton`,
  `estuary/glasswort`, `estuary/high-marsh`, `estuary/eastern-oyster`, `estuary/oyster-reef`,
  `estuary/blue-crab`, `estuary/fiddler-crab`, `estuary/ribbed-mussel`, `estuary/marsh-periwinkle`,
  `estuary/mummichog`, `estuary/striped-bass`, `estuary/great-blue-heron`, `estuary/snowy-egret`,
  `estuary/great-egret`, `estuary/osprey`, `estuary/mudflat`, `estuary/chesapeake-satellite`,
  `estuary/amazon-mouth`, `estuary/sf-bay`, `estuary/thames`, `estuary/algal-bloom`, `estuary/marine-debris`,
  `estuary/coastal-development`, `estuary/dredging`, `estuary/ghost-forest`, `estuary/living-shoreline`,
  `estuary/marsh-restoration`, `estuary/oyster-restoration`, `estuary/fish-kill`
