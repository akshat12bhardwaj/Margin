import { Router } from 'express';
import { z } from 'zod';
import { notFound } from '../lib/http.js';
import { idParams, optional, semester } from '../lib/schemas.js';
import { requireActive, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Book } from '../models/Book.js';
import { Conversation } from '../models/Conversation.js';
import { Notification } from '../models/Notification.js';
import { OPEN_REQUEST_STATUSES, PurchaseRequest } from '../models/PurchaseRequest.js';
import { PUBLIC_USER_FIELDS, User } from '../models/User.js';
import { Wishlist } from '../models/Wishlist.js';
import { publicSelf } from './auth.js';

const profileSchema = z.object({
  name: z.string('Enter your name').trim().min(2, 'Enter your name').max(80),
  program: z.string().trim().max(80).default(''),
  semester: semester,
  designation: z.string().trim().max(80).default(''),
  bio: z.string().trim().max(500).default(''),
});

export const usersRouter = Router();

// Only whitelisted fields: role and status can never be changed through this route.
usersRouter.patch('/me', requireActive, validate({ body: profileSchema }), async (req, res) => {
  const { semester, designation, ...fields } = req.data;
  Object.assign(req.user, fields, {
    semester: req.user.role === 'student' ? semester : undefined,
    designation: req.user.role === 'faculty' ? designation : '',
  });
  await req.user.save();
  res.json({ user: publicSelf(req.user) });
});

usersRouter.get('/me/dashboard', requireAuth, async (req, res) => {
  const me = req.user._id;
  const [activeListings, soldListings, incomingOpen, outgoingOpen, wishlist, unreadNotifications, unreadConversations, recentRequests] = await Promise.all([
    Book.countDocuments({ seller: me, status: 'active' }),
    Book.countDocuments({ seller: me, status: 'sold' }),
    PurchaseRequest.countDocuments({ seller: me, status: { $in: OPEN_REQUEST_STATUSES } }),
    PurchaseRequest.countDocuments({ buyer: me, status: { $in: OPEN_REQUEST_STATUSES } }),
    Wishlist.countDocuments({ user: me }),
    Notification.countDocuments({ user: me, read: false }),
    Conversation.countDocuments({ $or: [{ buyer: me, buyerUnread: { $gt: 0 } }, { seller: me, sellerUnread: { $gt: 0 } }] }),
    PurchaseRequest.find({ $or: [{ buyer: me }, { seller: me }] })
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('book buyer seller status price updatedAt')
      .populate('book', 'title images'),
  ]);
  res.json({ activeListings, soldListings, incomingOpen, outgoingOpen, wishlist, unreadNotifications, unreadConversations, recentRequests });
});

usersRouter.get('/:id', validate({ params: idParams }), async (req, res) => {
  const user = await User.findById(req.data.id).select(`${PUBLIC_USER_FIELDS} status`);
  if (!user || user.status === 'deactivated' || user.role === 'admin') throw notFound('User');
  const [listings, soldCount] = await Promise.all([
    Book.find({ seller: user._id, status: 'active' }).sort({ createdAt: -1 }).limit(24).populate('seller', 'name role isDemo'),
    Book.countDocuments({ seller: user._id, status: 'sold' }),
  ]);
  res.json({ user, listings, soldCount });
});
