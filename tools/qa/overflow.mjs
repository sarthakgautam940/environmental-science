// Report horizontal overflow (page wider than viewport) and elements sticking out, per page and width.
import { chromium } from 'playwright';
import fs from 'node:fs';
const pages = fs.readdirSync(new URL('../../site/', import.meta.url)).filter((f) => f.endsWith('.html'));
const b = await chromium.launch();
for (const w of [390, 834, 1440]) {
  for (const pg of pages) {
    const p = await b.newPage({ viewport: { width: w, height: 900 } });
    await p.goto(`http://localhost:8080/${pg}`, { waitUntil: 'networkidle' });
    const r = await p.evaluate((w) => {
      const out = [];
      document.querySelectorAll('body *').forEach((el) => {
        const rc = el.getBoundingClientRect();
        if (rc.width && rc.right > w + 1 && !el.closest('.table-wrap') && getComputedStyle(el).position !== 'fixed') out.push(el.tagName.toLowerCase() + '.' + (el.className.baseVal ?? el.className).toString().split(' ')[0] + ' ' + Math.round(rc.right));
      });
      return { sw: document.documentElement.scrollWidth, out: out.slice(0, 5) };
    }, w);
    console.log(w, pg, 'scrollWidth', r.sw, r.out.length ? r.out.join(' | ') : '');
    await p.close();
  }
}
await b.close();
