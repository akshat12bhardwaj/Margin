# Margin: Academic Book Marketplace

A MERN marketplace where students and faculty of BML Munjal University (BMU) buy and sell used course books directly with each other. It is an independent personal project, not affiliated with or endorsed by BML Munjal University.

BMU is the only supported university for now: it is set by `UNIVERSITY` in `server/src/models/User.js` (and its copy in `client/src/constants.js`). Users and listings still store a `university` field, so more universities can be added later. An administrator supervises listings, reports and accounts.

The platform does **not** take payments. A purchase request is only a request: buyer and seller settle payment and handover in person.

## Main features

- Accounts for students and faculty: email and password, optional Google sign-in, password reset, profiles
- Listings with up to 6 photos, categorised by a fixed catalogue of 39 subjects and by semester (1 to 8)
- Search by title, author, ISBN, subject or course; filters for subject, semester, course, edition, price, condition and seller role
- Wishlist
- Buy now at the listed price, or offers and counteroffers in the chat; acceptance reserves the book; the seller confirms the in-person exchange
- Messaging per book, notifications, transaction history
- Reporting of listings and users; administrator moderation, account suspension, dashboard and audit log
- Optional example marketplace: real books from BMU course reading lists offered by fictional sellers who reply automatically, clearly labelled and removable
- Light and dark themes, responsive from phone to desktop

Technology: MongoDB, Express 5, React 19 (Vite), Node.js. Tests: Node's test runner with supertest, and Playwright.

## Requirements

- Node.js 22.9 or newer (tested on 26.8)
- MongoDB 6.0 or newer, local or Atlas (tested on 8.2). Partial unique indexes using `$in` need 6.0.

## Installation

```bash
npm install
npx -w e2e playwright install chromium   # only needed for the browser tests
```

Create `server/.env` from the template and set `JWT_SECRET`:

