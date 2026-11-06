import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { listing, member, setupDb, teardownDb } from './helpers.js';
import { classify, decide, parseAmount, suggestionsFor } from '../src/lib/autoSeller.js';
import { Book } from '../src/models/Book.js';
import { Message } from '../src/models/Message.js';
import { PurchaseRequest } from '../src/models/PurchaseRequest.js';
import { UNIVERSITY, User } from '../src/models/User.js';

before(setupDb);
after(teardownDb);

let seq = 0;
// A fictional seller and example listing, as the seed script creates them.
async function scripted(price = 490) {
  const seller = await User.create({ name: 'Ananya Rao', email: `seller${++seq}@demo.invalid`, role: 'student', isDemo: true, isAutomatedSeller: true });
  const book = await Book.create({
    title: 'Data Communications and Networking', author: 'Behrouz A. Forouzan', subject: 'Computer Networks',
    university: UNIVERSITY, edition: '6th', publicationYear: 2022, price, condition: 'Acceptable', images: [], seller: seller._id, isDemo: true,
    description: 'Worn cover and highlighting throughout, but every page is intact. Listed as a textbook.',
  });
  return { seller, book };
}

// Sends a chat message and returns the seller's newest text reply.
async function chat(buyer, conversationId, message) {
  await buyer.agent.post(`/api/conversations/${conversationId}/messages`).send({ message }).expect(201);
  const { body } = await buyer.agent.get(`/api/conversations/${conversationId}`).expect(200);
  return { ...body, reply: body.messages.findLast((m) => m.kind === 'text' && m.sender !== buyer.id)?.body };
}

test('negotiation rules: accept near the price, decline far below, counter in between, always converging', () => {
  assert.deepEqual(decide(490, 490), { action: 'accept' });
  assert.deepEqual(decide(441, 490), { action: 'accept' });
  assert.deepEqual(decide(400, 490), { action: 'counter', amount: 450 });
  assert.deepEqual(decide(420, 490, 450), { action: 'counter', amount: 441 });
  assert.deepEqual(decide(450, 490, 450), { action: 'accept' });
  assert.deepEqual(decide(200, 490), { action: 'reject' });
  assert.deepEqual(decide(0, 0), { action: 'accept' });
});

test('amounts and intents are read conservatively', () => {
  assert.deepEqual(parseAmount('would you accept ₹400?'), { value: 400 });
  assert.deepEqual(parseAmount('i can pay rs. 1,200'), { value: 1200 });
  assert.deepEqual(parseAmount('how about 350 rupees'), { value: 350 });
  assert.deepEqual(parseAmount('would you take 300'), { value: 300 });
  assert.deepEqual(parseAmount('₹-50'), { invalid: true });
  assert.deepEqual(parseAmount('i offer -50'), { invalid: true });
  assert.equal(parseAmount('is it the 6th edition from 2022?'), null);
  const intents = {
    'Is this book still available?': 'availability',
    'Can you tell me more about its condition?': 'condition',
    'Would you consider a lower price?': 'discount',
    'What is your best price?': 'discount',
    'I accept your offer.': 'accept',
    "I don't accept that": 'unknown',
    'Could you reduce it a little more?': 'discount',
    "I'll think about it.": 'think',
    'When can we meet?': 'meetup',
    'Where should we exchange the book?': 'meetup',
    "Thank you, I'll confirm the exchange.": 'confirm',
    "I've collected the book. Thank you!": 'collected',
    "I haven't received it yet": 'unknown',
    'Which edition is it?': 'edition',
    'Hello!': 'greeting',
    'The weather is nice': 'unknown',
  };
  for (const [text, intent] of Object.entries(intents)) assert.equal(classify(text).intent, intent, text);
});

test('suggestions follow the conversation stage and the real listing price', () => {
  const book = { price: 490, status: 'active' };
  const buyer = 'b';
  assert.deepEqual(suggestionsFor(book, null, [], buyer), ['Is this book still available?', 'Can you tell me more about its condition?', 'Would you consider a lower price?']);
  const asked = [{ kind: 'text', sender: buyer, body: 'Would you consider a lower price?' }];
  assert.deepEqual(suggestionsFor(book, null, asked, buyer), ['Would you accept ₹400?', 'Can we settle at ₹450?', 'What is your best price?']);
  assert.deepEqual(suggestionsFor({ price: 1000, status: 'active' }, null, asked, buyer), ['Would you accept ₹820?', 'Can we settle at ₹900?', 'What is your best price?']);
  assert.equal(suggestionsFor(book, { status: 'pending', offerBy: 'seller', price: 450 }, asked, buyer)[0], 'I accept your offer.');
  assert.equal(suggestionsFor(book, { status: 'accepted', price: 450 }, [], buyer)[0], 'When can we meet?');
  assert.equal(suggestionsFor(book, { status: 'completed', price: 450 }, [], buyer)[0], 'Thanks again!');
});

