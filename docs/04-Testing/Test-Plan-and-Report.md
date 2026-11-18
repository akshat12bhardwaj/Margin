# Software Test Plan and Report: Margin

Course book exchange marketplace · CSE3005 Software Engineering · BML Munjal University

Version 1.0 · test run of 6 November 2026, 21:13 IST · Prepared by: Margin project team

## 1. Scope and approach

This document plans and reports verification and validation of Margin against the SRS (docs/01-SRS). Verification asks whether the system was built as specified: automated tests check each requirement. Validation asks whether it does what users need: complete browser workflows are run as a student, a faculty member and an administrator, and pages are reviewed at four screen widths.

| Level | What is tested | Tool | Location |
| --- | --- | --- | --- |
| Unit | Pure functions: negotiation rules (`decide`), message interpretation (`classify`, `parseAmount`), suggestions, ISBN checksum, seeding safeguards, listing plan | Node.js test runner (`node:test`) | `server/test/auto-seller.test.js`, `server/test/demo.test.js` |
| Integration | Each API route through HTTP to a real MongoDB database: validation, authorisation, state changes, database constraints | `node:test` + supertest | `server/test/*.test.js` (64 tests) |
| System | Complete workflows in a real browser against the running server and client build | Playwright (Chromium) | `e2e/tests/marketplace.spec.js` (16 tests) |
| Regression | Both suites re-run in full after every change | npm scripts | `npm test`, `npm run test:e2e` |
| Performance | Response time of catalogue endpoints, sequential and 20 concurrent | Measurement script | `evidence/perf-measure.mjs` |
| Security | Authentication, authorisation, input validation, injection, upload checks, dependency audit | Tests above + `npm audit` | see Section 5 |

Test isolation: API tests use a throw-away database per run (`server/test/helpers.js`). Browser tests use the separate `academic_marketplace_e2e` database, which their setup empties; the setup refuses to touch any other database. Neither suite touches the development data.

## 2. Environment

| Item | Value |
| --- | --- |
| Machine | Intel Core i7-14700HX, 28 logical cores, 32 GB RAM, Windows 11 |
| Runtime | Node.js 26.8.1, MongoDB 8.2 (local, standalone) |
| Browser | Chromium (Playwright) |
| Build | `npm run build` (Vite) succeeded, see `evidence/build.txt` |

## 3. Summary of results

| Suite | Command | Result | Evidence |
| --- | --- | --- | --- |
| API unit and integration tests | `npm test` | 64 passed, 0 failed (29.4 s) | `evidence/api-tests.sanitized.txt` |
| Browser system tests | `npm run test:e2e` | 16 passed, 0 failed (1.4 min) | `evidence/browser-tests.sanitized.txt` |
| Dependency audit | `npm audit --omit=dev` | 0 vulnerabilities | `evidence/npm-audit.txt` |
| Production build | `npm run build` | Succeeded | `evidence/build.txt` |
| Performance sample | `node docs/04-Testing/evidence/perf-measure.mjs` | Section 6 | `evidence/performance.txt` |

Status values: PASS (executed, result as expected), FAIL (executed, result differs), BLOCKED (could not be executed in this environment), NOT EXECUTED (planned, not run). A test is marked PASS only when it ran in the recorded run and passed.

## 4. Test cases

"API" names a test in `server/test`; "Browser" names a test in `e2e/tests/marketplace.spec.js`. Actual results come from the run on 6 November 2026.