```bash
cp server/.env.example server/.env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Running

Development, with reload (site at http://localhost:5173, API on port 5000):

```bash
npm run dev
```

Production, with the API also serving the built site (http://localhost:5000):

```bash
npm run build
NODE_ENV=production npm start
```

On Windows PowerShell, set the variable first: `$env:NODE_ENV='production'; npm start`. Production cookies are `Secure`, so deploy behind HTTPS (`localhost` also works). Behind a reverse proxy, set `TRUST_PROXY=1`.

## Subjects

Listings are categorised by subject, chosen from one catalogue in `shared/subjects.mjs` that both the server and the client import. The API rejects any other value (create, edit and the `subject` search filter), so a direct request cannot invent one. Departments are no longer collected; existing department values stay in the database untouched. Listings no longer ask for an original price; any stored value is excluded from every API response (`select: false` on `Book.originalPrice`).

To add or rename a subject, edit the catalogue (each entry names an icon from `client/src/components/ui.jsx`), then migrate existing listings:

```bash
npm run migrate:subjects                                  # dry run: lists what would change and what is flagged
npm run migrate:subjects -- --apply                       # maps listings onto the catalogue; safe to re-run
npm run migrate:subjects -- --apply --remove-original-price   # also deletes stored original prices (cannot be undone)
```

The migration never guesses. A subject that matches no catalogue name or known handout course is reported and left as it is; the seller must pick a subject the next time they edit it. Sample listings are mapped per book from the handouts (`SUBJECT_BY_COURSE` and `SUBJECT_BY_BOOK` in `server/demo/seed.js`).

## Sample marketplace data

Fills a local database with fictional sellers and listings of real books from 17 BMU course reading lists. The reviewed book list is in `server/demo/`, so seeding needs nothing else. Open Library cover images are not included in the repository: without them, example listings show generated covers. `node server/demo/verify-catalog.js --online` downloads them into `server/demo/covers/`.

```bash
npm run seed:demo     # safe to re-run: creates nothing twice
npm run demo:remove   # deletes sample records only, never real members or listings
```

- Seeding refuses `NODE_ENV=production` and non-local databases unless you pass `--allow-production` (`npm run seed:demo -- --allow-production`). Only do that with explicit authorization.
- Every record carries `isDemo`. Accounts use `@demo.invalid` addresses and a discarded random password, and cannot log in or reset a password.
- Example listings show an "Example" badge and an example price. Members can message and make offers on them, and the fictional seller replies automatically (see Automated example sellers). They cannot be reported, and no notifications are stored for fictional sellers. Admin totals leave them out and report them separately.
- Fields a handout does not state stay empty; the site shows "Not stated".

To rebuild the catalogue (`server/demo/`) you need local copies of the course handouts, which are not part of this repository:

```bash
pip install pdfplumber
python server/demo/extract-handouts.py "course-handouts of Subjects"   # writes raw-references.json
node server/demo/verify-catalog.js                                     # checks catalog.json against it, writes extraction-summary.md
node server/demo/verify-catalog.js --online                            # also refreshes Open Library checks and covers
```

`catalog.json` is the reviewed list: each book names its handout and a phrase that must appear in that handout's reading list. Covers are from [Open Library](https://openlibrary.org). Each was reviewed by eye, and rejected ones are listed with reasons in `rejectedCovers`. Covers that show a different edition carry a `coverNotes` entry in `catalog.json`, shown under the image. Books without a suitable cover get a generated one.

## Automated example sellers

Every seeded seller has `isAutomatedSeller: true` (set only by `npm run seed:demo`, never through the API). Real members message and negotiate with them through the normal chat, and the seller answers from fixed rules in `server/src/lib/autoSeller.js`, with no external AI:

- **Chat replies** cover availability, condition, edition, discounts, offers typed as amounts (`₹400`, `Rs 400`, `would you take 400`), accepting, declining, meeting up and collection. Messages it cannot interpret get a neutral reply and never change a deal.
- **Prices** use `THRESHOLDS` in the same file. Offers at or above 90% of the listed price are accepted, offers below 60% are declined, and anything in between gets a counteroffer halfway, never below 90%. Every price change goes through the same request handlers as a human seller, so turn order, reservation and history rules are identical.
- **Suggested messages:** the chat shows three for the current stage (first contact, price talk, counteroffer, agreed, collection, sold). Clicking one sends it; the text box still sends anything typed.
- **Completing a sale:** the listing is reserved on agreement and marked sold when the buyer says they have collected the book.

The thread header says the seller is fictional and replies are automated. Conversations between real members are never answered automatically. Activity on example listings carries `isDemo`, is left out of admin totals and is deleted by `npm run demo:remove`.

## Appearance

Light is the default. Anyone switches theme with the sun/moon button in the top navigation bar. The choice is stored in `localStorage` (key `theme`) and applied by `client/public/theme.js` before the page renders, so there is no flash. Both themes come from the CSS variables at the top of `client/src/styles.css`; dark mode only redefines them under `:root[data-theme='dark']`.

## Creating an administrator

Administrators cannot register through the site. Create one from the command line:

```bash
npm run create-admin -- "Admin Name" admin@example.edu "a-password-of-12-or-more-characters"
```

Log in at `/login`, and you land on `/admin`.

## Environment variables (`server/.env`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes | Database connection string |
| `JWT_SECRET` | Yes | Signs login tokens, at least 32 characters. The server refuses to start without it. |
| `PORT` | No | API port, default 5000 |
| `NODE_ENV` | No | `production` enables secure cookies and stops reset links being logged |
| `CLIENT_URL` | No | Public site address used in reset links, default `http://localhost:5173` |
| `TRUST_PROXY` | No | Number of reverse proxies in front of the app, default 0 |
| `AUTH_RATE_LIMIT` | No | Auth attempts per IP per 15 minutes, default 20 |
| `CLOUDINARY_URL` | No | `cloudinary://key:secret@cloud`. Without it, images are stored in `server/uploads`. |
| `UPLOAD_DIR` | No | Folder for uploaded images when Cloudinary is not used, default `server/uploads` |
| `SMTP_URL` | No | `smtp://user:pass@host:587`. Without it, development prints reset links to the server console, and production sends nothing. |
| `MAIL_FROM` | No | Sender of reset emails |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | No | OAuth web client from Google Cloud Console, with `CLIENT_URL` + `/api/auth/google/callback` as an authorized redirect URI. Without them, the Google button is hidden. |

