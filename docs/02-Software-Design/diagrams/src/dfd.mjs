// Data flow diagrams (Yourdon-DeMarco notation: bubbles, open-ended stores, square external entities).
// Flows are data, and balance() fails the render if a level adds or drops a flow across its boundary.
import { C, Diagram, text } from './lib.mjs';

// ---- Context diagram ------------------------------------------------------------------------------
const CONTEXT = [
  ['Visitor', 'search criteria', 'in'], ['Visitor', 'listings and listing details', 'out'],
  ['Visitor', 'registration details', 'in'], ['Visitor', 'password reset request', 'in'],
  ['Member', 'login details', 'in'], ['Member', 'session', 'out'], ['Member', 'profile changes', 'in'],
  ['Member', 'listing details and photos', 'in'], ['Member', 'own listings', 'out'],
  ['Member', 'wishlist changes', 'in'], ['Member', 'saved books', 'out'],
  ['Member', 'purchase requests, offers and decisions', 'in'], ['Member', 'request status', 'out'],
  ['Member', 'chat messages', 'in'], ['Member', 'conversations', 'out'],
  ['Member', 'notifications', 'out'], ['Member', 'notification reads', 'in'], ['Member', 'reports', 'in'],
  ['Administrator', 'login details', 'in'], ['Administrator', 'session', 'out'],
  ['Administrator', 'moderation actions', 'in'], ['Administrator', 'report decisions', 'in'],
  ['Administrator', 'reports, statistics and audit log', 'out'],
  ['Google', 'authorization code exchange', 'out'], ['Google', 'verified identity', 'in'],
  ['Email', 'password reset link', 'out'],
];

const SHORT = { Visitor: 'Visitor', Member: 'Member', Administrator: 'Administrator', Google: 'Google', Email: 'email service' };
const EXT_LABEL = { Visitor: 'Visitor', Member: 'Member\n(student or faculty)', Administrator: 'Administrator', Google: 'Google Identity\nService', Email: 'Email (SMTP)\nservice' };

export function context() {
  const d = new Diagram(1560, 960, 'Figure 2.9  Context diagram');
  const P = [780, 470];
  const R = 120;
  d.process('P0', ...P, R, '0', 'Margin\nCourse Book\nExchange Marketplace');
  const box = { Visitor: [60, 60, 200, 80], Member: [60, 600, 200, 110], Administrator: [1300, 420, 200, 100], Google: [1300, 60, 200, 80], Email: [1300, 800, 200, 80] };
  for (const [id, [x, y, w, h]] of Object.entries(box)) d.external(id, x, y, w, h, EXT_LABEL[id]);
  // One inbound and one outbound flow per entity, each labelled with the data it carries.
  // Label centres, placed by hand beside their own arrow ("in" = into the system).
  const LABEL_AT = {
    'Visitor in': [300, 310], 'Visitor out': [480, 190], 'Member in': [500, 715], 'Member out': [360, 490],
    'Administrator in': [1110, 395], 'Administrator out': [1110, 550], 'Google in': [1020, 220], 'Google out': [1265, 290],
    'Email out': [1230, 690],
  };
  for (const ext of Object.keys(box)) {
    const e = d.shapes.get(ext);
    const dx = P[0] - e.cx;
    const dy = P[1] - e.cy;
    const len = Math.hypot(dx, dy);
    const u = [dx / len, dy / len];
    const n = [-u[1], u[0]];
    const edgePt = (off) => {
      const t = Math.min(e.w / 2 / Math.abs(dx || 1e-9), e.h / 2 / Math.abs(dy || 1e-9));
      return [e.cx + dx * t + n[0] * off, e.cy + dy * t + n[1] * off];
    };
    const circlePt = (off) => [P[0] - u[0] * R + n[0] * off, P[1] - u[1] * R + n[1] * off];
    for (const [dir, sign] of [['in', 1], ['out', -1]]) {
      const flows = CONTEXT.filter(([x, , dd]) => x === ext && dd === dir).map(([, l]) => l);
      if (!flows.length) continue;
      const labels = [dir === 'in' ? 'into the system:' : `to ${SHORT[ext]}:`, ...flows];
      const off = 9 * sign;
      const [from, to] = dir === 'in' ? [edgePt(off), circlePt(off)] : [circlePt(off), edgePt(off)];
      d.raw(`<path d="M${from[0]},${from[1]} L${to[0]},${to[1]}" stroke="${C.line}" stroke-width="1.5" fill="none" marker-end="url(#arrow)"/>`);
      const w = Math.max(...labels.map((l) => l.length)) * 6.5 + 16;
      const h = labels.length * 15 + 10;
      const c = LABEL_AT[`${ext} ${dir}`];
      d.label(`<rect x="${c[0] - w / 2}" y="${c[1] - h / 2}" width="${w}" height="${h}" fill="#ffffff" stroke="${C.muted}" stroke-width="0.6" rx="3"/>${text(c[0], c[1], labels.join('\n'), { size: 11.5, lh: 1.3 })}`);
    }
  }
  d.raw(text(780, 940, 'The email service delivers the reset link to the member outside the system boundary. Google is used only when Google sign-in is configured.', { size: 11.5, fill: C.muted, italic: true }));
  return d;
}

