import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { admin, app, LISTING, listing, member, PNG, request, setupDb, teardownDb } from './helpers.js';

before(setupDb);
after(teardownDb);

const reportOf = (agent, targetType, targetId, extra = {}) =>
  agent.post('/api/reports').send({ targetType, targetId, category: 'scam_fraud', description: 'This looks like a scam to me.', ...extra });

test('reporting: flags the listing, blocks duplicates and self-reports, ignores forged status', async () => {
  const seller = await member();
  const reporter = await member();
  const a = await admin();
  const book = await listing(seller);
  await request(app).post('/api/reports').send({ targetType: 'book', targetId: book._id, category: 'other', description: 'anonymous report' }).expect(401);
  await reportOf(seller.agent, 'book', book._id).expect(400);
  await reportOf(seller.agent, 'user', seller.id).expect(400);
  await reportOf(reporter.agent, 'book', book._id, { category: 'nonsense' }).expect(400);
  await reportOf(reporter.agent, 'book', book._id, { description: 'short' }).expect(400);
  const res = await reportOf(reporter.agent, 'book', book._id, { status: 'resolved', decision: 'I win' }).expect(201);
  assert.equal(res.body.report.status, 'pending');
  await reportOf(reporter.agent, 'book', book._id).expect(409);
  await reportOf(reporter.agent, 'user', seller.id).expect(201);
  await reportOf(reporter.agent, 'user', a.id).expect(404);

  const flagged = (await a.agent.get('/api/admin/books').query({ flagged: 'true' })).body.items;
  assert.ok(flagged.some((b) => b._id === book._id));
  // Members have no route for changing reports.
  await reporter.agent.patch(`/api/admin/reports/${res.body.report._id}`).send({ status: 'rejected', decision: 'nope' }).expect(403);
});

test('report handling: status flow, decision required, final once closed, parties notified, audited', async () => {
  const seller = await member();
  const reporter = await member();
  const a = await admin();
  const book = await listing(seller);
  const id = (await reportOf(reporter.agent, 'book', book._id)).body.report._id;

  await a.agent.patch(`/api/admin/reports/${id}`).send({ status: 'under_review' }).expect(200);
  await a.agent.patch(`/api/admin/reports/${id}`).send({ status: 'resolved' }).expect(400);
  await a.agent.patch(`/api/admin/reports/${id}`).send({ status: 'pending' }).expect(400);
  await a.agent.patch(`/api/admin/reports/${id}`).send({ status: 'resolved', decision: 'Confirmed fake copy.' }).expect(200);
  await a.agent.patch(`/api/admin/reports/${id}`).send({ status: 'rejected', decision: 'Changed my mind.' }).expect(409);

  const listed = (await a.agent.get('/api/admin/reports').query({ status: 'resolved' })).body.items.find((r) => r._id === id);
  assert.equal(listed.decision, 'Confirmed fake copy.');
  assert.ok(listed.decidedBy.name);
  assert.ok((await reporter.agent.get('/api/notifications')).body.items.some((n) => n.message.includes('Confirmed fake copy')));
  assert.ok((await seller.agent.get('/api/notifications')).body.items.some((n) => n.message.includes('upheld')));
  assert.equal((await a.agent.get(`/api/admin/books/${book._id}`)).body.book.flagged, false);
  const log = (await a.agent.get('/api/admin/audit-logs')).body.items.map((l) => l.action);
  assert.ok(log.includes('report.resolved') && log.includes('report.under_review'));
});