## Testing

```bash
npm test            # API tests with a real MongoDB, database academic_marketplace_test
npm run build       # the browser tests run against this build
npm run test:e2e    # Chromium tests, database academic_marketplace_e2e
```

Both suites reset only their own database and never touch development data. MongoDB must be running. The browser suite also checks all member and admin pages for horizontal overflow at 375, 768, 1024 and 1440 px wide, and saves screenshots to `e2e/test-results/screens`.

## Project structure

```
client/                 React (Vite) single-page app
  src/api.js            Fetch wrapper
  src/context/          Auth and toast state
  src/components/       Layout, route guards, shared UI, book and request cards
  src/pages/            Member pages
  src/pages/admin/      Admin dashboard, users, listings, reports, audit log
server/
  src/models/           User, Book, PurchaseRequest, Conversation, Message, Wishlist, Report, Notification, AuditLog
  src/middleware/       Authentication and roles, validation, uploads, errors
  src/routes/           REST API
  src/lib/              Storage, email, notifications, shared request logic
  scripts/              create-admin, seed-demo, remove-demo, migrate-subjects
  demo/                 Handout extraction, reviewed catalogue, covers, seed and migration logic, extraction-summary.md
  test/                 API tests
shared/subjects.mjs     Subject catalogue used by both client and server
e2e/                    Playwright browser tests
```

## Roles

| Capability | Visitor | Student / Faculty | Suspended member | Admin |
| --- | --- | --- | --- | --- |
| Browse books and public profiles | Yes | Yes | Yes | Yes |
| List, buy, message, wishlist, report | | Yes | | |
| Read own messages, history, notifications | | Yes | Yes | |
| Admin dashboard and moderation | | | | Yes |

Students and faculty have the same marketplace abilities; faculty listings carry a badge. Deactivated accounts cannot log in at all.

## Purchase workflow and negotiation

A buyer sends a request at the listed price or a lower offer. While it is `pending`, whoever did not make the current offer answers it: **accept**, **decline** (`rejected`) or **counter** with another amount (whole rupees, from 0 up to the listed price). The other side then answers the counteroffer the same way, back and forth.

`pending` → `accepted` at the agreed price (listing becomes `reserved`) → `completed` when the seller marks it sold (listing becomes `sold`). Open requests can be `cancelled` by either side, which returns a reserved listing to sale. When a book sells, other open requests are cancelled.

Each step is a compare-and-set on the status, whose turn it is and the amount, so double clicks and racing counteroffers cannot both win. Every step also appears in the request's conversation as an offer card, with the actions on the newest one, and in the request's history with its amount.

**A book cannot be sold twice.** A listing leaves `active` through an atomic conditional update, so only one accept can win. As a backstop, a unique partial index allows one accepted or completed request per book.

## REST API

All routes are under `/api`. Errors are `{ "error": "message", "fields": { ... } }`.

