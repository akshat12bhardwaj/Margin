// Writes every diagram as SVG (editable source) and PNG (for the Word documents).
// Usage from the repository root: node docs/02-Software-Design/diagrams/src/render.mjs [name ...]
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import * as structure from './structure.mjs';
import * as behaviour from './behaviour.mjs';
import * as dfd from './dfd.mjs';
import { pertChart } from './pert.mjs';

const out = path.resolve(import.meta.dirname, '..');
const all = {
  'use-case': structure.useCase,
  class: structure.classDiagram,
  'seq-login': behaviour.login,
  'seq-google': behaviour.google,
  'seq-create-listing': behaviour.createListing,
  'seq-buy-now': behaviour.buyNow,
  'seq-negotiation': behaviour.negotiation,
  'seq-report-moderation': behaviour.reportModeration,
  'dfd-context': dfd.context,
  'dfd-level0': dfd.level0,
  'dfd-level1-trade': dfd.level1Trade,
  'dfd-level1-moderation': dfd.level1Moderation,
  architecture: structure.architecture,
  states: structure.states,
  'pert-chart': pertChart,
};
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(all);
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
for (const name of names) {
  const svg = all[name]().toSVG();
  await fs.writeFile(path.join(out, `${name}.svg`), svg);
  await page.setContent(`<!doctype html><body style="margin:0">${svg}</body>`);
  await page.locator('svg').first().screenshot({ path: path.join(out, `${name}.png`) });
  console.log('rendered', name);
}
await browser.close();
