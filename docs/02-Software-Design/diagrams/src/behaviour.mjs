// Sequence diagrams. Each follows the request path in server/src/routes and client/src/pages.
import { sequence } from './lib.mjs';

export const login = () => sequence({
  title: 'Figure 2.3  Sequence: log in with email and password',
  participants: [
    { id: 'u', label: 'Member', actor: true }, { id: 'c', label: 'React client\n(AuthPages.jsx)' },
    { id: 'a', label: 'Auth API\n(routes/auth.js)' }, { id: 'db', label: 'MongoDB\nusers' },
  ],
  gap: 240,
  steps: [
    ['u', 'c', 'enter email and password'],
    ['c', 'a', 'POST /api/auth/login {email, password}'],
    { note: 'rate limit: AUTH_RATE_LIMIT attempts per IP per 15 minutes\nzod validation of the body (rejects operator objects)', over: ['a'] },
    ['a', 'db', 'findOne({email}) with passwordHash'],
    ['db', 'a', 'user or null', { dashed: true }],
    ['a', 'a', 'bcrypt.compare (against a dummy hash\nwhen no user, so timing is the same)'],
    { frag: 'alt', branches: [
      { guard: 'no user or wrong password', steps: [['a', 'c', '401 Incorrect email or password', { dashed: true }], ['c', 'u', 'show error', { dashed: true }]] },
      { guard: 'account deactivated', steps: [['a', 'c', '403 account deactivated', { dashed: true }]] },
      { guard: 'valid', steps: [
        ['a', 'a', 'sign JWT {sub, tokenVersion}, HS256, 7 days'],
        ['a', 'c', '200 {user} + Set-Cookie (httpOnly, SameSite=Lax,\nSecure in production)', { dashed: true }],
        ['c', 'u', 'open dashboard', { dashed: true }],
      ] },
    ] },
    { divider: 'Every later request' },
    ['c', 'a', 'any /api request with the cookie'],
    ['a', 'db', 'loadUser: verify JWT, load user, compare tokenVersion'],
    ['a', 'a', 'requireAuth / requireMember / requireAdmin by route'],
  ],
});

export const google = () => sequence({
  title: 'Figure 2.4  Sequence: sign in with Google (OAuth 2.0 authorization code)',
  participants: [
    { id: 'u', label: 'Visitor or member', actor: true }, { id: 'c', label: 'React client' }, { id: 'a', label: 'Auth API' },
    { id: 'g', label: 'Google OAuth\nand OpenID Connect' }, { id: 'db', label: 'MongoDB\nusers' },
  ],
  gap: 215,
  steps: [
    ['u', 'c', 'Continue with Google'],
    ['c', 'a', 'GET /api/auth/google'],
    ['a', 'c', '302 to Google + random state cookie (10 min)', { dashed: true }],
    ['u', 'g', 'choose account and consent'],
    ['g', 'a', 'GET /api/auth/google/callback?code&state'],
    ['a', 'a', 'state must equal the cookie'],
    ['a', 'g', 'POST token endpoint (code, client secret)'],
    ['g', 'a', 'ID token (sub, email, email_verified)', { dashed: true }],
    ['a', 'a', 'check audience, issuer, verified email'],
    ['a', 'db', 'find user by googleId, else by email'],
    { frag: 'alt', branches: [
      { guard: 'existing student or faculty account', steps: [
        ['a', 'db', 'first Google sign-in: store googleId,\nremove password, end older sessions'],
        ['a', 'c', 'session cookie, redirect /dashboard', { dashed: true }],
      ] },
      { guard: 'no account yet', steps: [
        ['a', 'c', 'signed signup cookie (15 min), redirect /register/google', { dashed: true }],
        ['u', 'c', 'choose role, programme, semester'],
        ['c', 'a', 'POST /api/auth/google/complete'],
        ['a', 'db', 'create user with googleId (no password)'],
        ['a', 'c', '201 + session cookie', { dashed: true }],
      ] },
      { guard: 'admin, deactivated or different Google identity', steps: [['a', 'c', 'redirect /login?error=...', { dashed: true }]] },
    ] },
  ],
});

