import { Book } from '../models/Book.js';
import { OPEN_REQUEST_STATUSES, PurchaseRequest } from '../models/PurchaseRequest.js';
import { notify } from './notify.js';

// Cancels every open request matching `filter`, freeing reserved listings and telling both parties.
export async function cancelOpenRequests(filter, note, by) {
  const open = await PurchaseRequest.find({ ...filter, status: { $in: OPEN_REQUEST_STATUSES } }).populate('book', 'title');
  for (const request of open) {
    const cancelled = await PurchaseRequest.findOneAndUpdate(
      { _id: request._id, status: { $in: OPEN_REQUEST_STATUSES } },
      { status: 'cancelled', $push: { history: { status: 'cancelled', by, note } } },
    );
    if (!cancelled) continue;
    // No-op when the caller already moved the listing out of "reserved" (hidden, removed).
    if (request.status === 'accepted') await Book.updateOne({ _id: request.book._id, status: 'reserved' }, { status: 'active' });
    const message = `Purchase request for "${request.book.title}" was cancelled: ${note}.`;
    await notify(request.buyer, 'request', message, '/transactions');
    await notify(request.seller, 'request', message, '/transactions');
  }
}
