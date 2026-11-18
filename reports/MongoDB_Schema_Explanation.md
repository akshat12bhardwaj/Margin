# Margin MongoDB Schema Explanation

Verified on **18 November 2026** against the nine Mongoose models and live **academic_marketplace** database. The snapshot contains **nine collections and 243 documents**.

## How the database works

MongoDB groups related documents into collections. A document holds named fields, nested objects and arrays. Each document has a unique `_id` of type ObjectId. A field such as `books.seller` holds the `_id` of a user. The application resolves the reference when it needs the user’s details.

Mongoose defines the expected structure in application code. MongoDB stores BSON, which preserves dates, numbers and ObjectIds. The live collections have no collection-level JSON schema validators. Normal API and model operations enforce the field rules. MongoDB enforces the unique indexes directly. ObjectId references have no automatic foreign-key validation or cascade deletion.

All collections have `_id: ObjectId` and `createdAt: Date`. All except `auditlogs` also have `updatedAt: Date`. Ordinary Mongoose records include `__v: Number` as a version field. Optional fields can be absent. An empty collection still has an application schema and indexes.

## Collection definitions

### users — 26 documents

Stores student, faculty and administrator accounts.

| Field | Type | Purpose |
| --- | --- | --- |
| name, email | String | Name and private, unique login email |
| role | String | student, faculty or admin |
| status, statusReason | String | active, suspended or deactivated, and the account-action reason |
| university, program, designation, bio | String | Campus and self-declared profile information |
| semester | Number | Optional semester, 1–8 |
| isDemo, isAutomatedSeller | Boolean | Seeded account and rules-based example-seller flags |
| department | String | Legacy field retained for older records |
| passwordHash, googleId, resetTokenHash | String | Private authentication fields, hidden by default in Mongoose queries |
| tokenVersion | Number | Private session-invalidation counter |
| resetTokenExpires | Date | Private reset-link expiry |

Only field names are documented. Authentication values must stay outside the public demonstration.

### books — 168 documents

Stores each individual copy and its availability.

| Field | Type | Purpose |
| --- | --- | --- |
| seller | ObjectId → users | Owner |
| title, author, subject, university | String | Academic identification and campus |
| course, isbn, edition | String | Course and ISBN are optional. Edition is required for ordinary listings |
| semester, publicationYear, price | Number | Optional semester, publication year and rupee amount |
| description, condition | String | Listing details and condition |
| status | String | active, inactive, reserved, sold, deleted, hidden or removed |
| images[] | Array of objects | Each image has url and publicId strings referencing local or cloud files |
| flagged, hiddenBySuspension, isDemo | Boolean | Reporting, suspension and example-data flags |
| moderationReason, demoKey, demoSource, coverNote | String | Moderation reason or seeded-example metadata |
| department, originalPrice | String / Number | Legacy fields. originalPrice is hidden by default |

The ordinary API requires a positive asking price, a catalogue subject, edition, publication year and 1–6 images. The model itself allows price 0 and defines exceptions for seeded examples. Condition is one of New, Like New, Good, Acceptable or Heavily Used.

### purchaserequests — 3 documents

Stores the buyer’s current offer or agreed price and the decisions for a copy.

| Field | Type | Purpose |
| --- | --- | --- |
| book; buyer; seller | ObjectId → books; users; users | Copy and both parties |
| price, listPrice | Number | Current/agreed amount and the asking-price snapshot |
| offerBy | String | buyer or seller |
| status | String | pending, accepted, rejected, cancelled or completed |
| message, isDemo | String / Boolean | Initial note and example-data flag |
| history[] | Array of objects | status, note (String), by (ObjectId → users), optional amount (Number), at (Date) |

A counteroffer changes the current amount and offerBy, appends a history event, and keeps the request pending. The other party can respond. Acceptance reserves the copy, and the seller records completion after the offline handover.

### conversations — 3 documents

Stores a listing-specific thread shared by one buyer and one seller.

