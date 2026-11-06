import mongoose from 'mongoose';

// The only community served for now. Kept as a field on users and books so more universities can be added later.
export const UNIVERSITY = 'BML Munjal University';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    // Absent on accounts that only sign in with Google.
    passwordHash: { type: String, select: false },
    googleId: { type: String, unique: true, sparse: true, select: false },
    role: { type: String, enum: ['student', 'faculty', 'admin'], required: true },
    university: { type: String, required: true, trim: true, maxlength: 120, default: UNIVERSITY },
    // Degree programme, e.g. B.Tech. Self-declared.
    program: { type: String, trim: true, maxlength: 80, default: '' },
    // Legacy: no longer collected or shown. Existing values are kept untouched.
    department: { type: String, trim: true, maxlength: 80, default: '' },
    semester: { type: Number, min: 1, max: 8 },
    designation: { type: String, trim: true, maxlength: 80, default: '' },
    bio: { type: String, trim: true, maxlength: 500, default: '' },
    status: { type: String, enum: ['active', 'suspended', 'deactivated'], default: 'active' },
    statusReason: { type: String, default: '' },
    // Bumped on password change so older tokens stop working.
    // Fictional sample seller from scripts/seed-demo.js. Cannot log in; see README.
    isDemo: { type: Boolean, default: false },
    // Replies to buyers through lib/autoSeller.js. Set only by the seed script, never through the API.
    isAutomatedSeller: { type: Boolean, default: false },
    tokenVersion: { type: Number, default: 0, select: false },
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
  },
  { timestamps: true },
);

userSchema.index({ role: 1, status: 1, createdAt: -1 });

export const PUBLIC_USER_FIELDS = 'name role university program designation bio createdAt isDemo isAutomatedSeller';
export const User = mongoose.model('User', userSchema);