// ---- Level 0 ----------------------------------------------------------------------------------------
const L0_PROCESSES = {
  P1: ['1.0', 'Manage\naccounts'], P2: ['2.0', 'Manage\nlistings'], P3: ['3.0', 'Search and\nbrowse'], P4: ['4.0', 'Manage\nwishlist'],
  P5: ['5.0', 'Handle purchases\nand negotiation'], P6: ['6.0', 'Exchange\nmessages'], P7: ['7.0', 'Notify\nusers'], P8: ['8.0', 'Report and\nmoderate'],
};
// Logical stores. D2 holds listing records and their photos (photo files live in server/uploads or Cloudinary).
const STORES = {
  D1: 'Users', D2: 'Books (listings, photos)', D3: 'Wishlists', D4: 'Purchase requests',
  D5: 'Conversations and messages', D6: 'Notifications', D7: 'Reports', D8: 'Audit log',
};
// [from, to, label, options]. both: read and written (double-headed). at: draw at a duplicate of the entity.
const L0_FLOWS = [
  ['Visitor', 'P3', 'search criteria'], ['P3', 'Visitor', 'listings and listing details'],
  ['Visitor', 'P1', 'registration details'], ['Visitor', 'P1', 'password reset request'],
  ['Member', 'P1', 'login details'], ['P1', 'Member', 'session'], ['Member', 'P1', 'profile changes'],
  ['Administrator', 'P1', 'login details', { at: 'Admin2' }], ['P1', 'Administrator', 'session', { at: 'Admin2' }],
  ['P1', 'Google', 'authorization code exchange'], ['Google', 'P1', 'verified identity'], ['P1', 'Email', 'password reset link'],
  ['P1', 'D1', 'account records', { both: true }], ['D1', 'P3', 'seller profiles'],
  ['Member', 'P2', 'listing details and photos'], ['P2', 'Member', 'own listings'],
  ['P2', 'D2', 'listing record and photos', { both: true }], ['D2', 'P3', 'active listings and photos'],
  ['Member', 'P4', 'wishlist changes'], ['P4', 'Member', 'saved books'], ['P4', 'D3', 'saved entries', { both: true }], ['D2', 'P4', 'listing status'],
  ['Member', 'P5', 'purchase requests, offers and decisions'], ['P5', 'Member', 'request status'],
  ['P5', 'D2', 'listing / reserved, sold', { both: true }], ['P5', 'D4', 'request records', { both: true }],
  ['P5', 'D5', 'negotiation events'], ['P5', 'P7', 'trade event'],
  ['Member', 'P6', 'chat messages'], ['P6', 'Member', 'conversations'], ['P6', 'D5', 'messages', { both: true }],
  ['P6', 'P5', 'typed offer to an automated seller'], ['P6', 'P7', 'new message event'],
  ['P7', 'D6', 'notifications', { both: true }], ['P7', 'Member', 'notifications'], ['Member', 'P7', 'notification reads'],
  ['Member', 'P8', 'reports', { at: 'Member2' }], ['Administrator', 'P8', 'moderation actions'], ['Administrator', 'P8', 'report decisions'],
  ['P8', 'Administrator', 'reports, statistics and audit log'],
  ['P8', 'D7', 'report records', { both: true }], ['P8', 'D2', 'listing records / moderation status', { both: true }],
  ['P8', 'D1', 'user records / account status', { both: true }], ['P8', 'D4', 'requests / cancellations', { both: true }],
  ['P8', 'D8', 'audit entries / audit log', { both: true }], ['P8', 'P7', 'decision notices'],
];

