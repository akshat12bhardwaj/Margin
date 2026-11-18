# Requirements Traceability Matrix: Margin

Course book exchange marketplace · CSE3005 Software Engineering · BML Munjal University

Version 1.0 · 6 November 2026 · Prepared by: Margin project team

Each requirement in the SRS (docs/01-SRS) is traced to the design element that describes it (docs/02-Software-Design), the code that implements it and the test cases that verify it (docs/04-Testing). "Verified" means every acceptance criterion is covered by a test case that passed in the run of 6 November 2026. "Partly verified" names what is not covered.

## 1. Functional requirements

| Requirement | Design element | Implementation | Test cases | Status |
| --- | --- | --- | --- | --- |
| FR-01 Registration | Fig. 2.1; Fig. 2.10 process 1.0 | `server/src/routes/auth.js` (register); `client/src/pages/AuthPages.jsx` | TC-01, TC-02 | Verified |
| FR-02 Login and logout | Fig. 2.3 | `routes/auth.js` (login, logout, me); `middleware/auth.js` | TC-03, TC-04, TC-05, TC-06 | Verified |
| FR-03 Google sign-in | Fig. 2.4 | `routes/auth.js` (google, callback, complete) | TC-11, TC-12, TC-45 | Partly verified: automated with a stubbed Google token endpoint; live sign-in not run (TC-45 BLOCKED) |
| FR-04 Password reset and change | Fig. 2.10 process 1.0 | `routes/auth.js` (forgot, reset, change); `lib/mail.js` | TC-07, TC-08, TC-46 | Partly verified: email delivery not run (TC-46) |
| FR-05 Profile management | Fig. 2.1 | `routes/users.js`; `pages/Profile.jsx` | TC-10 | Verified |
| FR-06 Create listing | Fig. 2.5 | `routes/books.js` (POST); `middleware/upload.js`; `lib/storage.js`; `pages/ListingForm.jsx` | TC-13, TC-14 | Verified |
| FR-07 Subject catalogue | Section 2, Fig. 2.13 | `shared/subjects.mjs`; `routes/books.js` schema; `components/ui.jsx` (SubjectSelect) | TC-15, TC-18, TC-39 | Verified |
| FR-08 Edit listing | Fig. 2.14 (Book states) | `routes/books.js` (PATCH); `pages/ListingForm.jsx` | TC-16 | Verified |
| FR-09 Deactivate, reactivate, delete | Fig. 2.14 | `routes/books.js` (status, DELETE); `lib/requests.js` | TC-17 | Verified |
| FR-10 Browse and search | Fig. 2.10 process 3.0 | `routes/books.js` (GET, searchFilter); `pages/Browse.jsx` | TC-18 | Verified |
| FR-11 Filters and home subjects | Fig. 2.10 process 3.0 | `routes/books.js`; `pages/Browse.jsx`; `pages/Landing.jsx` | TC-18 | Verified |
| FR-12 Listing details | Fig. 2.1 | `routes/books.js` (GET /:id); `pages/BookDetails.jsx` | TC-18, TC-20, TC-39 | Verified |
| FR-13 Wishlist | Fig. 2.2 (Wishlist) | `routes/wishlist.js`; `pages/Wishlist.jsx` | TC-19 | Verified |
| FR-14 Buy now | Fig. 2.6; Fig. 2.11 process 5.1 | `routes/requests.js` (createRequest); `pages/BookDetails.jsx` | TC-20, TC-21 | Verified |
| FR-15 Make an offer | Fig. 2.7 | `routes/requests.js`; `pages/Messages.jsx` | TC-22, TC-23 | Verified |
| FR-16 Respond to an offer | Fig. 2.7; Fig. 2.11 process 5.2 | `routes/requests.js` (accept, reject, counter); `components/Negotiation.jsx` | TC-22, TC-23, TC-26 | Verified |
| FR-17 Reservation and conflicts | Fig. 2.14; Section 7.1 | `routes/requests.js`; `models/PurchaseRequest.js` (partial unique indexes) | TC-24, TC-27, TC-28 | Verified |
| FR-18 Exchange coordination and completion | Fig. 2.6; Fig. 2.11 process 5.5 | `routes/requests.js` (complete); `pages/Messages.jsx`; `pages/Requests.jsx` | TC-20, TC-21 | Verified |
| FR-19 Cancel a request | Fig. 2.14; Fig. 2.11 process 5.6 | `routes/requests.js` (cancel) | TC-25 | Verified |
| FR-20 Messaging | Fig. 2.10 process 6.0 | `routes/conversations.js`; `lib/messages.js`; `pages/Messages.jsx` | TC-29, TC-20 | Verified |
| FR-21 Notifications | Fig. 2.10 process 7.0 | `lib/notify.js`; `routes/notifications.js`; `pages/Notifications.jsx` | TC-30, TC-21 | Verified |
| FR-22 Reporting | Fig. 2.8; Fig. 2.12 process 8.1 | `routes/reports.js`; `components/ReportDialog.jsx` | TC-31 | Verified |
| FR-23 Report review | Fig. 2.8; Fig. 2.12 process 8.2 | `routes/admin.js` (reports); `pages/admin/AdminReports.jsx` | TC-32 | Verified |
| FR-24 Listing moderation | Fig. 2.12 process 8.3 | `routes/admin.js` (books); `pages/admin/AdminListings.jsx` | TC-33 | Verified |
| FR-25 Account moderation | Fig. 2.12 process 8.4 | `routes/admin.js` (users); `middleware/auth.js`; `pages/admin/AdminUsers.jsx` | TC-34 | Verified |
| FR-26 Dashboard and audit log | Fig. 2.12 process 8.5 | `routes/admin.js` (stats, audit-logs); `pages/admin/AdminDashboard.jsx`, `AdminAudit.jsx` | TC-35, TC-32 | Verified |
| FR-27 Example marketplace | Fig. 2.13 (scripts) | `server/demo/seed.js`; `server/scripts/seed-demo.js`, `remove-demo.js` | TC-39 | Verified |
| FR-28 Automated example sellers | Fig. 2.7 (note); Fig. 2.11 process 5.7 | `server/src/lib/autoSeller.js` | TC-38 | Verified |
| FR-29 Home page and themes | Fig. 2.1 | `pages/Landing.jsx`; `context/ThemeContext.jsx` | TC-36, TC-44 | Verified |

