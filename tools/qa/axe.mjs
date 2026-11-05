// Accessibility scan of every built page with axe-core (WCAG 2.1 A/AA rules).
//   node tools/qa/axe.mjs   (needs the local server on :8080 and `npm i --no-save axe-core`)
import { chromium } from 'playwright';
import fs from 'node:fs';
const axe = fs.readFileSync(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const pages = fs.readdirSync(new URL('../../site/', import.meta.url)).filter((f) => f.endsWith('.html'));
const b = await chromium.launch();
let total = 0;
for (const pg of pages) {
  for (const width of [1440, 390]) {
    const p = await b.newPage({ viewport: { width, height: 900 } });
    await p.goto(`http://localhost:8080/${pg}`, { waitUntil: 'networkidle' });
    await p.addScriptTag({ content: axe });
    const res = await p.evaluate(async () => await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }));
    for (const v of res.violations) {
      total++;
      console.log(`${pg} @${width} [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length})`);
      for (const n of v.nodes.slice(0, 4)) console.log('    ', n.target.join(' '), (n.failureSummary || '').split('\n')[1] || '');
    }
    await p.close();
  }
}
console.log(`axe: ${total} violation group(s)`);
await b.close();
