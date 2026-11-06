import mongoose from 'mongoose';

export const REPORT_CATEGORIES = [
  'fake_listing',
  'incorrect_edition',
  'counterfeit_damaged',
  'suspicious_seller',
  'scam_fraud',
  'harassment',
  'other',
];
export const REPORT_STATUSES = ['pending', 'under_review', 'resolved', 'rejected'];
export const OPEN_REPORT_STATUSES = ['pending', 'under_review'];

const reportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['book', 'user'], required: true },
    // Always the accountable user: the reported user, or the seller of the reported listing.
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
    category: { type: String, enum: REPORT_CATEGORIES, required: true },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    status: { type: String, enum: REPORT_STATUSES, default: 'pending' },
    decision: { type: String, trim: true, maxlength: 2000, default: '' },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    decidedAt: { type: Date },
  },
  { timestamps: true },
);

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ targetUser: 1, status: 1 });
reportSchema.index({ book: 1, status: 1 });
// A user cannot pile on the same target while their earlier report is still open.
reportSchema.index(
  { reporter: 1, targetUser: 1, book: 1 },
  { unique: true, partialFilterExpression: { status: { $in: OPEN_REPORT_STATUSES } } },
);

export const Report = mongoose.model('Report', reportSchema);