| ID | Module | Objective | Preconditions | Test input | Execution steps | Expected result | Actual result | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TC-01 | Registration | Register students and faculty; reject bad input | Empty test database | Valid student and faculty details; invalid email; short password; duplicate email | API "registration hashes the password and sets an httpOnly cookie", "registration validation and duplicate email"; Browser "registration, validation errors and login" | 201 and httpOnly cookie; stored password is a bcrypt hash; field errors for invalid input; 409 for a duplicate email | As expected | PASS |
| TC-02 | Registration | Prevent privilege escalation at sign-up | – | `role: admin`, `status: suspended` in the body | API "cannot self-register as admin, or set status through registration" | Admin role refused; status ignored | As expected | PASS |
| TC-03 | Login | Log in, read the session, log out | Registered member | Correct and wrong credentials | API "login, /me, logout" | Session cookie on success; 401 on wrong credentials; `/me` empty after logout | As expected | PASS |
| TC-04 | Session | Reject forged sessions | – | Garbage and wrongly signed JWT cookies | API "a forged or garbage token is not accepted" | Treated as logged out | As expected | PASS |
| TC-05 | Login | Resist NoSQL operator injection | Registered member | `{"email": {"$gt": ""}, "password": {"$gt": ""}}` | API "NoSQL operator injection on login is rejected" | 400 validation error, no login | As expected | PASS |
| TC-06 | Login | Rate limit login attempts | Low limit configured for the test | Repeated wrong passwords | API "login is rate limited" | 429 after the limit | As expected | PASS |
| TC-07 | Password reset | Reset is single-use and does not reveal accounts | Member with a session | Known and unknown email; token used twice | API "password reset: single use, unknown email is indistinguishable, old sessions die" | Same response for both emails; second use refused; older sessions invalid | As expected | PASS |
| TC-08 | Password change | Require the current password | Logged-in member | Wrong, then correct current password | API "change password requires the current one and keeps this session" | 400 for wrong current password; success keeps this session | As expected | PASS |
| TC-09 | Authorisation | Guard protected and admin routes | Visitor, member and admin | Requests to every admin route; visits to /dashboard and /admin | API "role guards: anonymous gets 401, members 403 on all admin routes"; Browser "protected and admin routes are guarded in the UI" | 401 anonymous, 403 member; pages redirect to login | As expected | PASS |
| TC-10 | Profile | Profile edits cannot change role or status; public profile hides private data | Member | `role`, `status` in the update; public profile request | API "profile update cannot change role or status", "public profile exposes no email or secrets"; Browser "forgot password page and profile editing" | Role and status unchanged; no email, hash or Google ID in the public profile; edits saved | As expected | PASS |
| TC-11 | Google sign-in | New Google user completes sign-up | Google configured; token endpoint stubbed | Valid stubbed ID token | API "/me says Google sign-in is available", "a new Google user finishes signup and can sign in again", "signup cannot be completed without a Google cookie, or with a session token", "a signup token is not accepted as a session" | Account created with Google ID and no password; later sign-in works | As expected | PASS |
| TC-12 | Google sign-in | Linking and refusals | Existing accounts | Same email as a password account; other Google ID; admin; deactivated; unverified email; wrong audience or issuer; mismatched state | API "linking an existing account removes its password and ends its sessions", "a different Google identity cannot take over a linked account", "admin and deactivated accounts cannot use Google", "unverified email, wrong audience and wrong issuer are rejected", "a callback without the matching state is rejected before contacting Google" | Link succeeds and ends older sessions; every refusal case redirects with an error | As expected | PASS |
| TC-13 | Create listing | Students and faculty list books; visitors cannot | Members logged in | Complete listing with two photos; no photo | API "students and faculty can list; anonymous users cannot"; Browser "student and faculty can list books, with photo validation" | 201 for members, 401 anonymous; missing photo blocked with a message; listing page opens | As expected | PASS |
| TC-14 | Create listing | Validate fields and uploads | Member | Fake PNG (script text), .exe, 6 MB file, blank price, unknown condition, 3-digit ISBN, semester 0, 9, 2.5 | API "upload rules: photo required, fake images and wrong types rejected, multiple accepted", "listing validation: blank price is an error, not a free book" | Each invalid input refused with 400; valid images accepted and served with the right type | As expected | PASS |
| TC-15 | Subjects, price | Only catalogue subjects; no original price | Member | Subjects "", "Algorithms", trailing space, HTML; price 0 and -5; `originalPrice`, `department` fields; legacy stored original price | API "subjects come from the catalogue; original price and department are not collected", "a stored legacy original price never reaches the API" | Invalid subjects and prices refused; extra fields not stored; stored original price absent from all four responses | As expected | PASS |
| TC-16 | Edit listing | Only the owner edits; photos and optional fields update | Two members, one listing | Edit by non-owner; forged `seller`, `status`; photo replacement; cleared ISBN | API "ownership: only the owner can edit, change status or delete", "edit: replaces photos, clears optionals, refuses zero photos"; Browser "listing management: edit, deactivate, reactivate, delete" | 404 or 409 for the non-owner; forged fields ignored; old photo deleted; subject change persisted | As expected | PASS |
| TC-17 | Delete listing | Deactivate and delete | Listing with a watcher | Deactivate, reactivate, delete | API "deactivate hides a listing from others; delete removes it"; Browser "listing management: edit, deactivate, reactivate, delete" | Hidden from others while inactive; deleted listing gone from search | As expected | PASS |
| TC-18 | Search and filters | Keyword, filters, sorting, paging | Two or three test listings | Title, author, ISBN with hyphens, regex characters; subject, semester, course, edition, condition, price, seller role, combined; sort orders; page 2; `university[$ne]` | API "search, filters, sorting and pagination"; Browser "browse: search, filters, sorting, category link" | Exactly the matching listings; unknown subject refused; operator payload ignored; clearing filters restores all; subject card opens the filter | As expected | PASS |
| TC-19 | Wishlist | Save, list and remove | Member, listings | Save twice; listing later sold or removed | API "wishlist: add is idempotent, shows sold and removed listings as such, remove works"; Browser "purchase workflow with messages, wishlist and notifications" | One entry; status shown; removal works | As expected | PASS |
| TC-20 | Buy now | Full-price request through a genuine seller to completion | Faculty seller's ₹350 listing; student buyer | Buy now, confirm | Browser "buy now: full-price request, seller accepts, chat stays open, seller confirms the exchange" | Exactly three actions shown; dialog shows title and ₹350; request pending at ₹350 and listing still available; after accept, reserved and chat still usable; after Mark as sold, request completed at ₹350 with history pending → accepted → completed and listing sold | As expected | PASS |
| TC-21 | Purchase | Request, accept, coordinate, sold | Seller and buyer | Request at listed price | API "full workflow: request, accept, coordinate, sold, history, notifications" | States and notifications in order; transaction history for both | As expected | PASS |
| TC-22 | Negotiation | Offer, counteroffer, accept at the agreed price | Active listing, buyer, seller | Offer below the listed price (₹380 in the browser test), counter (₹420), accept | API "offer, counteroffer, accept at the agreed price, then sold; each step lands in the chat"; Browser "purchase workflow with messages, wishlist and notifications" | Agreed price stored; each step appears as a card in the chat | As expected | PASS |
| TC-23 | Negotiation | Refuse invalid and stale actions | Pending request | Negative, fractional and above-price amounts; outsider; answering own offer; stale accept | API "invalid amounts, outsiders and stale or duplicate actions are refused" | 400, 403, 404 or 409 as appropriate; no state change | As expected | PASS |
| TC-24 | Duplicate prevention | One open request per buyer; no self-request | Listing | Two requests by one buyer, concurrently; seller requests own book | API "duplicate and self requests are refused, including under a race" | Second request and self-request refused | As expected | PASS |
| TC-25 | Cancellation | Cancelling frees the listing | Accepted request | Cancel | API "cancelling an accepted request frees the listing for the next buyer; rejected buyers may ask again" | Listing active again; another buyer can request | As expected | PASS |
| TC-26 | Authorisation | Outsiders cannot act on requests | Request between two others | Third party actions; complete on a pending request | API "outsiders see 404 on request actions; complete requires an accepted request" | 404 for outsiders; 409 for complete before acceptance | As expected | PASS |
| TC-27 | Concurrency | Exactly one of two simultaneous accepts wins | Two buyers' pending requests | Two accepts in parallel | API "concurrent accepts of different buyers: exactly one wins" | One accepted, one refused; listing reserved once | As expected | PASS |
| TC-28 | Database integrity | The database itself refuses a second winner | Accepted request | Direct insert of a second accepted request | API "the database itself refuses a second winning buyer" | Duplicate key error from MongoDB | As expected | PASS |
| TC-29 | Messaging | Conversation flow and privacy | Buyer, seller, outsider | Messages both ways; outsider reads | API "messaging: conversation flow, privacy, unread counts and notifications", "either party can open the chat for a request; outsiders cannot" | Messages delivered; unread counts correct; outsider gets 404 | As expected | PASS |
| TC-30 | Notifications | Mark read | Member with notifications | Mark one, mark all; another user's notification | API "notifications: mark one and all as read, cannot touch another user's" | Counts update; other user's notification untouched | As expected | PASS |
| TC-31 | Reporting | File reports safely | Member, listing, seller | Report, duplicate, self-report, forged status | API "reporting: flags the listing, blocks duplicates and self-reports, ignores forged status" | Listing flagged; duplicate and self-report refused; status stays pending | As expected | PASS |
| TC-32 | Report review | Status flow and final decisions | Open report, admin | Under review; resolve without, then with decision; change after closing | API "report handling: status flow, decision required, final once closed, parties notified, audited" | Decision required; closed report final; parties notified; audit entries | As expected | PASS |
| TC-33 | Listing moderation | Hide, restore, remove | Listing with open deals | Hide, restore, remove with and without reason | API "listing moderation: hide, restore, remove; open deals are cancelled; reason required", "restore clears a wrongly flagged but still active listing" | Reason required; open requests cancelled; restore unflags | As expected | PASS |
| TC-34 | Account moderation | Suspend, deactivate, restore; admins protected | Members, admin | Suspend, act while suspended, restore; deactivate; moderate an admin | API "suspension: immediate, blocks actions but not reading, hides listings, restore brings them back", "deactivation ends sessions and blocks login", "admins cannot be moderated, and do not trade"; Browser "reports, moderation, suspension and role isolation" | Immediate effect; reading allowed but not trading; listings hidden and restored; deactivated cannot log in; admin moderation refused | As expected | PASS |
| TC-35 | Dashboard | Statistics use real data | Members, example data, reports | Dashboard request; user filters | API "dashboard stats and repeat offender tracking use real data", "admin user filters" | Example data counted separately; filters return matching users | As expected | PASS |
| TC-36 | Home page | Showcase covers open their own listings; keyboard and touch | Example data seeded | Hover, click, Tab plus Enter, tap twice | Browser "home showcase: three covers only, spotlight on hover, each opens its own listing before and after rotation", "the mobile menu opens and every item works" | No overlays; hovered cover lit, others dimmed; each opens its listing before and after rotation; keyboard and two-tap touch work | As expected | PASS |
| TC-37 | Responsive layout | No horizontal overflow | All pages | Widths 375, 768, 1024, 1440 px | Browser "responsive: no horizontal overflow on any page at phone, tablet, laptop and desktop" | No page wider than the screen | As expected | PASS |
| TC-38 | Automated sellers | Scripted replies and negotiation through real workflows | Fictional seller listing; real member | Chips, typed questions, offers, accept, collected | API auto-seller tests (7, e.g. "a real member chats and negotiates with an automated seller, through to a completed sale", "conversations between real members get no automated replies"); Browser "an automated example seller answers chat and negotiates, without switching accounts" | Rules followed (accept ≥ 90%, decline < 60%, counter halfway); sale completes; no replies in real-member chats | As expected | PASS |
| TC-39 | Example data | Seeding, removal and subject migration are safe | Real member and listing present | Seed twice, remove; migrate with legacy subjects | API "seeding is idempotent, and removal leaves real data alone", "seeding refuses production and remote databases unless authorized", "subject migration maps known subjects, flags uncertain ones and is idempotent"; Browser "sample data: seeded listings are labelled, searchable and cannot be reported", "removing sample data keeps real members and listings" | Second seed creates nothing; real data untouched; uncertain subjects flagged, not guessed; re-run changes nothing | As expected | PASS |
| TC-40 | Performance | Catalogue response time | Server and MongoDB on one machine, 168 listings | 200 sequential and 200 concurrent (20 at a time) requests per endpoint | `perf-measure.mjs` | Median < 50 ms, p95 < 100 ms | Median 15.3 to 27.9 ms, p95 17.7 to 37.6 ms (Section 6) | PASS |
| TC-41 | Security | No vulnerable production dependencies | Installed dependencies | – | `npm audit --omit=dev` | 0 vulnerabilities | 0 vulnerabilities | PASS |
| TC-42 | Build | Production client builds | – | – | `npm run build` | Build succeeds | Succeeded | PASS |
| TC-43 | Runtime errors | No uncaught browser errors during all workflows | Whole browser run | – | Browser "no uncaught browser errors happened during the whole run" | No page errors or unexpected console errors | As expected | PASS |
| TC-44 | Theme | Light and dark themes persist | Browser | Toggle, reload, toggle back | Browser "forgot password page and profile editing" | Dark applies at once, survives reload, light restores | As expected | PASS |
| TC-45 | Google sign-in (live) | Sign in with a real Google account | Google client ID and secret; Google account | Real consent screen | Manual sign-in in a browser | Account linked or created | Not run: needs an interactive Google login; automated tests stub Google's token endpoint | BLOCKED |
| TC-46 | Email delivery | Reset link arrives by email | `SMTP_URL` configured | Reset request | Manual | Email received | Not run: no SMTP server configured; links are printed to the console in development | NOT EXECUTED |
| TC-47 | Compatibility | Firefox, Safari and physical phones | Devices | – | Manual | Same behaviour as Chromium | Not run | NOT EXECUTED |
| TC-48 | Load | Behaviour beyond 20 concurrent requests | Load tool | – | – | Stable response times | Not run | NOT EXECUTED |

