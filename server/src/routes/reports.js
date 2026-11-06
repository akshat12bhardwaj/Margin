import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { HttpError, notFound, refuseDemo } from '../lib/http.js';
import { objectId } from '../lib/schemas.js';
import { requireMember } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Book } from '../models/Book.js';
import { OPEN_REPORT_STATUSES, Report, REPORT_CATEGORIES } from '../models/Report.js';
import { User } from '../models/User.js';

const reportSchema = z.object({
  targetType: z.enum(['book', 'user']),
  targetId: objectId,
  category: z.enum(REPORT_CATEGORIES, 'Choose a category'),
  description: z.string('Describe the problem').trim().min(10, 'Describe the problem in at least 10 characters').max(2000),
});
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user.id,
  message: { error: 'Too many reports. Please try again later.' },
});

export const reportsRouter = Router();

// Status and decision are not in the schema, so a reporter cannot set them.
reportsRouter.post('/', requireMember, limiter, validate({ body: reportSchema }), async (req, res) => {
  const { targetType, targetId, category, description } = req.data;
  if (req.user.isDemo) throw new HttpError(403, 'Demo accounts cannot file reports');
  let targetUser;
  let book = null;
  if (targetType === 'book') {
    const target = await Book.findOne({ _id: targetId, status: { $ne: 'deleted' } });
    if (!target) throw notFound('Listing');
    refuseDemo(target);
    targetUser = target.seller;
    book = target._id;
  } else {
    const target = await User.findOne({ _id: targetId, role: { $ne: 'admin' } });
    if (!target) throw notFound('User');
    refuseDemo(target);
    targetUser = target._id;
  }
  if (targetUser.equals(req.user._id)) throw new HttpError(400, 'You cannot report yourself or your own listing');
  // book: null also matches a missing field, so this finds an open report on the user themself.
  const duplicate = await Report.exists({ reporter: req.user._id, targetUser, book, status: { $in: OPEN_REPORT_STATUSES } });
  if (duplicate) throw new HttpError(409, 'You already have an open report about this');
  const report = await Report.create({ reporter: req.user._id, targetType, targetUser, book: book ?? undefined, category, description });
  if (book) await Book.updateOne({ _id: book }, { flagged: true });
  res.status(201).json({ report: { _id: report._id, status: report.status } });
});
