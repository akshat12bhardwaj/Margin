import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { escapeRegex, HttpError, notFound, pageOf } from '../lib/http.js';
import { notify } from '../lib/notify.js';
import { cancelOpenRequests } from '../lib/requests.js';
import { idParams, optional, paging, required, semester } from '../lib/schemas.js';
import { deleteImage, saveImage } from '../lib/storage.js';
import { requireAuth, requireMember } from '../middleware/auth.js';
import { checkedImages, MAX_IMAGES, uploadImages } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { Book, CONDITIONS, PUBLIC_BOOK_STATUSES } from '../models/Book.js';
import { SUBJECT_NAMES, subjectInfo } from '../../../shared/subjects.mjs';
import { Conversation } from '../models/Conversation.js';
import { PurchaseRequest } from '../models/PurchaseRequest.js';
import { PUBLIC_USER_FIELDS, UNIVERSITY, User } from '../models/User.js';
import { Wishlist } from '../models/Wishlist.js';

const createLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user.id,
  message: { error: 'You are adding listings too quickly. Please try again later.' },
});
const SELLER_FIELDS = 'name role university designation isDemo isAutomatedSeller';

const listingSchema = z.object({
  title: z.string('Enter the title').trim().min(2, 'Enter the title').max(200),
  author: z.string('Enter the author').trim().min(2, 'Enter the author').max(200),
  isbn: optional(
    z.string().transform((s) => s.replace(/[\s-]/g, '').toUpperCase()).pipe(z.string().regex(/^(\d{9}[\dX]|\d{13})$/, 'ISBN must have 10 or 13 digits')),
  ),
  subject: z.enum(SUBJECT_NAMES, 'Choose a subject from the list'),
  course: optional(z.string().trim().max(120)),
  semester: semester,
  edition: z.string('Enter the edition').trim().min(1, 'Enter the edition').max(40),
  publicationYear: required(z.coerce.number('Enter the year').int().min(1800, 'Enter a valid year').max(new Date().getFullYear() + 1, 'Enter a valid year')),
  description: z.string('Describe the book').trim().min(10, 'Describe the book in at least 10 characters').max(3000),
  price: required(z.coerce.number('Enter a valid price').positive('Enter a price above ₹0').max(10_000_000)),
  condition: z.enum(CONDITIONS, 'Choose a condition'),
});

const searchSchema = z.object({
  q: optional(z.string().trim().max(100)),
  university: optional(z.string().trim().max(120)),
  subject: optional(z.enum(SUBJECT_NAMES, 'Unknown subject')),
  course: optional(z.string().trim().max(120)),
  edition: optional(z.string().trim().max(40)),
  semester: semester,
  condition: optional(z.string().transform((s) => s.split(',')).pipe(z.array(z.enum(CONDITIONS)))),
  minPrice: optional(z.coerce.number().min(0)),
  maxPrice: optional(z.coerce.number().min(0)),
  sellerRole: optional(z.enum(['student', 'faculty'])),
  sort: z.enum(['newest', 'oldest', 'price_asc', 'price_desc', 'year_desc']).default('newest'),
  ...paging,
});

const SORTS = { newest: { createdAt: -1 }, oldest: { createdAt: 1 }, price_asc: { price: 1, createdAt: -1 }, price_desc: { price: -1, createdAt: -1 }, year_desc: { publicationYear: -1, createdAt: -1 } };

const contains = (s) => new RegExp(escapeRegex(s), 'i');

async function searchFilter({ q, university, subject, course, edition, semester, condition, minPrice, maxPrice, sellerRole }) {
  const filter = { status: 'active' };
  if (q) {
    // shortcut: unanchored regex scans active listings, fine for one campus community; move to Atlas Search at large scale.
    filter.$or = ['title', 'author', 'subject', 'course'].map((field) => ({ [field]: contains(q) }));
    const isbn = q.replace(/[\s-]/g, '');
    if (isbn) filter.$or.push({ isbn: contains(isbn) });
  }
  if (university) filter.university = university;
  if (subject) filter.subject = subject;
  if (course) filter.course = contains(course);
  if (edition) filter.edition = contains(edition);
  if (semester) filter.semester = semester;
  if (condition) filter.condition = { $in: condition };
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = minPrice;
    if (maxPrice !== undefined) filter.price.$lte = maxPrice;
  }
  if (sellerRole) filter.seller = { $in: await User.distinct('_id', { role: sellerRole }) };
  return filter;
}

async function canSeeHiddenListing(user, book) {
  if (!user) return false;
  if (user.role === 'admin' || book.seller._id.equals(user._id)) return true;
  // Deleted or moderated listings remain readable to a past buyer, for their records.
  return PurchaseRequest.exists({ book: book._id, buyer: user._id });
}

export const booksRouter = Router();

booksRouter.get('/', validate({ query: searchSchema }), async (req, res) => {
  const { page, limit, sort } = req.data;
  const filter = await searchFilter(req.data);
  const [items, total] = await Promise.all([
    Book.find(filter).sort(SORTS[sort]).skip((page - 1) * limit).limit(limit).populate('seller', SELLER_FIELDS),
    Book.countDocuments(filter),
  ]);
  res.json(pageOf(items, total, page, limit));
});

booksRouter.get('/facets', async (req, res) => {
  const facet = (field, match = {}) =>
    Book.aggregate([
      { $match: { status: 'active', ...match } },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $project: { _id: 0, name: '$_id', count: 1 } },
    ]);
  const [subjects, courses, universities, total] = await Promise.all([
    // Unmigrated free-text subjects are left out so every facet links to a valid filter.
    facet('subject', { subject: { $in: SUBJECT_NAMES } }),
    facet('course', { course: { $nin: [null, ''] } }),
    facet('university'),
    Book.countDocuments({ status: 'active' }),
  ]);
  res.json({ subjects, courses, universities, total });
});

