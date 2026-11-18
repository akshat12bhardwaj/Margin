// Builds the Word versions of the documentation from the Markdown sources.
// Usage from the repository root:
//   npm install --no-save docx@9.5.1     (once; not a project dependency; installs jszip with it)
//   node docs/build-docx.cjs
// Supports the Markdown used in docs/: headings, paragraphs, bullet and numbered lists, pipe tables,
// images with captions, fenced code and **bold**, `code`, *italic*. Wide tables and large figures are
// placed on landscape pages so they stay readable.
const fs = require('node:fs');
const path = require('node:path');
const {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, ImageRun, LevelFormat, Packer, PageNumber,
  PageOrientation, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} = require('docx');

const DOCS = [
  '01-SRS/SRS.md',
  '02-Software-Design/Software-Design.md',
  '03-SDLC/SDLC.md',
  '04-Testing/Test-Plan-and-Report.md',
  '04-Testing/Traceability-Matrix.md',
  '05-Project-Management/Project-Management.md',
  '06-Quality-and-Maintenance/Quality-and-Maintenance.md',
];
const A4 = { width: 11906, height: 16838 };
const MARGIN = 1134; // 2 cm
const PORTRAIT_W = A4.width - 2 * MARGIN; // DXA
const LANDSCAPE_W = A4.height - 2 * MARGIN;
const PX_PER_DXA = 96 / 1440;
const FONT = 'Arial';
const ACCENT = '2F4436';

// ---- inline text ----
function runs(textIn, base = {}) {
  const out = [];
  for (const part of textIn.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/)) {
    if (!part) continue;
    if (part.startsWith('**')) out.push(new TextRun({ ...base, text: part.slice(2, -2), bold: true }));
    else if (part.startsWith('`')) out.push(new TextRun({ ...base, text: part.slice(1, -1), font: 'Consolas', size: (base.size ?? 21) - 2 }));
    else if (part.startsWith('*') && part.length > 2) out.push(new TextRun({ ...base, text: part.slice(1, -1), italics: true }));
    else out.push(new TextRun({ ...base, text: part }));
  }
  return out;
}

// ---- tables ----
const splitRow = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

function table(rows, totalWidth, fontSize) {
  const [head, , ...body] = rows;
  const cols = head.length;
  // Column widths follow content length, damped so one long column cannot squeeze the others out.
  const weight = Array.from({ length: cols }, (_, c) => {
    const longest = Math.max(...rows.filter((_, i) => i !== 1).map((r) => (r[c] ?? '').length));
    return Math.min(Math.max(Math.sqrt(longest), 2.2), 9);
  });
  const sum = weight.reduce((a, b) => a + b, 0);
  const widths = weight.map((w) => Math.floor((w / sum) * totalWidth));
  widths[cols - 1] += totalWidth - widths.reduce((a, b) => a + b, 0);
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'B9C2B4' };
  const borders = { top: border, bottom: border, left: border, right: border };
  const cell = (textIn, c, isHead) => new TableCell({
    width: { size: widths[c], type: WidthType.DXA },
    borders,
    shading: isHead ? { fill: 'E6ECDF', type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: runs(textIn ?? '', { size: fontSize, bold: isHead || undefined }) })],
  });
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: head.map((t, c) => cell(t, c, true)) }),
      ...body.map((r) => new TableRow({ cantSplit: true, children: head.map((_, c) => cell(r[c], c, false)) })),
    ],
  });
}

// ---- images ----
function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

