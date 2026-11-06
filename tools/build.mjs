// Static site assembler for the Group 6 ecosystems site.
//
//   node tools/build.mjs
//
// Reads src/pages/*.html and writes finished pages to site/*.html. Supported directives:
//   <!-- @include partials/x.html -->      insert another source fragment (path relative to src/)
//   <!-- @svg figures/x.svg -->            inline an SVG figure (path relative to src/)
//   {{cite:key1,key2}}                     numbered citation(s); numbers assigned per page by first use
//   {{figure:key|modifier}}                captioned, credited photo from src/data/images.json
//   {{hero:key}}                           eager-loaded hero <img> (no caption)
//   {{credit:key}}                         short credit line for a photo
//   <!-- @sources -->                      the page's numbered source list
//   <!-- @bibliography -->                 (references page) every page's source list
//   <!-- @credits -->                      (references page) table of photo credits
// The output in site/ is plain static HTML; no build step is needed to view or host it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'site');

const errors = [];
const warn = (m) => errors.push(m);

// ---------- references ----------
const refDir = path.join(SRC, 'data', 'refs');
const refs = {};
const urlToKey = {};
const normUrl = (u) => (u || '').replace(/^https?:\/\/(www\.)?/, '').replace(/[#?].*$/, '').replace(/\/$/, '').toLowerCase();
for (const f of fs.readdirSync(refDir).filter((f) => f.endsWith('.json')).sort()) {
  const data = JSON.parse(fs.readFileSync(path.join(refDir, f), 'utf8'));
  for (const [k, r] of Object.entries(data)) {
    if (refs[k]) warn(`duplicate reference key ${k} in ${f}`);
    const n = normUrl(r.url);
    if (n && urlToKey[n] && urlToKey[n] !== k) {
      refs[k] = { alias: urlToKey[n] };
    } else {
      refs[k] = r;
      if (n) urlToKey[n] = k;
    }
  }
}
const resolveKey = (k) => (refs[k] && refs[k].alias ? refs[k].alias : k);

// ---------- images ----------
const imgPath = path.join(SRC, 'data', 'images.json');
const images = fs.existsSync(imgPath) ? JSON.parse(fs.readFileSync(imgPath, 'utf8')) : {};
const usedImages = new Set();
let pageImages = null; // images used on the page being built

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SIZES = {
  full: '100vw',
  hero: '100vw',
  wide: '(min-width: 1240px) 1180px, 100vw',
  species: '(min-width: 1100px) 440px, (min-width: 760px) 40vw, 100vw',
  inline: '(min-width: 900px) 680px, 100vw',
  half: '(min-width: 900px) 50vw, 100vw',
  portrait: '(min-width: 900px) 360px, 100vw',
  gallery: '(min-width: 900px) 60vw, 100vw',
  thumb: '(min-width: 900px) 240px, 50vw',
};

function licenseLabel(l) {
  if (/public domain|^pd/i.test(l)) return 'Public domain';
  return l.replace(/^cc[- ]/i, 'CC ').replace(/-(\d)/, ' $1').replace(/-/g, '-');
}

function creditHtml(key) {
  const im = images[key];
  if (!im) return '';
  if (pageImages) pageImages.add(key);
  return `<span class="credit">Image: <a href="${esc(im.source_url)}" rel="noopener">${esc(im.source_url)}</a></span>`;
}

function imgTag(key, mod, { eager = false } = {}) {
  const im = images[key];
  if (!im) {
    warn(`missing image ${key}`);
    return `<span class="img-missing">[image ${esc(key)}]</span>`;
  }
  usedImages.add(key);
  if (pageImages) pageImages.add(key);
  const srcset = im.widths.map((w) => `${im.file}-${w}.webp ${w}w`).join(', ');
  const fallback = `${im.file}-${im.widths.includes(1600) ? 1600 : im.widths[0]}.webp`;
  const sizes = SIZES[mod] || SIZES.inline;
  const pos = im.focal && im.focal !== '50% 50%' ? ` style="object-position:${esc(im.focal)}"` : '';
  return `<img src="${fallback}" srcset="${srcset}" sizes="${sizes}" width="${im.width}" height="${im.height}" alt="${esc(im.alt)}"${pos} ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}

function figureHtml(key, mod = 'inline') {
  // Photos are shown without captions; their source URLs are listed in each page's "Image sources" section
  const im = images[key];
  const ratio = im ? ` style="--ar:${im.width}/${im.height}"` : '';
  return `<figure class="photo photo--${mod}"${ratio}><div class="photo__frame">${imgTag(key, mod)}</div></figure>`;
}

// ---------- reference formatting ----------
function formatRef(r) {
  // Sources are listed as plain URLs (no author/title formatting)
  return `<a href="${esc(r.url)}" rel="noopener">${esc(r.url)}</a>`;
}

// ---------- assembly ----------
function expandIncludes(html, depth = 0) {
  if (depth > 6) throw new Error('include depth');
  return html
    .replace(/<!--\s*@include\s+(\S+)\s*-->/g, (_, p) => {
      const fp = path.join(SRC, p);
      if (!fs.existsSync(fp)) { warn(`missing include ${p}`); return ''; }
      return expandIncludes(fs.readFileSync(fp, 'utf8'), depth + 1);
    })
    .replace(/<!--\s*@svg\s+(\S+)\s*-->/g, (_, p) => {
      const fp = path.join(SRC, p);
      if (!fs.existsSync(fp)) { warn(`missing svg ${p}`); return ''; }
      return fs.readFileSync(fp, 'utf8').replace(/<\?xml[^>]*>\s*/, '');
    });
}

const pageSources = {}; // page -> [keys in order]

function buildPage(file) {
  const name = path.basename(file, '.html');
  pageImages = new Set();
  let html = expandIncludes(fs.readFileSync(file, 'utf8'));

  // citations: assign numbers by first appearance
  const order = [];
  const num = {};
  html = html.replace(/\{\{cite:([^}]+)\}\}/g, (_, list) => {
    const keys = list.split(',').map((s) => s.trim()).filter(Boolean);
    const links = [];
    for (const k0 of keys) {
      if (!refs[k0]) { warn(`${name}: unknown cite key ${k0}`); continue; }
      const k = resolveKey(k0);
      if (!num[k]) { order.push(k); num[k] = order.length; }
      links.push(`<a href="#src-${num[k]}" aria-label="Source ${num[k]}">${num[k]}</a>`);
    }
    // collapse duplicates while keeping order
    const uniq = [...new Set(links)];
    return uniq.length ? `<sup class="cite">${uniq.join('<span class="cite__sep">,</span>')}</sup>` : '';
  });
  pageSources[name] = order;

  html = html.replace(/\{\{figure:([^}|]+)(?:\|([^}]+))?\}\}/g, (_, k, mod) => figureHtml(k.trim(), (mod || 'inline').trim()));
  html = html.replace(/\{\{hero:([^}]+)\}\}/g, (_, k) => imgTag(k.trim(), 'hero', { eager: true }));
  html = html.replace(/\{\{img:([^}|]+)(?:\|([^}]+))?\}\}/g, (_, k, mod) => imgTag(k.trim(), (mod || 'inline').trim()));
  html = html.replace(/\{\{credit:([^}]+)\}\}/g, (_, k) => creditHtml(k.trim()));

  // scrollable tables: make the scroll container keyboard-focusable and name it after its caption
  html = html.replace(/<div class="table-wrap">(\s*<table[^>]*>\s*<caption>([\s\S]*?)<\/caption>)?/g, (m, t, cap) => {
    const label = cap ? cap.replace(/<small>[\s\S]*?<\/small>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : 'Table';
    return `<div class="table-wrap" tabindex="0" role="region" aria-label="${esc(label)} (scrollable)">${t || ''}`;
  });

  html = html.replace(/<!--\s*@sources\s*-->/g, () =>
    `<ol class="src-list">\n${order.map((k, i) => `<li id="src-${i + 1}">${formatRef(refs[k])}</li>`).join('\n')}\n</ol>`);

  // list of image source URLs for this page
  html = html.replace(/<!--\s*@imagesources\s*-->/g, () => {
    const urls = [...new Set([...pageImages].map((k) => images[k].source_url))];
    return `<ol class="src-list">\n${urls.map((u) => `<li><a href="${esc(u)}" rel="noopener">${esc(u)}</a></li>`).join('\n')}\n</ol>`;
  });

  // active navigation item
  const page = (html.match(/<body[^>]*data-page="([^"]+)"/) || [])[1];
  if (page) html = html.replace(new RegExp(`data-nav="${page}"`, 'g'), `data-nav="${page}" aria-current="page"`);

  const left = html.match(/\{\{[^}]*\}\}/g);
  if (left) warn(`${name}: unreplaced directives ${[...new Set(left)].join(' ')}`);
  return html;
}

const pages = fs.readdirSync(path.join(SRC, 'pages')).filter((f) => f.endsWith('.html'));
const built = {};
// references page last so it can list every other page's sources
for (const f of pages.filter((f) => f !== 'references.html')) built[f] = buildPage(path.join(SRC, 'pages', f));

if (pages.includes('references.html')) {
  let html = buildPage(path.join(SRC, 'pages', 'references.html'));
  const groups = [
    ['coniferous-forest', 'Evergreen Coniferous Forest page', 'coniferous-forest.html'],
    ['estuary', 'Estuarine Zone page', 'estuary.html'],
    ['compare', 'Comparison page', 'compare.html'],
    ['index', 'Home page', 'index.html'],
  ];
  const bib = groups
    .filter(([p]) => (pageSources[p] || []).length)
    .map(([p, label, href]) => `<section class="bib-group" id="bib-${p}">
<h3>${label} <a class="bib-group__link" href="${href}#sources">numbers match the page</a></h3>
<ol class="sources">
${pageSources[p].map((k, i) => `<li>${formatRef(refs[k])}</li>`).join('\n')}
</ol></section>`).join('\n');
  html = html.replace(/<!--\s*@bibliography\s*-->/, bib);
  const rows = [...usedImages].sort().map((k) => {
    const im = images[k];
    return `<tr><td>${im.caption.replace(/<[^>]+>/g, '')}</td><td>${esc(im.author)}</td><td><a href="${esc(im.license_url || im.source_url)}" rel="noopener">${esc(licenseLabel(im.license))}</a></td><td><a href="${esc(im.source_url)}" rel="noopener">${esc(im.host || 'Source')}</a></td></tr>`;
  }).join('\n');
  html = html.replace(/<!--\s*@credits\s*-->/, `<div class="table-wrap"><table class="credits-table"><caption>Photographs used on this site (${usedImages.size}), all used under free licenses (public domain, CC0, CC BY or CC BY-SA)</caption><thead><tr><th scope="col">Photo</th><th scope="col">Author / creator</th><th scope="col">License</th><th scope="col">Source</th></tr></thead><tbody>
${rows}
</tbody></table></div>`);
  built['references.html'] = html;
}

for (const [f, html] of Object.entries(built)) fs.writeFileSync(path.join(OUT, f), html);

const total = Object.values(pageSources).reduce((a, b) => a + b.length, 0);
console.log(`built ${Object.keys(built).length} pages, ${total} page-level sources, ${usedImages.size} photos`);
if (errors.length) {
  console.log(`\n${errors.length} issue(s):`);
  for (const e of [...new Set(errors)]) console.log('  - ' + e);
  if (process.argv.includes('--strict')) process.exit(1);
}
