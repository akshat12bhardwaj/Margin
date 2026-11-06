import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from '../lib/http.js';
import { User } from '../models/User.js';

const COOKIE = 'token';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: config.isProd, path: '/' };

export function setAuthCookie(res, user) {
  const token = jwt.sign({ sub: user.id, v: user.tokenVersion }, config.jwtSecret, { algorithm: 'HS256', expiresIn: '7d' });
  res.cookie(COOKIE, token, { ...cookieOptions, maxAge: MAX_AGE });
}

export const clearAuthCookie = (res) => res.clearCookie(COOKIE, cookieOptions);

// The user is loaded on every request so suspensions and role changes apply immediately, not at token expiry.
export async function loadUser(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return next();
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    clearAuthCookie(res);
    return next();
  }
  const user = await User.findById(payload.sub).select('+tokenVersion');
  // Fictional sample accounts never have a session.
  if (user && user.tokenVersion === payload.v && user.status !== 'deactivated' && !user.isDemo) req.user = user;
  else clearAuthCookie(res);
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) throw new HttpError(401, 'Please log in');
  next();
}

function assertActive(req) {
  if (!req.user) throw new HttpError(401, 'Please log in');
  if (req.user.status !== 'active') throw new HttpError(403, `Your account is suspended: ${req.user.statusReason}`);
}

export function requireActive(req, res, next) {
  assertActive(req);
  next();
}

// Marketplace actions: buying, selling, messaging, reporting. Admins moderate and do not trade.
export function requireMember(req, res, next) {
  assertActive(req);
  if (req.user.role === 'admin') throw new HttpError(403, 'Administrator accounts cannot use marketplace actions');
  next();
}

export function requireAdmin(req, res, next) {
  assertActive(req);
  if (req.user.role !== 'admin') throw new HttpError(403, 'Administrator access required');
  next();
}
