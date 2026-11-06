import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';
import { HttpError } from '../lib/http.js';
import { sendPasswordReset } from '../lib/mail.js';
import { optional, semester } from '../lib/schemas.js';
import { clearAuthCookie, requireAuth, setAuthCookie } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { UNIVERSITY, User } from '../models/User.js';

const BCRYPT_ROUNDS = 12;
// Compared when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

const email = z.string('Enter your email').trim().toLowerCase().max(254).pipe(z.email('Enter a valid email'));
// bcrypt ignores input beyond 72 bytes.
const password = z.string('Enter a password').min(8, 'Password must be at least 8 characters').refine((p) => Buffer.byteLength(p) <= 72, 'Password is too long');

const registerSchema = z.object({
  name: z.string('Enter your name').trim().min(2, 'Enter your name').max(80),
  email,
  password,
  // "admin" is deliberately not accepted here; admins are created by scripts/create-admin.js.
  role: z.enum(['student', 'faculty'], 'Choose student or faculty'),
  // University is not accepted: every account belongs to UNIVERSITY for now.
  program: optional(z.string().trim().max(80)),
  semester: semester,
  designation: optional(z.string().trim().max(80)),
});

const googleSignupSchema = registerSchema.omit({ name: true, email: true, password: true });

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const GOOGLE_STATE_COOKIE = 'google_state';
const GOOGLE_SIGNUP_COOKIE = 'google_signup';
const GOOGLE_SIGNUP_AUDIENCE = 'google-signup';
const googleCookie = { httpOnly: true, sameSite: 'lax', secure: config.isProd, path: '/api/auth/google' };
const googleRedirectUri = () => `${config.clientUrl}/api/auth/google/callback`;

// The ID token comes straight from Google over TLS, so OpenID Connect does not require checking its signature.
async function fetchGoogleProfile(code) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  if (!response.ok) throw new Error(`Google token exchange failed: ${response.status}`);
  const profile = jwt.decode((await response.json()).id_token);
  const valid = profile?.aud === config.googleClientId && ['https://accounts.google.com', 'accounts.google.com'].includes(profile.iss);
  if (!valid || !profile.sub || !profile.email || profile.email_verified !== true) throw new Error('Google returned an unusable ID token');
  return profile;
}

export function publicSelf(user) {
  const { _id, name, email: mail, role, university, program, semester, designation, bio, status, statusReason, createdAt, isDemo } = user;
  return { _id, name, email: mail, role, university, program, semester, designation, bio, status, statusReason, createdAt, isDemo };
}

