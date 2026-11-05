// Generates the site's maps as static, accessible SVG files in src/figures/gen/.
//
// Data (prepared with mapshaper into tools/.cache/geo/, see README "Rebuilding the maps"):
//  - RESOLVE Ecoregions 2017 (Dinerstein et al. 2017, BioScience; CC BY 4.0): biomes
//    "Boreal Forests/Taiga" (6) and "Temperate Conifer Forests" (5), dissolved and simplified.
//  - Natural Earth 1:50m land, lakes, rivers and 1:10m land/rivers for the regional insets (public domain).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoAzimuthalEqualArea, geoMercator, geoPath, geoGraticule } from 'd3-geo';
import { geoWinkel3 } from 'd3-geo-projection';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GEO = path.join(ROOT, 'tools', '.cache', 'geo');
const OUT = path.join(ROOT, 'src', 'figures', 'gen');
fs.mkdirSync(OUT, { recursive: true });
// mapshaper writes RFC 7946 GeoJSON (counter-clockwise exterior rings); d3-geo expects the
// spherical convention (clockwise exterior rings), so every polygon ring is reversed on load.
function rewind(geom) {
  if (!geom) return geom;
  if (geom.type === 'Polygon') geom.coordinates = geom.coordinates.map((r) => r.slice().reverse());
  else if (geom.type === 'MultiPolygon') geom.coordinates = geom.coordinates.map((poly) => poly.map((r) => r.slice().reverse()));
  return geom;
}
const load = (f) => {
  const fc = JSON.parse(fs.readFileSync(path.join(GEO, f), 'utf8'));
  for (const ft of fc.features || []) rewind(ft.geometry);
  return fc;
};

const land = load('land50.json');
const land110 = load('land110.json');
const biomesPolar = load('conifer-biomes-polar.json');
const lakes = load('lakes50.json');
const rivers = load('rivers50.json');
const biomes = load('conifer-biomes.json');
const boreal = { type: 'FeatureCollection', features: biomes.features.filter((f) => f.properties.BIOME_NAME.startsWith('Boreal')) };
const temperate = { type: 'FeatureCollection', features: biomes.features.filter((f) => f.properties.BIOME_NAME.startsWith('Temperate')) };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const r1 = (n) => Math.round(n * 10) / 10;

function lat(proj, latDeg, lon0 = -180, lon1 = 180) {
  const pts = [];
  for (let lo = lon0; lo <= lon1; lo += 2) pts.push(proj([lo, latDeg]));
  return 'M' + pts.map((p) => `${r1(p[0])},${r1(p[1])}`).join('L');
}

