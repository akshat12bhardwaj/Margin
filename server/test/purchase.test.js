import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { app, listing, member, request, setupDb, teardownDb } from './helpers.js';
import { PurchaseRequest } from '../src/models/PurchaseRequest.js';

before(setupDb);
after(teardownDb);

const status = async (agent, id) => (await agent.get(`/api/books/${id}`)).body.book.status;

test('full workflow: request, accept, coordinate, sold, history, notifications', async () => {
  const seller = await member('faculty');
  const buyer = await member();
  const loser = await member();
  const book = await listing(seller, { price: '250' });

  const req1 = (await buyer.agent.post('/api/requests').send({ bookId: book._id, message: 'Can I buy it?' }).expect(201)).body.request;
  assert.equal(req1.status, 'pending');
  assert.equal(req1.price, 250);
  const req2 = (await loser.agent.post('/api/requests').send({ bookId: book._id }).expect(201)).body.request;

  const sellerNotes = (await seller.agent.get('/api/notifications')).body.items;
  assert.ok(sellerNotes.some((n) => n.message.includes('wants to buy')));
  assert.equal((await seller.agent.get('/api/requests').query({ side: 'selling' })).body.items.length, 2);

  await buyer.agent.patch(`/api/requests/${req1._id}/accept`).send({}).expect(403);
  await seller.agent.patch(`/api/requests/${req1._id}/accept`).send({}).expect(200);
  assert.equal(await status(request(app), book._id), 'reserved');
  await seller.agent.patch(`/api/requests/${req2._id}/accept`).send({}).expect(409);
  const third = await member();
  await third.agent.post('/api/requests').send({ bookId: book._id }).expect(409);
  assert.ok((await buyer.agent.get('/api/notifications')).body.items.some((n) => n.message.includes('accepted')));
  await seller.agent.delete(`/api/books/${book._id}`).expect(409);

  await buyer.agent.patch(`/api/requests/${req1._id}/complete`).send({}).expect(403);
  await seller.agent.patch(`/api/requests/${req1._id}/complete`).send({}).expect(200);
  assert.equal(await status(request(app), book._id), 'sold');

  const losing = (await loser.agent.get('/api/requests').query({ side: 'buying', state: 'closed' })).body.items[0];
  assert.equal(losing.status, 'cancelled');
  const closed = (await buyer.agent.get('/api/requests').query({ side: 'buying', state: 'closed' })).body.items[0];
  assert.equal(closed.status, 'completed');
  assert.deepEqual(closed.history.map((h) => h.status), ['pending', 'accepted', 'completed']);
  assert.equal((await seller.agent.get('/api/requests').query({ side: 'selling', state: 'closed' })).body.items.filter((r) => r.status === 'completed').length, 1);
  await seller.agent.patch(`/api/requests/${req1._id}/complete`).send({}).expect(409);
  assert.equal((await request(app).get('/api/books').query({ q: book.title })).body.items.some((b) => b._id === book._id), false);
});

test('duplicate and self requests are refused, including under a race', async () => {
  const seller = await member();
  const buyer = await member();
  const book = await listing(seller);
  await seller.agent.post('/api/requests').send({ bookId: book._id }).expect(400);
  const results = await Promise.all(Array.from({ length: 5 }, () => buyer.agent.post('/api/requests').send({ bookId: book._id })));
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.ok(results.every((r) => r.status === 201 || r.status === 409));
});

test('concurrent accepts of different buyers: exactly one wins', async () => {
  const seller = await member();
  const book = await listing(seller);
  const buyers = await Promise.all(Array.from({ length: 5 }, () => member()));
  const requests = [];
  for (const b of buyers) requests.push((await b.agent.post('/api/requests').send({ bookId: book._id }).expect(201)).body.request);
  const results = await Promise.all(requests.map((r) => seller.agent.patch(`/api/requests/${r._id}/accept`).send({})));
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal(results.filter((r) => r.status === 409).length, 4);
  assert.equal(await PurchaseRequest.countDocuments({ book: book._id, status: 'accepted' }), 1);
});

