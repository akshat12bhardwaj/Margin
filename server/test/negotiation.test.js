import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { app, listing, member, request, setupDb, teardownDb } from './helpers.js';

before(setupDb);
after(teardownDb);

const status = async (id) => (await request(app).get(`/api/books/${id}`)).body.book.status;

test('offer, counteroffer, accept at the agreed price, then sold; each step lands in the chat', async () => {
  const seller = await member();
  const buyer = await member();
  const book = await listing(seller, { title: 'Data Structures', price: '650' });

  const offer = (await buyer.agent.post('/api/requests').send({ bookId: book._id, offer: '500', message: 'Is the binding intact?' }).expect(201)).body.request;
  assert.equal(offer.price, 500);
  assert.equal(offer.listPrice, 650);
  assert.equal(offer.offerBy, 'buyer');

  // The buyer made the offer, so only the seller can answer it.
  await buyer.agent.patch(`/api/requests/${offer._id}/accept`).send({}).expect(403);
  await buyer.agent.patch(`/api/requests/${offer._id}/counter`).send({ amount: 450 }).expect(403);

  const countered = (await seller.agent.patch(`/api/requests/${offer._id}/counter`).send({ amount: 575, note: 'Binding is fine.' }).expect(200)).body.request;
  assert.equal(countered.price, 575);
  assert.equal(countered.offerBy, 'seller');
  await seller.agent.patch(`/api/requests/${offer._id}/accept`).send({}).expect(403);

  const accepted = (await buyer.agent.patch(`/api/requests/${offer._id}/accept`).send({}).expect(200)).body.request;
  assert.equal(accepted.status, 'accepted');
  assert.equal(accepted.price, 575);
  assert.equal(await status(book._id), 'reserved');
  assert.ok((await seller.agent.get('/api/notifications')).body.items.some((n) => n.message.includes('accepted your counteroffer of ₹575')));

  // Accepted terms are fixed.
  await seller.agent.patch(`/api/requests/${offer._id}/counter`).send({ amount: 600 }).expect(409);
  await buyer.agent.patch(`/api/requests/${offer._id}/reject`).send({}).expect(409);

  const done = (await seller.agent.patch(`/api/requests/${offer._id}/complete`).send({}).expect(200)).body.request;
  assert.equal(done.status, 'completed');
  assert.equal(done.price, 575);
  assert.equal(await status(book._id), 'sold');
  assert.deepEqual(done.history.map((h) => [h.status, h.amount]), [['pending', 500], ['countered', 575], ['accepted', 575], ['completed', 575]]);

  const { conversation } = (await buyer.agent.post(`/api/requests/${offer._id}/conversation`).expect(200)).body;
  const thread = (await seller.agent.get(`/api/conversations/${conversation._id}`).expect(200)).body;
  assert.deepEqual(
    thread.messages.map((m) => [m.kind, m.amount ?? null]),
    [['offer', 500], ['text', null], ['counter', 575], ['text', null], ['accepted', 575], ['completed', 575]],
  );
  assert.equal(thread.request.status, 'completed');
  assert.equal((await buyer.agent.get('/api/requests').query({ side: 'buying', state: 'closed' })).body.items[0].price, 575);
});

test('invalid amounts, outsiders and stale or duplicate actions are refused', async () => {
  const seller = await member();
  const buyer = await member();
  const outsider = await member();
  const book = await listing(seller, { price: '400' });

  await buyer.agent.post('/api/requests').send({ bookId: book._id, offer: '-5' }).expect(400);
  await buyer.agent.post('/api/requests').send({ bookId: book._id, offer: 'abc' }).expect(400);
  await buyer.agent.post('/api/requests').send({ bookId: book._id, offer: '12.5' }).expect(400);
  await buyer.agent.post('/api/requests').send({ bookId: book._id, offer: '401' }).expect(400);
  const r = (await buyer.agent.post('/api/requests').send({ bookId: book._id, offer: '300' }).expect(201)).body.request;
  await buyer.agent.post('/api/requests').send({ bookId: book._id, offer: '350' }).expect(409);

  await outsider.agent.patch(`/api/requests/${r._id}/counter`).send({ amount: 350 }).expect(404);
  await outsider.agent.patch(`/api/requests/${r._id}/accept`).send({}).expect(404);
  await seller.agent.patch(`/api/requests/${r._id}/counter`).send({ amount: -1 }).expect(400);
  await seller.agent.patch(`/api/requests/${r._id}/counter`).send({ amount: 500 }).expect(400);
  await seller.agent.patch(`/api/requests/${r._id}/counter`).send({ amount: 300 }).expect(400);

  // Two racing counters from the seller: only one changes the offer.
  const results = await Promise.all([350, 360].map((amount) => seller.agent.patch(`/api/requests/${r._id}/counter`).send({ amount })));
  const [won, lost] = results.map((x) => x.status).sort();
  assert.equal(won, 200);
  assert.ok([403, 409].includes(lost), `second counter got ${lost}`);

  // The buyer declines the counter; nothing more can happen to it.
  await buyer.agent.patch(`/api/requests/${r._id}/reject`).send({ note: 'Too much for me.' }).expect(200);
  await seller.agent.patch(`/api/requests/${r._id}/accept`).send({}).expect(409);
  await buyer.agent.patch(`/api/requests/${r._id}/counter`).send({ amount: 320 }).expect(409);
  assert.equal(await status(book._id), 'active');

  // A declined buyer may start again with a new offer.
  await buyer.agent.post('/api/requests').send({ bookId: book._id, offer: '320' }).expect(201);
});

test('the demo account switcher is gone', async () => {
  await request(app).get('/api/demo/accounts').expect(404);
  await request(app).post('/api/demo/switch').send({ userId: '0'.repeat(24) }).expect(404);
  assert.equal('demoMode' in (await request(app).get('/api/auth/me')).body, false);
});