Totals: 44 PASS, 0 FAIL, 1 BLOCKED, 3 NOT EXECUTED.

## 5. Security testing

| Threat | Control | Test |
| --- | --- | --- |
| Password theft | bcrypt (cost 12); hash never returned | TC-01, TC-10 |
| Session forgery or theft | Signed JWT in httpOnly, SameSite=Lax cookie (Secure in production); token version ends old sessions | TC-04, TC-07, TC-12 |
| Brute force | Per-IP authentication limit; listing, message and report limits | TC-06 |
| Privilege escalation | No admin self-registration; role and status not editable; guards on every route | TC-02, TC-09, TC-10, TC-34 |
| Injection | zod validation; Express 5 ignores nested query keys; regex input escaped | TC-05, TC-18 |
| Malicious uploads | Type, size and count limits; file signature must match the type | TC-14 |
| Unauthorised data access | Ownership checks return 404 to outsiders; public data excludes email and secrets | TC-16, TC-26, TC-29, TC-15 |
| Race conditions | Conditional updates; partial unique indexes | TC-24, TC-27, TC-28 |
| Vulnerable dependencies | `npm audit` | TC-41 |

Not performed: penetration testing by a third party, automated vulnerability scanning of the running site, and CSRF testing beyond the SameSite cookie setting.

