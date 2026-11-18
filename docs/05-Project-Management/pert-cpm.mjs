// PERT (three-point) and CPM calculations for the project plan, plus a basic COCOMO cross-check.
// Usage: node docs/05-Project-Management/pert-cpm.mjs   (prints the Markdown tables used in Project-Management.md)
// Durations are ESTIMATES in working days for one developer-equivalent; they are not recorded effort.
const activities = [
  // id, name, optimistic, most likely, pessimistic, predecessors
  ['A', 'Requirements elicitation and handout analysis', 2, 3, 5, []],
  ['B', 'System, database and UI design', 2, 4, 6, ['A']],
  ['C', 'Backend foundation and authentication (incl. Google)', 3, 5, 8, ['B']],
  ['D', 'Listings, photos, search, filters and subject catalogue', 4, 6, 9, ['C']],
  ['E', 'Purchase requests, negotiation, messaging, notifications', 5, 7, 11, ['D']],
  ['F', 'Reporting, moderation, admin dashboard, audit log', 3, 5, 7, ['C']],
  ['G', 'Frontend pages, responsive layout, themes', 6, 9, 13, ['C']],
  ['H', 'Example marketplace data and automated sellers', 3, 4, 7, ['E']],
  ['I', 'Integration, system and regression testing', 3, 5, 8, ['E', 'F', 'G', 'H']],
  ['J', 'Project documentation (SRS, design, test report)', 3, 4, 6, ['I']],
  ['K', 'Evaluation readiness: build, setup checks, demo data', 1, 2, 3, ['I', 'J']],
];

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const te = (o, m, p) => (o + 4 * m + p) / 6;
const variance = (o, p) => ((p - o) / 6) ** 2;

const nodes = new Map(activities.map(([id, name, o, m, p, pred]) => [id, { id, name, o, m, p, pred, d: round(te(o, m, p)), v: variance(o, p) }]));
// Forward pass (activities are listed in dependency order).
for (const n of nodes.values()) {
  n.es = Math.max(0, ...n.pred.map((p) => nodes.get(p).ef));
  n.ef = round(n.es + n.d);
}
const projectEnd = Math.max(...[...nodes.values()].map((n) => n.ef));
// Backward pass.
for (const n of [...nodes.values()].reverse()) {
  const succ = [...nodes.values()].filter((s) => s.pred.includes(n.id));
  n.lf = succ.length ? Math.min(...succ.map((s) => s.ls)) : projectEnd;
  n.ls = round(n.lf - n.d);
  n.slack = round(n.ls - n.es);
}
const critical = [...nodes.values()].filter((n) => Math.abs(n.slack) < 1e-9);
const sigma = Math.sqrt(critical.reduce((s, n) => s + n.v, 0));

// Self-checks: every activity finishes by the project end, critical activities chain from start to end.
for (const n of nodes.values()) console.assert(n.ef <= projectEnd + 1e-9 && n.slack >= -1e-9, `bad schedule for ${n.id}`);
console.assert(critical[0].es === 0 && round(critical.at(-1).ef) === round(projectEnd), 'critical path does not span the project');

// Also used by the PERT chart in docs/02-Software-Design/diagrams/src.
export const schedule = { nodes, critical, projectEnd };
if (import.meta.main) report();

function report() {

console.log('| ID | Activity | Predecessors | O | M | P | tₑ = (O+4M+P)/6 | Variance ((P−O)/6)² |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- |');
for (const n of nodes.values()) console.log(`| ${n.id} | ${n.name} | ${n.pred.join(', ') || '–'} | ${n.o} | ${n.m} | ${n.p} | ${n.d.toFixed(2)} | ${n.v.toFixed(2)} |`);
console.log('\n| ID | Duration | ES | EF | LS | LF | Slack | Critical |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- |');
for (const n of nodes.values()) console.log(`| ${n.id} | ${n.d.toFixed(2)} | ${n.es.toFixed(2)} | ${n.ef.toFixed(2)} | ${n.ls.toFixed(2)} | ${n.lf.toFixed(2)} | ${n.slack.toFixed(2)} | ${n.slack === 0 ? 'Yes' : 'No'} |`);
console.log(`\nCritical path: ${critical.map((n) => n.id).join(' → ')}`);
console.log(`Expected project duration: ${round(projectEnd)} working days; standard deviation along the critical path: ${round(sigma)} days`);
// Probability of finishing within T days, normal approximation (PERT assumption).
const phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
function erf(x) {
  // Abramowitz and Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return Math.sign(x) * y;
}
for (const T of [40, 42, 44]) console.log(`P(finish within ${T} days) ≈ ${(100 * phi((T - projectEnd) / sigma)).toFixed(1)}%`);
const totalEffort = round([...nodes.values()].reduce((s, n) => s + n.d, 0));
console.log(`Total estimated effort (sum of durations): ${totalEffort} developer-days`);

// Basic COCOMO (organic mode) from the measured size of production code.
const KLOC = Number(process.env.KLOC ?? 6.39);
const effortPM = 2.4 * KLOC ** 1.05;
const durationMonths = 2.5 * effortPM ** 0.38;
console.log(`\nBasic COCOMO (organic), ${KLOC} KLOC: effort ${round(effortPM, 1)} person-months, schedule ${round(durationMonths, 1)} months, average staff ${round(effortPM / durationMonths, 1)}`);
}
