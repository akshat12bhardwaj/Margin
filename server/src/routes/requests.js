import { Router } from 'express';
import { z } from 'zod';
import { afterBuyerAction } from '../lib/autoSeller.js';
import { HttpError, notFound, rupees } from '../lib/http.js';
import { conversationFor, postEvent } from '../lib/messages.js';
import { notify } from '../lib/notify.js';
import { cancelOpenRequests } from '../lib/requests.js';
import { idParams, objectId, optional } from '../lib/schemas.js';
import { requireAuth, requireMember } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Book, PUBLIC_BOOK_STATUSES } from '../models/Book.js';
import { OPEN_REQUEST_STATUSES, PurchaseRequest } from '../models/PurchaseRequest.js';

const CLOSED = ['rejected', 'cancelled', 'completed'];
const POPULATE = [
  { path: 'book', select: 'title author price edition condition images status subject' },
  { path: 'buyer', select: 'name role university' },
  { path: 'seller', select: 'name role university' },
];
const note = z.string().trim().max(500).default('');
const noteBody = z.object({ note });
const amount = z.coerce.number('Enter an amount').int('Use whole rupees').min(0, 'An offer cannot be negative').max(10_000_000);

export const requestsRouter = Router();

// Opens a buyer's request, from the book page, the chat "Make an offer" button, or an offer typed to an automated seller.
export async function createRequest(book, buyer, offer = book.price, message = '') {
  if (book.seller.equals(buyer._id)) throw new HttpError(400, 'You cannot request your own listing');
  if (book.status !== 'active') throw new HttpError(409, 'This book is no longer available');
  if (offer > book.price) throw new HttpError(400, `Offer at most the listed price of ${rupees(book.price)}`);
  if (await PurchaseRequest.exists({ book: book._id, buyer: buyer._id, status: { $in: OPEN_REQUEST_STATUSES } })) {
    throw new HttpError(409, 'You already have an open request for this book');
  }
  const request = await PurchaseRequest.create({
    book: book._id,
    buyer: buyer._id,
    seller: book.seller,
    price: offer,
    listPrice: book.price,
    offerBy: 'buyer',
    isDemo: book.isDemo,
    message,
    history: [{ status: 'pending', by: buyer._id, amount: offer }],
  });
  const text = offer === book.price ? `Asked to buy at the listed price of ${rupees(offer)}` : `Offered ${rupees(offer)}`;
  await postEvent(request, buyer, 'offer', text, message);
  const what = offer === book.price ? 'wants to buy' : `offered ${rupees(offer)} for`;
  await notify(book.seller, 'request', `${buyer.name} ${what} "${book.title}".`, '/requests?side=selling');
  return request;
}

requestsRouter.post(
  '/',
  requireMember,
  validate({ body: z.object({ bookId: objectId, message: z.string().trim().max(1000).default(''), offer: optional(amount) }) }),
  async (req, res) => {
    const book = await Book.findById(req.data.bookId);
    if (!book || !PUBLIC_BOOK_STATUSES.includes(book.status)) throw notFound('Listing');
    const request = await createRequest(book, req.user, req.data.offer ?? book.price, req.data.message);
    await afterBuyerAction(request, req.user, 'offer');
    res.status(201).json({ request });
  },
);

requestsRouter.get(
  '/',
  requireAuth,
  validate({ query: z.object({ side: z.enum(['buying', 'selling']).default('buying'), state: z.enum(['open', 'closed']).default('open') }) }),
  async (req, res) => {
    const { side, state } = req.data;
    const items = await PurchaseRequest.find({
      [side === 'buying' ? 'buyer' : 'seller']: req.user._id,
      status: { $in: state === 'open' ? OPEN_REQUEST_STATUSES : CLOSED },
    })
      .sort({ updatedAt: -1 })
      .limit(200)
      .populate(POPULATE);
    res.json({ items });
  },
);

// Compare-and-set: the filter pins status (and, for offers, whose turn and the amount), so of two racing actions only one wins.
function transition(request, filter, to, by, note, set = {}) {
  return PurchaseRequest.findOneAndUpdate(
    { _id: request._id, ...filter },
    { status: to, ...set, $push: { history: { status: to, by, note, amount: set.price ?? request.price } } },
    { returnDocument: 'after' },
  );
}

const roleOf = (request, me) => (request.buyer.equals(me) ? 'buyer' : 'seller');
const otherParty = (request, me) => (request.buyer.equals(me) ? request.seller : request.buyer);
// The offer on the table, unchanged since it was read.
const openOffer = (request) => ({ status: 'pending', offerBy: request.offerBy, price: request.price });

// Handlers by name, so an automated seller (lib/autoSeller.js) goes through exactly the same checks and updates.
export const ACTIONS = {};

const action = (name, who, handler, body = noteBody) => {
  ACTIONS[name] = handler;
  requestsRouter.patch(`/:id/${name}`, requireMember, validate({ params: idParams, body }), async (req, res) => {
    const request = await PurchaseRequest.findById(req.data.id).populate('book', 'title');
    const me = req.user._id;
    if (!request || !(request.buyer.equals(me) || request.seller.equals(me))) throw notFound('Request');
    if (who === 'seller' && !request.seller.equals(me)) throw new HttpError(403, 'Only the seller can do this');
    // Whoever made the current offer waits for the other party to answer it.
    if (who === 'responder' && request.status === 'pending' && request.offerBy === roleOf(request, me)) {
      throw new HttpError(403, 'Waiting for the other person to respond to your offer');
    }
    const updated = await handler(request, req);
    if (request.buyer.equals(me)) await afterBuyerAction(updated, req.user, name);
    res.json({ request: updated });
  });
};