| Field | Type | Purpose |
| --- | --- | --- |
| book; buyer; seller | ObjectId → books; users; users | Copy and participants |
| lastMessage, lastMessageAt | String / Date | Private latest-message preview and its time |
| buyerUnread, sellerUnread | Number | Participant unread counts |
| isDemo | Boolean | Example-data flag |

### messages — 26 documents

Stores private chat text and negotiation event cards.

| Field | Type | Purpose |
| --- | --- | --- |
| conversation; sender | ObjectId → conversations; users | Thread and author |
| request | ObjectId → purchaserequests | Optional negotiation-event link |
| body | String | Message or plain-text event summary |
| kind | String | text, offer, counter, accepted, rejected, cancelled or completed |
| amount | Number | Optional event amount |

### wishlists — 0 documents

Links members and saved copies.

| Field | Type | Purpose |
| --- | --- | --- |
| user; book | ObjectId → users; books | Member and saved listing |

### notifications — 17 documents

Stores member notices.

| Field | Type | Purpose |
| --- | --- | --- |
| user | ObjectId → users | Recipient |
| type | String | request, message, report, moderation or account |
| message, link | String | Notice and optional website destination |
| read | Boolean | Read state |

### reports — 0 documents

Stores reports about a listing or account and the moderator’s decision.

| Field | Type | Purpose |
| --- | --- | --- |
| reporter; targetUser | ObjectId → users; users | Reporter and accountable user |
| book | ObjectId → books | Optional reported listing |
| targetType | String | book or user |
| category, description | String | Report category and explanation |
| status | String | pending, under_review, resolved or rejected |
| decision | String | Recorded moderator decision |
| decidedBy, decidedAt | ObjectId → users / Date | Optional deciding administrator and time |

Categories are fake_listing, incorrect_edition, counterfeit_damaged, suspicious_seller, scam_fraud, harassment and other. A listing’s seller is its accountable targetUser.

### auditlogs — 0 documents

Records administrator actions.

| Field | Type | Purpose |
| --- | --- | --- |
| admin | ObjectId → users | Responsible administrator |
| action, reason | String | Action and explanation |
| targetType | String | user, book or report |
| targetId | ObjectId | Identifier in the collection selected by targetType |

The target is a manual polymorphic reference, with no Mongoose ref option. Audit records have createdAt and omit updatedAt.

## Verified constraints and indexes

All expected model indexes exist in the main database. There are **39 live indexes**, including the nine `_id` indexes. The `books` collection also retains a legacy `(status, department)` index. It was preserved.

Keys below are ascending unless marked `-1`, which means descending. Key order matters for compound indexes.

| Collection | Unique constraints beyond _id | Other index keys |
| --- | --- | --- |
| users | email; sparse googleId | (role, status, createdAt -1) |
| books | Sparse demoKey | (status, createdAt -1), (status, price), (status, subject), (status, university), (seller, status), (flagged, status), (status, publicationYear -1), legacy (status, department) |
| purchaserequests | (book, buyer) when status is pending or accepted; book when status is accepted or completed | (buyer, status, createdAt -1), (seller, status, createdAt -1) |
| conversations | (book, buyer) | (buyer, lastMessageAt -1), (seller, lastMessageAt -1) |
| messages | — | (conversation, createdAt -1) |
| wishlists | (user, book) | (user, createdAt -1) |
| notifications | — | (user, createdAt -1), (user, read) |
| reports | (reporter, targetUser, book) when status is pending or under_review | (status, createdAt -1), (targetUser, status), (book, status) |
| auditlogs | — | (createdAt -1), (targetType, targetId, createdAt -1) |

A sparse index excludes documents without the indexed field. A partial index applies only to documents matching its filter. Purchase-request constraints prevent an open duplicate from the same buyer and a second winning request for a copy. The server also checks the latest offer and listing state. Changes spanning multiple collections use separate writes, with interruption recovery outside the demonstrated guarantee.