// ---------------------------------------------------------------- conifer world map
function coniferWorld() {
  const W = 1000;
  const proj = geoWinkel3().rotate([-10, 0]).fitWidth(W, { type: 'Sphere' });
  const p = geoPath(proj).digits(0);
  // crop: 84N to 58S
  const yTop = proj([0, 84])[1];
  const yBot = proj([0, -58])[1];
  const H = Math.round(yBot - yTop);
  const ty = -yTop;
  const label = (lon, la, text, opts = {}) => {
    const [x, y] = proj([lon, la]);
    const { dx = 0, dy = 0, anchor = 'middle', cls = 'm-lbl', leader = false } = opts;
    let s = '';
    if (leader) s += `<path class="m-leader" d="M${r1(x)},${r1(y)}L${r1(x + dx)},${r1(y + dy + (dy < 0 ? 4 : -10))}"/><circle class="m-pin" cx="${r1(x)}" cy="${r1(y)}" r="2.6"/>`;
    s += `<text class="${cls}" x="${r1(x + dx)}" y="${r1(y + dy)}" text-anchor="${anchor}">${esc(text)}</text>`;
    return s;
  };
  const latLines = [0, 30, 50, 60, 70].map((la) => {
    const [x, y] = proj([-169.9, la]);
    return `<path class="m-lat${la === 50 || la === 70 ? ' m-lat--key' : ''}" d="${lat(proj, la)}"/><text class="m-latlbl" x="${r1(x - 5)}" y="${r1(y + 4)}" text-anchor="end">${la === 0 ? '0°' : la + '°N'}</text>`;
  }).join('');
  const arctic = `<path class="m-arctic" d="${lat(proj, 66.56)}"/>`;
  const svg = `<svg viewBox="-28 ${r1(-ty)} ${W + 28} ${H}" role="img" aria-labelledby="map-conifer-t map-conifer-d" class="map dg">
<title id="map-conifer-t">World distribution of evergreen coniferous forests</title>
<desc id="map-conifer-d">Winkel Tripel world map. Boreal forest (taiga) forms a nearly continuous belt across Alaska, Canada, Scandinavia, Finland and Russia, mostly between about 50 and 70 degrees north. Temperate conifer forests occur farther south in mountains and along coasts: the Pacific Northwest, the Rocky Mountains, the Sierra Nevada, the Alps, the Himalaya, Japan and southeastern U.S. pinelands. No boreal forest exists in the Southern Hemisphere.</desc>
<path class="m-sphere" d="${p({ type: 'Sphere' })}"/>
<path class="m-grat" d="${p(geoGraticule().step([30, 30])())}"/>
<path class="m-land" d="${p(land)}"/>
<path class="m-temperate" d="${p(temperate)}"/>
<path class="m-boreal" d="${p(boreal)}"/>
<path class="m-lake" d="${p(lakes)}"/>
${latLines}${arctic}
${label(-150, 64, 'Alaska', { dx: -44, dy: -14, leader: true, anchor: 'end' })}
${label(-104, 57, 'Canada', { cls: 'm-lbl m-lbl--w' })}
${label(16, 64.5, 'Scandinavia', { dx: -70, dy: -26, leader: true })}
${label(55, 61, 'Russia', { cls: 'm-lbl m-lbl--w' })}
${label(108, 62.5, 'Siberia', { cls: 'm-lbl m-lbl--w' })}
${label(-123.5, 48, 'Pacific Northwest', { dx: -60, dy: 4, leader: true, anchor: 'end', cls: 'm-lbl m-lbl--sm' })}
${label(-119.5, 37.8, 'Sierra Nevada', { dx: -46, dy: 22, leader: true, anchor: 'end', cls: 'm-lbl m-lbl--sm' })}
${label(-107, 40, 'Rocky Mountains', { dx: 34, dy: -2, leader: true, anchor: 'start', cls: 'm-lbl m-lbl--sm' })}
${label(-94.5, 31.5, 'SE U.S. pinelands', { dx: 18, dy: 34, leader: true, anchor: 'start', cls: 'm-lbl m-lbl--sm' })}
${label(10, 46.5, 'Alps', { dx: -30, dy: 30, leader: true, anchor: 'end', cls: 'm-lbl m-lbl--sm' })}
${label(88, 28.5, 'Himalaya', { dx: 0, dy: 38, leader: true, cls: 'm-lbl m-lbl--sm' })}
${label(141, 40, 'Japan', { dx: 26, dy: 26, leader: true, anchor: 'start', cls: 'm-lbl m-lbl--sm' })}
${label(-60, -30, 'No boreal forest in the', { cls: 'm-note' })}
${label(-60, -36, 'Southern Hemisphere', { cls: 'm-note' })}
</svg>`;
  fs.writeFileSync(path.join(OUT, 'map-conifer.svg'), svg);
  return svg.length;
}

