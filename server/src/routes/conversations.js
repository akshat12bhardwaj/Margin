import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { onBuyerMessage, suggestionsFor } from '../lib/autoSeller.js';
import { HttpError, notFound } from '../lib/http.js';
import { openConversation, sendMessage } from '../lib/messages.js';
import { idParams, objectId } from '../lib/schemas.js';
import { requireAuth, requireMember } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Book, PUBLIC_BOOK_STATUSES } from '../models/Book.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { Notification } from '../models/Notification.js';
import { PurchaseRequest } from '../models/PurchaseRequest.js';

const body = z.string('Write a message').trim().min(1, 'Write a message').max(2000);
const POPULATE = [
  { path: 'book', select: 'title images price status subject isDemo' },
  { path: 'buyer', select: 'name role' },
  { path: 'seller', select: 'name role isAutomatedSeller' },
];
const messageLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user.id,
  message: { error: 'You are sending messages too quickly. Please wait a moment.' },
});

async function loadOwn(req) {
  const conversation = await Conversation.findOne({ _id: req.data.id, $or: [{ buyer: req.user._id }, { seller: req.user._id }] });
  // 404, not 403, so outsiders cannot confirm a conversation exists.
  if (!conversation) throw notFound('Conversation');
  return conversation;
}

export const conversationsRouter = Router();

// The first message is optional only for automated sellers, whose chat opens with suggested messages instead.
conversationsRouter.post('/', requireMember, messageLimit, validate({ body: z.object({ bookId: objectId, message: body.optional() }) }), async (req, res) => {
  const book = await Book.findOne({ _id: req.data.bookId, status: { $in: PUBLIC_BOOK_STATUSES } }).populate('seller', 'isAutomatedSeller');
  if (!book) throw notFound('Listing');
  if (book.seller._id.equals(req.user._id)) throw new HttpError(400, 'You cannot message yourself about your own listing');
  if (!req.data.message && !book.seller.isAutomatedSeller) throw new HttpError(400, 'Write a message');
  book.depopulate('seller');
  const conversation = await openConversation(book, req.user._id);
  const message = req.data.message ? await sendMessage(conversation, req.user, req.data.message) : null;
  if (message) await onBuyerMessage(conversation, req.user, req.data.message);
  res.status(201).json({ conversation, message });
});

conversationsRouter.get('/', requireAuth, async (req, res) => {
  const me = req.user._id;
  const items = await Conversation.find({ $or: [{ buyer: me }, { seller: me }] }).sort({ lastMessageAt: -1 }).limit(100).populate(POPULATE);
  res.json({ items });
});

conversationsRouter.get('/:id', requireAuth, validate({ params: idParams }), async (req, res) => {
  const conversation = await loadOwn(req);
  // shortcut: returns only the latest 200 messages, add cursor paging if threads ever grow beyond that.
  const messages = await Message.find({ conversation: conversation._id }).sort({ createdAt: -1, _id: -1 }).limit(200);
  const isBuyer = conversation.buyer.equals(req.user._id);
  // The latest request drives the negotiation actions shown in the thread.
  const request = await PurchaseRequest.findOne({ book: conversation.book, buyer: conversation.buyer }).sort({ createdAt: -1 });
  await Promise.all([
    Conversation.updateOne({ _id: conversation._id }, { [isBuyer ? 'buyerUnread' : 'sellerUnread']: 0 }),
    Notification.updateMany({ user: req.user._id, type: 'message', link: `/messages/${conversation._id}`, read: false }, { read: true }),
  ]);
  await conversation.populate(POPULATE);
  messages.reverse();
  const suggestions = isBuyer && conversation.seller.isAutomatedSeller ? suggestionsFor(conversation.book, request, messages, req.user._id) : [];
  res.json({ conversation, messages, request, suggestions });
});

conversationsRouter.post('/:id/messages', requireMember, messageLimit, validate({ params: idParams, body: z.object({ message: body }) }), async (req, res) => {
  const conversation = await loadOwn(req);
  const message = await sendMessage(conversation, req.user, req.data.message);
  await onBuyerMessage(conversation, req.user, req.data.message);
  res.status(201).json({ message });
});