booksRouter.get('/mine', requireAuth, async (req, res) => {
  res.json({ items: await Book.find({ seller: req.user._id, status: { $ne: 'deleted' } }).sort({ createdAt: -1 }) });
});

booksRouter.get('/:id', validate({ params: idParams }), async (req, res) => {
  const book = await Book.findById(req.data.id).populate('seller', PUBLIC_USER_FIELDS);
  if (!book) throw notFound('Listing');
  // Reserved and sold stay visible so wishlists and shared links can show what happened to the book.
  if (!PUBLIC_BOOK_STATUSES.includes(book.status) && !(await canSeeHiddenListing(req.user, book))) throw notFound('Listing');
  const [wishlisted, myRequest, conversation] = req.user
    ? await Promise.all([
        Wishlist.exists({ user: req.user._id, book: book._id }),
        PurchaseRequest.findOne({ book: book._id, buyer: req.user._id, status: { $in: ['pending', 'accepted', 'completed'] } }).select('status'),
        Conversation.findOne({ book: book._id, buyer: req.user._id }).select('_id'),
      ])
    : [];
  const related = subjectInfo(book.subject)
    ? await Book.find({ _id: { $ne: book._id }, status: 'active', subject: book.subject }).sort({ createdAt: -1 }).limit(4).populate('seller', SELLER_FIELDS)
    : [];
  res.json({ book, related, wishlisted: Boolean(wishlisted), myRequest: myRequest ?? null, conversationId: conversation?._id ?? null });
});

booksRouter.post('/', requireMember, createLimit, uploadImages, validate({ body: listingSchema }), async (req, res) => {
  if (req.user.isDemo) throw new HttpError(403, 'Demo accounts cannot create listings');
  const files = checkedImages(req.files);
  if (!files.length) throw new HttpError(400, 'Add at least one photo of the book');
  const images = await Promise.all(files.map((f) => saveImage(f.buffer, f.ext)));
  const book = await Book.create({ ...req.data, images, seller: req.user._id, university: UNIVERSITY });
  res.status(201).json({ book });
});

const EDITABLE = ['active', 'inactive'];
const editSchema = listingSchema.extend({
  keepImages: z.preprocess((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]), z.array(z.string().max(500))),
});

booksRouter.patch('/:id', requireMember, uploadImages, validate({ params: idParams, body: editSchema }), async (req, res) => {
  const { id, keepImages, ...fields } = req.data;
  const book = await Book.findOne({ _id: id, seller: req.user._id, status: { $ne: 'deleted' } });
  if (!book) throw notFound('Listing');
  if (!EDITABLE.includes(book.status)) throw new HttpError(409, `A ${book.status} listing cannot be edited`);
  const files = checkedImages(req.files);
  const kept = book.images.filter((img) => keepImages.includes(img.url));
  const count = kept.length + files.length;
  if (count < 1) throw new HttpError(400, 'Add at least one photo of the book');
  if (count > MAX_IMAGES) throw new HttpError(400, `A listing can have at most ${MAX_IMAGES} photos`);
  const added = await Promise.all(files.map((f) => saveImage(f.buffer, f.ext)));
  const update = { $set: { ...fields, images: [...kept.map((i) => ({ url: i.url, publicId: i.publicId })), ...added] } };
  // Cleared optional fields must be unset, not left at their old values.
  const cleared = ['isbn', 'course', 'semester'].filter((k) => fields[k] === undefined);
  for (const k of cleared) delete update.$set[k];
  if (cleared.length) update.$unset = Object.fromEntries(cleared.map((k) => [k, 1]));
  const updated = await Book.findOneAndUpdate({ _id: id, seller: req.user._id, status: { $in: EDITABLE } }, update, { returnDocument: 'after', runValidators: true });
  if (!updated) throw new HttpError(409, 'This listing changed while you were editing it. Please reload.');
  await Promise.all(book.images.filter((img) => !keepImages.includes(img.url)).map(deleteImage));
  res.json({ book: updated });
});

booksRouter.patch('/:id/status', requireMember, validate({ params: idParams, body: z.object({ status: z.enum(EDITABLE) }) }), async (req, res) => {
  const book = await Book.findOneAndUpdate(
    { _id: req.data.id, seller: req.user._id, status: { $in: EDITABLE } },
    { status: req.data.status },
    { returnDocument: 'after' },
  );
  if (!book) throw new HttpError(409, 'This listing cannot be changed right now');
  if (req.data.status === 'inactive') await cancelOpenRequests({ book: book._id }, 'the seller deactivated the listing', req.user._id);
  res.json({ book });
});

booksRouter.delete('/:id', requireMember, validate({ params: idParams }), async (req, res) => {
  const book = await Book.findOneAndUpdate({ _id: req.data.id, seller: req.user._id, status: { $in: EDITABLE } }, { status: 'deleted' });
  if (!book) throw new HttpError(409, 'Only active or deactivated listings can be deleted. Cancel any accepted request first.');
  await cancelOpenRequests({ book: book._id }, 'the seller deleted the listing', req.user._id);
  const watchers = await Wishlist.find({ book: book._id }).select('user');
  await Promise.all(watchers.map((w) => notify(w.user, 'request', `"${book.title}" on your wishlist is no longer available.`, '/wishlist')));
  res.json({ ok: true });
});