// ---------------------------------------------------------------- circumpolar view
function coniferPolar() {
  const S = 520;
  const proj = geoAzimuthalEqualArea().rotate([100, -90]).clipAngle(52).fitExtent([[10, 10], [S - 10, S - 10]], { type: 'Sphere' });
  // fitExtent on Sphere with clipAngle fits the clipped disc
  const p = geoPath(proj).digits(0);
  const ring = (la) => p({ type: 'LineString', coordinates: Array.from({ length: 181 }, (_, i) => [-180 + i * 2, la]) });
  const lblRing = (la, lon) => { const [x, y] = proj([lon, la]); return `<text class="m-latlbl" x="${r1(x)}" y="${r1(y)}" text-anchor="middle">${la}°N</text>`; };
  const lbl = (lon, la, t, cls = 'm-lbl m-lbl--sm') => { const [x, y] = proj([lon, la]); return `<text class="${cls}" x="${r1(x)}" y="${r1(y)}" text-anchor="middle">${esc(t)}</text>`; };
  const svg = `<svg viewBox="0 0 ${S} ${S}" role="img" aria-labelledby="map-polar-t map-polar-d" class="map dg">
<title id="map-polar-t">The circumboreal forest seen from above the North Pole</title>
<desc id="map-polar-d">A polar map centered on the North Pole showing the boreal forest as a ring circling the Arctic Ocean through North America, Scandinavia and Russia, mostly between the 50 and 70 degree north latitude lines.</desc>
<path class="m-sphere" d="${p({ type: 'Sphere' })}"/>
<path class="m-land" d="${p(land110)}"/>
<path class="m-temperate" d="${p({ type: 'FeatureCollection', features: biomesPolar.features.filter((f) => f.properties.BIOME_NAME.startsWith('Temperate')) })}"/>
<path class="m-boreal" d="${p({ type: 'FeatureCollection', features: biomesPolar.features.filter((f) => f.properties.BIOME_NAME.startsWith('Boreal')) })}"/>
<path class="m-lake" d="${p(lakes)}"/>
<path class="m-lat m-lat--key" d="${ring(50)}"/>
<path class="m-lat m-lat--key" d="${ring(70)}"/>
<path class="m-arctic" d="${ring(66.56)}"/>
${lblRing(50, 145)}${lblRing(70, 150)}
${lbl(-100, 82, 'Arctic Ocean', 'm-lbl m-lbl--sea')}
${lbl(-115, 60, 'North America', 'm-lbl m-lbl--w')}
${lbl(85, 59, 'Eurasia', 'm-lbl m-lbl--w')}
${lbl(-160, 52.5, 'Pacific', 'm-lbl m-lbl--sea')}
${lbl(-28, 57, 'Atlantic', 'm-lbl m-lbl--sea')}
</svg>`;
  fs.writeFileSync(path.join(OUT, 'map-polar.svg'), svg);
}

// ---------------------------------------------------------------- estuary world map
export const ESTUARIES = [
  // n, name, place, lon, lat, label dx, dy, anchor
  [1, 'Chesapeake Bay', 'United States', -76.1, 37.8, 16, 22, 'start'],
  [2, 'San Francisco Bay', 'United States', -122.4, 37.8, -14, 22, 'end'],
  [3, 'Amazon River estuary', 'Brazil', -49.8, -0.2, 14, 6, 'start'],
  [4, 'Thames Estuary', 'United Kingdom', 0.8, 51.5, -36, -26, 'end'],
  [5, 'St. Lawrence Estuary', 'Canada', -69.0, 48.6, 12, -16, 'start'],
  [6, 'Columbia River estuary', 'United States', -123.9, 46.25, -14, -8, 'end'],
  [7, 'Río de la Plata', 'Argentina & Uruguay', -57.0, -35.0, 14, 8, 'start'],
  [8, 'Gironde Estuary', 'France', -1.0, 45.5, -28, 20, 'end'],
  [9, 'Elbe Estuary & Wadden Sea', 'Germany', 8.9, 53.9, 20, -28, 'start'],
  [10, 'Congo River estuary', 'DR Congo & Angola', 12.3, -6.0, -14, 6, 'end'],
  [11, 'Knysna Estuary', 'South Africa', 23.06, -34.07, 10, 20, 'start'],
  [12, 'Sundarbans (Ganges–Brahmaputra)', 'Bangladesh & India', 89.5, 21.8, -8, 30, 'middle'],
  [13, 'Yangtze River estuary', 'China', 121.8, 31.3, 16, 4, 'start'],
  [14, 'Murray Mouth & Coorong', 'Australia', 138.9, -35.6, 14, 18, 'start'],
];