test('listing moderation: hide, restore, remove; open deals are cancelled; reason required', async () => {
  const seller = await member();
  const buyer = await member();
  const a = await admin();
  const book = await listing(seller, { title: 'Moderated Book' });
  const r = (await buyer.agent.post('/api/requests').send({ bookId: book._id })).body.request;
  await seller.agent.patch(`/api/requests/${r._id}/accept`).send({}).expect(200);

  await a.agent.patch(`/api/admin/books/${book._id}/hide`).send({}).expect(400);
  await a.agent.patch(`/api/admin/books/${book._id}/hide`).send({ reason: 'Looks suspicious' }).expect(200);
  await request(app).get(`/api/books/${book._id}`).expect(404);
  await seller.agent.get(`/api/books/${book._id}`).expect(200);
  assert.equal((await request(app).get('/api/books').query({ q: 'Moderated Book' })).body.total, 0);
  assert.equal((await buyer.agent.get('/api/requests').query({ state: 'closed' })).body.items[0].status, 'cancelled');
  assert.ok((await seller.agent.get('/api/notifications')).body.items.some((n) => n.message.includes('Looks suspicious')));

  // Sellers cannot undo moderation.
  await seller.agent.patch(`/api/books/${book._id}/status`).send({ status: 'active' }).expect(409);
  await seller.agent.delete(`/api/books/${book._id}`).expect(409);
  await seller.agent.patch(`/api/books/${book._id}`).field({ ...LISTING, keepImages: book.images[0].url }).expect(409);

  await a.agent.patch(`/api/admin/books/${book._id}/restore`).send({ reason: 'False alarm' }).expect(200);
  assert.equal((await request(app).get(`/api/books/${book._id}`).expect(200)).body.book.status, 'active');

  await a.agent.patch(`/api/admin/books/${book._id}/remove`).send({ reason: 'Counterfeit' }).expect(200);
  await request(app).get(`/api/books/${book._id}`).expect(404);
  const history = (await a.agent.get(`/api/admin/books/${book._id}`)).body;
  assert.deepEqual(history.actions.map((x) => x.action).sort(), ['book.hide', 'book.remove', 'book.restore']);
  assert.equal(history.requests.length, 1);
});

test('restore clears a wrongly flagged but still active listing', async () => {
  const seller = await member();
  const reporter = await member();
  const a = await admin();
  const book = await listing(seller);
  await a.agent.patch(`/api/admin/books/${book._id}/restore`).send({ reason: 'Nothing to restore' }).expect(409);
  await reportOf(reporter.agent, 'book', book._id).expect(201);
  const res = await a.agent.patch(`/api/admin/books/${book._id}/restore`).send({ reason: 'Wrongly flagged' }).expect(200);
  assert.equal(res.body.book.flagged, false);
  assert.equal(res.body.book.status, 'active');
});

test('suspension: immediate, blocks actions but not reading, hides listings, restore brings them back', async () => {
  const seller = await member();
  const buyer = await member();
  const a = await admin();
  const live = await listing(seller, { title: 'Live Listing' });
  const paused = await listing(seller, { title: 'Paused Listing' });
  await seller.agent.patch(`/api/books/${paused._id}/status`).send({ status: 'inactive' }).expect(200);
  const r = (await buyer.agent.post('/api/requests').send({ bookId: live._id })).body.request;
  const c = (await buyer.agent.post('/api/conversations').send({ bookId: live._id, message: 'hello' })).body.conversation;

  await a.agent.patch(`/api/admin/users/${seller.id}/suspend`).send({ reason: 'Repeated fraud' }).expect(200);
  await a.agent.patch(`/api/admin/users/${seller.id}/suspend`).send({ reason: 'Repeated fraud' }).expect(409);

  // The seller's existing token now fails the moment they try to act.
  const denied = await seller.agent.post('/api/books').field(LISTING).attach('images', PNG, { filename: 'a.png', contentType: 'image/png' }).expect(403);
  assert.match(denied.body.error, /Repeated fraud/);
  await seller.agent.patch(`/api/requests/${r._id}/accept`).send({}).expect(403);
  await seller.agent.post(`/api/conversations/${c._id}/messages`).send({ message: 'hi' }).expect(403);
  await seller.agent.patch('/api/users/me').send({ name: 'New Name', university: 'X University' }).expect(403);
  await seller.agent.post('/api/wishlist').send({ bookId: live._id }).expect(403);
  await seller.agent.get('/api/conversations').expect(200);
  assert.equal((await seller.agent.get('/api/auth/me')).body.user.status, 'suspended');

  await request(app).get(`/api/books/${live._id}`).expect(404);
  await buyer.agent.post('/api/requests').send({ bookId: live._id }).expect(404);
  assert.equal((await buyer.agent.get('/api/requests').query({ state: 'closed' })).body.items[0].status, 'cancelled');

  await a.agent.patch(`/api/admin/books/${live._id}/restore`).send({ reason: 'Should fail' }).expect(409);
  await a.agent.patch(`/api/admin/users/${seller.id}/restore`).send({ reason: 'Appeal accepted' }).expect(200);
  await seller.agent.patch(`/api/books/${live._id}/status`).send({ status: 'active' }).expect(200);
  assert.equal((await request(app).get(`/api/books/${live._id}`).expect(200)).body.book.status, 'active');
  // A listing the seller had paused stays paused.
  assert.equal((await seller.agent.get(`/api/books/${paused._id}`).expect(200)).body.book.status, 'inactive');
  assert.ok((await seller.agent.get('/api/notifications')).body.items.some((n) => n.message.includes('Appeal accepted')));
});