export function authRouter({ authLimit = config.authRateLimit } = {}) {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: authLimit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please try again in a few minutes.' },
  });

  router.post('/register', limiter, validate({ body: registerSchema }), async (req, res) => {
    const { password: plain, role, semester, designation, ...fields } = req.data;
    if (await User.exists({ email: fields.email })) throw new HttpError(409, 'An account with this email already exists');
    const user = await User.create({
      ...fields,
      university: UNIVERSITY,
      role,
      semester: role === 'student' ? semester : undefined,
      designation: role === 'faculty' ? designation : '',
      passwordHash: await bcrypt.hash(plain, BCRYPT_ROUNDS),
    });
    setAuthCookie(res, user);
    res.status(201).json({ user: publicSelf(user) });
  });

  router.post('/login', limiter, validate({ body: z.object({ email, password: z.string('Enter your password').min(1, 'Enter your password').max(200) }) }), async (req, res) => {
    const user = await User.findOne({ email: req.data.email }).select('+passwordHash +tokenVersion');
    const ok = await bcrypt.compare(req.data.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new HttpError(401, 'Incorrect email or password');
    if (user.status === 'deactivated') throw new HttpError(403, 'This account has been deactivated. Contact the platform administrator.');
    setAuthCookie(res, user);
    res.json({ user: publicSelf(user) });
  });

  router.post('/logout', (req, res) => {
    clearAuthCookie(res);
    res.json({ ok: true });
  });

  router.get('/me', (req, res) => {
    res.json({ user: req.user ? publicSelf(req.user) : null, googleEnabled: Boolean(config.googleClientId && config.googleClientSecret) });
  });

  router.get('/google', (req, res) => {
    if (!config.googleClientId || !config.googleClientSecret) throw new HttpError(404, 'Google sign-in is not configured');
    const state = crypto.randomBytes(32).toString('hex');
    res.cookie(GOOGLE_STATE_COOKIE, state, { ...googleCookie, maxAge: 10 * 60 * 1000 });
    const params = new URLSearchParams({
      client_id: config.googleClientId,
      redirect_uri: googleRedirectUri(),
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });

  router.get('/google/callback', limiter, async (req, res) => {
    const fail = (reason) => res.redirect(`${config.clientUrl}/login?error=${reason}`);
    const { state, code } = req.query;
    const expected = req.cookies[GOOGLE_STATE_COOKIE];
    res.clearCookie(GOOGLE_STATE_COOKIE, googleCookie);
    if (!expected || state !== expected || typeof code !== 'string') return fail('google');

    let profile;
    try {
      profile = await fetchGoogleProfile(code);
    } catch (err) {
      console.error('Google sign-in failed:', err);
      return fail('google');
    }

    const mail = profile.email.toLowerCase();
    let user = (await User.findOne({ googleId: profile.sub }).select('+googleId +tokenVersion')) ?? (await User.findOne({ email: mail }).select('+googleId +tokenVersion'));
    if (!user) {
      // Google does not know the role or programme, so the account is created once the visitor supplies them.
      const name = (profile.name?.trim() || mail.split('@')[0]).slice(0, 80);
      const pending = jwt.sign({ gid: profile.sub, email: mail, name }, config.jwtSecret, { algorithm: 'HS256', expiresIn: '15m', audience: GOOGLE_SIGNUP_AUDIENCE });
      res.cookie(GOOGLE_SIGNUP_COOKIE, pending, { ...googleCookie, maxAge: 15 * 60 * 1000 });
      return res.redirect(`${config.clientUrl}/register/google`);
    }
    if (user.role === 'admin') return fail('google-admin');
    if (user.status === 'deactivated') return fail('deactivated');
    if (user.googleId && user.googleId !== profile.sub) return fail('google');
    if (!user.googleId) {
      // Registration never proves email ownership, so a password set before this could be an attacker's. Remove it and end those sessions.
      user = await User.findByIdAndUpdate(
        user.id,
        { googleId: profile.sub, $unset: { passwordHash: 1 }, $inc: { tokenVersion: 1 } },
        { returnDocument: 'after' },
      ).select('+tokenVersion');
    }
    setAuthCookie(res, user);
    res.redirect(`${config.clientUrl}/dashboard`);
  });

  router.post('/google/complete', limiter, validate({ body: googleSignupSchema }), async (req, res) => {
    let pending;
    try {
      pending = jwt.verify(req.cookies[GOOGLE_SIGNUP_COOKIE], config.jwtSecret, { algorithms: ['HS256'], audience: GOOGLE_SIGNUP_AUDIENCE });
    } catch {
      throw new HttpError(400, 'Your Google sign-in has expired. Please continue with Google again.');
    }
    if (await User.exists({ $or: [{ email: pending.email }, { googleId: pending.gid }] })) throw new HttpError(409, 'An account with this email already exists');
    const { role, semester, designation, ...fields } = req.data;
    const user = await User.create({
      ...fields,
      university: UNIVERSITY,
      name: pending.name,
      email: pending.email,
      googleId: pending.gid,
      role,
      semester: role === 'student' ? semester : undefined,
      designation: role === 'faculty' ? designation : '',
    });
    res.clearCookie(GOOGLE_SIGNUP_COOKIE, googleCookie);
    setAuthCookie(res, user);
    res.status(201).json({ user: publicSelf(user) });
  });

  router.post('/forgot-password', limiter, validate({ body: z.object({ email }) }), async (req, res) => {
    const token = crypto.randomBytes(32).toString('hex');
    const user = await User.findOneAndUpdate(
      { email: req.data.email, status: { $ne: 'deactivated' }, isDemo: { $ne: true } },
      { resetTokenHash: hashToken(token), resetTokenExpires: new Date(Date.now() + 60 * 60 * 1000) },
    );
    if (user) await sendPasswordReset(user.email, `${config.clientUrl}/reset-password/${token}`).catch((err) => console.error('Reset email failed:', err));
    // Same answer either way, so this cannot be used to discover accounts.
    res.json({ ok: true });
  });

  router.post('/reset-password', limiter, validate({ body: z.object({ token: z.string().length(64, 'Invalid reset link'), password }) }), async (req, res) => {
    const user = await User.findOneAndUpdate(
      { resetTokenHash: hashToken(req.data.token), resetTokenExpires: { $gt: new Date() } },
      {
        passwordHash: await bcrypt.hash(req.data.password, BCRYPT_ROUNDS),
        $inc: { tokenVersion: 1 },
        $unset: { resetTokenHash: 1, resetTokenExpires: 1 },
      },
    );
    if (!user) throw new HttpError(400, 'This reset link is invalid or has expired');
    clearAuthCookie(res);
    res.json({ ok: true });
  });

  router.post(
    '/change-password',
    requireAuth,
    limiter,
    validate({ body: z.object({ currentPassword: z.string('Enter your current password').min(1, 'Enter your current password').max(200), newPassword: password }) }),
    async (req, res) => {
      const user = await User.findById(req.user.id).select('+passwordHash +tokenVersion');
      if (!user.passwordHash) throw new HttpError(400, 'This account signs in with Google. Use "Forgot password" on the login page to set a password.');
      if (!(await bcrypt.compare(req.data.currentPassword, user.passwordHash))) throw new HttpError(400, 'Current password is incorrect');
      user.passwordHash = await bcrypt.hash(req.data.newPassword, BCRYPT_ROUNDS);
      user.tokenVersion += 1;
      await user.save();
      setAuthCookie(res, user);
      res.json({ ok: true });
    },
  );

  return router;
}