export const createListing = () => sequence({
  title: 'Figure 2.5  Sequence: create a book listing',
  participants: [
    { id: 's', label: 'Seller (member)', actor: true }, { id: 'c', label: 'Listing form\n(ListingForm.jsx)' }, { id: 'a', label: 'Books API\n(routes/books.js)' },
    { id: 'up', label: 'Upload middleware\nand storage' }, { id: 'db', label: 'MongoDB\nbooks' },
  ],
  gap: 215,
  steps: [
    ['s', 'c', 'enter details, choose subject from catalogue,\nsemester 1-8, selling price, add 1-6 photos'],
    ['c', 'c', 'browser checks: required fields, price ≥ 1,\nJPEG/PNG/WebP up to 5 MB'],
    ['c', 'a', 'POST /api/books (multipart form)'],
    ['a', 'a', 'requireMember (active student or faculty),\nrate limit 30 listings per hour'],
    ['a', 'up', 'multer: at most 6 files, 5 MB each'],
    ['a', 'a', 'zod listingSchema: subject ∈ SUBJECT_NAMES,\nprice > 0, semester 1-8, ISBN format'],
    { frag: 'alt', branches: [
      { guard: 'invalid fields or no photo', steps: [['a', 'c', '400 with per-field errors', { dashed: true }], ['c', 's', 'show errors beside fields', { dashed: true }]] },
      { guard: 'valid', steps: [
        ['a', 'up', 'checkedImages: file signature must match type'],
        ['up', 'up', 'saveImage: server/uploads or Cloudinary'],
        ['a', 'db', 'Book.create({..., seller, university, status: active})'],
        ['a', 'c', '201 {book}', { dashed: true }],
        ['c', 's', 'open the new listing page', { dashed: true }],
      ] },
    ] },
  ],
});

export const buyNow = () => sequence({
  title: 'Figure 2.6  Sequence: Buy now, acceptance and exchange confirmation',
  participants: [
    { id: 'b', label: 'Buyer', actor: true }, { id: 'c', label: 'React client\n(BookDetails, Messages)' }, { id: 'a', label: 'Requests API\n(routes/requests.js)' },
    { id: 'db', label: 'MongoDB\nbooks, requests,\nconversations, messages' }, { id: 's', label: 'Seller', actor: true },
  ],
  gap: 225,
  steps: [
    ['b', 'c', 'Buy now'],
    ['c', 'b', 'confirm dialog: title and full listed price', { dashed: true }],
    ['b', 'c', 'Send request at the listed price'],
    ['c', 'a', 'POST /api/requests {bookId}'],
    ['a', 'db', 'load book; refuse own listing, non-active book,\nor an open request by this buyer'],
    ['a', 'db', 'PurchaseRequest.create(price = listPrice, pending,\noffer by buyer)  [unique partial index]'],
    ['a', 'db', 'open conversation, post offer card, notify seller'],
    ['a', 'c', '201 {request}', { dashed: true }],
    ['c', 'a', 'POST /api/requests/:id/conversation'],
    ['c', 'b', 'open the chat for this request', { dashed: true }],
    { frag: 'alt', branches: [
      { guard: 'genuine seller', steps: [['s', 'a', 'PATCH /api/requests/:id/accept']] },
      { guard: 'automated example seller', steps: [['a', 'a', 'afterBuyerAction: full price, so accept']] },
    ] },
    ['a', 'db', 'book: active → reserved (conditional update)'],
    ['a', 'db', 'request: pending → accepted (compare-and-set);\naccepted card + notification'],
    { frag: 'loop', branches: [{ guard: 'until the exchange', steps: [
      ['b', 'a', 'POST /api/conversations/:id/messages (meeting place, time)'],
      ['a', 's', 'message + unread count + notification', { dashed: true }],
    ] }] },
    ['s', 'a', 'PATCH /api/requests/:id/complete (after handover, paid in person)'],
    ['a', 'db', 'book: reserved → sold; request → completed;\ncancel other open requests'],
    ['a', 'b', 'notification: marked as sold to you', { dashed: true }],
  ],
});