function estuaryWorld() {
  const W = 1000;
  const proj = geoWinkel3().rotate([-10, 0]).fitWidth(W, { type: 'Sphere' });
  const p = geoPath(proj).digits(0);
  const yTop = proj([0, 75])[1];
  const yBot = proj([0, -50])[1];
  const H = Math.round(yBot - yTop);
  const band = (a, b) => {
    const top = []; const bot = [];
    for (let lo = -180; lo <= 180; lo += 2) { top.push(proj([lo, b])); bot.push(proj([lo, a])); }
    return 'M' + top.map((q) => `${r1(q[0])},${r1(q[1])}`).join('L') + 'L' + bot.reverse().map((q) => `${r1(q[0])},${r1(q[1])}`).join('L') + 'Z';
  };
  const latLines = [-30, 0, 30, 60].map((la) => {
    const [x, y] = proj([-169.9, la]);
    const t = la === 0 ? '0°' : `${Math.abs(la)}°${la > 0 ? 'N' : 'S'}`;
    return `<path class="m-lat${Math.abs(la) === 30 ? ' m-lat--key' : ''}" d="${lat(proj, la)}"/><text class="m-latlbl" x="${r1(x - 5)}" y="${r1(y + 4)}" text-anchor="end">${t}</text>`;
  }).join('');
  const marks = ESTUARIES.map(([n, name, , lon, la, dx, dy, anchor]) => {
    const [x, y] = proj([lon, la]);
    return `<g class="m-est"><path class="m-leader" d="M${r1(x)},${r1(y)}L${r1(x + dx * 0.7)},${r1(y + dy * 0.7)}"/><circle class="m-est__dot" cx="${r1(x)}" cy="${r1(y)}" r="4"/><circle class="m-est__badge" cx="${r1(x + dx)}" cy="${r1(y + dy)}" r="9"/><text class="m-est__n" x="${r1(x + dx)}" y="${r1(y + dy + 4)}" text-anchor="middle">${n}</text><title>${esc(name)}</title></g>`;
  }).join('\n');
  const svg = `<svg viewBox="-28 ${r1(yTop)} ${W + 28} ${H}" role="img" aria-labelledby="map-est-t map-est-d" class="map dg">
<title id="map-est-t">Representative estuaries of the world</title>
<desc id="map-est-d">Winkel Tripel world map with fourteen numbered estuaries on six continents, from the Thames and Elbe in Europe at about 51 to 54 degrees north to the Río de la Plata and Murray Mouth at about 35 degrees south. Bold lines at 30 degrees north and south mark the approximate boundary between mostly mangrove-fringed estuaries in the tropics and subtropics and mostly salt-marsh-fringed estuaries at higher latitudes.</desc>
<path class="m-sphere m-sphere--sea" d="${p({ type: 'Sphere' })}"/>
<path class="m-land m-land--sand" d="${p(land)}"/>
<path class="m-lake m-lake--sea" d="${p(lakes)}"/>
<path class="m-river" d="${p(rivers)}"/>
${latLines}
<text class="m-note" x="${r1(proj([-128, 6])[0])}" y="${r1(proj([-128, 6])[1])}" text-anchor="middle">Tropics &amp; subtropics:</text>
<text class="m-note" x="${r1(proj([-128, 1])[0])}" y="${r1(proj([-128, 1])[1])}" text-anchor="middle">mangrove-fringed estuaries</text>
<text class="m-note" x="${r1(proj([-140, 48])[0])}" y="${r1(proj([-140, 48])[1])}" text-anchor="middle">Temperate &amp; subpolar:</text>
<text class="m-note" x="${r1(proj([-140, 43])[0])}" y="${r1(proj([-140, 43])[1])}" text-anchor="middle">salt-marsh-fringed estuaries</text>
${marks}
</svg>`;
  fs.writeFileSync(path.join(OUT, 'map-estuaries.svg'), svg);
}

