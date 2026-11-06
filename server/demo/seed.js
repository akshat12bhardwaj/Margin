// Sample marketplace data built from the handout catalogue. Everything written here carries isDemo,
// and removeDemo only ever deletes records that carry it or point at one.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcrypt';
import { UPLOAD_DIR } from '../src/lib/storage.js';
import { Book } from '../src/models/Book.js';
import { Conversation } from '../src/models/Conversation.js';
import { Message } from '../src/models/Message.js';
import { Notification } from '../src/models/Notification.js';
import { PurchaseRequest } from '../src/models/PurchaseRequest.js';
import { Report } from '../src/models/Report.js';
import { UNIVERSITY, User } from '../src/models/User.js';
import { Wishlist } from '../src/models/Wishlist.js';
import { subjectInfo } from '../../shared/subjects.mjs';

const here = import.meta.dirname;
const COVER_DIR = path.join(UPLOAD_DIR, 'demo');

const CSE = 'Computer Science & Engineering';
const MTH = 'Mathematics';
const ECE = 'Electronics & Communication Engineering';
const MECH = 'Mechanical Engineering';
const PHY = 'Physics';
const SELLERS = [
  ['Aarav Mehta', 'student', CSE, 5], ['Riya Sharma', 'student', CSE, 3], ['Kabir Sethi', 'student', CSE, 7], ['Ananya Rao', 'student', CSE, 5],
  ['Dev Malhotra', 'student', CSE, 3], ['Ishita Kapoor', 'student', MTH, 5], ['Kunal Verma', 'student', MTH, 3], ['Meera Nair', 'student', PHY, 3],
  ['Arjun Bansal', 'student', ECE, 5], ['Nisha Gupta', 'student', ECE, 3], ['Rohan Iyer', 'student', MECH, 3], ['Sana Qureshi', 'student', MECH, 5],
  ['Tenzin Dorje', 'student', CSE, 7], ['Farah Siddiqui', 'student', PHY, 5], ['Vikram Sandhu', 'student', CSE, 3], ['Lavanya Pillai', 'student', MTH, 7],
  ['Neel Chatterjee', 'faculty', CSE], ['Shalini Menon', 'faculty', CSE], ['Harpreet Gill', 'faculty', MTH], ['Joseph Thomas', 'faculty', PHY],
  ['Asha Kulkarni', 'faculty', ECE], ['Imran Sheikh', 'faculty', MECH], ['Pooja Desai', 'faculty', CSE],
];

// Catalogue subject for each handout course. Three handouts span two subjects, so their books are split by
// title in SUBJECT_BY_BOOK; anything not listed there takes the course's subject.
export const SUBJECT_BY_COURSE = {
  AI: 'Artificial Intelligence', BDA: 'Big Data Analytics', COA: 'Computer Organization and Architecture',
  DM: 'Discrete Mathematics', BEEE: 'Basic Electrical and Electronics Engineering', DAA: 'Data Structures and Algorithms',
  DSA: 'Data Structures and Algorithms', DBMS: 'Database Management Systems', DCCN: 'Computer Networks', PHY: 'Physics',
  IOT: 'Internet of Things', ML: 'Machine Learning', OS: 'Operating Systems', SE: 'Software Engineering',
  LADE: 'Linear Algebra', CALC: 'Calculus', EME: 'Engineering Graphics',
};
export const SUBJECT_BY_BOOK = {
  'simmons-de': 'Differential Equations', 'zill-first-de': 'Differential Equations',
  'kreyszig-aem': 'Engineering Mathematics', 'zill-aem': 'Engineering Mathematics',
  'kalpakjian-manufacturing': 'Manufacturing Processes', 'parashar-manufacturing': 'Manufacturing Processes',
};
export function subjectForCatalogBook(book) {
  const subject = SUBJECT_BY_BOOK[book.id] ?? SUBJECT_BY_COURSE[book.sources[0].course];
  if (!subjectInfo(subject)) throw new Error(`No catalogue subject for ${book.id}`);
  return subject;
}