test('the database itself refuses a second winning buyer', async () => {
  const seller = await member();
  const a = await member();
  const b = await member();
  const book = await listing(seller);
  const base = { book: book._id, seller: seller.id, price: 1, status: 'accepted' };
  await PurchaseRequest.create({ ...base, buyer: a.id });
  await assert.rejects(PurchaseRequest.create({ ...base, buyer: b.id }), /E11000/);
});

test('cancelling an accepted request frees the listing for the next buyer; rejected buyers may ask again', async () => {
  const seller = await member();
  const a = await member();
  const b = await member();
  const book = await listing(seller);
  const ra = (await a.agent.post('/api/requests').send({ bookId: book._id })).body.request;
  const rb = (await b.agent.post('/api/requests').send({ bookId: book._id })).body.request;
  await seller.agent.patch(`/api/requests/${ra._id}/accept`).send({}).expect(200);
  await a.agent.patch(`/api/requests/${ra._id}/cancel`).send({}).expect(200);
  assert.equal(await status(request(app), book._id), 'active');
  await seller.agent.patch(`/api/requests/${rb._id}/reject`).send({}).expect(200);
  await seller.agent.patch(`/api/requests/${rb._id}/accept`).send({}).expect(409);
  await b.agent.post('/api/requests').send({ bookId: book._id }).expect(201);
});

test('cancelling before acceptance leaves the book available', async () => {
  const seller = await member();
  const buyer = await member();
  const book = await listing(seller);
  const { body } = await buyer.agent.post('/api/requests').send({ bookId: book._id }).expect(201);
  const route = `/api/requests/${body.request._id}`;
  await buyer.agent.patch(`${route}/cancel`).send({}).expect(200);
  await seller.agent.patch(`${route}/accept`).send({}).expect(409);
  assert.equal(await status(request(app), book._id), 'active');
});

for (const first of ['cancel', 'accept']) {
  test(`overlapping acceptance and cancellation stay consistent when ${first} starts first`, async (t) => {
    const seller = await member();
    const buyer = await member();
    const book = await listing(seller);
    const { body } = await buyer.agent.post('/api/requests').send({ bookId: book._id }).expect(201);
    const route = `/api/requests/${body.request._id}`;
    const update = PurchaseRequest.findOneAndUpdate;
    const atWrite = Promise.withResolvers();
    const resume = Promise.withResolvers();
    const pausedStatus = first === 'cancel' ? 'cancelled' : 'accepted';
    // Hold the first write after its initial read while the other action commits.
    t.mock.method(PurchaseRequest, 'findOneAndUpdate', async function (filter, changes, options) {
      if (changes.status === pausedStatus) {
        atWrite.resolve();
        await resume.promise;
      }
      return update.call(this, filter, changes, options);
    });
    const accept = () => seller.agent.patch(`${route}/accept`).send({});
    const cancel = () => buyer.agent.patch(`${route}/cancel`).send({});
    const delayed = (first === 'cancel' ? cancel() : accept()).timeout(5000).then((res) => res);
    try {
      await Promise.race([atWrite.promise, delayed.then(() => assert.fail('The first action did not reach the write'))]);
      await (first === 'cancel' ? accept() : cancel()).expect(200);
    } finally {
      resume.resolve();
      assert.equal((await delayed).status, first === 'cancel' ? 200 : 409);
    }
    const saved = await PurchaseRequest.findById(body.request._id);
    assert.equal(saved.status, 'cancelled');
    assert.deepEqual(saved.history.map((event) => event.status), first === 'cancel'
      ? ['pending', 'accepted', 'cancelled'] : ['pending', 'cancelled']);
    assert.equal(await status(request(app), book._id), 'active');
  });
}

test('outsiders see 404 on request actions; complete requires an accepted request', async () => {
  const seller = await member();
  const buyer = await member();
  const outsider = await member();
  const book = await listing(seller);
  const r = (await buyer.agent.post('/api/requests').send({ bookId: book._id })).body.request;
  for (const a of ['accept', 'reject', 'cancel', 'complete']) await outsider.agent.patch(`/api/requests/${r._id}/${a}`).send({}).expect(404);
  await seller.agent.patch(`/api/requests/${r._id}/complete`).send({}).expect(409);
});

