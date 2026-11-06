export const CONDITIONS = ['New', 'Like New', 'Good', 'Acceptable', 'Heavily Used'];
// B.Tech runs eight semesters; the server enforces the same range.
export const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

// Must match server/src/models/User.js UNIVERSITY.
export const UNIVERSITY = 'BML Munjal University';

// One catalogue for client and server: listings may only use these subjects.
export { SUBJECT_GROUPS, SUBJECT_NAMES, SUBJECTS, subjectInfo } from '../../shared/subjects.mjs';
export const PROGRAMS = ['B.Tech', 'M.Tech', 'BBA', 'MBA', 'B.Com', 'BA', 'BA LLB', 'BBA LLB', 'LLM', 'Ph.D.'];

export const REPORT_CATEGORIES = {
  fake_listing: 'Fake or misleading listing',
  incorrect_edition: 'Incorrect book edition',
  counterfeit_damaged: 'Counterfeit or damaged book',
  suspicious_seller: 'Suspicious seller',
  scam_fraud: 'Scam or payment fraud',
  harassment: 'Harassment or inappropriate behaviour',
  other: 'Other violation',
};

export const STATUS_LABELS = {
  active: 'Available', inactive: 'Deactivated', reserved: 'Reserved', sold: 'Sold', deleted: 'Deleted', hidden: 'Hidden', removed: 'Removed', unavailable: 'No longer available',
  pending: 'Pending', countered: 'Counteroffer', accepted: 'Accepted', rejected: 'Declined', cancelled: 'Cancelled', completed: 'Completed',
  under_review: 'Under review', resolved: 'Resolved', suspended: 'Suspended', deactivated: 'Deactivated',
};

const STATUS_TONES = {
  active: 'good', accepted: 'good', completed: 'good', resolved: 'good',
  pending: 'warn', reserved: 'warn', under_review: 'warn', inactive: 'neutral', sold: 'neutral', cancelled: 'neutral', rejected: 'neutral', deleted: 'neutral',
  hidden: 'bad', removed: 'bad', suspended: 'bad', deactivated: 'bad', unavailable: 'neutral',
};
export const statusTone = (status) => STATUS_TONES[status] ?? 'neutral';

export const formatPrice = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
export const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
export const formatDateTime = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
