import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { app, LISTING, listing, member, PNG, request, setupDb, teardownDb } from './helpers.js';
import mongoose from 'mongoose';
import { Book } from '../src/models/Book.js';
import { UNIVERSITY } from '../src/models/User.js';

before(setupDb);
after(teardownDb);

const titles = (res) => res.body.items.map((b) => b.title).sort();

test('students and faculty can list; anonymous users cannot', async () => {
  const student = await member('student');
  const faculty = await member('faculty');
  assert.equal((await listing(student)).university, UNIVERSITY);
  assert.equal((await listing(faculty, { edition: '1st' })).edition, '1st');
  await request(app).post('/api/books').field(LISTING).attach('images', PNG, { filename: 'a.png', contentType: 'image/png' }).expect(401);
});

test('upload rules: photo required, fake images and wrong types rejected, multiple accepted', async () => {
  const m = await member();
  await m.agent.post('/api/books').field(LISTING).expect(400);
  const fake = await m.agent.post('/api/books').field(LISTING).attach('images', Buffer.from('<script>alert(1)</script>'), { filename: 'a.png', contentType: 'image/png' }).expect(400);
  assert.match(fake.body.error, /not a valid/);
  await m.agent.post('/api/books').field(LISTING).attach('images', Buffer.from('MZ'), { filename: 'a.exe', contentType: 'application/x-msdownload' }).expect(400);
  await m.agent.post('/api/books').field(LISTING).attach('images', Buffer.alloc(6 * 1024 * 1024), { filename: 'big.png', contentType: 'image/png' }).expect(400);
  const two = await m.agent.post('/api/books').field(LISTING).attach('images', PNG, { filename: 'a.png', contentType: 'image/png' }).attach('images', PNG, { filename: 'b.png', contentType: 'image/png' }).expect(201);
  assert.equal(two.body.book.images.length, 2);
  const img = await request(app).get(two.body.book.images[0].url).expect(200);
  assert.equal(img.headers['content-type'], 'image/png');
});

test('listing validation: blank price is an error, not a free book', async () => {
  const m = await member();
  const res = await m.agent.post('/api/books').field({ ...LISTING, price: '' }).attach('images', PNG, { filename: 'a.png', contentType: 'image/png' }).expect(400);
  assert.ok(res.body.fields.price);
  await m.agent.post('/api/books').field({ ...LISTING, condition: 'Mint' }).attach('images', PNG, { filename: 'a.png', contentType: 'image/png' }).expect(400);
  await m.agent.post('/api/books').field({ ...LISTING, isbn: '123' }).attach('images', PNG, { filename: 'a.png', contentType: 'image/png' }).expect(400);
  // B.Tech semesters run 1 to 8.
  for (const semester of ['0', '9', '2.5']) {
    await m.agent.post('/api/books').field({ ...LISTING, semester }).attach('images', PNG, { filename: 'a.png', contentType: 'image/png' }).expect(400);
  }
  assert.equal((await listing(m, { semester: '8' })).semester, 8);
  await request(app).get('/api/books').query({ semester: '9' }).expect(400);
});

