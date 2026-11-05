// Render one or more SVG fragments from src/figures with the site CSS, for visual checks.
// usage: node tools/qa/preview-svg.mjs out.png theme file1.svg [file2.svg ...]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const [out, theme, ...files] = process.argv.slice(2);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const css = fs.readFileSync(path.join(root, 'site/assets/css/main.css'), 'utf8').replace('@import url("../fonts/fonts-local.css");', fs.readFileSync(path.join(root, 'site/assets/fonts/fonts-local.css'), 'utf8').replaceAll("../fonts/", 'file://' + root + '/site/assets/fonts/'));
const body = files.map((f) => `<figure class="diagram"><div class="diagram__frame">${fs.readFileSync(path.resolve(f), 'utf8')}</div></figure>`).join('');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css} body{padding:20px}</style></head><body class="theme-${theme}"><div style="max-width:${process.env.W || 1000}px">${body}</div></body></html>`;
const tmp = path.join(path.dirname(path.resolve(out)), '_preview.html');
fs.writeFileSync(tmp, html);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: Number(process.env.W || 1000) + 40, height: 800 }, deviceScaleFactor: 1 });
await p.goto('file://' + tmp);
await p.waitForTimeout(300);
await p.screenshot({ path: out, fullPage: true });
await b.close();
