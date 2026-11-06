import mongoose from 'mongoose';

export const CONDITIONS = ['New', 'Like New', 'Good', 'Acceptable', 'Heavily Used'];
// active -> reserved (request accepted) -> sold. inactive = seller paused it. deleted = seller removed it
// (kept because transactions reference it). hidden/removed = moderation.
export const BOOK_STATUSES = ['active', 'inactive', 'reserved', 'sold', 'deleted', 'hidden', 'removed'];
export const PUBLIC_BOOK_STATUSES = ['active', 'reserved', 'sold'];

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    author: { type: String, required: true, trim: true, maxlength: 200 },
    isbn: { type: String, trim: true, match: /^(\d{9}[\dX]|\d{13})$/ },
    // One of SUBJECT_NAMES (shared/subjects.mjs), enforced by the API. Older records may hold free text until migrated.
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    course: { type: String, trim: true, maxlength: 120 },
    // Legacy: no longer collected or shown. Kept so older records lose no academic history.
    department: { type: String, trim: true, maxlength: 80 },
    university: { type: String, required: true, trim: true, maxlength: 120 },
    semester: { type: Number, min: 1, max: 8 },
    // Sample listings keep these empty when a handout does not state them, rather than inventing a value.
    edition: { type: String, required() { return !this.isDemo; }, trim: true, maxlength: 40 },
    publicationYear: { type: Number, required() { return !this.isDemo; }, min: 1800 },
    description: { type: String, required: true, trim: true, maxlength: 3000 },
    price: { type: Number, required: true, min: 0 },
    // Legacy: no longer collected. select:false keeps stored values out of every API response;
    // `migrate-subjects.js --remove-original-price` deletes them.
    originalPrice: { type: Number, min: 0, select: false },
    condition: { type: String, enum: CONDITIONS, required: true },
    images: {
      type: [{ _id: false, url: { type: String, required: true }, publicId: { type: String, required: true } }],
      validate(v) { return v.length <= 6 && (v.length >= 1 || this.isDemo === true); },
    },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: BOOK_STATUSES, default: 'active' },
    flagged: { type: Boolean, default: false },
    moderationReason: { type: String, default: '' },
    // Set when a listing was hidden only because its seller was suspended, so restoring the seller restores it.
    hiddenBySuspension: { type: Boolean, default: false },
    // Sample data from scripts/seed-demo.js: demoKey makes re-seeding idempotent, demoSource names the handout.
    isDemo: { type: Boolean, default: false },
    demoKey: { type: String },
    demoSource: { type: String },
    // Set when an example cover shows a different edition, e.g. "Cover shows the 6th edition."
    coverNote: { type: String },
  },
  { timestamps: true },
);

bookSchema.index({ status: 1, createdAt: -1 });
bookSchema.index({ status: 1, price: 1 });
bookSchema.index({ status: 1, subject: 1 });
bookSchema.index({ status: 1, university: 1 });
bookSchema.index({ seller: 1, status: 1 });
bookSchema.index({ flagged: 1, status: 1 });
bookSchema.index({ demoKey: 1 }, { unique: true, sparse: true });
bookSchema.index({ status: 1, publicationYear: -1 });

export const Book = mongoose.model('Book', bookSchema);