test('search, filters, sorting and pagination', async () => {
  const s = await member('student');
  await listing(s, { title: 'Quantum Physics', author: 'Griffiths', subject: 'Physics', isbn: '978-0-13-468099-0', price: '100', condition: 'New', edition: '2nd', semester: '3', course: 'ZZ-PH101' });
  await listing(s, { title: 'Organic Chemistry', author: 'Clayden', subject: 'Chemistry', price: '300', condition: 'Acceptable', edition: '5th', semester: '4', course: 'ZZ-CH201' });
  // The course prefix keeps other tests' listings out of these results.
  const q = (query) => request(app).get('/api/books').query({ course: 'zz-', ...query }).expect(200);

  assert.deepEqual(titles(await q({ q: 'quant' })), ['Quantum Physics']);
  assert.deepEqual(titles(await q({ q: 'griffiths' })), ['Quantum Physics']);
  assert.deepEqual(titles(await q({ q: '978-0134680' })), ['Quantum Physics']);
  assert.deepEqual(titles(await q({ q: 'chemistry' })), ['Organic Chemistry']);
  assert.equal((await q({ q: '.*(' })).body.total, 0);
  assert.deepEqual(titles(await q({ subject: 'Physics' })), ['Quantum Physics']);
  assert.deepEqual(titles(await q({ subject: 'Chemistry', semester: '4', maxPrice: '300' })), ['Organic Chemistry']);
  assert.equal((await q({ subject: 'Chemistry', semester: '3' })).body.total, 0);
  // Exact catalogue names only: a partial or invented subject is rejected, not fuzzy-matched.
  await request(app).get('/api/books').query({ subject: 'Phys' }).expect(400);
  assert.deepEqual(titles(await q({ semester: '4' })), ['Organic Chemistry']);
  assert.deepEqual(titles(await q({ course: 'zz-ph101' })), ['Quantum Physics']);
  assert.deepEqual(titles(await q({ edition: '5th' })), ['Organic Chemistry']);
  assert.deepEqual(titles(await q({ condition: 'New,Good' })), ['Quantum Physics']);
  assert.deepEqual(titles(await q({ minPrice: '150', maxPrice: '400' })), ['Organic Chemistry']);
  assert.equal((await q({ sort: 'price_desc' })).body.items[0].price, 300);
  assert.equal((await q({ sort: 'price_asc' })).body.items[0].price, 100);
  assert.equal((await q({ sort: 'oldest' })).body.items[0].title, 'Quantum Physics');
  assert.equal((await q({ sort: 'newest' })).body.items[0].title, 'Organic Chemistry');
  const paged = await q({ limit: '1', page: '2' });
  assert.equal(paged.body.items.length, 1);
  assert.equal(paged.body.pages, 2);
  await request(app).get('/api/books').query({ sort: 'evil' }).expect(400);
  // Express 5 does not parse nested query keys, so an operator payload is simply an ignored parameter.
  assert.ok((await request(app).get('/api/books?university[$ne]=x').expect(200)).body.total > 2);
  const facets = await request(app).get('/api/books/facets').expect(200);
  assert.ok(facets.body.subjects.some((d) => d.name === 'Physics' && d.count >= 1));
  assert.ok(facets.body.courses.some((d) => d.name === 'ZZ-PH101'));
  assert.equal(facets.body.departments, undefined);
  assert.deepEqual(facets.body.universities.map((u) => u.name), [UNIVERSITY]);
});

test('subjects come from the catalogue; original price and department are not collected', async () => {
  const m = await member();
  const attach = (req) => req.attach('images', PNG, { filename: 'a.png', contentType: 'image/png' });
  for (const subject of ['', 'Algorithms', 'Data Structures and Algorithms ', '<b>x</b>']) {
    const res = await attach(m.agent.post('/api/books').field({ ...LISTING, subject })).expect(400);
    assert.ok(res.body.fields.subject, `accepted ${JSON.stringify(subject)}`);
  }
  for (const price of ['0', '-5']) await attach(m.agent.post('/api/books').field({ ...LISTING, price })).expect(400);
  const book = await listing(m, { originalPrice: '900', department: 'Physics' });
  assert.equal(book.subject, 'Data Structures and Algorithms');
  assert.equal(book.originalPrice, undefined);
  assert.equal(book.department, undefined);
  const edit = { ...LISTING, keepImages: book.images[0].url };
  await m.agent.patch(`/api/books/${book._id}`).field({ ...edit, subject: 'Quantum Basket Weaving' }).expect(400);
  const changed = await m.agent.patch(`/api/books/${book._id}`).field({ ...edit, subject: 'Operating Systems' }).expect(200);
  assert.equal(changed.body.book.subject, 'Operating Systems');
  assert.equal((await request(app).get(`/api/books/${book._id}`).expect(200)).body.book.subject, 'Operating Systems');
});

test('a stored legacy original price never reaches the API', async () => {
  const m = await member();
  const book = await listing(m, { title: 'Legacy price' });
  await Book.collection.updateOne({ _id: new mongoose.Types.ObjectId(book._id) }, { $set: { originalPrice: 1200, department: 'CSE' } });
  const responses = [
    (await request(app).get(`/api/books/${book._id}`).expect(200)).body.book,
    (await request(app).get('/api/books').query({ q: 'Legacy price' }).expect(200)).body.items[0],
    (await m.agent.get('/api/books/mine').expect(200)).body.items.find((b) => b._id === book._id),
    (await m.agent.patch(`/api/books/${book._id}`).field({ ...LISTING, title: 'Legacy price', keepImages: book.images[0].url }).expect(200)).body.book,
  ];
  for (const b of responses) assert.equal(b.originalPrice, undefined);
  // Editing leaves the legacy values in place for the reviewed migration to handle.
  assert.equal((await Book.collection.findOne({ _id: new mongoose.Types.ObjectId(book._id) })).department, 'CSE');
});