## 6. Performance testing

Measured with `evidence/perf-measure.mjs` on the development machine (Section 2) against the development database (168 listings). Read-only; no data was changed.

| Endpoint | Sequential median (ms) | Sequential p95 (ms) | 20 concurrent median (ms) | 20 concurrent p95 (ms) |
| --- | --- | --- | --- | --- |
| Browse page (12 listings) | 15.5 | 18.1 | 22.8 | 35.3 |
| Keyword search | 15.3 | 19.1 | 22.9 | 33.2 |
| Subject + semester + price filter | 15.5 | 18.3 | 27.9 | 32.5 |
| Home facets | 15.5 | 17.7 | 18.3 | 37.6 |
| Listing details | 15.5 | 19.6 | 23.8 | 33.4 |

Limits: one machine, client and server on the same host (no network latency), small data set. The results show the API is not a bottleneck at campus scale; they are not a capacity claim for larger loads (TC-48).

## 7. Regression testing and automation

Both suites are fully automated and run with one command each. They were re-run after every change, and the count of passing tests grew with each increment: 38 API and 11 browser tests in the first release, 64 and 16 now (the project milestones recorded in the SDLC document). Defects found by testing and fixed, as recorded in the project milestones recorded in the SDLC document and the current run, include:

- A blank price or year was coerced to 0, which would have listed a free book (now a validation error, TC-14).
- A screen-reader-only table header widened administrator pages on phones (found by the overflow test, TC-37).
- The account menu could not reliably open on mobile (replaced, covered by the mobile menu test).
- Listing creation had no rate limit, although it writes files to disk (limit added).
- The home showcase kept rotating when the pointer was already over it after navigating back (found by TC-36, fixed by pausing on any pointer movement inside the showcase).

