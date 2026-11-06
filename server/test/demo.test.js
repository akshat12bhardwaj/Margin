import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { admin, app, listing, member, request, setupDb, teardownDb } from './helpers.js';

const { isValidIsbn } = await import('../demo/isbn.js');
const { loadCatalog, refusalReason, removeDemo, seedDemo, subjectForCatalogBook } = await import('../demo/seed.js');
const { migrateSubjects } = await import('../demo/migrate-subjects.js');
const { subjectInfo } = await import('../../shared/subjects.mjs');
const { Book } = await import('../src/models/Book.js');
const { Notification } = await import('../src/models/Notification.js');
const { PurchaseRequest } = await import('../src/models/PurchaseRequest.js');
const { UNIVERSITY, User } = await import('../src/models/User.js');

before(setupDb);
after(teardownDb);

test('ISBN checksum recognises valid and invalid numbers', () => {
  assert.equal(isValidIsbn('9780134439020'), true);
  assert.equal(isValidIsbn('9788120319583'), false);
  assert.equal(isValidIsbn('0262033844'), true);
});

test('seeding refuses production and remote databases unless authorized', () => {
  assert.equal(refusalReason('mongodb://127.0.0.1:27017/x', 'development', false), null);
  assert.match(refusalReason('mongodb://127.0.0.1:27017/x', 'production', false), /production/);
  assert.match(refusalReason('mongodb+srv://a.example.net/x', 'development', false), /not a local/);
  assert.equal(refusalReason('mongodb+srv://a.example.net/x', 'production', true), null);
});

test('seeding is idempotent, and removal leaves real data alone', async () => {
  const real = await member();
  const realBook = await listing(real);

  const first = await seedDemo();
  assert.ok(first.listings > 100);
  assert.equal(first.created, first.listings);
  const second = await seedDemo();
  assert.equal(second.created, 0);
  assert.equal(await Book.countDocuments({ isDemo: true }), first.listings);
  assert.equal(await User.countDocuments({ isDemo: true }), first.sellers);

  // Listings arrive through the public API, labelled, with no invented year or edition.
  const page = await request(app).get('/api/books').query({ q: 'Introduction to Algorithms', limit: 24 }).expect(200);
  const sample = page.body.items.find((b) => b.isDemo);
  assert.equal(sample.seller.isDemo, true);
  assert.equal(sample.university, UNIVERSITY);
  assert.equal(sample.publicationYear, undefined);
  assert.equal(sample.edition, '3rd');
  const faculty = await request(app).get('/api/books').query({ sellerRole: 'faculty', limit: 24 }).expect(200);
  assert.ok(faculty.body.total > 0 && faculty.body.items.every((b) => b.seller.role === 'faculty'));
  const newest = await request(app).get('/api/books').query({ sort: 'year_desc', limit: 2 }).expect(200);
  assert.ok(newest.body.items[0].publicationYear >= newest.body.items[1].publicationYear);

  const details = await request(app).get(`/api/books/${sample._id}`).expect(200);
  assert.ok(details.body.related.length > 0);
  assert.ok(details.body.related.every((b) => b._id !== sample._id));

  // Sample sellers are automated: a real member's offer is answered, but sample listings cannot be reported
  // and fictional sellers receive no notifications.
  assert.equal(sample.seller.isAutomatedSeller, true);
  await real.agent.post('/api/requests').send({ bookId: sample._id }).expect(201);
  assert.equal((await PurchaseRequest.findOne({ book: sample._id })).status, 'accepted');
  await real.agent.post('/api/reports').send({ targetType: 'book', targetId: sample._id, category: 'other', description: 'This is a sample listing.' }).expect(409);
  assert.equal(await Notification.countDocuments({ user: sample.seller._id }), 0);

  // Fictional accounts cannot be logged into or reset.
  const demoUser = await User.findOne({ isDemo: true }).select('+passwordHash +resetTokenHash');
  assert.match(demoUser.email, /@demo\.invalid$/);
  await request(app).post('/api/auth/login').send({ email: demoUser.email, password: 'password123' }).expect(401);
  await request(app).post('/api/auth/forgot-password').send({ email: demoUser.email }).expect(200);
  assert.equal((await User.findById(demoUser._id).select('+resetTokenHash')).resetTokenHash, undefined);

  // Moderating a sample stores no notification; admin totals count real members only.
  const boss = await admin();
  await boss.agent.patch(`/api/admin/books/${sample._id}/hide`).send({ reason: 'Trying moderation.' }).expect(200);
  assert.equal(await Notification.countDocuments({ user: sample.seller._id }), 0);
  const stats = await boss.agent.get('/api/admin/stats').expect(200);
  assert.equal(stats.body.demoListings, first.listings);
  assert.equal(stats.body.demoUsers, first.sellers);
  assert.equal(stats.body.activeListings, 1);

  await real.agent.post('/api/wishlist').send({ bookId: page.body.items.find((b) => b.isDemo && b._id !== sample._id)._id }).expect(201);
  const removed = await removeDemo();
  assert.equal(removed.listings, first.listings);
  assert.equal(removed.wishlistEntries, 1);
  assert.equal(await User.countDocuments({ isDemo: true }), 0);
  assert.equal(await Book.countDocuments({ isDemo: true }), 0);
  assert.ok(await User.exists({ _id: real.id }));
  assert.ok(await Book.exists({ _id: realBook._id }));
  const wishlist = await real.agent.get('/api/wishlist').expect(200);
  assert.deepEqual(wishlist.body.items, []);
});

