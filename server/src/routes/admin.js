import { Router } from 'express';
import { z } from 'zod';
import { escapeRegex, HttpError, notFound, pageOf } from '../lib/http.js';
import { notify } from '../lib/notify.js';
import { cancelOpenRequests } from '../lib/requests.js';
import { idParams, optional, paging, reason } from '../lib/schemas.js';
import { requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AuditLog } from '../models/AuditLog.js';
import { Book, BOOK_STATUSES } from '../models/Book.js';
import { OPEN_REQUEST_STATUSES, PurchaseRequest } from '../models/PurchaseRequest.js';
import { OPEN_REPORT_STATUSES, Report, REPORT_CATEGORIES, REPORT_STATUSES } from '../models/Report.js';
import { User } from '../models/User.js';

const contains = (s) => new RegExp(escapeRegex(s), 'i');
const reasonBody = z.object({ reason });
const REPEAT_OFFENDER_THRESHOLD = 2;
const RAPID_LISTING_THRESHOLD = 10;
const USER_BRIEF = 'name email role status university isDemo';
const REAL = { isDemo: { $ne: true } };

const audit = (req, action, targetType, targetId, why = '') => AuditLog.create({ admin: req.user._id, action, targetType, targetId, reason: why });

// Per-user counts of reports against them; "upheld" means an admin resolved the report against them.
async function reportCountsByUser(userIds) {
  const rows = await Report.aggregate([
    { $match: { targetUser: { $in: userIds } } },
    {
      $group: {
        _id: '$targetUser',
        open: { $sum: { $cond: [{ $in: ['$status', OPEN_REPORT_STATUSES] }, 1, 0] } },
        upheld: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
}

export const adminRouter = Router();
// Every route below requires an active administrator.
adminRouter.use(requireAdmin);

adminRouter.get('/stats', async (req, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const topUsers = (model, match, field, minimum) =>
    model.aggregate([
      { $match: match },
      { $group: { _id: field, count: { $sum: 1 } } },
      { $match: { count: { $gte: minimum } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);
  const [
    students, faculty, suspendedUsers, activeListings, flaggedListings, hiddenListings, completedTransactions, pendingTransactions,
    reportedListings, reportedUsers, openReports, repeatOffenderRows, rapidListerRows, multipleReportRows, recentActions, demoListings, demoUsers,
  ] = await Promise.all([
    User.countDocuments({ role: 'student', ...REAL }),
    User.countDocuments({ role: 'faculty', ...REAL }),
    User.countDocuments({ status: 'suspended', ...REAL }),
    Book.countDocuments({ status: 'active', ...REAL }),
    Book.countDocuments({ flagged: true, status: { $nin: ['removed', 'deleted'] } }),
    Book.countDocuments({ status: 'hidden' }),
    PurchaseRequest.countDocuments({ status: 'completed', ...REAL }),
    PurchaseRequest.countDocuments({ status: { $in: OPEN_REQUEST_STATUSES }, ...REAL }),
    Report.distinct('book', { targetType: 'book', status: { $in: OPEN_REPORT_STATUSES } }).then((r) => r.length),
    Report.distinct('targetUser', { targetType: 'user', status: { $in: OPEN_REPORT_STATUSES } }).then((r) => r.length),
    Report.countDocuments({ status: { $in: OPEN_REPORT_STATUSES } }),
    topUsers(Report, { status: 'resolved' }, '$targetUser', REPEAT_OFFENDER_THRESHOLD),
    topUsers(Book, { createdAt: { $gte: since }, ...REAL }, '$seller', RAPID_LISTING_THRESHOLD),
    topUsers(Report, { status: { $in: OPEN_REPORT_STATUSES } }, '$targetUser', 2),
    AuditLog.find().sort({ createdAt: -1 }).limit(8).populate('admin', 'name'),
    Book.countDocuments({ isDemo: true }),
    User.countDocuments({ isDemo: true }),
  ]);
  const ids = [...repeatOffenderRows, ...rapidListerRows, ...multipleReportRows].map((r) => r._id);
  const users = new Map((await User.find({ _id: { $in: ids } }).select(USER_BRIEF)).map((u) => [String(u._id), u]));
  const withUser = (rows) => rows.map((r) => ({ count: r.count, user: users.get(String(r._id)) })).filter((r) => r.user);
  res.json({
    totalUsers: students + faculty,
    students,
    faculty,
    suspendedUsers,
    activeListings,
    completedTransactions,
    pendingTransactions,
    reportedListings,
    reportedUsers,
    openReports,
    // Sample data is reported apart from the totals above, which count real members only.
    demoListings,
    demoUsers,
    suspicious: {
      flaggedListings,
      hiddenListings,
      repeatOffenders: withUser(repeatOffenderRows),
      rapidListers: withUser(rapidListerRows),
      multipleOpenReports: withUser(multipleReportRows),
    },
    recentActions,
  });
});

adminRouter.get(
  '/users',
  validate({
    query: z.object({
      q: optional(z.string().trim().max(100)),
      role: optional(z.enum(['student', 'faculty', 'admin'])),
      status: optional(z.enum(['active', 'suspended', 'deactivated'])),
      ...paging,
    }),
  }),
  async (req, res) => {
    const { q, role, status, page, limit } = req.data;
    const filter = {};
    if (q) filter.$or = [{ name: contains(q) }, { email: contains(q) }, { university: contains(q) }];
    if (role) filter.role = role;
    if (status) filter.status = status;
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      User.countDocuments(filter),
    ]);
    const counts = await reportCountsByUser(users.map((u) => u._id));
    const items = users.map((u) => {
      const c = counts.get(String(u._id));
      return { ...u.toObject(), openReports: c?.open ?? 0, upheldReports: c?.upheld ?? 0, repeatOffender: (c?.upheld ?? 0) >= REPEAT_OFFENDER_THRESHOLD };
    });
    res.json(pageOf(items, total, page, limit));
  },
);

adminRouter.get('/users/:id', validate({ params: idParams }), async (req, res) => {
  const user = await User.findById(req.data.id);
  if (!user) throw notFound('User');
  const [listings, requests, reportsAgainst, reportsFiled, actions] = await Promise.all([
    Book.find({ seller: user._id }).sort({ createdAt: -1 }).limit(50).select('title price status flagged createdAt'),
    PurchaseRequest.find({ $or: [{ buyer: user._id }, { seller: user._id }] }).sort({ updatedAt: -1 }).limit(50)
      .populate('book', 'title').populate('buyer', 'name').populate('seller', 'name'),
    Report.find({ targetUser: user._id }).sort({ createdAt: -1 }).limit(50).populate('reporter', 'name').populate('book', 'title'),
    Report.countDocuments({ reporter: user._id }),
    AuditLog.find({ targetType: 'user', targetId: user._id }).sort({ createdAt: -1 }).limit(50).populate('admin', 'name'),
  ]);
  res.json({ user, listings, requests, reportsAgainst, reportsFiled, actions });
});

function setUserStatus(status, action) {
  adminRouter.patch(`/users/:id/${action}`, validate({ params: idParams, body: reasonBody }), async (req, res) => {
    const target = await User.findById(req.data.id);
    if (!target) throw notFound('User');
    if (target.role === 'admin') throw new HttpError(403, 'Administrator accounts cannot be moderated here');
    if (target.status === status) throw new HttpError(409, `This account is already ${status}`);
    target.status = status;
    target.statusReason = req.data.reason;
    await target.save();
    // Inactive listings are already off the market, and must stay paused after a restore.
    await Book.updateMany(
      { seller: target._id, status: { $in: ['active', 'reserved'] } },
      { status: 'hidden', hiddenBySuspension: true, moderationReason: 'Seller account restricted' },
    );
    await cancelOpenRequests({ $or: [{ buyer: target._id }, { seller: target._id }] }, 'one of the accounts involved was restricted', req.user._id);
    await notify(target._id, 'account', `Your account was ${status}: ${req.data.reason}`);
    await audit(req, `user.${action}`, 'user', target._id, req.data.reason);
    res.json({ user: target });
  });
}
setUserStatus('suspended', 'suspend');
setUserStatus('deactivated', 'deactivate');

adminRouter.patch('/users/:id/restore', validate({ params: idParams, body: reasonBody }), async (req, res) => {
  const target = await User.findOneAndUpdate(
    { _id: req.data.id, role: { $ne: 'admin' }, status: { $ne: 'active' } },
    { status: 'active', statusReason: '' },
    { returnDocument: 'after' },
  );
  if (!target) throw new HttpError(409, 'This account is not suspended or deactivated');
  await Book.updateMany(
    { seller: target._id, status: 'hidden', hiddenBySuspension: true },
    { status: 'active', hiddenBySuspension: false, moderationReason: '' },
  );
  await notify(target._id, 'account', `Your account was restored: ${req.data.reason}`);
  await audit(req, 'user.restore', 'user', target._id, req.data.reason);
  res.json({ user: target });
});

adminRouter.get(
  '/books',
  validate({
    query: z.object({
      q: optional(z.string().trim().max(100)),
      status: optional(z.enum(BOOK_STATUSES)),
      flagged: optional(z.enum(['true'])),
      ...paging,
    }),
  }),
  async (req, res) => {
    const { q, status, flagged, page, limit } = req.data;
    const filter = {};
    if (q) filter.$or = [{ title: contains(q) }, { author: contains(q) }, { isbn: contains(q) }];
    if (status) filter.status = status;
    if (flagged) filter.flagged = true;
    const [items, total] = await Promise.all([
      Book.find(filter).sort({ flagged: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('seller', USER_BRIEF),
      Book.countDocuments(filter),
    ]);
    res.json(pageOf(items, total, page, limit));
  },
);

adminRouter.get('/books/:id', validate({ params: idParams }), async (req, res) => {
  const book = await Book.findById(req.data.id).populate('seller', USER_BRIEF);
  if (!book) throw notFound('Listing');
  const [reports, requests, actions] = await Promise.all([
    Report.find({ book: book._id }).sort({ createdAt: -1 }).populate('reporter', 'name'),
    PurchaseRequest.find({ book: book._id }).sort({ createdAt: -1 }).populate('buyer', 'name'),
    AuditLog.find({ targetType: 'book', targetId: book._id }).sort({ createdAt: -1 }).populate('admin', 'name'),
  ]);
  res.json({ book, reports, requests, actions });
});

function moderateBook(action, status, allowedFrom) {
  adminRouter.patch(`/books/:id/${action}`, validate({ params: idParams, body: reasonBody }), async (req, res) => {
    const book = await Book.findOneAndUpdate(
      { _id: req.data.id, status: { $in: allowedFrom } },
      { status, moderationReason: req.data.reason, hiddenBySuspension: false },
      { returnDocument: 'after' },
    );
    if (!book) throw new HttpError(409, `This listing cannot be ${status} in its current state`);
    await cancelOpenRequests({ book: book._id }, 'the listing is under moderation', req.user._id);
    await notify(book.seller, 'moderation', `Your listing "${book.title}" was ${status}: ${req.data.reason}`, `/books/${book._id}`);
    await audit(req, `book.${action}`, 'book', book._id, req.data.reason);
    res.json({ book });
  });
}
moderateBook('hide', 'hidden', ['active', 'inactive', 'reserved']);
moderateBook('remove', 'removed', ['active', 'inactive', 'reserved', 'hidden']);

// Restoring clears the flag, so it also serves "incorrectly flagged" active listings.
adminRouter.patch('/books/:id/restore', validate({ params: idParams, body: reasonBody }), async (req, res) => {
  const current = await Book.findById(req.data.id).populate('seller', 'status');
  if (!current) throw notFound('Listing');
  if (current.seller.status !== 'active') throw new HttpError(409, "Restore the seller's account first");
  const moderated = ['hidden', 'removed'].includes(current.status);
  if (!moderated && !current.flagged) throw new HttpError(409, 'This listing is not flagged or hidden');
  const book = await Book.findOneAndUpdate(
    { _id: current._id, status: current.status },
    { status: moderated ? 'active' : current.status, flagged: false, moderationReason: '', hiddenBySuspension: false },
    { returnDocument: 'after' },
  );
  if (!book) throw new HttpError(409, 'This listing changed. Please reload.');
  await notify(book.seller, 'moderation', `Your listing "${book.title}" was restored: ${req.data.reason}`, `/books/${book._id}`);
  await audit(req, 'book.restore', 'book', book._id, req.data.reason);
  res.json({ book });
});

adminRouter.get(
  '/reports',
  validate({
    query: z.object({
      status: optional(z.enum(REPORT_STATUSES)),
      category: optional(z.enum(REPORT_CATEGORIES)),
      targetType: optional(z.enum(['book', 'user'])),
      ...paging,
    }),
  }),
  async (req, res) => {
    const { status, category, targetType, page, limit } = req.data;
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (targetType) filter.targetType = targetType;
    const [items, total] = await Promise.all([
      Report.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
        .populate('reporter', 'name email').populate('targetUser', USER_BRIEF).populate('book', 'title status')
        .populate('decidedBy', 'name'),
      Report.countDocuments(filter),
    ]);
    res.json(pageOf(items, total, page, limit));
  },
);

adminRouter.patch(
  '/reports/:id',
  validate({
    params: idParams,
    body: z
      .object({ status: z.enum(['under_review', 'resolved', 'rejected']), decision: z.string().trim().max(2000).default('') })
      .refine((b) => b.status === 'under_review' || b.decision.length >= 3, { path: ['decision'], message: 'Record the decision and explanation' }),
  }),
  async (req, res) => {
    const { id, status, decision } = req.data;
    const closing = status !== 'under_review';
    // A closed report is final, so a decision cannot be silently rewritten.
    const report = await Report.findOneAndUpdate(
      { _id: id, status: { $in: OPEN_REPORT_STATUSES } },
      closing ? { status, decision, decidedBy: req.user._id, decidedAt: new Date() } : { status },
      { returnDocument: 'after' },
    );
    if (!report) throw new HttpError(409, 'This report is already closed');
    await audit(req, `report.${status}`, 'report', report._id, decision);
    if (closing) {
      if (report.book && !(await Report.exists({ book: report.book, status: { $in: OPEN_REPORT_STATUSES } }))) {
        await Book.updateOne({ _id: report.book }, { flagged: false });
      }
      const outcome = status === 'resolved' ? 'upheld' : 'not upheld';
      await notify(report.reporter, 'report', `Your report was reviewed and ${outcome}: ${decision}`);
      // The reported party only hears about reports that were upheld against them.
      if (status === 'resolved') await notify(report.targetUser, 'report', `A report about you was upheld: ${decision}`);
    }
    res.json({ report });
  },
);

adminRouter.get('/audit-logs', validate({ query: z.object(paging) }), async (req, res) => {
  const { page, limit } = req.data;
  const [items, total] = await Promise.all([
    AuditLog.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('admin', 'name email'),
    AuditLog.countDocuments(),
  ]);
  res.json(pageOf(items, total, page, limit));
});
