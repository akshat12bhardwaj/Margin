// Checks catalog.json against the handouts and Open Library, and downloads covers.
// Usage: node server/demo/verify-catalog.js          offline checks only, writes extraction-summary.md
//        node server/demo/verify-catalog.js --online also refreshes verification.json and covers/
import fs from 'node:fs';
import path from 'node:path';
import { isValidIsbn } from './isbn.js';

const here = import.meta.dirname;
const catalog = JSON.parse(fs.readFileSync(path.join(here, 'catalog.json'), 'utf8'));
const raw = JSON.parse(fs.readFileSync(path.join(here, 'raw-references.json'), 'utf8'));
const verificationPath = path.join(here, 'verification.json');
const coversDir = path.join(here, 'covers');

const norm = (s) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”"]/g, '').replace(/\s+/g, ' ');
const blob = new Map(raw.map((d) => [d.file, norm(d.sections.flatMap((s) => s.lines).join(' '))]));

const problems = [];
const seen = new Map();
const docsWithBooks = new Set();
for (const book of catalog.books) {
  if (book.isbn && !isValidIsbn(book.isbn)) problems.push(`${book.id}: invalid ISBN ${book.isbn}`);
  const key = norm(`${book.title}|${book.authors}|${book.edition ?? ''}`);
  if (seen.has(key)) problems.push(`${book.id}: duplicate of ${seen.get(key)}`);
  seen.set(key, book.id);
  for (const source of book.sources) {
    const course = catalog.courses[source.course];
    if (!course) problems.push(`${book.id}: unknown course ${source.course}`);
    else if (!blob.get(course.file)?.includes(norm(source.match))) problems.push(`${book.id}: "${source.match}" not found in ${course.file}`);
    else docsWithBooks.add(course.file);
  }
}
for (const item of catalog.excluded) {
  if (!blob.get(catalog.courses[item.source.course].file)?.includes(norm(item.source.match))) problems.push(`excluded "${item.text}" not found in its handout`);
}
for (const d of raw) if (!docsWithBooks.has(d.file)) problems.push(`no books recorded for ${d.file}`);

// The cover host often times out, so a network failure counts as "no result" after one retry.
async function safeFetch(url) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fetch(url, { headers: { 'User-Agent': 'Margin academic marketplace demo seed' }, signal: AbortSignal.timeout(30_000) });
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return null;
}

async function getJson(url) {
  const res = await safeFetch(url);
  return res?.ok ? res.json() : null;
}

const firstSurname = (authors) => authors.split(',')[0].trim().split(' ').pop();
const shortTitle = (title) => title.split(':')[0];
const sameWords = (a, b) => {
  const words = (s) => norm(s).replace(/[^a-z0-9 ]/g, '').split(' ').filter((w) => w.length > 3);
  const theirs = new Set(words(b));
  return words(a).every((w) => theirs.has(w));
};

async function online() {
  fs.mkdirSync(coversDir, { recursive: true });
  const results = fs.existsSync(verificationPath) ? JSON.parse(fs.readFileSync(verificationPath, 'utf8')) : {};
  for (const book of catalog.books) {
    // Finished entries are kept, so an interrupted run resumes instead of hammering the API again.
    if (results[book.id]?.cover) continue;
    // Reviewed by eye and rejected: never download these again.
    if (catalog.rejectedCovers[book.id] && results[book.id]) continue;
    const fields = 'key,title,author_name,cover_i,first_publish_year';
    const params = new URLSearchParams({ title: shortTitle(book.title), author: firstSurname(book.authors), limit: '5', fields });
    const search = await getJson(`https://openlibrary.org/search.json?${params}`);
    const match = search?.docs?.find((d) => sameWords(shortTitle(book.title), d.title) && d.author_name?.some((a) => norm(a).includes(norm(firstSurname(book.authors)))));
    // A handout ISBN names the exact edition, so its cover beats the work's general cover.
    let coverUrl = book.isbn ? `https://covers.openlibrary.org/b/isbn/${book.isbn}-L.jpg?default=false` : null;
    let coverKind = 'isbn';
    let res = coverUrl ? await safeFetch(coverUrl) : null;
    if (!res?.ok && match?.cover_i) {
      coverUrl = `https://covers.openlibrary.org/b/id/${match.cover_i}-L.jpg`;
      coverKind = 'work';
      res = await safeFetch(coverUrl);
    }
    let cover = null;
    if (res?.ok) {
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length > 3000) {
        fs.writeFileSync(path.join(coversDir, `${book.id}.jpg`), bytes);
        cover = { kind: coverKind, source: coverUrl };
      }
    }
    results[book.id] = { verified: Boolean(match), openLibraryKey: match?.key ?? null, openLibraryTitle: match?.title ?? null, cover };
    fs.writeFileSync(verificationPath, JSON.stringify(results, null, 1));
    console.log(`${match ? 'ok ' : '?? '} ${cover ? cover.kind.padEnd(4) : '-   '} ${book.id}`);
    await new Promise((r) => setTimeout(r, 1200)); // Open Library asks clients to stay gentle.
  }
}

if (process.argv.includes('--online')) await online();

const verification = fs.existsSync(verificationPath) ? JSON.parse(fs.readFileSync(verificationPath, 'utf8')) : {};
const references = catalog.books.reduce((n, b) => n + b.sources.length, 0) + catalog.excluded.length;
const uncertain = catalog.books.filter((b) => b.uncertain);
const unverified = catalog.books.filter((b) => verification[b.id] && !verification[b.id].verified);
const covers = catalog.books.filter((b) => verification[b.id]?.cover);
const lines = [
  '# Handout extraction summary',
  '',
  '| Measure | Count |',
  '| --- | --- |',
  `| Documents scanned | ${raw.length} |`,
  `| Book and paper references found | ${references} |`,
  `| Excluded (papers or unconfirmed titles) | ${catalog.excluded.length} |`,
  `| Unique books | ${catalog.books.length} |`,
  `| Duplicates merged | ${references - catalog.excluded.length - catalog.books.length} |`,
  `| Uncertain entries (kept, conflicting field left out) | ${uncertain.length} |`,
  `| Not found in Open Library (kept, taken from the handout) | ${unverified.length} |`,
  `| Entries ready for import | ${catalog.books.length} |`,
  `| Books with an Open Library cover (each reviewed by eye) | ${covers.length} |`,
  `| Covers rejected on review (generated cover used) | ${Object.keys(catalog.rejectedCovers).length} |`,
  '',
  '## Uncertain entries',
  ...uncertain.map((b) => `- **${b.title}** (${b.authors}): ${b.uncertain}`),
  '',
  '## Not found in Open Library',
  ...unverified.map((b) => `- ${b.title} (${b.authors})`),
  '',
  '## Excluded',
  ...catalog.excluded.map((e) => `- ${e.text}: ${e.reason}`),
  '',
  '## Corrected from the handout text',
  ...catalog.books.filter((b) => b.corrected).map((b) => `- **${b.title}**: ${b.corrected}`),
  '',
];
fs.writeFileSync(path.join(here, 'extraction-summary.md'), lines.join('\n'));
console.log(lines.slice(4, 14).join('\n'));
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.join('\n')}`);
  process.exitCode = 1;
}