Each fix was followed by a full run of both suites.

## 8. Defects and open issues

No known failing test. Open items are the BLOCKED and NOT EXECUTED cases above (TC-45 to TC-48).

## 9. Final verification addendum (17 November 2026)

| Check | Final result |
| --- | --- |
| Production client build | Passed |
| API suite | 67 passed, 0 failed, 0 skipped |
| Chromium browser suite | 16 passed, 0 failed, 0 skipped |
| Separate fictional-account demonstration | Seller published, buyer found the book and requested it, seller accepted, both exchanged messages, seller completed, listing became sold, and both histories showed completion |

An earlier inspection that day stopped the serial Chromium suite after an ambiguous Browse count check (3 passed, 1 failed, 12 not run). The revised assertion requires the exact count in the visible Browse results. All 16 cases ran on the final rerun.

The purchase tests added cancellation before acceptance and two deterministic overlaps. Before the fix, the cancellation-first overlap failed because the saved request was cancelled and the book remained reserved. The corrected handler uses the state it actually replaced. Both overlap orders passed after the fix. Existing cases still cover cancellation after acceptance and simultaneous attempts to accept requests from competing buyers. A process interruption between database writes remains untested.

Live Google, SMTP, Cloudinary, production deployment, additional browser engines and formal accessibility checks were outside this run.
