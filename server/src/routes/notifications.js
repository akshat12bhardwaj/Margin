import { Router } from 'express';
import { z } from 'zod';
import { notFound, pageOf } from '../lib/http.js';
import { idParams, paging } from '../lib/schemas.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Conversation } from '../models/Conversation.js';
import { Notification } from '../models/Notification.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/', validate({ query: z.object(paging) }), async (req, res) => {
  const { page, limit } = req.data;
  const filter = { user: req.user._id };
  const [items, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Notification.countDocuments(filter),
  ]);
  res.json(pageOf(items, total, page, limit));
});

// Polled by the header badges.
notificationsRouter.get('/summary', async (req, res) => {
  const me = req.user._id;
  const [notifications, messages] = await Promise.all([
    Notification.countDocuments({ user: me, read: false }),
    Conversation.countDocuments({ $or: [{ buyer: me, buyerUnread: { $gt: 0 } }, { seller: me, sellerUnread: { $gt: 0 } }] }),
  ]);
  res.json({ notifications, messages });
});

notificationsRouter.patch('/read-all', async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ ok: true });
});

notificationsRouter.patch('/:id/read', validate({ params: idParams }), async (req, res) => {
  const result = await Notification.updateOne({ _id: req.data.id, user: req.user._id }, { read: true });
  if (!result.matchedCount) throw notFound('Notification');
  res.json({ ok: true });
});
