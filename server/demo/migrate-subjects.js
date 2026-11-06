// Moves listings onto the controlled subject catalogue (shared/subjects.mjs). Dry run unless apply is set.
// Never guesses: a subject that matches no catalogue name or known handout course is reported and left alone.
import { Book } from '../src/models/Book.js';
import { SUBJECT_NAMES, subjectInfo } from '../../shared/subjects.mjs';
import { loadCatalog, SUBJECT_BY_BOOK, SUBJECT_BY_COURSE, subjectForCatalogBook } from './seed.js';

const normal = (s) => String(s ?? '').trim().toLowerCase().replace(/\s*&\s*/g, ' and ').replace(/\s+/g, ' ');

// Exact catalogue names, plus the old free-text subjects the seed used (handout course names). A course whose
// books span two subjects is left out, because its name alone does not say which one a listing belongs to.
function aliasTable(catalog) {
  const split = new Set(Object.keys(SUBJECT_BY_BOOK).map((id) => catalog.books.find((b) => b.id === id).sources[0].course));
  const aliases = new Map(SUBJECT_NAMES.map((n) => [normal(n), n]));
  for (const [key, course] of Object.entries(catalog.courses)) {
    if (!split.has(key) && SUBJECT_BY_COURSE[key]) aliases.set(normal(course.name), SUBJECT_BY_COURSE[key]);
  }
  return aliases;
}

export function planSubjects(books, catalog) {
  const aliases = aliasTable(catalog);
  const byId = new Map(catalog.books.map((b) => [b.id, b]));
  const changes = [];
  const flagged = [];
  for (const b of books) {
    if (subjectInfo(b.subject)) continue;
    const source = b.isDemo && byId.get(b.demoKey?.split('#')[0]);
    const to = source ? subjectForCatalogBook(source) : aliases.get(normal(b.subject));
    if (to) changes.push({ _id: b._id, title: b.title, from: b.subject, to });
    else flagged.push({ _id: b._id, title: b.title, subject: b.subject, course: b.course, status: b.status });
  }
  return { changes, flagged };
}

const countByStatus = async () =>
  Object.fromEntries((await Book.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }, { $sort: { _id: 1 } }])).map((r) => [r._id, r.n]));

export async function migrateSubjects({ apply = false, removeOriginalPrice = false } = {}) {
  const { catalog } = await loadCatalog();
  const before = await countByStatus();
  const books = await Book.collection.find({}, { projection: { title: 1, subject: 1, course: 1, status: 1, isDemo: 1, demoKey: 1 } }).toArray();
  const { changes, flagged } = planSubjects(books, catalog);
  const withOriginalPrice = await Book.countDocuments({ originalPrice: { $exists: true } });
  let updated = 0;
  let originalPricesRemoved = 0;
  if (apply) {
    // Matching on the old value keeps a re-run, or a listing edited meanwhile, from being overwritten.
    for (const c of changes) updated += (await Book.collection.updateOne({ _id: c._id, subject: c.from }, { $set: { subject: c.to } })).modifiedCount;
    if (removeOriginalPrice) originalPricesRemoved = (await Book.collection.updateMany({ originalPrice: { $exists: true } }, { $unset: { originalPrice: 1 } })).modifiedCount;
  }
  const after = await countByStatus();
  return { apply, before, after, total: books.length, alreadyValid: books.length - changes.length - flagged.length, changes, flagged, updated, withOriginalPrice, originalPricesRemoved };
}
