# Spruce & Spartina: Evergreen Coniferous Forest and Estuarine Zone

An illustrated, fully static educational website for an AP Environmental Science group project.

**Group 6:** Eshan Nath, Aarav Nayak, Dhruv Vijay
**Course:** AP Environmental Science, Mr. Bosher

The site compares one terrestrial biome (the evergreen coniferous, or boreal, forest) with one aquatic life zone (the estuarine zone). Each ecosystem page follows the same eight numbered sections:

1. Characteristic climate (with a real NOAA climatogram for the forest and USGS river-flow data for the estuary)
2. Soil or bottom substrate
3. Global map and latitude
4. Plant and animal species with detailed adaptations (challenge, adaptation, how it works, why it helps, survival and reproduction)
5. Specific problems caused by humans
6. Potential solutions
7. Pictures
8. Sources cited

There is also an ecology section on each page (food webs, energy flow, nutrient cycling, key relationships, ecosystem services), a comparison page and a full sources and image-credits page.

## Pages

| File | Contents |
| --- | --- |
| `site/index.html` | Landing page, project credits, biome vs. life zone primer, links to every section |
| `site/coniferous-forest.html` | Evergreen Coniferous Forest |
| `site/estuary.html` | Estuarine Zone |
| `site/compare.html` | Side-by-side comparison, connections and review questions |
| `site/references.html` | All sources by page, data sets, image credits |

## Preview locally

The finished site is plain HTML, CSS and a little JavaScript in the `site/` folder. No build step is needed to view it.

Either open `site/index.html` directly in a browser, or serve the folder (recommended, so every link behaves exactly as it will online):

```bash
python3 -m http.server 8080 --directory site
```

Then visit http://localhost:8080.

## Publish so anyone with the link can view it

Any static host works. Point it at the `site/` folder.

### Option A: Vercel

1. Import this repository at vercel.com/new.
2. The included `vercel.json` already sets the output directory to `site` and needs no install step. Click **Deploy**.

### Option B: GitHub Pages

1. In the repository on GitHub, open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push to `main` (or run the "Deploy site to GitHub Pages" workflow by hand). The workflow in `.github/workflows/pages.yml` publishes the `site/` folder.

GitHub Pages on a free account requires the repository to be public. If the repository is private, use Vercel or Netlify instead.

### Option C: Netlify Drop

Drag the `site/` folder onto https://app.netlify.com/drop.

## How the site is built (for editing)

The pages in `site/` are generated from source fragments in `src/` by a small Node script with no dependencies:

```bash
node tools/build.mjs
```

- `src/pages/` page shells; `src/sections/` the text of each numbered section
- `src/figures/` hand-drawn SVG diagrams; `src/figures/gen/` generated charts and maps
- `src/data/refs/*.json` every reference; citations are written as `{{cite:key}}` and numbered automatically per page
- `src/data/images.json` photo metadata (author, license, source) used for captions and the credits table

Other tools (only needed to regenerate data, maps or photos):

| Script | Purpose |
| --- | --- |
| `tools/fetch_data.py` | Downloads NOAA climate normals and USGS river statistics into `site/assets/data/` |
| `tools/build-charts.mjs` | Draws the climatograms and river-flow chart from that data |
| `tools/build-maps.mjs` | Draws the maps from RESOLVE Ecoregions 2017 and Natural Earth (needs `npm install`) |
| `tools/images.py` | Searches openly licensed photos and converts chosen ones to WebP |

Quality checks:

```bash
python3 tools/qa/check_links.py --external
```

```bash
python3 tools/qa/content_check.py
```

```bash
node tools/qa/axe.mjs
```

The accessibility check needs the local preview server running and `npm install --no-save axe-core`.

## Credits and licenses

- Text and diagrams: written and drawn for this project from the sources listed on each page.
- Photographs: from iNaturalist, Wikimedia Commons and Flickr under CC0, public domain, CC BY or CC BY-SA licenses; every photo is credited beside the image and in `site/references.html#image-credits`.
- Data: NOAA NCEI U.S. Climate Normals 1991–2020, USGS National Water Information System, RESOLVE Ecoregions 2017 (CC BY 4.0), Natural Earth (public domain).
- Fonts: Newsreader and Source Sans 3, SIL Open Font License (license files in `site/assets/fonts/`).
