# Software Quality and Maintenance: Margin

Course book exchange marketplace · CSE3005 Software Engineering · BML Munjal University

Version 1.0 · 6 November 2026 · Prepared by: Margin project team

## 1. Purpose

This document describes how quality is built into Margin (quality assurance), how it is checked (quality control), how the system is maintained, how changes are controlled, and which security protections are implemented. Examples are taken from the repository and its development log (`the project milestones recorded in the SDLC document`).

## 2. Quality assurance

### 2.1 Coding standards and guidelines

| Standard | Practice in the code |
| --- | --- |
| One language and module system | Modern JavaScript (ES modules) on client and server; React function components with hooks |
| Consistent structure | Server: `routes/` (one router per resource), `middleware/`, `lib/` (shared services), `models/` (one per collection). Client: `pages/`, `components/`, `context/`, `hooks.js`, `api.js` |
| Naming | Descriptive names for intent (`createRequest`, `cancelOpenRequests`, `requireMember`); constants in capitals (`CONDITIONS`, `THRESHOLDS`, `SUBJECT_NAMES`) |
| Comments | Explain why, not what (for example why a counteroffer must differ, or why a store stays open); known limits are marked `shortcut:` with the upgrade path |
| Single source of truth | Shared constants (subjects, conditions, statuses, university) defined once; the subject catalogue is one module imported by client and server |
| Configuration | Environment variables listed in `server/.env.example`; secrets never committed in code; the server refuses to start with a JWT secret under 32 characters |

### 2.2 Validation practices

- Every route validates its parameters, query and body with a zod schema (`middleware/validate.js`) before any database access. Errors return 400 with one message per field.
- The client repeats the important checks (required fields, ranges, file types) for faster feedback, but the server never relies on them.
- Values with a fixed set of options (subject, condition, status, role, report category) are enums in both validation and schema.
- Amounts are whole rupees within a range; prices must be positive; semesters are 1 to 8.

### 2.3 Error handling

- A central error handler (`middleware/error.js`) turns known errors (`HttpError`, validation, duplicate keys) into clear status codes and messages, and logs unexpected errors while returning a generic message.
- Conflicts are explicit: acting on a request that changed returns 409 ("This offer has changed. Please reload.") instead of silently overwriting.
- Startup fails fast if MongoDB is unreachable or a unique index cannot be built, so the system never runs without its integrity guarantees.

### 2.4 Testing practices

- Every workflow has an automated API test against a real MongoDB database and a browser test of the same flow (docs/04-Testing).
- Tests run on isolated databases; the browser setup refuses to reset any database other than its own.
- A feature is complete only when both suites and the production build pass.

## 3. Quality control

| Activity | How it is done | Recorded where |
| --- | --- | --- |
| Test execution | `npm test` (64 API tests) and `npm run test:e2e` (16 browser tests) after every change | `docs/04-Testing/evidence/`, the project milestones recorded in the SDLC document |
| Defect identification | Failing tests, visual review of screenshots at four widths, and review of each increment | the project milestones recorded in the SDLC document "Bugs found and fixed" |
| Defect correction | Root cause fixed in the shared code; a test is added where the defect could recur | Code and test files |
| Regression verification | Both suites re-run in full after each fix | Test counts in the project milestones recorded in the SDLC document |
| Static checks | `npm audit --omit=dev` for vulnerable dependencies; production build compiles every client module | `evidence/npm-audit.txt`, `evidence/build.txt` |

Examples of the cycle, from the project milestones recorded in the SDLC document and the current run:

- The overflow test found that a screen-reader-only table header widened administrator pages on phones. The style was corrected and the test now guards all pages.
- The showcase test found that rotation did not pause when the pointer was already over the showcase after going back. The pause was moved to a pointer-movement event, and the test re-ran 16 of 16.
- A handout ISBN failed its checksum during data verification and was left out instead of being stored with an error.

## 4. Maintenance

Maintenance is necessary because requirements, data and the environment keep changing after delivery. Margin's history already shows all four types.