const CONDITION_NOTES = {
  'Like New': ['Like New', 'Spine uncracked and pages clean.'],
  Good: ['Good', 'Some shelf wear, with light pencil marks in a few chapters.'],
  Acceptable: ['Acceptable', 'Worn cover and highlighting throughout, but every page is intact.'],
  'Heavily Used': ['Heavily Used', 'Well-thumbed, with heavy notes and a creased cover. Still fully readable.'],
};
const CONDITION_RATE = { 'Like New': 0.85, Good: 0.7, Acceptable: 0.55, 'Heavily Used': 0.42 };

// Stable pseudo-random numbers, so every seed produces the same prices and sellers.
const hash = (s) => crypto.createHash('sha256').update(s).digest().readUInt32BE(0);
const slug = (s) => s.toLowerCase().replace(/[^a-z]+/g, '.');

export async function loadCatalog() {
  const read = async (name) => JSON.parse(await fs.readFile(path.join(here, name), 'utf8'));
  const [catalog, verification] = await Promise.all([read('catalog.json'), read('verification.json')]);
  return { catalog, verification };
}

async function upsertSellers() {
  // A hash of random bytes nobody ever sees: these accounts have no working password at all.
  const passwordHash = await bcrypt.hash(crypto.randomBytes(48).toString('hex'), 10);
  const sellers = [];
  for (const [name, role, department, semester] of SELLERS) {
    const email = `${slug(name)}@demo.invalid`;
    const existing = await User.findOne({ email });
    if (existing && !existing.isDemo) throw new Error(`${email} belongs to a real account, so seeding stopped.`);
    const fields = {
      name, role, department, university: UNIVERSITY, isDemo: true, isAutomatedSeller: true, semester,
      designation: '',
      bio: 'Example profile used to illustrate listings. Not a real person.',
    };
    sellers.push(await User.findOneAndUpdate({ email, isDemo: true }, { $set: fields, $setOnInsert: { email, passwordHash } }, { upsert: true, returnDocument: 'after' }));
  }
  return sellers;
}

function describe(book, source, course, condition) {
  const [, note] = CONDITION_NOTES[condition];
  const role = source.role === 'textbook' ? 'a textbook' : 'a reference book';
  const label = [course.code, course.name].filter(Boolean).join(' ');
  const publisher = book.publisher ? ` Publisher: ${book.publisher}.` : '';
  // The page states that example listings are not real offers; isDemo carries that for API clients.
  return `${note} Listed as ${role} on the reading list for ${label}.${publisher}`;
}

// One listing per fictional copy: textbooks get up to three copies, reference books up to two.
export function planListings(catalog) {
  const plan = [];
  for (const book of catalog.books) {
    const source = book.sources[0];
    const course = catalog.courses[source.course];
    const copies = source.role === 'textbook' ? 2 + (hash(book.id) % 2) : 1 + (hash(book.id) % 2);
    const base = 280 + (hash(`${book.id}:base`) % 24) * 50;
    for (let copy = 1; copy <= copies; copy += 1) {
      const key = `${book.id}#${copy}`;
      const conditions = Object.keys(CONDITION_NOTES);
      const condition = conditions[hash(`${key}:condition`) % conditions.length];
      const price = Math.round((base * CONDITION_RATE[condition] * (0.92 + (hash(`${key}:price`) % 17) / 100)) / 10) * 10;
      plan.push({ key, book, source, course, condition, price, wantsFaculty: copy === copies && hash(`${key}:faculty`) % 2 === 0 });
    }
  }
  return plan.sort((a, b) => hash(a.key) - hash(b.key));
}

function pickSeller(item, sellers) {
  const role = item.wantsFaculty ? 'faculty' : 'student';
  const sameDept = sellers.filter((s) => s.role === role && s.department === item.course.department);
  const pool = sameDept.length ? sameDept : sellers.filter((s) => s.role === role);
  return pool[hash(`${item.key}:seller`) % pool.length];
}