## Relationships

One user can list many copies. Each purchase request identifies a copy and its buyer and seller. A copy can accumulate requests from multiple buyers, subject to the partial unique constraints. Each conversation belongs to one copy and buyer and includes its seller. Messages identify their conversation and sender and may link a purchase request. A conversation has no direct purchase-request field.

Wishlists link members to saved books. Notifications identify recipients. Reports identify the reporter, accountable user and optional listing and deciding administrator. Audit logs identify the acting administrator and a target. A listing’s deleted status retains the copy record for past transactions.

The main database includes 23 seeded example sellers and three other accounts. Its books include 167 seeded examples and one other listing. A read-only audit found no dangling top-level references among the checked records. Empty moderation collections provide no live examples. Nested history references and audit target resolution were outside that check.

[Open the printable vector relationship diagram](assets/mongodb-schema.svg)

Large boxes show the nine actual collections. Small boxes repeat a target collection at each reference endpoint, keeping connectors separate. Arrows go from reference fields to the collection containing the target _id. Many source documents may share one target. A question mark indicates an optional reference. The dashed audit arrow uses targetType. The diagram shows important fields and fits within a 277 × 190 mm area on landscape A4.

## MongoDB Compass demonstration

1. Connect to `mongodb://127.0.0.1:27017` and expand **academic_marketplace**. Start with the collection names and counts.
2. Open **books**, set filter `{ isDemo: true }`, and apply the books projection below before showing document details. Explain _id, title, subject, price, status and seller.
3. Open **users** with `{ isDemo: true }` and the users projection below. Explain that books.seller matches users._id.
4. Open **purchaserequests → Indexes**. Expand `book_1_buyer_1` and `book_1`. Show their unique flags and partial status filters without attempting a write.
5. In **books → Aggregations**, run the projected lookup below to show fictional listings and their seeded owners.
6. Explain conversations, messages and request history using the diagram and index definitions. The main database contains member activity, so use the projections and avoid showing its unprojected private threads, conversation previews or notifications.
7. The main database’s reports, wishlists and auditlogs were empty at the inspection snapshot. Explain their fields from the model definitions and their Indexes tabs. Use a dedicated fictional demonstration database if you need populated examples.

In the Documents query bar, expand the options to enter **Project** before presenting results.

**books**, filtered to `{ isDemo: true }`

```javascript
{ _id: 1, title: 1, subject: 1, price: 1, condition: 1, status: 1, seller: 1, isDemo: 1 }
```

**users**, filtered to `{ isDemo: true }`

```javascript
{ _id: 1, name: 1, role: 1, university: 1, isDemo: 1 }
```

**purchaserequests** in a dedicated fictional demonstration database

```javascript
{ _id: 1, book: 1, buyer: 1, seller: 1, price: 1, listPrice: 1, offerBy: 1, status: 1 }
```

The following read-only aggregation resolves seeded book owners through their stored ObjectIds.

```javascript
[
  { $match: { isDemo: true } },
  { $limit: 3 },
  { $lookup: {
      from: "users",
      let: { owner: "$seller" },
      pipeline: [
        { $match: { $expr: { $and: [
          { $eq: ["$_id", "$$owner"] },
          { $eq: ["$isDemo", true] }
        ] } } },
        { $project: { _id: 1, name: 1, role: 1 } }
      ],
      as: "exampleSeller"
  } },
  { $project: { _id: 1, title: 1, subject: 1, price: 1, seller: 1, exampleSeller: 1 } }
]
```

Compass reads stored records directly. Mongoose’s `select: false` setting does not hide private fields in Compass. The positive projections above limit the visible fields.

## Inspection basis

Model definitions came from `server/src/models/*.js` and connection behaviour from `server/src/index.js` and `server/src/config.js`. Collection names, counts, index options and observed BSON types were inspected in local MongoDB. Optional model fields need not occur in the current documents. Definitions for the three empty collections were checked against their models and live indexes.
