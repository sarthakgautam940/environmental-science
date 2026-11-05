// Full-page screenshot: node tools/qa/fullpage.mjs <page> <width> <out.png> [maxHeight]
import { chromium } from 'playwright';
const [page, width, out, maxH] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: Number(width), height: 900 }, deviceScaleFactor: 1 });
await p.goto(`http://localhost:8080/${page}`, { waitUntil: 'networkidle' });
await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } window.scrollTo(0, 0); });
await p.waitForTimeout(400);
const h = await p.evaluate(() => document.documentElement.scrollHeight);
await p.screenshot({ path: out, clip: { x: 0, y: 0, width: Number(width), height: Math.min(h, Number(maxH || h)) } , fullPage: true});
console.log(out, 'height', h, 'scrollWidth', await p.evaluate(() => document.documentElement.scrollWidth));
await b.close();
