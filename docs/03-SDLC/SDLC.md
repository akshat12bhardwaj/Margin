# Software Development Life Cycle: Margin

Course book exchange marketplace · CSE3005 Software Engineering · BML Munjal University

Version 1.0 · 6 November 2026 · Prepared by: Margin project team

## 1. Methodology

Margin was developed with an **iterative and incremental** process in the Agile style. Requirements were captured as a prioritised list of features, and each increment took one group of features through analysis, design, implementation, testing and review before the next began. Every increment ended with a working, tested system.

### 1.1 Why this model

| Model considered | Fit for this project |
| --- | --- |
| Waterfall | Poor. Several requirements changed after the first working version (subject-based categories replacing departments, removal of the original-price field, Buy now separated from offers). Waterfall would have required reopening completed phases |
| Spiral | Partly suitable for risk handling, but its formal risk analysis per cycle is heavier than a course project needs |
| Incremental / Agile | Chosen. Feedback on each working version could change the next increment, high-priority features (accounts, listings, purchase workflow) were delivered first, and the full automated test suite gave a regression check at the end of every increment |

## 2. Phases as carried out

The development record is `the project milestones recorded in the SDLC document` in the repository root. It lists every increment, what was checked and the test results at the end. The repository is not under version control, so that file is the only history; this document uses no dates other than those it records.

| Increment (date in the project milestones recorded in the SDLC document) | Content | Result recorded |
| --- | --- | --- |
| 1. Core marketplace (2 Nov 2026) | Architecture; authentication and roles; listings with photos, search and filters; wishlist; purchase workflow with double-sale prevention; messaging; notifications; reporting, moderation and audit log; all pages; administrator dashboard | 38 API tests and 11 browser tests passing; production build; 0 dependency vulnerabilities |
| 2. Redesign and example marketplace (3 Nov 2026) | Design system and responsive layout; extraction of books from 17 course handouts; example listings and covers | Book data verified against the handouts; layouts checked at four widths |
| 3. BMU scope (3 Nov 2026) | University fixed to BMU; example-listing labelling; independence disclaimer | 51 API tests, 13 browser tests |
| 4. Negotiation, themes, semesters (3 Nov 2026) | Offers and counteroffers with turn-taking; light and dark themes; semester 1 to 8 everywhere | 55 API tests, 13 browser tests |
| 5. Automated example sellers (6 Nov 2026) | Scripted replies and negotiation for fictional sellers, replacing a demo account switcher | 61 API tests, 14 browser tests |
| 6. Subject catalogue (6 Nov 2026) | Controlled subject catalogue replacing departments; original price removed; reversible data migration | 64 API tests, 14 browser tests |
| 7. Showcase and Buy now (6 Nov 2026) | Clickable rotating showcase with spotlight; separate Buy now, Message seller and Save to wishlist actions | 64 API tests, 16 browser tests |

### 2.1 Requirements phase

Requirements were elicited from the problem of exchanging course books at BMU (SRS Section 2), the course handouts (which supplied real reading lists and the subject structure), and change requests raised after reviewing each working increment. They were analysed into functional and non-functional requirements and prioritised with MoSCoW (SRS Sections 5, 6 and 9). Requirements that changed, such as categorisation by subject instead of department, were updated in the SRS and implemented with a data migration rather than a reset of existing data.

### 2.2 Design phase

The architecture was fixed in the first increment: a React client, an Express REST API and MongoDB (Software Design, Section 2). Integrity risks were designed out early: double reservation was prevented by partial unique indexes and conditional updates, and authentication used httpOnly cookies. The UML and DFD models in docs/02-Software-Design document the design as built; they were produced from the code and are regenerated from source files whenever the design changes.

### 2.3 Implementation phase

Each feature was implemented as a vertical slice: schema, route with validation, client page, then tests. Coding conventions are listed in the Quality and Maintenance document (Section 2). Sensitive operations (accepting a request, completing a sale, moderation) were written as conditional updates from the start, not added later.

### 2.4 Testing phase

Testing ran inside every increment, not only at the end:

- API integration and unit tests (`server/test`, Node's test runner with supertest) against a real MongoDB test database.
- Browser system tests (`e2e/tests`, Playwright with Chromium) against a separate database, covering complete user workflows and page layouts at four screen widths.
- Visual review of screenshots at phone, tablet, laptop and desktop widths.
- Regression: the full API and browser suites were re-run after every change. A feature was not marked complete until both passed and the production build succeeded.

Results and evidence are in docs/04-Testing.

### 2.5 Maintenance phase

Maintenance began as soon as the first increment was delivered: defects found by tests or review were corrected, and later increments adapted and extended the system. Examples of each maintenance type are in the Quality and Maintenance document (Section 4). Repeatable scripts support operation and maintenance: `npm run create-admin`, `npm run seed:demo`, `npm run demo:remove` and `npm run migrate:subjects`.

## 3. Lessons from the process

- Changing requirements were cheap to absorb because each increment ended with full automated tests. The move from departments to subjects touched the schema, API, five pages and the data, and was verified by the same suites.
- Writing integrity rules into the database (unique indexes) rather than only into code meant a race condition test could prove the rule, not just suggest it.
- The process lacked version control. Change history exists only in `the project milestones recorded in the SDLC document`, and individual changes cannot be reviewed or reverted line by line. Putting the repository under Git is the first improvement recommended for future work.