test('deactivation ends sessions and blocks login', async () => {
  const m = await member();
  const a = await admin();
  await a.agent.patch(`/api/admin/users/${m.id}/deactivate`).send({ reason: 'Abandoned spam account' }).expect(200);
  await m.agent.get('/api/users/me/dashboard').expect(401);
  await request(app).post('/api/auth/login').send({ email: m.email, password: 'password123' }).expect(403);
  await request(app).get(`/api/users/${m.id}`).expect(404);
  await a.agent.patch(`/api/admin/users/${m.id}/restore`).send({ reason: 'Owner confirmed' }).expect(200);
  await request(app).post('/api/auth/login').send({ email: m.email, password: 'password123' }).expect(200);
});

test('admins cannot be moderated, and do not trade', async () => {
  const seller = await member();
  const a = await admin();
  const b = await admin();
  await a.agent.patch(`/api/admin/users/${b.id}/suspend`).send({ reason: 'Palace coup' }).expect(403);
  await a.agent.patch(`/api/admin/users/${a.id}/deactivate`).send({ reason: 'Oops, myself' }).expect(403);
  const book = await listing(seller);
  await a.agent.post('/api/requests').send({ bookId: book._id }).expect(403);
  await a.agent.post('/api/wishlist').send({ bookId: book._id }).expect(403);
});

test('dashboard stats and repeat offender tracking use real data', async () => {
  const offender = await member();
  const r1 = await member();
  const r2 = await member();
  const a = await admin();
  const book = await listing(offender);
  const id1 = (await reportOf(r1.agent, 'user', offender.id).expect(201)).body.report._id;
  const id2 = (await reportOf(r2.agent, 'book', book._id).expect(201)).body.report._id;

  let stats = (await a.agent.get('/api/admin/stats').expect(200)).body;
  assert.equal(stats.totalUsers, stats.students + stats.faculty);
  assert.ok(stats.suspicious.multipleOpenReports.some((x) => x.user._id === offender.id && x.count === 2));
  assert.ok(stats.reportedListings >= 1 && stats.reportedUsers >= 1 && stats.openReports >= 2);

  await a.agent.patch(`/api/admin/reports/${id1}`).send({ status: 'resolved', decision: 'Confirmed one.' }).expect(200);
  await a.agent.patch(`/api/admin/reports/${id2}`).send({ status: 'resolved', decision: 'Confirmed two.' }).expect(200);
  stats = (await a.agent.get('/api/admin/stats')).body;
  assert.ok(stats.suspicious.repeatOffenders.some((x) => x.user._id === offender.id && x.count === 2));
  const found = (await a.agent.get('/api/admin/users').query({ q: offender.email })).body.items[0];
  assert.equal(found.repeatOffender, true);
  assert.equal(found.passwordHash, undefined);
  const detail = (await a.agent.get(`/api/admin/users/${offender.id}`).expect(200)).body;
  assert.equal(detail.reportsAgainst.length, 2);
  assert.equal(detail.user.passwordHash, undefined);
});

test('admin user filters', async () => {
  const f = await member('faculty');
  const a = await admin();
  const res = (await a.agent.get('/api/admin/users').query({ role: 'faculty', status: 'active', limit: 48 })).body;
  assert.ok(res.items.some((u) => u._id === f.id));
  assert.ok(res.items.every((u) => u.role === 'faculty'));
  await a.agent.get('/api/admin/users').query({ role: 'king' }).expect(400);
});
