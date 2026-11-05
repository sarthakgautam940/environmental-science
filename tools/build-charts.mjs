// Builds the data charts (inline SVG) from the real datasets in site/assets/data/.
//   node tools/build-charts.mjs
// Output: src/figures/gen/climatogram-fairbanks.svg, climatogram-quillayute.svg, flow-susquehanna.svg
// and matching HTML data tables (src/figures/gen/*-table.html).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'site', 'assets', 'data');
const OUT = path.join(ROOT, 'src', 'figures', 'gen');
fs.mkdirSync(OUT, { recursive: true });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const r1 = (n) => Math.round(n * 10) / 10;
const fmt = (n, d = 1) => (n < 0 ? '−' : '') + Math.abs(n).toFixed(d);
const c2f = (c) => c * 9 / 5 + 32;

function climatogram(key, opts) {
  const d = JSON.parse(fs.readFileSync(path.join(DATA, `${key}-1991-2020.json`), 'utf8'));
  const m = d.months;
  const W = 720, H = opts.snow ? 430 : 400;
  const L = 64, R = 70, T = 34, B = opts.snow ? 92 : 62;
  const pw = W - L - R, ph = H - T - B;
  const [tMin, tMax] = [-30, 30];
  const pMax = opts.pMax;
  const yT = (t) => T + (tMax - t) / (tMax - tMin) * ph;
  const yP = (p) => T + ph - p / pMax * ph;
  const bw = pw / 12;
  const xC = (i) => L + bw * i + bw / 2;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${key}-t ${key}-d" class="dg climatogram">`;
  s += `<title id="${key}-t">${opts.title}</title><desc id="${key}-d">${opts.desc}</desc>`;
  // growing season band
  if (opts.season) {
    const [a, b] = opts.season; // fractional month positions (0 = start of Jan)
    s += `<rect class="season" x="${r1(L + a * bw)}" y="${T}" width="${r1((b - a) * bw)}" height="${ph}"/>`;
    s += `<text class="lbl-sm lbl-a" x="${r1(L + (a + b) / 2 * bw)}" y="${T - 8}" text-anchor="middle">${opts.seasonLabel}</text>`;
  }
  // grid + temperature axis (left)
  s += '<g class="grid">';
  for (let t = tMin; t <= tMax; t += 10) s += `<line x1="${L}" x2="${L + pw}" y1="${r1(yT(t))}" y2="${r1(yT(t))}"/>`;
  s += '</g>';
  s += `<line class="zero" x1="${L}" x2="${L + pw}" y1="${r1(yT(0))}" y2="${r1(yT(0))}"/>`;
  s += '<g class="axis">';
  for (let t = tMin; t <= tMax; t += 10) {
    s += `<text x="${L - 8}" y="${r1(yT(t) + 4)}" text-anchor="end">${fmt(t, 0)}°C</text>`;
    s += `<text x="${L - 8}" y="${r1(yT(t) + 16)}" text-anchor="end" class="lbl-sm" style="font-size:10px">${fmt(c2f(t), 0)}°F</text>`;
  }
  for (let p = 0; p <= pMax; p += opts.pStep) {
    s += `<text x="${L + pw + 8}" y="${r1(yP(p) + 4)}">${p} mm</text>`;
    s += `<text x="${L + pw + 8}" y="${r1(yP(p) + 16)}" class="lbl-sm" style="font-size:10px">${p ? (p / 25.4).toFixed(p / 25.4 < 10 ? 1 : 0) + ' in' : ''}</text>`;
  }
  s += `<line x1="${L}" x2="${L}" y1="${T}" y2="${T + ph}"/><line x1="${L + pw}" x2="${L + pw}" y1="${T}" y2="${T + ph}"/><line x1="${L}" x2="${L + pw}" y1="${T + ph}" y2="${T + ph}"/>`;
  m.forEach((mm, i) => { s += `<text x="${r1(xC(i))}" y="${T + ph + 18}" text-anchor="middle">${MONTHS[i]}</text>`; });
  s += '</g>';
  s += `<text class="lbl-sm lbl-mute" transform="rotate(-90)" x="${-(T + ph / 2)}" y="14" text-anchor="middle">Temperature</text>`;
  s += `<text class="lbl-sm lbl-mute" transform="rotate(90)" x="${T + ph / 2}" y="${-(W - 10)}" text-anchor="middle">Precipitation</text>`;
  // bars
  m.forEach((mm, i) => {
    const h = yP(0) - yP(mm.prcp_mm);
    s += `<rect class="bar" x="${r1(xC(i) - bw * 0.32)}" y="${r1(yP(mm.prcp_mm))}" width="${r1(bw * 0.64)}" height="${r1(h)}"/>`;
  });
  // max-min band
  const top = m.map((mm, i) => `${r1(xC(i))},${r1(yT(mm.tmax_c))}`);
  const bot = m.map((mm, i) => `${r1(xC(i))},${r1(yT(mm.tmin_c))}`).reverse();
  s += `<path class="band" d="M${top.join('L')}L${bot.join('L')}Z"/>`;
  s += `<path class="line" d="M${m.map((mm, i) => `${r1(xC(i))},${r1(yT(mm.tavg_c))}`).join('L')}"/>`;
  m.forEach((mm, i) => { s += `<circle class="dot" cx="${r1(xC(i))}" cy="${r1(yT(mm.tavg_c))}" r="3.5"/>`; });
  // annotations
  for (const a of opts.notes || []) s += `<text class="lbl-sm${a.cls ? ' ' + a.cls : ''}" x="${a.x}" y="${a.y}" text-anchor="${a.anchor || 'start'}">${a.text}</text>`;
  // snowfall row
  if (opts.snow) {
    const y0 = T + ph + 40;
    s += `<text class="lbl-sm lbl-b" x="${L - 8}" y="${y0 + 4}" text-anchor="end">Snowfall</text>`;
    s += `<text class="lbl-sm lbl-mute" x="${L - 8}" y="${y0 + 17}" text-anchor="end" style="font-size:10px">cm (in)</text>`;
    m.forEach((mm, i) => {
      const v = mm.snow_cm;
      s += `<text class="lbl-sm" x="${r1(xC(i))}" y="${y0 + 4}" text-anchor="middle">${v > 0 ? Math.round(v) : '–'}</text>`;
      s += `<text class="lbl-sm lbl-mute" x="${r1(xC(i))}" y="${y0 + 17}" text-anchor="middle" style="font-size:10px">${v > 0 ? '(' + mm.snow_in.toFixed(1) + ')' : ''}</text>`;
    });
    s += `<line class="ln-thin" x1="${L}" x2="${L + pw}" y1="${y0 + 26}" y2="${y0 + 26}"/>`;
  }
  // hit areas for tooltips
  m.forEach((mm, i) => {
    const tip = `<b>${MONTHS_LONG[i]}</b><br>Mean ${fmt(mm.tavg_c)} °C (${fmt(mm.tavg_f)} °F)<br>Avg high ${fmt(mm.tmax_c)} °C, low ${fmt(mm.tmin_c)} °C<br>Precipitation ${mm.prcp_mm} mm (${mm.prcp_in.toFixed(2)} in)${mm.snow_cm != null ? `<br>Snowfall ${mm.snow_cm} cm (${mm.snow_in} in)` : ''}`;
    s += `<rect class="hit" role="img" x="${r1(L + bw * i)}" y="${T}" width="${r1(bw)}" height="${ph}" tabindex="0" data-tip="${tip.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}" aria-label="${MONTHS_LONG[i]}: mean ${fmt(mm.tavg_c)} degrees C, precipitation ${mm.prcp_mm} millimeters"/>`;
  });
  s += '</svg>';
  fs.writeFileSync(path.join(OUT, `climatogram-${key}.svg`), s);

  // data table
  const rows = [
    ['Mean temperature (°C)', m.map((x) => fmt(x.tavg_c))],
    ['Mean temperature (°F)', m.map((x) => fmt(x.tavg_f))],
    ['Average daily high (°C)', m.map((x) => fmt(x.tmax_c))],
    ['Average daily low (°C)', m.map((x) => fmt(x.tmin_c))],
    ['Precipitation (mm)', m.map((x) => x.prcp_mm.toFixed(1))],
    ['Precipitation (in)', m.map((x) => x.prcp_in.toFixed(2))],
  ];
  if (opts.snow) rows.push(['Snowfall (cm)', m.map((x) => x.snow_cm.toFixed(1))]);
  const a = d.annual_raw_standard_units;
  const annPrcpIn = parseFloat(a['ANN-PRCP-NORMAL']);
  const annT = (parseFloat(a['ANN-TAVG-NORMAL']) - 32) * 5 / 9;
  const tbl = `<div class="table-wrap"><table class="data-tbl"><caption>${opts.tableCaption}<small>NOAA NCEI U.S. Climate Normals 1991–2020, station ${d.station.id}. Annual: mean ${fmt(annT)} °C (${a['ANN-TAVG-NORMAL']} °F); precipitation ${Math.round(annPrcpIn * 25.4)} mm (${annPrcpIn} in)${a['ANN-SNOW-NORMAL'] ? `; snowfall ${Math.round(parseFloat(a['ANN-SNOW-NORMAL']) * 2.54)} cm (${a['ANN-SNOW-NORMAL']} in)` : ''}; median freeze-free season ${parseFloat(a['ANN-TMIN-PRBGSL-T32FP50'])} days (last spring freeze ${a['ANN-TMIN-PRBLST-T32FP50']}, first fall freeze ${a['ANN-TMIN-PRBFST-T32FP50']}).</small></caption>
<thead><tr><th scope="col">Normal</th>${MONTHS.map((x) => `<th scope="col" class="num">${x}</th>`).join('')}</tr></thead>
<tbody>${rows.map(([lab, vals]) => `<tr><th scope="row">${lab}</th>${vals.map((v) => `<td class="num">${v.replace('-', '−')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  fs.writeFileSync(path.join(OUT, `climatogram-${key}-table.html`), tbl);
  return d;
}

// month index helper for day-of-year based season band
const doyFrac = (mmdd) => {
  const [mo, dd] = mmdd.trim().split('/').map(Number);
  const dim = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return mo - 1 + (dd - 0.5) / dim[mo - 1];
};

const fai = JSON.parse(fs.readFileSync(path.join(DATA, 'fairbanks-1991-2020.json'), 'utf8')).annual_raw_standard_units;
climatogram('fairbanks', {
  title: 'Climatogram of Fairbanks, Alaska (boreal forest), 1991–2020 normals',
  desc: 'Monthly mean temperature line with a shaded band from average daily low to high, and monthly precipitation bars. Mean temperature is below freezing from October through March, bottoming at about minus 22 degrees C in January, and peaks at about 17 degrees C in July. Precipitation is low all year, 8 to 57 millimeters per month, with a summer maximum in July and August. A shaded band marks the median freeze-free season from mid-May to mid-September.',
  pMax: 80, pStep: 20, snow: true,
  season: [doyFrac(fai['ANN-TMIN-PRBLST-T32FP50']), doyFrac(fai['ANN-TMIN-PRBFST-T32FP50'])],
  seasonLabel: `Median freeze-free season: ${parseFloat(fai['ANN-TMIN-PRBGSL-T32FP50'])} days`,
  notes: [
    { x: 76, y: 52, text: 'Winter: 6 months below 0 °C', cls: 'lbl-b' },
  ],
  tableCaption: 'Monthly climate normals: Fairbanks International Airport, Alaska',
});
const qui = JSON.parse(fs.readFileSync(path.join(DATA, 'quillayute-1991-2020.json'), 'utf8')).annual_raw_standard_units;
climatogram('quillayute', {
  title: 'Climatogram of Quillayute, Washington (temperate coniferous rainforest), 1991–2020 normals',
  desc: 'Mean temperature stays above freezing all year, from about 5 degrees C in December and January to about 16 degrees C in August. Precipitation is very high, peaking near 390 to 400 millimeters per month in November and January and falling to about 40 millimeters in July.',
  pMax: 400, pStep: 100, snow: false,
  season: [doyFrac(qui['ANN-TMIN-PRBLST-T32FP50']), doyFrac(qui['ANN-TMIN-PRBFST-T32FP50'])],
  seasonLabel: `Median freeze-free season: ${parseFloat(qui['ANN-TMIN-PRBGSL-T32FP50'])} days`,
  notes: [],
  tableCaption: 'Monthly climate normals: Quillayute Airport, Olympic Peninsula, Washington',
});

// ---------- Susquehanna discharge ----------
{
  const d = JSON.parse(fs.readFileSync(path.join(DATA, 'susquehanna-flow.json'), 'utf8'));
  const m = d.months;
  const W = 720, H = 360, L = 70, R = 24, T = 36, B = 48;
  const pw = W - L - R, ph = H - T - B;
  const vMax = 80000;
  const y = (v) => T + ph - v / vMax * ph;
  const bw = pw / 12;
  const xC = (i) => L + bw * i + bw / 2;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="flow-t flow-d" class="dg flowchart">`;
  s += `<title id="flow-t">Average monthly flow of the Susquehanna River into Chesapeake Bay</title>`;
  s += `<desc id="flow-d">Bar chart of mean monthly discharge at Conowingo, Maryland, ${d.years[0]} to ${d.years[1]}. Flow is highest in March and April, about 72,000 to 74,000 cubic feet per second, and lowest in August, about 17,000 cubic feet per second, roughly a fourfold seasonal swing.</desc>`;
  s += '<g class="grid">';
  for (let v = 0; v <= vMax; v += 20000) s += `<line x1="${L}" x2="${L + pw}" y1="${r1(y(v))}" y2="${r1(y(v))}"/>`;
  s += '</g><g class="axis">';
  for (let v = 0; v <= vMax; v += 20000) {
    s += `<text x="${L - 8}" y="${r1(y(v) + 4)}" text-anchor="end">${v ? (v / 1000).toFixed(0) + 'k cfs' : '0'}</text>`;
    s += `<text x="${L - 8}" y="${r1(y(v) + 16)}" text-anchor="end" style="font-size:10px">${v ? Math.round(v * 0.0283168).toLocaleString('en-US') + ' m³/s' : ''}</text>`;
  }
  m.forEach((mm, i) => { s += `<text x="${r1(xC(i))}" y="${T + ph + 18}" text-anchor="middle">${MONTHS[i]}</text>`; });
  s += `<line x1="${L}" x2="${L + pw}" y1="${T + ph}" y2="${T + ph}"/></g>`;
  m.forEach((mm, i) => {
    const hi = mm.month === 3 || mm.month === 4;
    const lo = mm.month === 8;
    s += `<rect class="bar${hi ? ' bar--hi' : ''}${lo ? ' bar--lo' : ''}" x="${r1(xC(i) - bw * 0.34)}" y="${r1(y(mm.mean_cfs))}" width="${r1(bw * 0.68)}" height="${r1(y(0) - y(mm.mean_cfs))}"/>`;
    const tip = `<b>${MONTHS_LONG[i]}</b><br>${mm.mean_cfs.toLocaleString('en-US')} cubic feet per second<br>${Math.round(mm.mean_m3s).toLocaleString('en-US')} m³/s (mean of ${mm.n} years)`;
    s += `<rect class="hit" role="img" x="${r1(L + bw * i)}" y="${T}" width="${r1(bw)}" height="${ph}" tabindex="0" data-tip="${tip.replace(/</g, '&lt;').replace(/>/g, '&gt;')}" aria-label="${MONTHS_LONG[i]}: ${mm.mean_cfs} cubic feet per second"/>`;
  });
  const apr = m[3], aug = m[7];
  s += `<text class="lbl-sm lbl-b" x="${r1(xC(2.5))}" y="${r1(y(apr.mean_cfs) - 12)}" text-anchor="middle">Spring freshet: snowmelt + rain</text>`;
  s += `<text class="lbl-sm lbl-b" x="${r1(xC(7))}" y="${r1(y(34000))}" text-anchor="middle">Late-summer low flow</text>`;
  s += `<text class="lbl-sm" x="${r1(xC(7))}" y="${r1(y(34000) + 14)}" text-anchor="middle">→ salt water moves up-bay</text>`;
  s += '</svg>';
  fs.writeFileSync(path.join(OUT, 'flow-susquehanna.svg'), s);
}
console.log('charts written');