test('a real member chats and negotiates with an automated seller, through to a completed sale', async () => {
  const { book, seller } = await scripted(490);
  const buyer = await member();
  assert.equal((await buyer.agent.get(`/api/books/${book._id}`).expect(200)).body.book.seller.isAutomatedSeller, true);

  // Contact seller opens an empty thread with three suggestions; nothing is sent until the buyer chooses.
  const { conversation } = (await buyer.agent.post('/api/conversations').send({ bookId: book._id }).expect(201)).body;
  let thread = (await buyer.agent.get(`/api/conversations/${conversation._id}`).expect(200)).body;
  assert.equal(thread.messages.length, 0);
  assert.equal(thread.suggestions.length, 3);
  assert.equal(thread.conversation.seller.isAutomatedSeller, true);

  thread = await chat(buyer, conversation._id, thread.suggestions[0]);
  assert.equal(thread.reply, "Yes, it's still available. Are you interested in buying it?");
  const saved = await Message.find({ conversation: conversation._id }).sort({ createdAt: 1, _id: 1 });
  assert.deepEqual(saved.map((m) => String(m.sender)), [buyer.id, String(seller._id)]);

  assert.match((await chat(buyer, conversation._id, 'Hey, do you still have this one?')).reply, /still available/);
  assert.match((await chat(buyer, conversation._id, 'Can you tell me more about its condition?')).reply, /acceptable condition\. Worn cover/);
  assert.match((await chat(buyer, conversation._id, 'Which edition is it?')).reply, /6th edition, published in 2022/);
  thread = await chat(buyer, conversation._id, 'The weather is lovely today');
  assert.match(thread.reply, /didn't quite follow|not sure I understood/);
  assert.equal(await PurchaseRequest.countDocuments({ book: book._id }), 0);

  thread = await chat(buyer, conversation._id, 'Would you consider a lower price?');
  assert.equal(thread.reply, 'I can negotiate a little. What price did you have in mind?');
  assert.deepEqual(thread.suggestions, ['Would you accept ₹400?', 'Can we settle at ₹450?', 'What is your best price?']);

  thread = await chat(buyer, conversation._id, 'Would you accept ₹400?');
  assert.equal(thread.reply, 'I can offer it for ₹450.');
  assert.equal(thread.request.status, 'pending');
  assert.equal(thread.request.offerBy, 'seller');
  assert.equal(thread.request.price, 450);
  assert.equal(thread.suggestions[0], 'I accept your offer.');

  thread = await chat(buyer, conversation._id, 'I accept your offer.');
  assert.equal(thread.reply, "Great! We've agreed on ₹450. We can now arrange the exchange.");
  assert.equal(thread.request.status, 'accepted');
  assert.equal((await Book.findById(book._id)).status, 'reserved');
  assert.equal(thread.suggestions[0], 'When can we meet?');

  thread = await chat(buyer, conversation._id, 'When can we meet?');
  assert.match(thread.reply, /near the .* Please bring ₹450/);
  assert.equal(thread.suggestions[0], "I've collected the book. Thank you!");
  assert.match((await chat(buyer, conversation._id, 'Can we meet at a different time?')).reply, /works too, same place/);
  assert.match((await chat(buyer, conversation._id, 'Where exactly should I wait?')).reply, /Message me here when you arrive/);

  thread = await chat(buyer, conversation._id, "I've collected the book. Thank you!");
  assert.match(thread.reply, /marked the book as sold/);
  const done = await PurchaseRequest.findOne({ book: book._id });
  assert.equal(done.status, 'completed');
  assert.equal(done.price, 450);
  assert.deepEqual(done.history.map((h) => [h.status, h.amount]), [['pending', 400], ['countered', 450], ['accepted', 450], ['completed', 450]]);
  assert.equal((await Book.findById(book._id)).status, 'sold');
  assert.deepEqual((await Message.find({ conversation: conversation._id, kind: { $ne: 'text' } }).sort({ createdAt: 1, _id: 1 })).map((m) => m.kind), ['offer', 'counter', 'accepted', 'completed']);
  const history = (await buyer.agent.get('/api/requests').query({ state: 'closed' }).expect(200)).body.items;
  assert.equal(history[0].status, 'completed');

  // A completed sale cannot be reopened or changed, by chat or by the API.
  await buyer.agent.patch(`/api/requests/${done._id}/cancel`).send({}).expect(409);
  assert.match((await chat(buyer, conversation._id, 'I will pay ₹100')).reply, /already have it/);
  assert.equal(await PurchaseRequest.countDocuments({ book: book._id }), 1);
});

test('offers made with the buttons are answered by the same rules', async () => {
  const buyer = await member();

  const low = await scripted(490);
  const rejected = (await buyer.agent.post('/api/requests').send({ bookId: low.book._id, offer: 200 }).expect(201)).body.request;
  assert.equal((await PurchaseRequest.findById(rejected._id)).status, 'rejected');
  assert.equal((await Book.findById(low.book._id)).status, 'active');
  // Declined requests can be followed by a better offer, which is accepted near the price.
  await buyer.agent.post('/api/requests').send({ bookId: low.book._id, offer: 470 }).expect(201);
  assert.equal((await PurchaseRequest.findOne({ book: low.book._id, status: 'accepted' })).price, 470);

  const { book } = await scripted(490);
  const r = (await buyer.agent.post('/api/requests').send({ bookId: book._id, offer: 380 }).expect(201)).body.request;
  let current = await PurchaseRequest.findById(r._id);
  assert.deepEqual([current.offerBy, current.price], ['seller', 441]);
  await buyer.agent.patch(`/api/requests/${r._id}/counter`).send({ amount: 420 }).expect(200);
  current = await PurchaseRequest.findById(r._id);
  assert.deepEqual([current.offerBy, current.price], ['seller', 441]);
  const { conversation } = (await buyer.agent.post(`/api/requests/${r._id}/conversation`).expect(200)).body;
  assert.equal((await Message.findOne({ conversation: conversation._id, kind: 'text' }).sort({ createdAt: -1, _id: -1 })).body, '₹441 is my final price.');
  await buyer.agent.patch(`/api/requests/${r._id}/accept`).send({}).expect(200);
  assert.equal((await PurchaseRequest.findById(r._id)).status, 'accepted');
  assert.equal((await Book.findById(book._id)).status, 'reserved');
  // Only the turn-holder may act: the buyer cannot accept again or complete for the seller.
  await buyer.agent.patch(`/api/requests/${r._id}/accept`).send({}).expect(409);
  await buyer.agent.patch(`/api/requests/${r._id}/complete`).send({}).expect(403);

  // Asking for a little more off lowers the seller's own standing counter, never below the lowest price.
  const third = await scripted(490);
  const t = (await buyer.agent.post('/api/requests').send({ bookId: third.book._id, offer: 400 }).expect(201)).body.request;
  const thread = await chat(buyer, (await buyer.agent.post(`/api/requests/${t._id}/conversation`)).body.conversation._id, 'Could you reduce it a little more?');
  assert.equal(thread.reply, 'Alright, ₹441 is the lowest I can go.');
  assert.deepEqual([thread.request.offerBy, thread.request.price], ['seller', 441]);
});

test('conversations between real members get no automated replies', async () => {
  const seller = await member();
  const buyer = await member();
  const book = await listing(seller);
  await buyer.agent.post('/api/conversations').send({ bookId: book._id }).expect(400);
  const { conversation } = (await buyer.agent.post('/api/conversations').send({ bookId: book._id, message: 'Is this book still available?' }).expect(201)).body;
  await buyer.agent.post(`/api/conversations/${conversation._id}/messages`).send({ message: 'Would you accept ₹400?' }).expect(201);
  const thread = (await buyer.agent.get(`/api/conversations/${conversation._id}`).expect(200)).body;
  assert.equal(thread.messages.length, 2);
  assert.ok(thread.messages.every((m) => m.sender === buyer.id));
  assert.deepEqual(thread.suggestions, []);
  assert.equal(await PurchaseRequest.countDocuments({ book: book._id }), 0);
  // The real seller replies normally.
  await seller.agent.post(`/api/conversations/${conversation._id}/messages`).send({ message: 'Yes it is.' }).expect(201);
  assert.equal((await buyer.agent.get(`/api/conversations/${conversation._id}`)).body.messages.at(-1).body, 'Yes it is.');
});

test('security: private threads, no self-promotion to automated seller, invalid offers refused', async () => {
  const { book } = await scripted(490);
  const buyer = await member();
  const other = await member();
  const { conversation } = (await buyer.agent.post('/api/conversations').send({ bookId: book._id, message: 'Hello!' }).expect(201)).body;
  await other.agent.get(`/api/conversations/${conversation._id}`).expect(404);
  await other.agent.post(`/api/conversations/${conversation._id}/messages`).send({ message: 'I accept your offer.' }).expect(404);
  assert.ok((await other.agent.get('/api/conversations')).body.items.every((c) => c._id !== conversation._id));

  // The flag cannot be set through the API, and a seller id in the body is ignored.
  await other.agent.patch('/api/users/me').send({ name: 'Other', isAutomatedSeller: true, isDemo: true }).expect(200);
  const stored = await User.findById(other.id);
  assert.equal(stored.isAutomatedSeller, false);
  assert.equal(stored.isDemo, false);
  const own = await listing(other);
  const c2 = (await buyer.agent.post('/api/conversations').send({ bookId: own._id, seller: book.seller, message: 'Hi' }).expect(201)).body.conversation;
  assert.equal(c2.seller, other.id);
  assert.equal((await buyer.agent.get(`/api/conversations/${c2._id}`)).body.messages.length, 1);

  assert.match((await chat(buyer, conversation._id, 'I offer ₹-50')).reply, /valid amount/);
  assert.match((await chat(buyer, conversation._id, 'Would you accept ₹900?')).reply, /No need to go above the listed ₹490/);
  await buyer.agent.post('/api/requests').send({ bookId: book._id, offer: -5 }).expect(400);
  await buyer.agent.post('/api/requests').send({ bookId: book._id, offer: 900 }).expect(400);
  assert.equal(await PurchaseRequest.countDocuments({ book: book._id }), 0);
  // Fictional sellers cannot sign in.
  await buyer.agent.post('/api/auth/login').send({ email: (await User.findById(book.seller)).email, password: 'password123' }).expect(401);
});
