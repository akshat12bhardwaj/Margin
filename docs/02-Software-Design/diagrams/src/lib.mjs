// Minimal SVG diagram primitives for the design document: shapes, clipped edges, UML markers and an
// automatic sequence-diagram layout. Diagrams are plain data in diagrams.mjs; render.mjs writes SVG and PNG.
export const FONT = 'Arial, Helvetica, sans-serif';
export const C = { ink: '#1c2b20', line: '#2f4436', fill: '#fbfaf5', ext: '#e6ecdf', store: '#f4efe2', proc: '#fdfcf7', muted: '#5b6b5f', frag: '#7a5a3a', note: '#fff8dc' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const textWidth = (s, size = 13) => Math.max(...String(s).split('\n').map((l) => l.length)) * size * 0.56;

export function text(x, y, label, { size = 13, anchor = 'middle', weight = 'normal', italic = false, fill = C.ink, lh = 1.25, underline = false } = {}) {
  const lines = String(label).split('\n');
  const first = -((lines.length - 1) * size * lh) / 2;
  const attrs = `font-family="${FONT}" font-size="${size}" text-anchor="${anchor}" font-weight="${weight}"${italic ? ' font-style="italic"' : ''}${underline ? ' text-decoration="underline"' : ''} fill="${fill}" dominant-baseline="central"`;
  return `<text x="${x}" y="${y}" ${attrs}>${lines.map((l, i) => `<tspan x="${x}" dy="${i === 0 ? first : size * lh}">${esc(l)}</tspan>`).join('')}</text>`;
}

const DEFS = `<defs>
  <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.line}"/></marker>
  <marker id="open" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="10" markerHeight="10" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10" fill="none" stroke="${C.line}" stroke-width="1.4"/></marker>
  <marker id="triangle" viewBox="0 0 12 12" refX="12" refY="6" markerWidth="14" markerHeight="14" orient="auto-start-reverse"><path d="M0,0 L12,6 L0,12 z" fill="#ffffff" stroke="${C.line}" stroke-width="1.2"/></marker>
  <marker id="diamond" viewBox="0 0 16 10" refX="0" refY="5" markerWidth="16" markerHeight="10" orient="auto-start-reverse"><path d="M0,5 L8,0 L16,5 L8,10 z" fill="${C.line}"/></marker>
</defs>`;

// A diagram collects shapes by id so edges can attach to them.
export class Diagram {
  constructor(width, height, title) {
    Object.assign(this, { width, height, title, shapes: new Map(), parts: [], top: [] });
    if (title) this.parts.push(text(width / 2, 22, title, { size: 15, weight: 'bold' }));
  }
  add(id, shape) {
    if (id) this.shapes.set(id, shape);
    this.parts.push(shape.svg);
    return shape;
  }
  raw(svg) { this.parts.push(svg); }
  // Labels go last so lines never run over them.
  label(svg) { this.top.push(svg); }
  toSVG() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}">${DEFS}<rect width="100%" height="100%" fill="#ffffff"/>${this.parts.join('\n')}${this.top.join('\n')}</svg>`;
  }

  rect(id, x, y, w, h, label, { fill = C.fill, stroke = C.line, sw = 1.4, r = 4, size = 13, weight = 'normal', dash = false } = {}) {
    const svg = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ' stroke-dasharray="6 4"' : ''}/>${label ? text(x + w / 2, y + h / 2, label, { size, weight }) : ''}`;
    return this.add(id, { svg, kind: 'rect', cx: x + w / 2, cy: y + h / 2, w, h });
  }
  ellipse(id, cx, cy, rx, ry, label, { fill = C.fill, size = 13 } = {}) {
    const svg = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${C.line}" stroke-width="1.4"/>${text(cx, cy, label, { size })}`;
    return this.add(id, { svg, kind: 'ellipse', cx, cy, rx, ry });
  }
  actor(id, cx, cy, label, { size = 13 } = {}) {
    const s = `stroke="${C.line}" stroke-width="1.6" fill="none"`;
    const svg = `<circle cx="${cx}" cy="${cy - 26}" r="9" ${s} fill="#ffffff"/><line x1="${cx}" y1="${cy - 17}" x2="${cx}" y2="${cy + 8}" ${s}/><line x1="${cx - 15}" y1="${cy - 8}" x2="${cx + 15}" y2="${cy - 8}" ${s}/><line x1="${cx}" y1="${cy + 8}" x2="${cx - 12}" y2="${cy + 26}" ${s}/><line x1="${cx}" y1="${cy + 8}" x2="${cx + 12}" y2="${cy + 26}" ${s}/>${text(cx, cy + 44, label, { size })}`;
    return this.add(id, { svg, kind: 'rect', cx, cy, w: 44, h: 72 });
  }
  // DFD process (Yourdon/DeMarco bubble) with its number above the name.
  process(id, cx, cy, r, num, label) {
    const svg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.proc}" stroke="${C.line}" stroke-width="1.6"/>${text(cx, cy - r * 0.55, num, { size: 12, weight: 'bold' })}<line x1="${cx - r * 0.75}" y1="${cy - r * 0.32}" x2="${cx + r * 0.75}" y2="${cy - r * 0.32}" stroke="${C.line}" stroke-width="0.8"/>${text(cx, cy + r * 0.18, label, { size: 12 })}`;
    return this.add(id, { svg, kind: 'ellipse', cx, cy, rx: r, ry: r });
  }
  // DFD data store: open-ended rectangle with an ID compartment.
  store(id, x, y, w, h, sid, label) {
    const l = `stroke="${C.line}" stroke-width="1.5"`;
    const svg = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${C.store}" stroke="none"/><line x1="${x}" y1="${y}" x2="${x + w}" y2="${y}" ${l}/><line x1="${x}" y1="${y + h}" x2="${x + w}" y2="${y + h}" ${l}/><line x1="${x}" y1="${y}" x2="${x}" y2="${y + h}" ${l}/><line x1="${x + 38}" y1="${y}" x2="${x + 38}" y2="${y + h}" ${l}/>${text(x + 19, y + h / 2, sid, { size: 12, weight: 'bold' })}${text(x + 38 + (w - 38) / 2, y + h / 2, label, { size: 12 })}`;
    return this.add(id, { svg, kind: 'rect', cx: x + w / 2, cy: y + h / 2, w, h });
  }
  // DFD external entity: square box with a darker fill.
  external(id, x, y, w, h, label) {
    return this.rect(id, x, y, w, h, label, { fill: C.ext, sw: 2, r: 0, weight: 'bold' });
  }

  // UML class box. sections: [attributes[], operations[]]; stereotype adds «...» above the name.
  classBox(id, x, y, w, name, attrs = [], ops = [], { stereotype, size = 12 } = {}) {
    const lh = size * 1.42;
    const head = stereotype ? 40 : 28;
    const hA = attrs.length ? attrs.length * lh + 10 : 8;
    const hO = ops.length ? ops.length * lh + 10 : 0;
    const h = head + hA + hO;
    let svg = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${C.fill}" stroke="${C.line}" stroke-width="1.4"/>`;
    svg += `<rect x="${x}" y="${y}" width="${w}" height="${head}" fill="${C.ext}" stroke="${C.line}" stroke-width="1.4"/>`;
    if (stereotype) svg += text(x + w / 2, y + 13, `«${stereotype}»`, { size: 11, italic: true });
    svg += text(x + w / 2, y + head - 14, name, { size: 13, weight: 'bold' });
    attrs.forEach((a, i) => { svg += text(x + 8, y + head + 5 + lh * (i + 0.5), a, { size, anchor: 'start' }); });
    if (ops.length) {
      const oy = y + head + hA;
      svg += `<line x1="${x}" y1="${oy}" x2="${x + w}" y2="${oy}" stroke="${C.line}" stroke-width="1.2"/>`;
      ops.forEach((o, i) => { svg += text(x + 8, oy + 5 + lh * (i + 0.5), o, { size, anchor: 'start' }); });
    }
    return this.add(id, { svg, kind: 'rect', cx: x + w / 2, cy: y + h / 2, w, h, x, y, bottom: y + h, right: x + w });
  }

  // Edge between shapes. Without explicit end points it is clipped to each shape's outline.
  edge(from, to, { via = [], start, end, label, labelAt, dashed = false, head = 'arrow', tail = null, m1, m2, size = 11.5, width = 1.3 } = {}) {
    const A = this.shapes.get(from);
    const B = this.shapes.get(to);
    if (!A || !B) throw new Error(`edge ${from} -> ${to}: unknown shape`);
    const p0 = start ?? clip(A, via[0] ?? [B.cx, B.cy]);
    const pN = end ?? clip(B, via.at(-1) ?? p0);
    const pts = [p0, ...via, pN];
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const markers = `${head ? ` marker-end="url(#${head})"` : ''}${tail ? ` marker-start="url(#${tail})"` : ''}`;
    this.raw(`<path d="${d}" fill="none" stroke="${C.line}" stroke-width="${width}"${dashed ? ' stroke-dasharray="6 4"' : ''}${markers}/>`);
    if (label) this.labelBox(labelAt ?? midpoint(pts), label, size);
    if (m1) this.labelText(near(pts[0], pts[1], 16), m1);
    if (m2) this.labelText(near(pts.at(-1), pts.at(-2), 16), m2);
  }
  labelBox([x, y], label, size = 11.5) {
    const lines = String(label).split('\n').length;
    const w = textWidth(label, size) + 8;
    const h = lines * size * 1.25 + 4;
    this.label(`<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" fill="#ffffff" opacity="0.92"/>${text(x, y, label, { size, fill: C.ink })}`);
  }
  labelText([x, y], label) {
    this.label(`<rect x="${x - textWidth(label, 11) / 2 - 2}" y="${y - 8}" width="${textWidth(label, 11) + 4}" height="16" fill="#ffffff" opacity="0.9"/>${text(x, y, label, { size: 11, weight: 'bold', fill: C.frag })}`);
  }
}