// Checks that a lower-level diagram exchanges exactly the same flows with its environment as its parent.
function balance(name, parentFlows, childFlows) {
  const key = (ext, label, dir) => `${ext}|${label}|${dir}`;
  const want = new Set(parentFlows.map(([ext, label, dir]) => key(ext, label, dir)));
  const got = new Set(childFlows.map(([ext, label, dir]) => key(ext, label, dir)));
  const missing = [...want].filter((k) => !got.has(k));
  const extra = [...got].filter((k) => !want.has(k));
  if (missing.length || extra.length) throw new Error(`${name} is not balanced.\nMissing: ${missing.join('; ')}\nExtra: ${extra.join('; ')}`);
}
// A store can only be connected to a process (no entity-to-store or store-to-store flow).
function checkStores(name, flows, isStore, isExternal) {
  for (const [a, b] of flows) {
    if ((isStore(a) || isExternal(a)) && (isStore(b) || isExternal(b))) throw new Error(`${name}: invalid flow ${a} -> ${b}`);
  }
}
const EXTERNALS = Object.keys(EXT_LABEL);
const isStore = (n) => /^D\d$/.test(n);

function boundaryFlows(flows, inside) {
  const out = [];
  for (const [from, to, label, opt] of flows) {
    if (!inside(from) && inside(to)) out.push([from, label, 'in']);
    if (inside(from) && !inside(to)) out.push([to, label, 'out']);
    // A read-write flow also crosses the other way.
    if (opt?.both && inside(from) && !inside(to)) out.push([to, label, 'in']);
  }
  return out;
}
const unique = (rows) => [...new Map(rows.map((r) => [r.join('|'), r])).values()];

function draw(d, flows, routes) {
  for (const [from, to, label, opt = {}] of flows) {
    const r = routes[`${from}>${to}|${label}`] ?? routes[`${from}>${to}`] ?? {};
    // `at` redirects the entity or store end of a flow to its duplicate on the diagram.
    const outside = (n) => EXTERNALS.includes(n) || isStore(n);
    const a = (opt.at && outside(from)) ? opt.at : from;
    const b = (opt.at && outside(to)) ? opt.at : to;
    d.edge(a, b, { label: opt.part ?? label, ...r, tail: opt.both ? 'arrow' : null, size: 11 });
  }
}
const duplicate = (d, id, x, y, w, h, label) => {
  d.external(id, x, y, w, h, `${label} *`);
  d.raw(`<line x1="${x}" y1="${y + 12}" x2="${x + 12}" y2="${y}" stroke="${C.line}" stroke-width="1.6"/>`);
};