test('messaging: conversation flow, privacy, unread counts and notifications', async () => {
  const seller = await member();
  const buyer = await member();
  const outsider = await member();
  const book = await listing(seller);
  await seller.agent.post('/api/conversations').send({ bookId: book._id, message: 'hi me' }).expect(400);
  await buyer.agent.post('/api/conversations').send({ bookId: book._id, message: '   ' }).expect(400);
  const first = await buyer.agent.post('/api/conversations').send({ bookId: book._id, message: 'Is it available?' }).expect(201);
  const again = await buyer.agent.post('/api/conversations').send({ bookId: book._id, message: 'Hello?' }).expect(201);
  const id = first.body.conversation._id;
  assert.equal(again.body.conversation._id, id);

  assert.deepEqual((await seller.agent.get('/api/notifications/summary')).body, { notifications: 1, messages: 1 });
  const thread = (await seller.agent.get(`/api/conversations/${id}`).expect(200)).body;
  assert.deepEqual(thread.messages.map((m) => m.body), ['Is it available?', 'Hello?']);
  assert.deepEqual((await seller.agent.get('/api/notifications/summary')).body, { notifications: 0, messages: 0 });

  await seller.agent.post(`/api/conversations/${id}/messages`).send({ message: 'Yes it is' }).expect(201);
  assert.equal((await buyer.agent.get('/api/notifications/summary')).body.messages, 1);
  assert.equal((await buyer.agent.get('/api/conversations')).body.items[0].lastMessage, 'Yes it is');

  await outsider.agent.get(`/api/conversations/${id}`).expect(404);
  await outsider.agent.post(`/api/conversations/${id}/messages`).send({ message: 'sneak' }).expect(404);
  assert.equal((await outsider.agent.get('/api/conversations')).body.items.length, 0);
  await request(app).get(`/api/conversations/${id}`).expect(401);
});

test('notifications: mark one and all as read, cannot touch another user\'s', async () => {
  const seller = await member();
  const buyer = await member();
  const a = await listing(seller);
  const b = await listing(seller);
  await buyer.agent.post('/api/requests').send({ bookId: a._id });
  await buyer.agent.post('/api/requests').send({ bookId: b._id });
  const [n] = (await seller.agent.get('/api/notifications')).body.items;
  await buyer.agent.patch(`/api/notifications/${n._id}/read`).expect(404);
  await seller.agent.patch(`/api/notifications/${n._id}/read`).expect(200);
  assert.equal((await seller.agent.get('/api/notifications/summary')).body.notifications, 1);
  await seller.agent.patch('/api/notifications/read-all').expect(200);
  assert.equal((await seller.agent.get('/api/notifications/summary')).body.notifications, 0);
});

test('either party can open the chat for a request; outsiders cannot', async () => {
  const seller = await member();
  const buyer = await member();
  const outsider = await member();
  const book = await listing(seller);
  const r = (await buyer.agent.post('/api/requests').send({ bookId: book._id })).body.request;
  await outsider.agent.post(`/api/requests/${r._id}/conversation`).expect(404);
  const id = (await seller.agent.post(`/api/requests/${r._id}/conversation`).expect(200)).body.conversation._id;
  assert.equal((await buyer.agent.post(`/api/requests/${r._id}/conversation`).expect(200)).body.conversation._id, id);
  await seller.agent.post(`/api/conversations/${id}/messages`).send({ message: 'Meet at the library?' }).expect(201);
  // The request itself opened the thread with an offer card; the seller's reply follows it.
  const { messages } = (await buyer.agent.get(`/api/conversations/${id}`).expect(200)).body;
  assert.deepEqual(messages.map((m) => m.kind), ['offer', 'text']);
  assert.equal(messages.at(-1).body, 'Meet at the library?');
});