## 2. Non-functional requirements

| Requirement | Implementation | Test cases | Status |
| --- | --- | --- | --- |
| NFR-01 Password storage | `routes/auth.js` (bcrypt, cost 12), `select: false` | TC-01, TC-10 | Verified |
| NFR-02 Sessions | `middleware/auth.js` (cookie options, tokenVersion) | TC-03, TC-04, TC-07, TC-08, TC-12 | Verified |
| NFR-03 Input validation | `middleware/validate.js`, zod schemas in each router | TC-05, TC-14, TC-15, TC-18 | Verified |
| NFR-04 Role checks | `requireAuth`, `requireMember`, `requireAdmin`; ownership checks | TC-09, TC-26 | Verified |
| NFR-05 Rate limits | `express-rate-limit` in auth, books, conversations, reports | TC-06 | Partly verified: only the authentication limit is tested |
| NFR-06 Dependency vulnerabilities | `package-lock.json` | TC-41 | Verified |
| NFR-07 Data integrity | Conditional updates; partial unique indexes | TC-27, TC-28 | Verified |
| NFR-08 Performance | Indexes on `books` | TC-40 | Verified at campus scale on one machine |
| NFR-09 Responsive layout | `client/src/styles.css` | TC-37 | Verified in Chromium; other browsers not run (TC-47) |
| NFR-10 Error feedback | `hooks.js` (useForm), `components/ui.jsx` (Field) | TC-01, TC-13 | Verified |
| NFR-11 Accessibility | Labelled fields, focus styles, reduced-motion rule | TC-36 | Partly verified: no formal WCAG audit |
| NFR-12 Reliability | `middleware/error.js` | TC-43 | Design target: TC-43 shows no uncaught browser errors across all workflows, but no test forces a server error (500) |
| NFR-13 Maintainability | Module structure; test suites | TC-42 and all suites | Verified |
| NFR-14 Scalability | Indexed queries; documented search upgrade path | TC-48 | Not verified (TC-48 NOT EXECUTED) |
| NFR-15 Privacy | `PUBLIC_USER_FIELDS`; `select: false` fields | TC-10, TC-15 | Verified |

## 3. Gaps

- Partly verified: FR-03 (live Google), FR-04 (email delivery), NFR-05 (non-authentication rate limits), NFR-09 (other browsers), NFR-11 (accessibility audit).
- Design targets not verified by a dedicated test: NFR-12 (no test forces a server error), NFR-14 (load beyond 20 concurrent requests).
- Every functional requirement has an implementation and at least one passing test case.

## 4. Final verification on 17 November 2026

| Requirement | Design component | Implementation exercised | Test case | Result |
| --- | --- | --- | --- | --- |
| FR-01, FR-02 | Account process and session | Register and sign in | TC-01, TC-03 | API and Chromium passed |
| FR-06 | Catalogue and upload validation | Publish with a valid photo; reject invalid photos | TC-14 | API and Chromium passed |
| FR-10, FR-11 | Catalogue query and subject navigation | Search, filter and check the visible result count | TC-18 | API and Chromium passed |
| FR-13 | Member–book relationship | Save once and remove | TC-19 | API and Chromium passed |
| FR-15, FR-16 | Offer and conversation | Counter, validate turns and accept the agreed price | TC-22, TC-23 | API passed; Chromium passed the negotiation workflow |
| FR-17, FR-19 | Request and listing states | Reserve once; release on cancellation even when acceptance overlaps | TC-25, TC-27, TC-28; three new cancellation cases | API passed, including both controlled overlap orders |
| FR-20 | Private conversations | Exchange messages; reject third-party access | TC-29; Chromium full-price exchange | API and Chromium passed the applicable checks |
| FR-22, FR-24 | Reports and moderation | Report, hide, cancel open deals and restore | TC-31, TC-33 | API and Chromium passed the applicable checks |