export function level0() {
  balance('Level 0 against the context diagram', CONTEXT, boundaryFlows(L0_FLOWS, (n) => !EXTERNALS.includes(n)).filter(([e, , dir], i, all) => EXTERNALS.includes(e)));
  checkStores('Level 0', L0_FLOWS, isStore, (n) => EXTERNALS.includes(n));
  const d = new Diagram(1720, 1290, 'Figure 2.10  DFD level 0');
  d.external('Visitor', 30, 160, 170, 80, EXT_LABEL.Visitor);
  d.external('Member', 30, 340, 170, 900, EXT_LABEL.Member);
  d.external('Google', 900, 44, 170, 56, EXT_LABEL.Google);
  d.external('Email', 1100, 44, 170, 56, EXT_LABEL.Email);
  duplicate(d, 'Admin2', 1300, 44, 170, 56, 'Administrator');
  duplicate(d, 'Member2', 1520, 300, 170, 70, 'Member');
  d.external('Administrator', 1520, 430, 170, 330, EXT_LABEL.Administrator);
  const P = { P3: [430, 200], P1: [430, 400], P2: [430, 590], P4: [430, 770], P6: [430, 990], P8: [1090, 470], P5: [1090, 810], P7: [1090, 1130] };
  for (const [id, [x, y]] of Object.entries(P)) d.process(id, x, y, 60, ...L0_PROCESSES[id]);
  const S = { D1: [620, 140, 200], D2: [620, 520, 230], D3: [620, 752, 200], D5: [620, 972, 250], D7: [1250, 330, 200], D8: [1300, 620, 200], D4: [1250, 900, 210], D6: [1250, 1210, 200] };
  for (const [id, [x, y, w]] of Object.entries(S)) d.store(id, x, y, w, 36, id, STORES[id]);
  const routes = {
    'Visitor>P3': { start: [200, 185], end: [372, 185] }, 'P3>Visitor': { start: [372, 216], end: [200, 216] },
    'Visitor>P1|registration details': { start: [185, 240], end: [380, 366], labelAt: [300, 314] },
    'Visitor>P1|password reset request': { start: [140, 240], via: [[250, 330]], end: [372, 384], labelAt: [312, 358] },
    'Member>P1|login details': { start: [200, 392], end: [370, 392] }, 'P1>Member': { start: [370, 412], end: [200, 412] },
    'Member>P1|profile changes': { start: [200, 432], end: [374, 426], labelAt: [290, 446] },
    'P1>Google': { start: [470, 354], end: [940, 100], labelAt: [700, 232] }, 'Google>P1': { start: [990, 100], end: [480, 362], labelAt: [895, 150] },
    'P1>Email': { start: [486, 372], end: [1170, 100], labelAt: [1080, 140] },
    'Administrator>P1': { start: [1370, 100], end: [489, 382], labelAt: [1270, 140] }, 'P1>Administrator': { start: [490, 394], end: [1410, 100], labelAt: [1320, 158] },
    'P1>D1': { start: [455, 345], end: [640, 176], labelAt: [575, 250] }, 'D1>P3': { start: [620, 150], end: [488, 185], labelAt: [555, 152] },
    'Member>P2': { start: [200, 578], end: [370, 578] }, 'P2>Member': { start: [370, 604], end: [200, 604] },
    'P2>D2': { start: [490, 582], end: [620, 548], labelAt: [555, 590] },
    'D2>P3': { start: [650, 520], end: [470, 246], labelAt: [598, 470] },
    'Member>P4': { start: [200, 758], end: [370, 758] }, 'P4>Member': { start: [370, 784], end: [200, 784] },
    'P4>D3': { start: [490, 770], end: [620, 770] }, 'D2>P4': { start: [700, 556], end: [478, 734], labelAt: [600, 660] },
    'Member>P5': { start: [200, 862], via: [[960, 862]], end: [1036, 834], labelAt: [480, 862] },
    'P5>Member': { start: [1034, 842], via: [[975, 884]], end: [200, 884], labelAt: [300, 884] },
    'P5>D2': { start: [1040, 776], end: [850, 556], labelAt: [960, 690] },
    'P5>D4': { start: [1140, 845], end: [1270, 900] },
    'P5>D5': { start: [1048, 852], end: [870, 972], labelAt: [930, 945] },
    'P5>P7': { start: [1090, 870], end: [1090, 1070] },
    'Member>P6': { start: [200, 978], end: [370, 978] }, 'P6>Member': { start: [370, 1004], end: [200, 1004] },
    'P6>D5': { start: [490, 990], end: [620, 990] },
    'P6>P5': { start: [470, 945], via: [[560, 916], [990, 916]], end: [1046, 852], labelAt: [760, 916] },
    'P6>P7': { start: [470, 1035], via: [[560, 1090]], end: [1030, 1120], labelAt: [780, 1102] },
    'P7>D6': { start: [1145, 1155], end: [1260, 1210] },
    'P7>Member': { start: [1030, 1140], via: [[700, 1170]], end: [200, 1170], labelAt: [330, 1170] },
    'Member>P7': { start: [200, 1205], via: [[700, 1205]], end: [1040, 1163], labelAt: [330, 1205] },
    'Member>P8': { start: [1520, 335], end: [1145, 448], labelAt: [1488, 352] },
    'Administrator>P8|moderation actions': { start: [1520, 460], end: [1150, 466], labelAt: [1430, 460] },
    'Administrator>P8|report decisions': { start: [1520, 500], end: [1146, 490], labelAt: [1430, 497] },
    'P8>Administrator': { start: [1138, 506], end: [1520, 560], labelAt: [1300, 547] },
    'P8>D7': { start: [1120, 418], end: [1265, 366], labelAt: [1195, 375] },
    'P8>D2': { start: [1031, 488], end: [850, 530], labelAt: [930, 495] },
    'P8>D1': { start: [1044, 432], end: [820, 168], labelAt: [978, 352] },
    'P8>D4': { start: [1112, 527], end: [1290, 900], labelAt: [1245, 800] },
    'P8>D8': { start: [1140, 500], end: [1310, 620], labelAt: [1250, 590] },
    'P8>P7': { start: [1092, 530], via: [[1180, 600], [1180, 1080]], end: [1135, 1090], labelAt: [1180, 1010] },
  };
  draw(d, L0_FLOWS, routes);
  d.raw(text(860, 1275, '* duplicated external entity (same entity drawn twice to keep flows short).   Double-headed arrows: data read from and written to a store.', { size: 11.5, fill: C.muted, italic: true }));
  return d;
}