| Method and path | Access | Purpose |
| --- | --- | --- |
| `POST /auth/register`, `/auth/login`, `/auth/logout` | Public | Session (rate limited, JWT in an httpOnly cookie) |
| `GET /auth/me` | Public | Current user or null |
| `GET /auth/google`, `/auth/google/callback`, `POST /auth/google/complete` | Public | Google sign-in. New users supply their role (and programme or designation). Linking an existing account removes its password; admins cannot use Google. |
| `POST /auth/forgot-password`, `/auth/reset-password` | Public | Password reset (rate limited) |
| `POST /auth/change-password` | Logged in | Change password |
| `PATCH /users/me`, `GET /users/me/dashboard` | Logged in | Own profile and dashboard |
| `GET /users/:id` | Public | Public profile and listings |
| `GET /books`, `/books/facets`, `/books/:id` | Public | Search, filter (including `sellerRole`) and sort, filter options, details with related books |
| `GET /books/mine` | Logged in | Own listings |
| `POST /books`, `PATCH /books/:id`, `PATCH /books/:id/status`, `DELETE /books/:id` | Member, owner | Manage listings (multipart, up to 6 images of 5 MB) |
| `GET`/`POST /wishlist`, `DELETE /wishlist/:bookId` | Member | Wishlist |
| `POST /requests` (`bookId`, optional `offer`, `message`), `GET /requests?side=&state=` | Member | Create and list purchase requests |
| `PATCH /requests/:id/accept`, `/reject`, `/counter` | The party answering the current offer | Accept, decline, or counter with `{ amount }` |
| `PATCH /requests/:id/complete` | Seller | Mark an accepted request sold |
| `PATCH /requests/:id/cancel`, `POST /requests/:id/conversation` | Either party | Cancel, or open the chat |
| `GET`/`POST /conversations`, `GET /conversations/:id`, `POST /conversations/:id/messages` | Participants | Messaging |
| `GET /notifications`, `/notifications/summary`, `PATCH /notifications/read-all`, `/notifications/:id/read` | Logged in | Notifications |
| `POST /reports` | Member | Report a listing or user |
| `GET /admin/stats`, `/admin/audit-logs` | Admin | Dashboard and audit log |
| `GET /admin/users`, `/admin/users/:id`; `PATCH /admin/users/:id/suspend`, `/deactivate`, `/restore` | Admin | User management |
| `GET /admin/books`, `/admin/books/:id`; `PATCH /admin/books/:id/hide`, `/remove`, `/restore` | Admin | Listing moderation |
| `GET /admin/reports`, `PATCH /admin/reports/:id` | Admin | Report handling |

## Security

- Passwords hashed with bcrypt (12 rounds). JWTs live in `httpOnly`, `SameSite=Lax` cookies, and changing a password invalidates older tokens.
- The user is reloaded on every request, so suspensions apply immediately.
- All input is validated with Zod, so request bodies cannot carry query operators or set protected fields such as role, status or seller.
- Uploads are checked by file content, not just by declared type.
- Rate limits cover authentication, listing creation, messages and reports. Helmet sets security headers.
- Outsiders get a 404 for conversations and requests they are not part of.

## Known limitations

- **Sample books are only as good as the handouts:** see `server/demo/extraction-summary.md` for corrected, uncertain and excluded entries. Listing conditions, prices and sellers are invented on purpose, and labelled.
- **Older editions by faculty:** sample faculty copies use the handout's edition, because inventing an older edition would mean inventing bibliographic data.

- **No payments:** deliberately out of scope for now; exchanges happen offline.
- **Faculty status is self-declared:** there is no email-domain or identity verification, so the faculty badge is not proof of employment.
- **Email addresses are not verified** at registration.
- **Password reset needs `SMTP_URL`** to send real email. Sending has not been tested against a real mail server.
- **Cloudinary needs `CLOUDINARY_URL`.** That code path has not been tested against a real account; local image storage is what the tests cover. Local files do not survive hosts with temporary disks.
- **Messages and badges update by polling** (every 5 and 20 seconds), not instantly.
- **Admins cannot read private messages**, so harassment reports rely on the reporter's description.
- **Search uses unanchored regular expressions.** This suits a campus-sized catalogue, but needs a search index at large scale.
- **Rate limit counters live in memory**, so they reset on restart and are per process.
- **Currency is fixed to rupees (₹).**
- **Multi-step updates are not transactional**, because a standalone MongoDB has none. Each step is conditional and the unique indexes protect against double sales, but a crash between steps could leave, for example, a notification unsent.