export const negotiation = () => sequence({
  title: 'Figure 2.7  Sequence: price negotiation (offer, counteroffer, accept)',
  participants: [
    { id: 'b', label: 'Buyer', actor: true }, { id: 'c', label: 'Chat\n(Messages.jsx)' }, { id: 'a', label: 'Requests API' },
    { id: 'db', label: 'MongoDB\nrequests, books,\nmessages' }, { id: 's', label: 'Seller', actor: true },
  ],
  gap: 225,
  steps: [
    ['b', 'c', 'Make an offer: ₹400 (listed at ₹490)'],
    ['c', 'a', 'POST /api/requests {bookId, offer: 400}'],
    ['a', 'a', 'offer must be a whole number, 0 to listed price'],
    ['a', 'db', 'create request: price 400, listPrice 490, offerBy buyer'],
    ['a', 's', 'offer card in chat + notification', { dashed: true }],
    { note: 'Automated seller (lib/autoSeller.js decide): accept at ≥ 90% of the listed price,\ndecline below 60%, otherwise counter halfway, rounded to ₹10, never below 90%.', over: ['a', 'db'] },
    ['s', 'a', 'PATCH /api/requests/:id/counter {amount: 450}'],
    ['a', 'a', 'responder check: only the party who did not make\nthe current offer may answer it'],
    ['a', 'db', 'findOneAndUpdate where {pending, offerBy: buyer, price: 400}\nset price 450, offerBy seller'],
    { frag: 'alt', branches: [
      { guard: 'offer changed meanwhile (no match)', steps: [['a', 's', '409 This offer has changed. Please reload.', { dashed: true }]] },
      { guard: 'updated', steps: [['a', 'b', 'counteroffer card ₹450 + notification', { dashed: true }]] },
    ] },
    ['b', 'a', 'PATCH /api/requests/:id/accept'],
    ['a', 'db', 'reserve book (active → reserved), then\nrequest accepted at ₹450'],
    ['a', 'c', 'accepted card; deal strip "Agreed at ₹450"', { dashed: true }],
    { note: 'The chat stays open after agreement for arranging the handover. The agreed price\nonly changes if a new request is made after this one is cancelled.', over: ['c', 'a'] },
  ],
});

export const reportModeration = () => sequence({
  title: 'Figure 2.8  Sequence: report a listing and administrator moderation',
  participants: [
    { id: 'm', label: 'Member', actor: true }, { id: 'r', label: 'Reports API\n(routes/reports.js)' }, { id: 'db', label: 'MongoDB\nreports, books,\naudit logs' },
    { id: 'ad', label: 'Admin API\n(routes/admin.js)' }, { id: 'x', label: 'Administrator', actor: true },
  ],
  gap: 225,
  steps: [
    ['m', 'r', 'POST /api/reports {targetType: book, targetId,\ncategory, description}'],
    ['r', 'db', 'listing exists, not own, not an example listing,\nno open report by this member on it'],
    ['r', 'db', 'Report.create(status pending); book.flagged = true'],
    ['r', 'm', '201 Report submitted', { dashed: true }],
    ['x', 'ad', 'GET /api/admin/reports?status=pending  (requireAdmin)'],
    ['ad', 'x', 'reports with reporter, target and listing', { dashed: true }],
    ['x', 'ad', 'PATCH /api/admin/reports/:id {status: under_review}'],
    ['ad', 'db', 'update report; AuditLog report.under_review'],
    ['x', 'ad', 'PATCH /api/admin/books/:id/hide {reason}'],
    ['ad', 'db', 'book → hidden (only from active, inactive, reserved);\ncancel open requests; AuditLog book.hide'],
    { note: 'The listing\'s seller (another member) is notified with the reason.', over: ['ad'] },
    ['x', 'ad', 'PATCH /api/admin/reports/:id {status: resolved, decision}'],
    ['ad', 'db', 'close report (final); unflag the book when no report\nis open; AuditLog report.resolved'],
    ['ad', 'm', 'notify reporter (and the reported user when upheld)', { dashed: true }],
  ],
});