export async function seedDemo() {
  const { catalog, verification } = await loadCatalog();
  await Promise.all([User.init(), Book.init()]);
  await fs.mkdir(COVER_DIR, { recursive: true });
  const sellers = await upsertSellers();
  const plan = planListings(catalog);
  const now = Date.now();
  let created = 0;
  for (const [index, item] of plan.entries()) {
    const { book, source, course } = item;
    let images = [];
    // Cover files are not in the repository (Open Library images); without one the site draws a generated cover.
    const name = `${book.id}.jpg`;
    const cover = path.join(here, 'covers', name);
    if (verification[book.id]?.cover && !catalog.rejectedCovers[book.id] && await fs.access(cover).then(() => true, () => false)) {
      await fs.copyFile(cover, path.join(COVER_DIR, name));
      images = [{ url: `/uploads/demo/${name}`, publicId: `demo/${name}` }];
    }
    const fields = {
      title: book.title,
      author: book.authors,
      subject: subjectForCatalogBook(book),
      course: [course.code, course.name].filter(Boolean).join(' · ').slice(0, 120),
      university: UNIVERSITY,
      description: describe(book, source, course, item.condition),
      price: item.price,
      condition: item.condition,
      images,
      seller: pickSeller(item, sellers)._id,
      isDemo: true,
      demoSource: course.file,
    };
    const optional = { isbn: book.isbn, semester: course.semester, edition: book.edition, publicationYear: book.year, coverNote: images.length ? catalog.coverNotes?.[book.id] : undefined };
    const $set = { ...fields };
    const $unset = {};
    for (const [k, v] of Object.entries(optional)) {
      if (v === undefined || v === null) $unset[k] = 1;
      else $set[k] = v;
    }
    // Listing times are staggered only so the newest-first view is varied; pages do not show them on samples.
    const createdAt = new Date(now - index * 37 * 60 * 1000);
    const update = { $set, $setOnInsert: { demoKey: item.key, createdAt, updatedAt: createdAt, status: 'active' } };
    if (Object.keys($unset).length) update.$unset = $unset;
    const res = await Book.collection.updateOne({ demoKey: item.key, isDemo: true }, update, { upsert: true });
    created += res.upsertedCount;
  }
  // Listings dropped from the catalogue must not linger after a re-seed.
  const stale = await Book.deleteMany({ isDemo: true, demoKey: { $nin: plan.map((p) => p.key) } });
  return { sellers: sellers.length, listings: plan.length, created, updated: plan.length - created, staleRemoved: stale.deletedCount };
}

export async function removeDemo() {
  const users = await User.find({ isDemo: true }).distinct('_id');
  const books = await Book.find({ isDemo: true }).distinct('_id');
  const conversations = await Conversation.find({ $or: [{ book: { $in: books } }, { seller: { $in: users } }] }).distinct('_id');
  const [wishlist, reports, requests, messages, convos, notifications, listings, accounts] = [
    await Wishlist.deleteMany({ book: { $in: books } }),
    await Report.deleteMany({ $or: [{ book: { $in: books } }, { targetUser: { $in: users } }] }),
    await PurchaseRequest.deleteMany({ $or: [{ book: { $in: books } }, { seller: { $in: users } }] }),
    await Message.deleteMany({ conversation: { $in: conversations } }),
    await Conversation.deleteMany({ _id: { $in: conversations } }),
    await Notification.deleteMany({ user: { $in: users } }),
    await Book.deleteMany({ isDemo: true }),
    await User.deleteMany({ isDemo: true }),
  ];
  await fs.rm(COVER_DIR, { recursive: true, force: true });
  return {
    listings: listings.deletedCount, accounts: accounts.deletedCount, wishlistEntries: wishlist.deletedCount, reports: reports.deletedCount,
    requests: requests.deletedCount, conversations: convos.deletedCount, messages: messages.deletedCount, notifications: notifications.deletedCount,
  };
}

// Sample accounts must never reach a live site by accident.
export function refusalReason(uri, env, allow) {
  if (allow) return null;
  if (env === 'production') return 'NODE_ENV is production.';
  if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(uri)) return 'MONGODB_URI is not a local database.';
  return null;
}
