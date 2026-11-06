import mongoose from 'mongoose';

export const OPEN_REQUEST_STATUSES = ['pending', 'accepted'];

const purchaseRequestSchema = new mongoose.Schema(
  {
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Negotiation: while pending, `price` is the offer on the table and `offerBy` made it, so only the other
    // party may accept, decline or counter. Once accepted it is the agreed price. Paid offline, never through the site.
    price: { type: Number, required: true, min: 0 },
    listPrice: { type: Number, min: 0 },
    offerBy: { type: String, enum: ['buyer', 'seller'], default: 'buyer' },
    // Between demo accounts on an example listing (demo mode only). Kept out of admin totals and removed by demo:remove.
    isDemo: { type: Boolean, default: false },
    message: { type: String, trim: true, maxlength: 1000, default: '' },
    status: { type: String, enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed'], default: 'pending' },
    history: [
      {
        _id: false,
        status: { type: String, required: true },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: { type: String, default: '' },
        amount: { type: Number },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

purchaseRequestSchema.index({ buyer: 1, status: 1, createdAt: -1 });
purchaseRequestSchema.index({ seller: 1, status: 1, createdAt: -1 });
// One open request per buyer per listing.
purchaseRequestSchema.index(
  { book: 1, buyer: 1 },
  { unique: true, partialFilterExpression: { status: { $in: OPEN_REQUEST_STATUSES } } },
);
// Database-level guarantee that a listing can never have two winning buyers.
purchaseRequestSchema.index(
  { book: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['accepted', 'completed'] } } },
);

export const PurchaseRequest = mongoose.model('PurchaseRequest', purchaseRequestSchema);
