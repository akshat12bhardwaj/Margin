import { Router } from 'express';
import { z } from 'zod';
import { notFound } from '../lib/http.js';
import { idParams, objectId } from '../lib/schemas.js';
import { requireMember } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Book, PUBLIC_BOOK_STATUSES } from '../models/Book.js';
import { Wishlist } from '../models/Wishlist.js';

export const wishlistRouter = Router();
wishlistRouter.use(requireMember);

wishlistRouter.get('/', async (req, res) => {
  const items = await Wishlist.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .populate({ path: 'book', select: 'title author price edition condition images status seller subject course isDemo', populate: { path: 'seller', select: 'name role isDemo' } });
  // Moderated or deleted listings stay on the list, but without details that were taken down.
  res.json({
    items: items.map(({ book }) =>
      PUBLIC_BOOK_STATUSES.includes(book.status) ? book : { _id: book._id, title: book.title, status: 'unavailable', images: [] },
    ),
  });
});

wishlistRouter.post('/', validate({ body: z.object({ bookId: objectId }) }), async (req, res) => {
  if (!(await Book.exists({ _id: req.data.bookId, status: { $in: PUBLIC_BOOK_STATUSES } }))) throw notFound('Listing');
  await Wishlist.updateOne({ user: req.user._id, book: req.data.bookId }, {}, { upsert: true });
  res.status(201).json({ ok: true });
});

wishlistRouter.delete('/:id', validate({ params: idParams }), async (req, res) => {
  await Wishlist.deleteOne({ user: req.user._id, book: req.data.id });
  res.json({ ok: true });
});