// ---- Level 1: 5.0 Handle purchases and negotiation ------------------------------------------------
const envOf = (p) => L0_FLOWS.filter(([a, b]) => a === p || b === p).flatMap(([a, b, label, o]) => {
  const rows = [a === p ? [b, label, 'out'] : [a, label, 'in']];
  if (o?.both) rows.push([b, label, 'in']);
  return rows;
});
const L1_TRADE = [
  ['Member', 'T1', 'purchase requests, offers and decisions', { part: 'Buy now or offer' }],
  ['Member', 'T2', 'purchase requests, offers and decisions', { part: 'accept, decline or counter' }],
  ['Member', 'T5', 'purchase requests, offers and decisions', { part: 'exchange confirmation' }],
  ['Member', 'T6', 'purchase requests, offers and decisions', { part: 'cancellation' }],
  ['P6', 'T7', 'typed offer to an automated seller'],
  ['D2', 'T1', 'listing / reserved, sold', { part: 'listing price and status', at: 'D2a' }],
  ['T1', 'D4', 'request records', { part: 'new request', at: 'D4a' }],
  ['T2', 'D4', 'request records', { part: 'offer, counter, decision', both: true, at: 'D4a' }],
  ['T5', 'D4', 'request records', { part: 'completed', both: true, at: 'D4b' }],
  ['T6', 'D4', 'request records', { part: 'cancelled', both: true, at: 'D4b' }],
  ['T2', 'T3', 'accepted request'], ['T5', 'T3', 'exchange confirmed'], ['T6', 'T3', 'released request'],
  ['T3', 'D2', 'listing / reserved, sold', { part: 'reserved, sold or active' }],
  ['T1', 'T7', 'request to an automated seller'], ['T7', 'T2', 'seller decision (rules)'], ['T7', 'T5', 'buyer says collected'],
  ['T1', 'T4', 'event'], ['T2', 'T4', 'event'], ['T5', 'T4', 'event'], ['T6', 'T4', 'event'],
  ['T4', 'D5', 'negotiation events'], ['T4', 'P7', 'trade event'], ['T4', 'Member', 'request status'],
];

