# Evergreen Coniferous Forest and Estuarine Zone

AP Environmental Science biome project, Group 6 (Eshan Nath, Aarav Nayak, Dhruv Vijay), Mr. Bosher.

A plain static website, no build step. Everything lives in `site/`:

- `index.html` home page
- `coniferous-forest.html` terrestrial biome
- `estuary.html` aquatic life zone
- `assets/` styles, fonts, photos, map and climatogram SVGs

Preview locally with `python3 -m http.server 8080 --directory site`.
Vercel serves the `site/` folder as is (see `vercel.json`).