| Type | Meaning | Examples from Margin |
| --- | --- | --- |
| Corrective | Fixing defects | Blank price coerced to 0 (would list a free book); account menu not opening on mobile; showcase not pausing after navigating back; generated covers showing coloured bands |
| Adaptive | Keeping the system working in a changed environment | Optional Cloudinary storage and SMTP for hosted use; `TRUST_PROXY` for correct rate limiting behind a reverse proxy; Secure cookies in production; relying on Express 5's query parsing, which ignores nested operator keys |
| Perfective | Improving or extending functionality in response to user needs | Subject catalogue replacing free-text departments; removing the original-price field; separate Buy now, Message seller and Save to wishlist actions; light and dark themes; automated example sellers |
| Preventive | Changes that lower the risk of future failure | Database-level unique index so a listing can never have two winning buyers; rate limit on listing creation; hiding stored original prices from every query (`select: false`); idempotent seed and migration scripts with dry runs; removal of the demo account switcher, so fictional accounts can never hold a session |

### 4.1 Reverse engineering

The design models were recovered from the implementation: the class diagram and database tables from the Mongoose schemas, the sequence diagrams from the route handlers, and the DFDs from the flows between routes and collections. Keeping the diagram sources next to the document, with automatic balance checks, makes it practical to re-derive the design after each change.

## 5. Change management

Every modification goes through the same steps:

1. **Inspect:** find every place the change reaches (callers, schemas, pages, tests, documentation) and what it could break, especially stored data.
2. **Plan:** choose the smallest complete change and record it as a subgoal in the project milestones recorded in the SDLC document.
3. **Assess data impact:** a change to stored data gets a repeatable script with a dry run (for example `npm run migrate:subjects`). Irreversible steps, such as deleting stored original prices (`--remove-original-price`), are only run with explicit approval. Record counts are compared before and after.
4. **Implement and test:** update or add tests, then run both suites and the build.
5. **Verify visually** where the interface changed, at phone and desktop widths.
6. **Record:** update the project milestones recorded in the SDLC document with status, evidence and anything not done.

Example: replacing departments with subjects changed the schema validation, five pages and the stored data. The migration ran first as a dry run (100 listings to map, 1 flagged as uncertain), was applied after a backup, and a second run confirmed nothing was left to map. Listing counts were the same before and after.

## 6. Security

| Area | Implemented protection |
| --- | --- |
| Authentication | bcrypt password hashes (cost 12), generic login errors, the same work whether or not the email exists, per-IP rate limit on login, registration and reset. Google sign-in uses the authorization code flow with a random state value and checks the token's audience, issuer and verified email |
| Sessions | JWT signed with HS256 in an httpOnly, SameSite=Lax cookie (Secure in production), valid for 7 days. A token version on the user ends older sessions after a password reset or change and after Google linking; a deactivated account is refused on every request |
| Authorisation | `requireAuth`, `requireMember` (active student or faculty) and `requireAdmin` on every protected route; ownership checks on listings, requests and conversations, returning 404 so outsiders cannot learn what exists. No self-registration as administrator; role and status cannot be changed through the API |
| User data | Password hash, Google ID, token version and reset fields are excluded from queries by default. Public profiles and listings never include email addresses. Reset tokens are stored only as hashes, single-use, and expire after one hour |
| API validation | zod schemas on all input; 100 kB JSON limit; uploads limited to 6 files of 5 MB with a file-signature check; regular-expression input escaped in search |
| HTTP | helmet security headers with a Content Security Policy |
| Administrative actions | Reasons required; every action written to the append-only audit log with the administrator's ID; closed report decisions cannot be rewritten; administrators cannot be moderated through the panel |
| Transaction integrity | Conditional (compare-and-set) state changes; partial unique indexes for one open request per buyer and one winning buyer per listing; turn-taking in negotiation enforced on the server |
| Example data | Fictional accounts use `@demo.invalid` addresses, have unusable passwords and cannot hold a session; seeding refuses production and remote databases unless explicitly authorised |

Not implemented: email verification at registration, multi-factor authentication, CSRF tokens (the SameSite=Lax cookie is the only CSRF defence), and automated scheduled backups.