export function level1Trade() {
  const inside = (n) => /^T\d$/.test(n);
  balance('Level 1 (5.0) against level 0', unique(envOf('P5')), unique(boundaryFlows(L1_TRADE, inside)));
  checkStores('Level 1 (5.0)', L1_TRADE, isStore, (n) => EXTERNALS.includes(n));
  const d = new Diagram(1560, 1040, 'Figure 2.11  DFD level 1 for process 5.0: Handle purchases and negotiation');
  d.rect('boundary', 290, 50, 990, 950, '', { fill: '#ffffff', dash: true, r: 0 });
  d.raw(text(785, 68, '5.0 Handle purchases and negotiation', { size: 12.5, weight: 'bold', fill: C.muted }));
  d.external('Member', 30, 140, 190, 800, EXT_LABEL.Member);
  d.rect('P6', 1330, 160, 200, 60, '6.0 Exchange messages\n(level 0 process)', { r: 30, fill: C.proc, size: 12 });
  d.rect('P7', 1330, 600, 200, 60, '7.0 Notify users\n(level 0 process)', { r: 30, fill: C.proc, size: 12 });
  const proc = {
    T1: [480, 200, '5.1', 'Validate and\ncreate request'], T2: [480, 440, '5.2', 'Respond to\noffer'],
    T5: [480, 670, '5.5', 'Confirm\nexchange'], T6: [480, 900, '5.6', 'Cancel\nrequest'],
    T7: [860, 190, '5.7', 'Apply automated\nseller rules'], T4: [860, 470, '5.4', 'Record event\nand notify'], T3: [1080, 780, '5.3', 'Update listing\nstatus'],
  };
  for (const [id, [x, y, n, l]] of Object.entries(proc)) d.process(id, x, y, 58, n, l);
  const dupStore = (id, x, y, w, sid) => {
    d.store(id, x, y, w, 36, sid, `${STORES[sid]} *`);
    d.raw(`<line x1="${x + 6}" y1="${y}" x2="${x + 6}" y2="${y + 36}" stroke="${C.line}" stroke-width="1.5"/>`);
  };
  dupStore('D2a', 560, 96, 220, 'D2');
  dupStore('D4a', 370, 302, 220, 'D4');
  dupStore('D4b', 370, 767, 220, 'D4');
  d.store('D2', 1000, 900, 240, 36, 'D2', STORES.D2);
  d.store('D5', 1300, 450, 240, 36, 'D5', STORES.D5);
  const routes = {
    'Member>T1': { start: [220, 200], end: [422, 200] }, 'Member>T2': { start: [220, 440], end: [422, 440] },
    'Member>T5': { start: [220, 670], end: [422, 670] }, 'Member>T6': { start: [220, 900], end: [422, 900] },
    'P6>T7': { start: [1330, 190], end: [918, 190], labelAt: [1180, 190] },
    'D2>T1': { start: [600, 132], end: [520, 158], labelAt: [640, 160] },
    'T1>D4': { start: [480, 258], end: [480, 302], labelAt: [545, 280] }, 'T2>D4': { start: [480, 382], end: [480, 338], labelAt: [560, 360] },
    'T5>D4': { start: [480, 728], end: [480, 767], labelAt: [545, 748] }, 'T6>D4': { start: [480, 842], end: [480, 803], labelAt: [545, 822] },
    'T1>T7': { start: [538, 200], end: [802, 195], labelAt: [670, 215] },
    'T7>T2': { start: [815, 226], end: [532, 415], labelAt: [700, 300] },
    'T7>T5': { start: [905, 226], via: [[990, 330], [990, 600]], end: [536, 655], labelAt: [990, 420] },
    'T1>T4': { start: [530, 230], end: [812, 438], labelAt: [745, 388] },
    'T2>T4': { start: [538, 445], end: [802, 465], labelAt: [670, 470] },
    'T5>T4': { start: [534, 650], end: [812, 505], labelAt: [670, 590] },
    'T6>T4': { start: [530, 870], end: [835, 522], labelAt: [640, 760] },
    'T2>T3': { start: [530, 470], via: [[700, 560], [1050, 560]], end: [1060, 725], labelAt: [930, 560] },
    'T5>T3': { start: [538, 690], via: [[760, 730]], end: [1022, 770], labelAt: [800, 738] },
    'T6>T3': { start: [538, 905], via: [[900, 860]], end: [1030, 810], labelAt: [800, 880] },
    'T3>D2': { start: [1100, 836], end: [1100, 900], labelAt: [1180, 868] },
    'T4>D5': { start: [918, 468], end: [1300, 468] },
    'T4>P7': { start: [905, 505], via: [[1250, 630]], end: [1330, 630], labelAt: [1150, 598] },
    'T4>Member': { start: [808, 492], via: [[700, 548]], end: [220, 548], labelAt: [330, 548] },
  };
  draw(d, L1_TRADE, routes);
  d.raw(text(785, 1025, '* duplicated store. Labels such as "exchange confirmation" are parts of the level 0 flows "purchase requests, offers and decisions", "request records" and "listing / reserved, sold".', { size: 11, fill: C.muted, italic: true }));
  return d;
}