const invalid = (request) => new HttpError(409, `This request is already ${request.status}`);
const changed = () => new HttpError(409, 'This offer has changed. Please reload.');

action('accept', 'responder', async (request, req) => {
  if (request.status !== 'pending') throw invalid(request);
  // Reserve first: the listing can only leave "active" once, so a second accept stops here.
  const reserved = await Book.findOneAndUpdate({ _id: request.book._id, status: 'active' }, { status: 'reserved' });
  if (!reserved) throw new HttpError(409, 'This book is already reserved or no longer available');
  let updated;
  try {
    updated = await transition(request, openOffer(request), 'accepted', req.user._id, req.data.note);
  } finally {
    if (!updated) await Book.updateOne({ _id: request.book._id, status: 'reserved' }, { status: 'active' });
  }
  if (!updated) throw changed();
  await postEvent(updated, req.user, 'accepted', `Accepted ${rupees(updated.price)}`, req.data.note);
  const message = roleOf(request, req.user._id) === 'seller'
    ? `Your offer of ${rupees(updated.price)} for "${request.book.title}" was accepted. Message the seller to arrange the exchange.`
    : `${req.user.name} accepted your counteroffer of ${rupees(updated.price)} for "${request.book.title}". The book is reserved for them.`;
  await notify(otherParty(request, req.user._id), 'request', message, '/requests');
  return updated;
});

action('reject', 'responder', async (request, req) => {
  if (request.status !== 'pending') throw invalid(request);
  const updated = await transition(request, openOffer(request), 'rejected', req.user._id, req.data.note);
  if (!updated) throw changed();
  await postEvent(updated, req.user, 'rejected', `Declined the offer of ${rupees(updated.price)}`, req.data.note);
  await notify(otherParty(request, req.user._id), 'request', `${req.user.name} declined the offer of ${rupees(updated.price)} for "${request.book.title}".`, '/transactions');
  return updated;
});

action(
  'counter',
  'responder',
  async (request, req) => {
    if (request.status !== 'pending') throw invalid(request);
    const limit = request.listPrice ?? request.price;
    if (req.data.amount > limit) throw new HttpError(400, `Offer at most the listed price of ${rupees(limit)}`);
    if (req.data.amount === request.price) throw new HttpError(400, 'Suggest a different amount, or accept this offer');
    const role = roleOf(request, req.user._id);
    const updated = await PurchaseRequest.findOneAndUpdate(
      { _id: request._id, ...openOffer(request) },
      { price: req.data.amount, offerBy: role, $push: { history: { status: 'countered', by: req.user._id, note: req.data.note, amount: req.data.amount } } },
      { returnDocument: 'after' },
    );
    if (!updated) throw changed();
    await postEvent(updated, req.user, 'counter', `Counteroffer: ${rupees(updated.price)}`, req.data.note);
    await notify(otherParty(request, req.user._id), 'request', `${req.user.name} made a counteroffer of ${rupees(updated.price)} for "${request.book.title}".`, '/requests');
    return updated;
  },
  z.object({ amount, note }),
);

action('cancel', 'either', async (request, req) => {
  const updated = await transition(request, { status: { $in: OPEN_REQUEST_STATUSES } }, 'cancelled', req.user._id, req.data.note);
  if (!updated) throw invalid(request);
  if (request.status === 'accepted') await Book.updateOne({ _id: request.book._id, status: 'reserved' }, { status: 'active' });
  await postEvent(updated, req.user, 'cancelled', 'Cancelled the request', req.data.note);
  await notify(otherParty(request, req.user._id), 'request', `${req.user.name} cancelled the request for "${request.book.title}".`, '/transactions');
  return updated;
});

action('complete', 'seller', async (request, req) => {
  if (request.status !== 'accepted') throw invalid(request);
  const sold = await Book.findOneAndUpdate({ _id: request.book._id, status: 'reserved' }, { status: 'sold' });
  if (!sold) throw new HttpError(409, 'This listing is under moderation and cannot be marked as sold');
  const updated = await transition(request, { status: 'accepted' }, 'completed', req.user._id, req.data.note);
  if (!updated) {
    await Book.updateOne({ _id: request.book._id, status: 'sold' }, { status: 'active' });
    throw new HttpError(409, 'This request changed. Please reload.');
  }
  await postEvent(updated, req.user, 'completed', `Marked as sold for ${rupees(updated.price)}`, req.data.note);
  await notify(request.buyer, 'request', `"${request.book.title}" was marked as sold to you for ${rupees(updated.price)}. The transaction is complete.`, '/transactions');
  await cancelOpenRequests({ book: request.book._id, _id: { $ne: request._id } }, 'the book has been sold to another buyer', req.user._id);
  return updated;
});

// Either party can open the chat for a request, so a seller can reach a buyer who has not written yet.
requestsRouter.post('/:id/conversation', requireMember, validate({ params: idParams }), async (req, res) => {
  const me = req.user._id;
  const request = await PurchaseRequest.findOne({ _id: req.data.id, $or: [{ buyer: me }, { seller: me }] });
  if (!request) throw notFound('Request');
  const conversation = await conversationFor(request);
  res.json({ conversation });
});

