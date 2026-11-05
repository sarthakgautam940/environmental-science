// Screenshot sections of a page: node tools/qa/screens.mjs <page> <width> <outdir> <selector...>
import { chromium } from 'playwright';
const [page, width, outdir, ...sels] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: Number(width), height: 900 }, deviceScaleFactor: 1 });
await p.goto(`http://localhost:8080/${page}`, { waitUntil: 'networkidle' });
for (const s of sels) {
  const el = await p.$(s);
  if (!el) { console.log('missing', s); continue; }
  await el.scrollIntoViewIfNeeded();
  await p.waitForTimeout(250);
  const name = `${outdir}/${page.replace('.html', '')}-${width}-${s.replace(/[^a-z0-9]/gi, '_')}.png`;
  await el.screenshot({ path: name, timeout: 20000 }).catch(async () => { await p.screenshot({ path: name }); });
  console.log(name);
}
const sw = await p.evaluate(() => document.documentElement.scrollWidth);
console.log('scrollWidth', sw, 'height', await p.evaluate(() => document.documentElement.scrollHeight));
await b.close();
