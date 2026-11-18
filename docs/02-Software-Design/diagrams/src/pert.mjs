// Activity-on-node PERT chart drawn from the computed schedule, so the figure always matches the CPM table.
import { schedule } from '../../../05-Project-Management/pert-cpm.mjs';
import { C, Diagram, text } from './lib.mjs';

export function pertChart() {
  const d = new Diagram(1620, 720, 'Figure 5.1  PERT chart (activity on node) with the critical path');
  // Column and row of each activity, following the dependency structure.
  const at = { A: [0, 1], B: [1, 1], C: [2, 1], D: [3, 1], E: [4, 1], F: [4, 2], G: [4, 0], H: [5, 1], I: [6, 1], J: [7, 1], K: [8, 1] };
  const W = 150;
  const H = 108;
  const x = (c) => 30 + c * 176;
  const y = (r) => 70 + r * 160;
  for (const n of schedule.nodes.values()) {
    const [c, r] = at[n.id];
    const crit = n.slack === 0;
    const X = x(c);
    const Y = y(r);
    const stroke = crit ? '#a33a1f' : C.line;
    const f = (v) => v.toFixed(2);
    d.raw(`<rect x="${X}" y="${Y}" width="${W}" height="${H}" rx="4" fill="${crit ? '#fbeee8' : C.fill}" stroke="${stroke}" stroke-width="${crit ? 2.4 : 1.4}"/>`);
    d.raw(`<line x1="${X}" y1="${Y + 28}" x2="${X + W}" y2="${Y + 28}" stroke="${stroke}"/><line x1="${X}" y1="${Y + 80}" x2="${X + W}" y2="${Y + 80}" stroke="${stroke}"/><line x1="${X + W / 2}" y1="${Y}" x2="${X + W / 2}" y2="${Y + 28}" stroke="${stroke}"/><line x1="${X + W / 2}" y1="${Y + 80}" x2="${X + W / 2}" y2="${Y + H}" stroke="${stroke}"/>`);
    d.raw(text(X + W / 4, Y + 14, `ES ${f(n.es)}`, { size: 11 }) + text(X + (3 * W) / 4, Y + 14, `EF ${f(n.ef)}`, { size: 11 }));
    d.raw(text(X + W / 2, Y + 54, `${n.id}  (${f(n.d)} d)\nslack ${f(n.slack)}`, { size: 12, weight: 'bold' }));
    d.raw(text(X + W / 4, Y + 94, `LS ${f(n.ls)}`, { size: 11 }) + text(X + (3 * W) / 4, Y + 94, `LF ${f(n.lf)}`, { size: 11 }));
    d.shapes.set(n.id, { kind: 'rect', cx: X + W / 2, cy: Y + H / 2, w: W, h: H });
  }
  for (const n of schedule.nodes.values()) {
    for (const p of n.pred) {
      const crit = n.slack === 0 && schedule.nodes.get(p).slack === 0;
      // Skip-level dependencies go around the box in between instead of through it.
      const around = {
        'E>I': { start: [x(4) + W / 2, y(1) + H], via: [[x(4) + W / 2, y(1) + H + 22], [x(6) + W / 2 - 20, y(1) + H + 22]], end: [x(6) + W / 2 - 20, y(1) + H] },
        'I>K': { start: [x(6) + W / 2, y(1)], via: [[x(6) + W / 2, y(1) - 22], [x(8) + W / 2, y(1) - 22]], end: [x(8) + W / 2, y(1)] },
      }[`${p}>${n.id}`];
      d.edge(p, n.id, { width: crit ? 1.9 : 1.2, ...around });
    }
  }
  const names = [...schedule.nodes.values()].map((n) => `${n.id} ${n.name}`);
  d.raw(text(30, 615, names.slice(0, 6).join('\n'), { size: 11.5, anchor: 'start', lh: 1.35 }));
  d.raw(text(820, 615, names.slice(6).join('\n'), { size: 11.5, anchor: 'start', lh: 1.35 }));
  d.raw(text(810, 705, `Critical path (red): ${schedule.critical.map((n) => n.id).join(' → ')}, ${schedule.projectEnd.toFixed(2)} working days. Durations are PERT estimates, not recorded effort.`, { size: 11.5, fill: C.muted, italic: true }));
  return d;
}