function clip(s, [px, py]) {
  const dx = px - s.cx;
  const dy = py - s.cy;
  if (!dx && !dy) return [s.cx, s.cy];
  const t = s.kind === 'ellipse'
    ? 1 / Math.sqrt((dx / s.rx) ** 2 + (dy / s.ry) ** 2)
    : Math.min(dx ? s.w / 2 / Math.abs(dx) : Infinity, dy ? s.h / 2 / Math.abs(dy) : Infinity);
  return [s.cx + dx * t, s.cy + dy * t];
}

// Midpoint of the longest segment, where a label has the most room.
function midpoint(pts) {
  let best = [pts[0], pts[1]];
  let len = -1;
  for (let i = 1; i < pts.length; i += 1) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (l > len) [len, best] = [l, [pts[i - 1], pts[i]]];
  }
  return [(best[0][0] + best[1][0]) / 2, (best[0][1] + best[1][1]) / 2];
}

// A point `dist` along the segment from a toward b, nudged sideways so it sits beside the line.
function near(a, b, dist) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ux = (b[0] - a[0]) / len;
  const uy = (b[1] - a[1]) / len;
  return [a[0] + ux * (dist + 6) - uy * 12, a[1] + uy * (dist + 6) + ux * 12];
}

// ---- Sequence diagrams --------------------------------------------------------------------------
// participants: [{ id, label, actor }]; steps: messages [from, to, label, { dashed }], { note, over: [ids] },
// { frag: 'alt' | 'opt' | 'loop', branches: [{ guard, steps }] }, { divider: 'text' }.
export function sequence({ title, participants, steps, gap = 210, left = 110 }) {
  const xs = new Map(participants.map((p, i) => [p.id, left + i * gap]));
  const width = left * 2 + (participants.length - 1) * gap;
  const body = [];
  const top = 50;
  const headH = 64;
  let y = top + headH + 30;
  let counter = 0;

  function range(list) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of list) {
      if (Array.isArray(s)) { lo = Math.min(lo, xs.get(s[0]), xs.get(s[1])); hi = Math.max(hi, xs.get(s[0]), xs.get(s[1]) + (s[0] === s[1] ? textWidth(s[2], 11.5) - 60 : 0)); }
      else if (s.over) { for (const id of s.over) { lo = Math.min(lo, xs.get(id)); hi = Math.max(hi, xs.get(id)); } }
      else if (s.frag) { for (const b of s.branches) { const [l, h] = range(b.steps); lo = Math.min(lo, l); hi = Math.max(hi, h); } }
    }
    return [lo, hi];
  }

  function run(list, depth) {
    for (const s of list) {
      if (Array.isArray(s)) {
        const [from, to, label, opt = {}] = s;
        counter += 1;
        const x1 = xs.get(from);
        const x2 = xs.get(to);
        const lines = String(label).split('\n').length;
        const labelH = lines * 14;
        y += labelH + 2;
        const tag = `${counter}. ${label}`;
        // White backing keeps lifelines from running through the label text.
        const back = (cx, anchor) => {
          const w = textWidth(tag, 11.5) + 8;
          const x = anchor === 'start' ? cx - 4 : cx - w / 2;
          body.push(`<rect x="${x}" y="${y - labelH - 7}" width="${w}" height="${labelH + 1}" fill="#ffffff"/>`);
        };
        if (from === to) {
          back(x1 + 10, 'start');
          body.push(text(x1 + 10, y - labelH / 2 - 6, tag, { size: 11.5, anchor: 'start' }));
          body.push(`<path d="M${x1},${y} h40 v24 h-40" fill="none" stroke="${C.line}" stroke-width="1.3"${opt.dashed ? ' stroke-dasharray="6 4"' : ''} marker-end="url(#arrow)"/>`);
          y += 36;
        } else {
          const mid = (x1 + x2) / 2;
          back(mid, 'middle');
          body.push(text(mid, y - labelH / 2 - 6, tag, { size: 11.5 }));
          body.push(`<line x1="${x1}" y1="${y}" x2="${x2 + (x2 > x1 ? -1 : 1)}" y2="${y}" stroke="${C.line}" stroke-width="1.3"${opt.dashed ? ' stroke-dasharray="6 4"' : ''} marker-end="url(#${opt.dashed ? 'open' : 'arrow'})"/>`);
          y += 16;
        }
      } else if (s.note) {
        const xsOver = s.over.map((id) => xs.get(id));
        const mid = (Math.min(...xsOver) + Math.max(...xsOver)) / 2;
        const half = Math.max((Math.max(...xsOver) - Math.min(...xsOver)) / 2 + 70, textWidth(s.note, 11.5) / 2 + 16);
        const lo = mid - half;
        const hi = mid + half;
        const lines = String(s.note).split('\n').length;
        const h = lines * 15 + 10;
        y += 6;
        body.push(`<path d="M${lo},${y} H${hi - 10} L${hi},${y + 10} V${y + h} H${lo} Z" fill="${C.note}" stroke="${C.muted}" stroke-width="1"/>`);
        body.push(text((lo + hi) / 2, y + h / 2, s.note, { size: 11.5 }));
        y += h + 12;
      } else if (s.divider) {
        y += 14;
        body.push(`<line x1="20" y1="${y}" x2="${width - 20}" y2="${y}" stroke="${C.muted}" stroke-width="1" stroke-dasharray="2 4"/>`);
        body.push(`<rect x="${width / 2 - textWidth(s.divider, 12) / 2 - 8}" y="${y - 10}" width="${textWidth(s.divider, 12) + 16}" height="20" fill="#ffffff"/>${text(width / 2, y, s.divider, { size: 12, weight: 'bold', fill: C.muted })}`);
        y += 22;
      } else if (s.frag) {
        const [lo, hi] = range(s.branches.flatMap((b) => b.steps));
        const x0 = lo - 95 + depth * 10;
        const x1 = hi + 95 - depth * 10;
        const y0 = y + 4;
        y += 30;
        const guards = [];
        s.branches.forEach((b, i) => {
          if (i > 0) { y += 6; guards.push({ y, guard: b.guard }); y += 22; }
          else guards.push({ y: y0 + 34, guard: b.guard, first: true });
          run(b.steps, depth + 1);
        });
        y += 10;
        body.push(`<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y - y0}" fill="none" stroke="${C.frag}" stroke-width="1.2"/>`);
        body.push(`<path d="M${x0},${y0} h${s.frag.length * 9 + 22} v12 l-8,8 H${x0} z" fill="#f6ede3" stroke="${C.frag}" stroke-width="1.2"/>${text(x0 + 8, y0 + 10, s.frag, { size: 12, weight: 'bold', anchor: 'start', fill: C.frag })}`);
        for (const g of guards) {
          if (!g.first) body.push(`<line x1="${x0}" y1="${g.y}" x2="${x1}" y2="${g.y}" stroke="${C.frag}" stroke-width="1" stroke-dasharray="6 4"/>`);
          if (g.guard) body.push(text(x0 + (g.first ? s.frag.length * 9 + 30 : 10), g.first ? y0 + 10 : g.y + 11, `[${g.guard}]`, { size: 11.5, anchor: 'start', italic: true, fill: C.frag }));
        }
        y += 8;
      }
    }
  }
  run(steps, 0);
  y += 20;
  const height = y + 20;
  const heads = participants.map((p) => {
    const x = xs.get(p.id);
    const life = `<line x1="${x}" y1="${top + headH}" x2="${x}" y2="${y}" stroke="${C.muted}" stroke-width="1" stroke-dasharray="5 4"/>`;
    if (p.actor) {
      const s = `stroke="${C.line}" stroke-width="1.6" fill="none"`;
      const cy = top + 14;
      return `${life}<circle cx="${x}" cy="${cy}" r="8" ${s} fill="#ffffff"/><line x1="${x}" y1="${cy + 8}" x2="${x}" y2="${cy + 26}" ${s}/><line x1="${x - 13}" y1="${cy + 14}" x2="${x + 13}" y2="${cy + 14}" ${s}/><line x1="${x}" y1="${cy + 26}" x2="${x - 10}" y2="${cy + 38}" ${s}/><line x1="${x}" y1="${cy + 26}" x2="${x + 10}" y2="${cy + 38}" ${s}/>${text(x, top + headH + 12, p.label, { size: 12.5, weight: 'bold' })}`;
    }
    const w = Math.max(120, textWidth(p.label, 12.5) + 24);
    return `${life}<rect x="${x - w / 2}" y="${top}" width="${w}" height="${headH - 6}" rx="4" fill="${C.ext}" stroke="${C.line}" stroke-width="1.4"/>${text(x, top + (headH - 6) / 2, p.label, { size: 12.5, weight: 'bold' })}`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${DEFS}<rect width="100%" height="100%" fill="#ffffff"/>${title ? text(width / 2, 22, title, { size: 15, weight: 'bold' }) : ''}${heads.join('')}${body.join('\n')}</svg>`;
  return { toSVG: () => svg };
}