test('every catalogue book names its source handout and no ISBN is malformed', async () => {
  const { catalog } = await loadCatalog();
  const ids = new Set();
  for (const book of catalog.books) {
    assert.ok(!ids.has(book.id));
    ids.add(book.id);
    assert.ok(book.sources.length >= 1 && catalog.courses[book.sources[0].course].file);
    if (book.isbn) assert.ok(isValidIsbn(book.isbn), book.id);
  }
});

test('subject migration maps known subjects, flags uncertain ones and is idempotent', async () => {
  const { catalog } = await loadCatalog();
  for (const book of catalog.books) assert.ok(subjectInfo(subjectForCatalogBook(book)), book.id);

  await seedDemo();
  const m = await member();
  const legacy = async (title, subject) => {
    const b = await listing(m, { title });
    await Book.collection.updateOne({ title }, { $set: { subject } });
    return b._id;
  };
  const alias = await legacy('Old OS book', 'Operating System');
  const ambiguous = await legacy('Old LADE book', 'Linear Algebra & Differential Equations');
  const unknown = await legacy('Old COMS book', 'COMS');
  // Demo listings as the previous seed stored them: subject was the handout course name.
  await Book.collection.updateMany({ demoKey: /^(simmons-de|lay-linear)#/ }, { $set: { subject: 'Linear Algebra & Differential Equations' } });

  const dry = await migrateSubjects();
  assert.equal(dry.updated, 0);
  assert.equal(await Book.countDocuments({ subject: 'Operating System' }), 1);
  assert.deepEqual(dry.before, dry.after);

  const run = await migrateSubjects({ apply: true });
  assert.equal(run.updated, run.changes.length);
  assert.deepEqual(run.before, run.after);
  const subjectOf = async (id) => (await Book.findById(id)).subject;
  assert.equal(await subjectOf(alias), 'Operating Systems');
  // Neither the split course name nor unknown text is guessed: both stay as they were, flagged.
  assert.equal(await subjectOf(ambiguous), 'Linear Algebra & Differential Equations');
  assert.equal(await subjectOf(unknown), 'COMS');
  assert.deepEqual(run.flagged.map((f) => f.title).sort(), ['Old COMS book', 'Old LADE book']);
  // Demo books are split per title by the catalogue mapping.
  assert.equal((await Book.findOne({ demoKey: /^simmons-de#/ })).subject, 'Differential Equations');
  assert.equal((await Book.findOne({ demoKey: /^lay-linear#/ })).subject, 'Linear Algebra');

  const again = await migrateSubjects({ apply: true });
  assert.equal(again.changes.length, 0);
  assert.equal(again.updated, 0);
  await removeDemo();
});