// ---- Level 1: 8.0 Report and moderate ------------------------------------------------------------
const L1_MOD = [
  ['Member', 'M1', 'reports'],
  ['D2', 'M1', 'listing records / moderation status', { part: 'reported listing' }], ['M1', 'D7', 'report records', { part: 'new report' }],
  ['M1', 'D2', 'listing records / moderation status', { part: 'flag listing' }],
  ['Administrator', 'M2', 'report decisions'], ['M2', 'D7', 'report records', { part: 'status and decision', both: true }],
  ['M2', 'D2', 'listing records / moderation status', { part: 'unflag listing' }],
  ['Administrator', 'M3', 'moderation actions', { part: 'hide, remove, restore listing' }],
  ['M3', 'D2', 'listing records / moderation status', { part: 'listing status', both: true }],
  ['Administrator', 'M4', 'moderation actions', { part: 'suspend, deactivate, restore' }],
  ['M4', 'D1', 'user records / account status', { part: 'account status', both: true }],
  ['M4', 'D2', 'listing records / moderation status', { part: "seller's listings" }],
  ['M3', 'D4', 'requests / cancellations', { part: 'cancel open requests' }], ['M4', 'D4', 'requests / cancellations', { part: 'cancel open requests' }],
  ['M2', 'D8', 'audit entries / audit log', { part: 'audit entry' }], ['M3', 'D8', 'audit entries / audit log', { part: 'audit entry' }],
  ['M4', 'D8', 'audit entries / audit log', { part: 'audit entry' }],
  ['M2', 'P7', 'decision notices'], ['M3', 'P7', 'decision notices'], ['M4', 'P7', 'decision notices'],
  ['D1', 'M5', 'user records / account status', { part: 'users' }], ['D2', 'M5', 'listing records / moderation status', { part: 'listings' }],
  ['D4', 'M5', 'requests / cancellations', { part: 'transactions' }], ['D7', 'M5', 'report records', { part: 'reports' }],
  ['D8', 'M5', 'audit entries / audit log', { part: 'audit log' }],
  ['M5', 'Administrator', 'reports, statistics and audit log'],
];