// ---------------------------------------------------------------- regional insets
function inset(file, landF, riversF, bbox, size, labels, title, desc) {
  const L = load(landF);
  const R = load(riversF);
  const [x0, y0, x1, y1] = bbox;
  const frame = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[x0, y0], [x0, y1], [x1, y1], [x1, y0], [x0, y0]]] } };
  const proj = geoMercator().fitSize(size, frame);
  const p = geoPath(proj).digits(0);
  const t = labels.map(([lon, la, text, cls = 'm-lbl m-lbl--sm', anchor = 'middle', rot = 0]) => {
    const [x, y] = proj([lon, la]);
    const tr = rot ? ` transform="rotate(${rot} ${r1(x)} ${r1(y)})"` : '';
    return text.split('\n').map((line, i) => `<text class="${cls}" x="${r1(x)}" y="${r1(y + i * 14)}" text-anchor="${anchor}"${tr}>${esc(line)}</text>`).join('');
  }).join('\n');
  const svg = `<svg viewBox="0 0 ${size[0]} ${size[1]}" role="img" aria-labelledby="${file}-t ${file}-d" class="map map--inset dg">
<title id="${file}-t">${esc(title)}</title>
<desc id="${file}-d">${esc(desc)}</desc>
<rect class="m-sea" x="0" y="0" width="${size[0]}" height="${size[1]}"/>
<path class="m-land m-land--sand" d="${p(L)}"/>
<path class="m-river m-river--inset" d="${p(R)}"/>
${t}
</svg>`;
  fs.writeFileSync(path.join(OUT, `${file}.svg`), svg);
}

coniferWorld();
coniferPolar();
estuaryWorld();
inset('map-chesapeake', 'ches-land.json', 'ches-rivers.json', [-77.6, 36.75, -75.3, 39.75], [420, 540], [
  [-76.05, 39.62, 'Susquehanna R.', 'm-lbl m-lbl--sm m-lbl--river', 'start'],
  [-77.25, 38.6, 'Potomac R.', 'm-lbl m-lbl--sm m-lbl--river', 'middle'],
  [-77.05, 37.28, 'James R.', 'm-lbl m-lbl--sm m-lbl--river', 'middle'],
  [-76.33, 39.22, 'Upper Bay', 'm-lbl m-lbl--zone', 'end'],
  [-76.22, 38.42, 'Middle Bay', 'm-lbl m-lbl--zone', 'end'],
  [-76.12, 37.42, 'Lower Bay', 'm-lbl m-lbl--zone', 'middle'],
  [-75.62, 37.2, 'Atlantic\nOcean', 'm-lbl m-lbl--sea', 'middle'],
  [-75.95, 36.92, 'Bay mouth', 'm-lbl m-lbl--sm', 'start'],
], 'Chesapeake Bay', 'Map of Chesapeake Bay, a drowned river valley about 300 kilometers long. The Susquehanna River enters at the northern head of the bay; the Potomac and James Rivers join from the west; the bay meets the Atlantic Ocean at its southern mouth. Labels mark the upper, middle and lower bay.');
inset('map-sfbay', 'sf-land.json', 'sf-rivers.json', [-122.65, 37.4, -121.75, 38.2], [460, 420], [
  [-122.62, 37.62, 'Pacific\nOcean', 'm-lbl m-lbl--sea', 'middle'],
  [-122.5, 37.795, 'Golden Gate', 'm-lbl m-lbl--sm', 'end'],
  [-122.38, 38.05, 'San Pablo Bay', 'm-lbl m-lbl--zone', 'middle'],
  [-122.06, 38.11, 'Suisun Bay', 'm-lbl m-lbl--zone', 'middle'],
  [-121.82, 38.17, 'Delta', 'm-lbl m-lbl--sm m-lbl--river', 'end'],
  [-122.42, 37.86, 'Central Bay', 'm-lbl m-lbl--zone', 'start'],
  [-122.14, 37.6, 'South Bay', 'm-lbl m-lbl--zone', 'middle'],
], 'San Francisco Bay', 'Map of San Francisco Bay. Fresh water from the Sacramento and San Joaquin Rivers flows through the Delta, Suisun Bay and San Pablo Bay to the Central Bay and out through the Golden Gate to the Pacific Ocean. The South Bay extends southeast and receives little river inflow.');

console.log('maps written to', OUT);