function convert(mdFile) {
  const dir = path.dirname(mdFile);
  const lines = fs.readFileSync(mdFile, 'utf8').split(/\r?\n/);
  const sections = [];
  let current = null;
  const open = (landscape) => {
    if (current && current.landscape === landscape) return;
    current = { landscape, children: [] };
    sections.push(current);
  };
  open(false);
  let title = '';
  let listCounter = 0;
  let i = 0;
  let inTitleBlock = false;
  const push = (el, landscape = false) => {
    if (landscape) open(true);
    else if (current.landscape) open(false);
    current.children.push(el);
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }
    if (line.startsWith('# ')) {
      title = line.slice(2).trim();
      push(new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { before: 1800, after: 300 }, children: runs(title) }));
      inTitleBlock = true;
      i += 1;
      continue;
    }
    if (line.startsWith('## ') || line.startsWith('### ')) {
      if (inTitleBlock) {
        inTitleBlock = false;
        push(new Paragraph({ pageBreakBefore: false, children: [] }));
      }
      const h2 = line.startsWith('## ');
      push(new Paragraph({ heading: h2 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2, children: runs(line.replace(/^#+\s/, '')) }));
      i += 1;
      continue;
    }
    if (line.startsWith('```')) {
      const code = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      i += 1;
      for (const c of code) push(new Paragraph({ shading: { fill: 'F4F4F0', type: ShadingType.CLEAR, color: 'auto' }, spacing: { before: 0, after: 0 }, children: [new TextRun({ text: c || ' ', font: 'Consolas', size: 18 })] }));
      continue;
    }
    if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(splitRow(lines[i++]));
      const cols = rows[0].length;
      const wide = cols >= 7;
      const fontSize = cols >= 8 ? 15 : cols >= 6 ? 17 : 19;
      push(table(rows, wide ? LANDSCAPE_W : PORTRAIT_W, fontSize), wide);
      push(new Paragraph({ spacing: { before: 0, after: 120 }, children: [] }), wide);
      continue;
    }
    const img = line.match(/^!\[(.*)\]\((.*)\)\s*$/);
    if (img) {
      const file = path.resolve(dir, img[2]);
      const { w, h } = pngSize(file);
      // PNGs are rendered at 2x; their CSS size decides portrait or landscape placement.
      const cssW = w / 2;
      const landscape = cssW > 1100 && w / h > 1.15;
      const maxW = (landscape ? LANDSCAPE_W : PORTRAIT_W) * PX_PER_DXA;
      const maxH = ((landscape ? A4.width : A4.height) - 2 * MARGIN) * PX_PER_DXA - 70;
      const scale = Math.min(maxW / w, maxH / h);
      push(new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 60 }, children: [new ImageRun({ type: 'png', data: fs.readFileSync(file), transformation: { width: Math.round(w * scale), height: Math.round(h * scale) }, altText: { title: img[1], description: img[1], name: path.basename(file) } })] }), landscape);
      push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 200 }, children: [new TextRun({ text: img[1], italics: true, size: 18, color: '5B6B5F' })] }), landscape);
      i += 1;
      continue;
    }
    if (/^(- |\d+\. )/.test(line)) {
      const numbered = /^\d+\. /.test(line);
      listCounter += 1;
      while (i < lines.length && /^(- |\d+\. )/.test(lines[i])) {
        const textIn = lines[i].replace(/^(- |\d+\. )/, '');
        push(new Paragraph({ numbering: { reference: numbered ? 'numbers' : 'bullets', level: 0, instance: numbered ? listCounter : 0 }, spacing: { before: 0, after: 60 }, children: runs(textIn) }));
        i += 1;
      }
      continue;
    }
    // Paragraph: join consecutive plain lines.
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#|\||!\[|```|- |\d+\. )/.test(lines[i])) para.push(lines[i++].trim());
    const textIn = para.join(' ');
    push(new Paragraph({ alignment: inTitleBlock ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { after: inTitleBlock ? 120 : 140 }, children: runs(textIn, inTitleBlock ? { size: 24, color: '444444' } : {}) }));
  }

  const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], size: 16, color: '777777' })] })] });
  const header = new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Margin · ${title.replace(/:.*/, '')}`, size: 16, color: '777777' })] })] });
  const doc = new Document({
    creator: 'Margin project team',
    title,
    styles: {
      default: { document: { run: { font: FONT, size: 21 }, paragraph: { spacing: { line: 276 } } } },
      paragraphStyles: [
        { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 44, bold: true, color: ACCENT }, paragraph: { spacing: { before: 1800, after: 300 }, keepNext: true } },
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 30, bold: true, color: ACCENT }, paragraph: { spacing: { before: 360, after: 140 }, keepNext: true, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 24, bold: true, color: ACCENT }, paragraph: { spacing: { before: 240, after: 100 }, keepNext: true, outlineLevel: 1 } },
      ],
    },
    numbering: {
      config: [
        { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
        { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] },
      ],
    },
    sections: sections.filter((s) => s.children.length).map((s) => ({
      properties: { page: { size: { width: A4.width, height: A4.height, orientation: s.landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
      headers: { default: header },
      footers: { default: footer },
      children: s.children,
    })),
  });
  return Packer.toBuffer(doc);
}

(async () => {
  const root = __dirname;
  const JSZip = require('jszip');
  // Optional arguments limit the build to matching documents, e.g. `node docs/build-docx.cjs Traceability`.
  const only = process.argv.slice(2);
  for (const rel of DOCS.filter((r) => !only.length || only.some((o) => r.includes(o)))) {
    const md = path.join(root, rel);
    const out = md.replace(/\.md$/, '.docx');
    // Drop the archive's folder entries: Word has refused files containing them when opened through co-editing services.
    const zip = await JSZip.loadAsync(await convert(md));
    for (const name of Object.keys(zip.files)) if (zip.files[name].dir) delete zip.files[name];
    fs.writeFileSync(out, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
    console.log('wrote', path.relative(root, out));
  }
})();