test('ownership: only the owner can edit, change status or delete', async () => {
  const owner = await member();
  const other = await member();
  const book = await listing(owner);
  const edit = { ...LISTING, title: 'Hacked', keepImages: book.images[0].url };
  await other.agent.patch(`/api/books/${book._id}`).field(edit).expect(404);
  await other.agent.patch(`/api/books/${book._id}/status`).send({ status: 'inactive' }).expect(409);
  await other.agent.delete(`/api/books/${book._id}`).expect(409);
  const ok = await owner.agent.patch(`/api/books/${book._id}`).field({ ...edit, title: 'Renamed' }).expect(200);
  assert.equal(ok.body.book.title, 'Renamed');
  // Client-supplied seller/status are ignored.
  const sneaky = await owner.agent.patch(`/api/books/${book._id}`).field({ ...edit, seller: other.id, status: 'sold', flagged: 'true' }).expect(200);
  assert.equal(sneaky.body.book.seller, owner.id);
  assert.equal(sneaky.body.book.status, 'active');
});

test('edit: replaces photos, clears optionals, refuses zero photos', async () => {
  const owner = await member();
  const book = await listing(owner, { isbn: '9780134680990', semester: '3' });
  await owner.agent.patch(`/api/books/${book._id}`).field(LISTING).expect(400);
  const res = await owner.agent.patch(`/api/books/${book._id}`).field(LISTING).attach('images', PNG, { filename: 'n.png', contentType: 'image/png' }).expect(200);
  assert.notEqual(res.body.book.images[0].url, book.images[0].url);
  assert.equal(res.body.book.isbn, undefined);
  assert.equal(res.body.book.semester, undefined);
  await request(app).get(book.images[0].url).expect(404);
});

test('deactivate hides a listing from others; delete removes it', async () => {
  const owner = await member();
  const other = await member();
  const book = await listing(owner, { title: 'Pausable' });
  await owner.agent.patch(`/api/books/${book._id}/status`).send({ status: 'inactive' }).expect(200);
  await request(app).get(`/api/books/${book._id}`).expect(404);
  await other.agent.get(`/api/books/${book._id}`).expect(404);
  await owner.agent.get(`/api/books/${book._id}`).expect(200);
  assert.equal((await request(app).get('/api/books').query({ q: 'Pausable' })).body.total, 0);
  await owner.agent.patch(`/api/books/${book._id}/status`).send({ status: 'active' }).expect(200);
  assert.equal((await request(app).get('/api/books').query({ q: 'Pausable' })).body.total, 1);
  await owner.agent.delete(`/api/books/${book._id}`).expect(200);
  assert.equal((await owner.agent.get('/api/books/mine')).body.items.some((b) => b._id === book._id), false);
  await owner.agent.delete(`/api/books/${book._id}`).expect(409);
});

test('wishlist: add is idempotent, shows sold and removed listings as such, remove works', async () => {
  const seller = await member();
  const buyer = await member();
  const a = await listing(seller, { title: 'Wish A' });
  const b = await listing(seller, { title: 'Wish B' });
  await request(app).post('/api/wishlist').send({ bookId: a._id }).expect(401);
  await buyer.agent.post('/api/wishlist').send({ bookId: a._id }).expect(201);
  await buyer.agent.post('/api/wishlist').send({ bookId: a._id }).expect(201);
  await buyer.agent.post('/api/wishlist').send({ bookId: b._id }).expect(201);
  assert.equal((await buyer.agent.get('/api/wishlist')).body.items.length, 2);
  assert.equal((await buyer.agent.get(`/api/books/${a._id}`)).body.wishlisted, true);
  await seller.agent.delete(`/api/books/${b._id}`).expect(200);
  const items = (await buyer.agent.get('/api/wishlist')).body.items;
  const removed = items.find((i) => i._id === b._id);
  assert.equal(removed.status, 'unavailable');
  assert.equal(removed.price, undefined);
  await buyer.agent.delete(`/api/wishlist/${a._id}`).expect(200);
  assert.equal((await buyer.agent.get('/api/wishlist')).body.items.length, 1);
  const notes = (await buyer.agent.get('/api/notifications')).body.items;
  assert.ok(notes.some((n) => n.message.includes('Wish B')));
});

test('public profile exposes no email or secrets', async () => {
  const m = await member('faculty', { designation: 'Professor' });
  await listing(m);
  const res = await request(app).get(`/api/users/${m.id}`).expect(200);
  assert.equal(res.body.user.email, undefined);
  assert.equal(res.body.user.passwordHash, undefined);
  assert.equal(res.body.user.designation, 'Professor');
  assert.equal(res.body.listings.length, 1);
});
