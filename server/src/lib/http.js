export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const notFound = (what = 'Resource') => new HttpError(404, `${what} not found`);

export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const pageOf = (items, total, page, limit) => ({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });

// Sample listings and sellers are not real, so they cannot be reported.
export function refuseDemo(target) {
  if (target.isDemo) throw new HttpError(409, 'This is an example listing, so it cannot be requested, messaged or reported.');
}

export const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
