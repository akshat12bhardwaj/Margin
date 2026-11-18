// Response-time sample for read-only catalogue endpoints. Usage, with the API running:
//   node docs/04-Testing/evidence/perf-measure.mjs http://localhost:5000
// Sends N sequential requests per endpoint, then the same endpoints with C concurrent requests,
// and prints median and 95th-percentile latency. Read-only: it creates or changes no data.
const base = process.argv[2] ?? 'http://localhost:5000';
const N = 200;
const C = 20;

const first = await (await fetch(`${base}/api/books?limit=1`)).json();
const id = first.items[0]?._id;
const endpoints = [
  ['Browse page (12 listings)', '/api/books?limit=12'],
  ['Keyword search', '/api/books?q=algorithms&limit=12'],
  ['Subject + semester + price filter', '/api/books?subject=Physics&semester=2&maxPrice=500&limit=12'],
  ['Home facets', '/api/books/facets'],
  ['Listing details', `/api/books/${id}`],
];

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
async function timed(path) {
  const t = performance.now();
  const res = await fetch(base + path);
  await res.arrayBuffer();
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return performance.now() - t;
}

console.log(`Base ${base}, Node ${process.version}, ${N} sequential and ${C} concurrent requests per endpoint\n`);
console.log('Endpoint | Sequential median ms | Sequential p95 ms | Concurrent median ms | Concurrent p95 ms');
for (const [name, path] of endpoints) {
  await timed(path); // warm-up
  const seq = [];
  for (let i = 0; i < N; i += 1) seq.push(await timed(path));
  const conc = [];
  for (let round = 0; round < N / C; round += 1) conc.push(...(await Promise.all(Array.from({ length: C }, () => timed(path)))));
  seq.sort((a, b) => a - b);
  conc.sort((a, b) => a - b);
  const f = (v) => v.toFixed(1);
  console.log(`${name} | ${f(pct(seq, 50))} | ${f(pct(seq, 95))} | ${f(pct(conc, 50))} | ${f(pct(conc, 95))}`);
}