export function level1Moderation() {
  const inside = (n) => /^M\d$/.test(n);
  balance('Level 1 (8.0) against level 0', unique(envOf('P8')), unique(boundaryFlows(L1_MOD, inside)));
  checkStores('Level 1 (8.0)', L1_MOD, isStore, (n) => EXTERNALS.includes(n));
  const d = new Diagram(1560, 1010, 'Figure 2.12  DFD level 1 for process 8.0: Report and moderate');
  d.rect('boundary', 280, 50, 1000, 920, '', { fill: '#ffffff', dash: true, r: 0 });
  d.raw(text(780, 68, '8.0 Report and moderate', { size: 12.5, weight: 'bold', fill: C.muted }));
  d.external('Member', 30, 140, 180, 100, EXT_LABEL.Member);
  d.external('Administrator', 1340, 180, 190, 760, EXT_LABEL.Administrator);
  d.rect('P7', 30, 560, 200, 60, '7.0 Notify users\n(level 0 process)', { r: 30, fill: C.proc, size: 12 });
  const proc = { M1: [440, 190, '8.1', 'File\nreport'], M2: [1060, 230, '8.2', 'Review\nreport'], M3: [1060, 520, '8.3', 'Moderate\nlisting'], M4: [1060, 790, '8.4', 'Moderate\naccount'], M5: [440, 840, '8.5', 'Produce\noversight views'] };
  for (const [id, [x, y, n, l]] of Object.entries(proc)) d.process(id, x, y, 58, n, l);
  d.store('D7', 660, 120, 200, 36, 'D7', STORES.D7);
  d.store('D2', 620, 380, 240, 36, 'D2', STORES.D2);
  d.store('D8', 660, 600, 200, 36, 'D8', STORES.D8);
  d.store('D4', 660, 700, 220, 36, 'D4', STORES.D4);
  d.store('D1', 660, 900, 200, 36, 'D1', STORES.D1);
  const routes = {
    'Member>M1': { start: [210, 190], end: [382, 190] },
    'D2>M1': { start: [640, 380], end: [470, 240], labelAt: [530, 322] }, 'M1>D7': { start: [497, 175], end: [660, 140], labelAt: [580, 150] },
    'M1>D2': { start: [482, 232], end: [700, 380], labelAt: [640, 300] },
    'Administrator>M2': { start: [1340, 230], end: [1118, 230] }, 'M2>D7': { start: [1002, 215], end: [860, 145], labelAt: [930, 168] },
    'M2>D2': { start: [1010, 260], end: [830, 380], labelAt: [920, 330] },
    'Administrator>M3': { start: [1340, 520], end: [1118, 520], labelAt: [1235, 505] },
    'M3>D2': { start: [1002, 505], end: [860, 410], labelAt: [930, 450] },
    'Administrator>M4': { start: [1340, 790], end: [1118, 790], labelAt: [1235, 775] },
    'M4>D1': { start: [1010, 820], end: [860, 912], labelAt: [930, 880] },
    'M4>D2': { start: [1020, 748], via: [[960, 600], [960, 416]], end: [860, 416], labelAt: [960, 470] },
    'M3>D4': { start: [1010, 550], end: [880, 712], labelAt: [945, 631] }, 'M4>D4': { start: [1002, 780], end: [880, 728], labelAt: [971, 767] },
    'M2>D8': { start: [1030, 280], via: [[990, 330], [990, 610]], end: [860, 610], labelAt: [1000, 400] },
    'M3>D8': { start: [1004, 535], end: [860, 622], labelAt: [896, 600] },
    'M4>D8': { start: [1012, 758], end: [840, 636], labelAt: [935, 703] },
    'M2>P7': { start: [1005, 252], via: [[300, 290], [300, 570]], end: [230, 575], labelAt: [300, 440] },
    'M3>P7': { start: [1002, 530], via: [[330, 590]], end: [230, 590], labelAt: [380, 588] },
    'M4>P7': { start: [1004, 806], via: [[330, 620]], end: [230, 605], labelAt: [380, 650] },
    'D1>M5': { start: [680, 900], end: [492, 862], labelAt: [600, 880] }, 'D2>M5': { start: [630, 416], end: [462, 785], labelAt: [530, 520] },
    'D4>M5': { start: [670, 736], end: [494, 818], labelAt: [600, 770] },
    'D7>M5': { start: [670, 156], via: [[580, 300], [580, 690]], end: [478, 796], labelAt: [580, 660] },
    'D8>M5': { start: [660, 630], end: [488, 808], labelAt: [570, 700] },
    'M5>Administrator': { start: [498, 850], via: [[520, 950], [1300, 950]], end: [1340, 900], labelAt: [1000, 950] },
  };
  draw(d, L1_MOD, routes);
  return d;
}
