import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { ADMIN } from '../global-setup.js';
import { DB } from '../playwright.config.js';

// A real, visible cover image: 2x2 coloured PNG is enough for the browser to decode.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==', 'base64');
const SHOTS = path.resolve('test-results/screens');
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, laptop: { width: 1024, height: 768 }, tablet: { width: 768, height: 1024 }, phone: { width: 375, height: 760 } };

const stamp = Date.now();
const student = { name: 'Priya Student', email: `priya${stamp}@uni.test`, password: 'password-priya', role: 'Student' };
const faculty = { name: 'Dr Rao Faculty', email: `rao${stamp}@uni.test`, password: 'password-raooo', role: 'Teacher / Faculty' };
const buyer = { name: 'Sam Buyer', email: `sam${stamp}@uni.test`, password: 'password-samuel', role: 'Student' };

const ctx = {};

async function newUser(browser, options = {}) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  ctx.errors ??= [];
  page.on('pageerror', (e) => ctx.errors.push(`pageerror ${page.url()}: ${e.message}`));
  page.on('console', (m) => {
    // Expected 4xx responses log a network line in Chrome; application errors do not look like that.
    if (m.type() === 'error' && !m.text().includes('Failed to load resource')) ctx.errors.push(`console ${page.url()}: ${m.text()}`);
  });
  return page;
}

async function register(page, u) {
  await page.goto('/register');
  await page.getByLabel(u.role, { exact: true }).check({ force: true });
  await page.getByLabel('Full name').fill(u.name);
  await page.getByLabel('Email').fill(u.email);
  await page.getByLabel('Password').fill(u.password);
  await expect(page.locator('.university-line')).toContainText('BML Munjal University');
  await expect(page.getByLabel('Department')).toHaveCount(0);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function login(page, email, password) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

async function createListing(page, { title, price = '450', condition = 'Good', edition = '3rd', subject = 'Data Structures and Algorithms' }) {
  await page.goto('/sell');
  await page.getByTestId('photo-input').setInputFiles([
    { name: 'cover.png', mimeType: 'image/png', buffer: PNG },
    { name: 'back.png', mimeType: 'image/png', buffer: PNG },
  ]);
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Author').fill('Thomas Cormen');
  await page.getByLabel('ISBN').fill('978-0-262-03384-8');
  await page.getByLabel('Edition').fill(edition);
  await page.getByLabel('Publication year').fill('2015');
  await page.getByLabel('Condition').selectOption(condition);
  await page.getByLabel('Description').fill('A well kept copy with a few pencil notes in chapter two.');
  await page.getByLabel('Subject').selectOption(subject);
  await page.getByLabel('Course').fill('CS201');
  await expect(page.getByLabel('Department')).toHaveCount(0);
  await expect(page.getByLabel('Original price')).toHaveCount(0);
  await page.getByLabel('Semester').selectOption('3');
  await page.getByLabel('Selling price').fill(price);
  await page.getByRole('button', { name: 'Publish listing' }).click();
  await expect(page).toHaveURL(/\/books\/[a-f\d]{24}$/);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}

test.describe.serial('marketplace', () => {
  test('protected and admin routes are guarded in the UI', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/no-such-page');
    await expect(page.getByRole('heading', { name: /not on the shelf/ })).toBeVisible();
    await page.goto('/');
    await expect(page.getByText('The shelves are empty so far')).toBeVisible();
  });

  test('registration, validation errors and login', async ({ browser }) => {
    const page = await newUser(browser);
    await register(page, student);
    await expect(page.getByRole('heading', { name: 'Hello, Priya' })).toBeVisible();
    await page.getByRole('button', { name: 'Priya' }).click();
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();

    await login(page, student.email, 'wrong-password');
    await expect(page.getByRole('alert')).toContainText('Incorrect email or password');

    await page.goto('/register');
    await page.getByLabel('Full name').fill('Dup');
    await page.getByLabel('Email').fill(student.email);
    await page.getByLabel('Password').fill('password-dup');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('alert')).toContainText('already exists');

    await login(page, student.email, student.password);
    await expect(page).toHaveURL(/\/dashboard/);
    ctx.student = page;
    await page.context().storageState();
  });

  test('student and faculty can list books, with photo validation', async ({ browser }) => {
    const page = ctx.student;
    await page.goto('/sell');
    await page.getByLabel('Title').fill('No Photo Book');
    await page.getByLabel('Author').fill('Someone');
    await page.getByLabel('Edition').fill('1st');
    await page.getByLabel('Publication year').fill('2015');
    await page.getByLabel('Condition').selectOption('Good');
    await page.getByLabel('Description').fill('Long enough description here.');
    await page.getByLabel('Selling price').fill('10');
    // Subject is a required choice from the catalogue, so the browser blocks submission without one.
    await page.getByRole('button', { name: 'Publish listing' }).click();
    expect(await page.getByLabel('Subject').evaluate((el) => el.validity.valueMissing)).toBe(true);
    await page.getByLabel('Subject').selectOption('Calculus');
    await page.getByRole('button', { name: 'Publish listing' }).click();
    await expect(page.getByRole('alert')).toContainText('at least one photo');

    await createListing(page, { title: 'Introduction to Algorithms' });
    await expect(page.getByText('This is your listing.')).toBeVisible();
    await expect(page.locator('.gallery-thumbs button')).toHaveCount(2);
    await createListing(page, { title: 'Discrete Mathematics', price: '120', condition: 'Acceptable', edition: '7th', subject: 'Discrete Mathematics' });

    const fac = await newUser(browser);
    await register(fac, faculty);
    await createListing(fac, { title: 'Operating Systems Older Edition', price: '300', condition: 'Like New', edition: '5th', subject: 'Operating Systems' });
    await expect(page.locator('body')).toBeVisible();
    ctx.faculty = fac;
  });

  test('browse: search, filters, sorting, category link', async ({ page }) => {
    await page.goto('/books');
    await expect(page.getByText('3 books')).toBeVisible();
    await page.getByLabel('Search books').fill('discrete');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText('1 book', { exact: true })).toBeVisible();
    await page.goto('/books?q=9780262033848');
    await expect(page.getByText('3 books')).toBeVisible();

    // Subject filter from the catalogue, combined with semester; no department controls remain.
    await page.goto('/books');
    await expect(page.getByLabel('Department')).toHaveCount(0);
    await page.locator('.filters').getByLabel('Subject').selectOption('Discrete Mathematics');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).toHaveURL(/subject=Discrete\+Mathematics/);
    await expect(page.getByRole('heading', { name: 'Discrete Mathematics', level: 2 })).toBeVisible();
    await expect(page.getByText('1 book', { exact: true })).toBeVisible();
    await page.locator('.filters').getByLabel('Semester').selectOption('3');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).toHaveURL(/semester=3/);
    await expect(page.getByText('1 book', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByText('3 books')).toBeVisible();
    await expect(page.locator('.filters').getByLabel('Subject')).toHaveValue('');

    const semester = page.locator('.filters').getByLabel('Semester');
    await expect(semester.locator('option')).toHaveText(['Any', ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `Semester ${n}`)]);
    await semester.selectOption('3');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).toHaveURL(/semester=3/);
    await expect(page.getByText('3 books')).toBeVisible();
    await page.locator('.filters').getByLabel('Semester').selectOption('4');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.getByText('No books match')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByText('3 books')).toBeVisible();

    await page.goto('/books');
    await page.getByLabel('Max price').fill('200');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).toHaveURL(/maxPrice=200/);
    await expect(page.getByText('1 book', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByText('3 books')).toBeVisible();

    await page.getByLabel('Like New').check();
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.getByRole('heading', { name: 'Operating Systems Older Edition' })).toBeVisible();
    await expect(page.locator('.book-seller .badge-faculty')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByText('3 books')).toBeVisible();

    await page.getByLabel('Sort by').selectOption('price_asc');
    await expect(page.locator('.book-card h3').first()).toHaveText('Discrete Mathematics');
    await page.getByLabel('Sort by').selectOption('price_desc');
    await expect(page.locator('.book-card h3').first()).toHaveText('Introduction to Algorithms');

    await page.getByLabel('Search books').fill('zzzz-nothing');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText('No books match')).toBeVisible();

    await page.goto('/');
    const card = page.locator('.dept-card', { hasText: 'DS & Algorithms' });
    await expect(card).toContainText('1 book');
    await card.click();
    await expect(page).toHaveURL(/subject=Data\+Structures\+and\+Algorithms/);
    await expect(page.getByText('1 book', { exact: true })).toBeVisible();
    await expect(page.locator('.book-price s')).toHaveCount(0);
  });

  test('purchase workflow with messages, wishlist and notifications', async ({ browser }) => {
    const seller = ctx.student;
    const page = await newUser(browser);
    await register(page, buyer);
    ctx.buyer = page;

    await page.goto('/books?q=Introduction');
    await page.getByRole('heading', { name: 'Introduction to Algorithms' }).click();
    ctx.bookUrl = page.url();
    await page.getByRole('button', { name: 'Save to wishlist' }).click();
    await expect(page.getByRole('button', { name: 'Saved to wishlist' })).toBeVisible();

    await page.getByRole('button', { name: 'Message seller' }).click();
    await page.getByLabel('Your message').fill('Is it still available?');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page).toHaveURL(/\/messages\/[a-f\d]{24}/);
    await expect(page.locator('.bubble.mine')).toHaveText(/Is it still available/);

    // Offers below the listed price are made from the chat; the book page only offers Buy now at full price.
    await page.getByRole('button', { name: 'Make an offer' }).click();
    await expect(page.getByRole('dialog')).toContainText('The seller can accept, decline or counter');
    await page.getByLabel('Amount (₹)').fill('-5');
    await page.getByRole('button', { name: 'Send offer' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Amount (₹)').fill('380');
    await page.getByRole('button', { name: 'Send offer' }).click();
    await expect(page.locator('.offer-card.offer-offer')).toContainText('₹380');
    await page.goto(ctx.bookUrl);
    await expect(page.locator('.buy-box')).toContainText('Your request is pending');
    await page.getByRole('link', { name: 'Track it' }).click();
    await expect(page.locator('.request-card')).toContainText('Introduction to Algorithms');

    // Seller sees the alert, the message and the request.
    await seller.goto('/notifications');
    await expect(seller.getByText('Sam Buyer offered ₹380 for')).toBeVisible();
    await expect(seller.getByText('New message from Sam Buyer')).toBeVisible();
    await seller.goto('/messages');
    await seller.getByRole('link', { name: /Sam Buyer/ }).click();
    await expect(seller.locator('.bubble').first()).toContainText('Is it still available?');
    await seller.getByLabel('Write a message').fill('Yes, it is.');
    await seller.getByRole('button', { name: 'Send' }).click();
    await expect(seller.locator('.bubble.mine')).toContainText('Yes, it is.');
    // The reply reaches the buyer's side of the conversation.
    await page.goto('/messages');
    await page.getByRole('link', { name: /Priya Student/ }).click();
    await expect(page.locator('.bubble').last()).toContainText('Yes, it is.');

    // Negotiation: the seller counters, the buyer accepts the counteroffer from the chat thread.
    await seller.goto('/requests?side=selling');
    await expect(seller.locator('.request-card')).toContainText('Your response is needed');
    await seller.getByRole('button', { name: 'Counter' }).click();
    await seller.getByLabel('Amount (₹)').fill('420');
    await seller.getByRole('button', { name: 'Send counteroffer' }).click();
    await expect(seller.locator('.request-card')).toContainText('You countered with ₹420');
    await expect(seller.getByRole('button', { name: /^Accept/ })).toHaveCount(0);

    await page.goto('/messages');
    await page.getByRole('link', { name: /Priya Student/ }).click();
    await expect(page.locator('.offer-card.offer-counter')).toContainText('₹420');
    await page.locator('.offer-card').getByRole('button', { name: 'Accept ₹420' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Accept ₹420' }).click();
    await expect(page.locator('.deal-strip')).toContainText('Agreed at ₹420');

    await seller.goto('/requests?side=selling');
    await expect(seller.locator('.request-card .badge-good')).toHaveText('Accepted');

    await page.goto(ctx.bookUrl);
    await expect(page.locator('.buy-box')).toContainText('accepted');

    // A second buyer cannot request a reserved book.
    const late = await newUser(browser);
    await register(late, { name: 'Late Buyer', email: `late${stamp}@uni.test`, password: 'password-lateb', role: 'Student' });
    await late.goto(ctx.bookUrl);
    await expect(late.getByRole('button', { name: /^Buy now/ })).toHaveCount(0);
    await expect(late.locator('.buy-box')).toContainText('reserved');
    ctx.reporter = late;

    await seller.getByRole('button', { name: 'Mark as sold' }).click();
    await seller.getByRole('dialog').getByRole('button', { name: 'Mark as sold' }).click();
    await expect(seller.getByText('No requests for your books')).toBeVisible();
    await seller.goto('/transactions?side=selling');
    await expect(seller.locator('.request-card')).toContainText('Completed');
    await seller.locator('.timeline summary').click();
    await expect(seller.locator('.timeline li')).toHaveCount(4);

    await page.goto('/transactions');
    await expect(page.locator('.request-card')).toContainText('Completed');
    await expect(page.locator('.request-card')).toContainText('Sold for ₹420');
    await page.goto('/wishlist');
    await expect(page.locator('.book-card')).toContainText('Sold');
    await page.getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByText('Nothing saved yet')).toBeVisible();

    await page.goto('/books?q=Introduction');
    await expect(page.getByText('No books match')).toBeVisible();
  });

  test('listing management: edit, deactivate, reactivate, delete', async ({ browser }) => {
    const page = ctx.student;
    await page.goto('/my-listings');
    const row = page.locator('.listing-row', { hasText: 'Discrete Mathematics' });
    await row.getByRole('link', { name: 'Edit' }).click();
    await expect(page.getByLabel('Subject')).toHaveValue('Discrete Mathematics');
    await page.getByLabel('Subject').selectOption('Probability and Statistics');
    await page.getByLabel('Selling price').fill('99');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('.details-price')).toContainText('₹99');
    await expect(page.locator('.details-price s')).toHaveCount(0);
    await expect(page.locator('.facts')).toContainText('Probability and Statistics');
    await expect(page.locator('.facts')).not.toContainText('Department');

    await page.goto('/my-listings');
    await row.getByRole('button', { name: 'Deactivate' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Deactivate' }).click();
    await expect(row.locator('.badge')).toHaveText('Deactivated');
    await row.getByRole('button', { name: 'Reactivate' }).click();
    await expect(row.locator('.badge')).toHaveText('Available');

    await createListing(page, { title: 'Throwaway Book' });
    await page.goto('/my-listings');
    const doomed = page.locator('.listing-row', { hasText: 'Throwaway Book' });
    await doomed.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete listing' }).click();
    await expect(doomed).toHaveCount(0);
    await expect(browser).toBeTruthy();
  });

  test('buy now: full-price request, seller accepts, chat stays open, seller confirms the exchange', async () => {
    const seller = ctx.faculty;
    const page = ctx.buyer;
    await createListing(seller, { title: 'Concepts of Physics Spare Copy', price: '350', subject: 'Physics' });
    const bookUrl = seller.url();

    // Exactly three actions for a buyer: Buy now, Message seller, Save to wishlist.
    await page.goto(bookUrl);
    await expect(page.locator('.buy-box button')).toHaveText([/^Buy now · ₹350$/, /Message seller/, /Save to wishlist/]);
    await page.getByRole('button', { name: /^Buy now/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Concepts of Physics Spare Copy');
    await expect(dialog).toContainText('full listed price of ₹350');
    await dialog.getByRole('button', { name: 'Send request at ₹350' }).click();
    await expect(page).toHaveURL(/\/messages\/[a-f\d]{24}/);
    await expect(page.locator('.offer-card.offer-offer')).toContainText('₹350');
    await expect(page.locator('.deal-strip')).toContainText('You offered ₹350');
    const chatUrl = page.url();

    // Not sold yet: a genuine seller must accept first.
    await page.goto(bookUrl);
    await expect(page.locator('.details-info')).toContainText('Available');
    await expect(page.locator('.buy-box')).toContainText('Your request is pending');

    await seller.goto('/messages');
    await seller.getByRole('link', { name: /Concepts of Physics Spare Copy/ }).click();
    await seller.locator('.offer-card').getByRole('button', { name: 'Accept ₹350' }).click();
    await seller.getByRole('dialog').getByRole('button', { name: 'Accept ₹350' }).click();
    await expect(seller.locator('.deal-strip')).toContainText('Agreed at ₹350');

    // The chat stays open after agreement, for arranging the handover.
    await page.goto(chatUrl);
    await expect(page.locator('.deal-strip')).toContainText('Agreed at ₹350');
    await page.getByLabel('Write a message').fill('Main library entrance, tomorrow at 4 pm?');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.locator('.bubble.mine').last()).toContainText('tomorrow at 4 pm');
    await page.goto(bookUrl);
    await expect(page.locator('.details-info')).toContainText('Reserved');

    await seller.reload();
    await expect(seller.locator('.bubble').last()).toContainText('tomorrow at 4 pm');
    await seller.getByLabel('Write a message').fill('See you there. Bring ₹350 in cash.');
    await seller.getByRole('button', { name: 'Send', exact: true }).click();
    await seller.getByRole('button', { name: 'Mark as sold' }).click();
    await seller.getByRole('dialog').getByRole('button', { name: 'Mark as sold' }).click();
    await expect(seller.locator('.deal-strip')).toContainText('Sold for ₹350');

    // Stored state, read back through the API: completed at the listed price, book sold.
    const closed = await (await page.request.get('/api/requests?side=buying&state=closed')).json();
    const done = closed.items.find((r) => r.book.title === 'Concepts of Physics Spare Copy');
    expect(done).toMatchObject({ status: 'completed', price: 350, book: { status: 'sold' } });
    expect(done.history.map((h) => h.status)).toEqual(['pending', 'accepted', 'completed']);
  });

  test('reports, moderation, suspension and role isolation', async ({ browser }) => {
    const reporter = ctx.reporter;
    await reporter.goto('/books?q=Operating');
    await reporter.getByRole('heading', { name: 'Operating Systems Older Edition' }).click();
    const bookUrl = reporter.url();
    await reporter.getByRole('button', { name: 'Report this listing' }).click();
    await reporter.getByLabel('What is wrong?').selectOption('incorrect_edition');
    await reporter.getByLabel('Details').fill('The photos show a different edition from the one described.');
    await reporter.getByRole('button', { name: 'Submit report' }).click();
    await expect(reporter.getByText('Report submitted').last()).toBeVisible();
    await reporter.locator('.seller-card a').first().click();
    await reporter.getByRole('button', { name: 'Report user' }).click();
    await reporter.getByLabel('What is wrong?').selectOption('suspicious_seller');
    await reporter.getByLabel('Details').fill('Asked me to pay in advance outside the campus.');
    await reporter.getByRole('button', { name: 'Submit report' }).click();
    await expect(reporter.getByText('Report submitted').last()).toBeVisible();

    // Non-admins get a 404 page at /admin.
    await reporter.goto('/admin');
    await expect(reporter.getByRole('heading', { name: /not on the shelf/ })).toBeVisible();
    await expect(reporter.getByRole('link', { name: 'Admin', exact: true })).toHaveCount(0);

    const admin = await newUser(browser);
    await login(admin, ADMIN.email, ADMIN.password);
    await expect(admin).toHaveURL(/\/admin$/);
    await expect(admin.getByRole('heading', { name: 'Marketplace overview' })).toBeVisible();
    await expect(admin.locator('.stat', { hasText: 'Open reports' }).locator('strong')).toHaveText('2');
    await expect(admin.locator('.stat', { hasText: 'Completed transactions' }).locator('strong')).toHaveText('2');
    await expect(admin.getByText('Dr Rao Faculty')).toBeVisible();
    ctx.admin = admin;

    await admin.getByRole('link', { name: 'Reports', exact: true }).click();
    const report = admin.locator('.report', { hasText: 'Incorrect book edition' });
    await report.getByRole('button', { name: 'Start review' }).click();
    await expect(report.locator('.badge').first()).toHaveText('Under review');
    await report.getByRole('button', { name: 'Resolve' }).click();
    await admin.getByLabel(/Decision and explanation/).fill('Edition mismatch confirmed from the photos.');
    await admin.getByRole('dialog').getByRole('button', { name: 'Resolve report' }).click();
    await expect(report).toContainText('Edition mismatch confirmed');
    await expect(report.getByRole('button', { name: 'Resolve' })).toHaveCount(0);

    await reporter.goto('/notifications');
    await expect(reporter.getByText(/Edition mismatch confirmed/)).toBeVisible();

    await admin.getByRole('link', { name: 'Listings', exact: true }).click();
    const row = admin.locator('tr', { hasText: 'Operating Systems Older Edition' });
    await row.getByRole('button', { name: 'Hide' }).click();
    await admin.getByLabel(/Reason/).fill('Checking the edition claim.');
    await admin.getByRole('dialog').getByRole('button', { name: 'Hide listing' }).click();
    await expect(row.locator('.badge').first()).toHaveText('Hidden');
    await reporter.goto(bookUrl);
    await expect(reporter.getByRole('heading', { name: /not on the shelf/ })).toBeVisible();

    const fac = ctx.faculty;
    await fac.goto(bookUrl);
    await expect(fac.getByText(/hidden and not visible to buyers/)).toBeVisible();

    await row.getByRole('button', { name: 'Restore' }).click();
    await admin.getByLabel(/Reason/).fill('Seller corrected the description.');
    await admin.getByRole('dialog').getByRole('button', { name: 'Restore listing' }).click();
    await expect(row.locator('.badge').first()).toHaveText('Available');
    await row.getByRole('button', { name: 'Remove' }).click();
    await admin.getByLabel(/Reason/).fill('Confirmed as misleading after review.');
    await admin.getByRole('dialog').getByRole('button', { name: 'Remove listing' }).click();
    await expect(row.locator('.badge').first()).toHaveText('Removed');
    await row.getByRole('button', { name: 'History' }).click();
    await expect(admin.getByRole('dialog')).toContainText('book.remove');
    await admin.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

    // Suspension applies to a user who is already logged in.
    await admin.getByRole('link', { name: 'Users', exact: true }).click();
    await admin.getByLabel('Search users').fill(faculty.email);
    await admin.getByRole('button', { name: 'Search' }).click();
    const userRow = admin.locator('tbody tr');
    await expect(userRow).toHaveCount(1);
    await userRow.getByRole('button', { name: 'Activity' }).click();
    await expect(admin.getByRole('dialog')).toContainText('Reports against this user');
    await admin.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
    await userRow.getByRole('button', { name: 'Suspend' }).click();
    await admin.getByLabel(/Reason/).fill('Misleading listings.');
    await admin.getByRole('dialog').getByRole('button', { name: 'Suspend account' }).click();
    await expect(userRow.locator('.badge').first()).toHaveText('Suspended');

    await fac.goto('/my-listings');
    await expect(fac.getByText('Your account is suspended.')).toBeVisible();
    await expect(fac.getByRole('link', { name: 'List a book' })).toHaveCount(0);
    await fac.goto('/sell');
    await expect(fac.getByText(/cannot list books/)).toBeVisible();

    await userRow.getByRole('button', { name: 'Restore' }).click();
    await admin.getByLabel(/Reason/).fill('Appeal accepted.');
    await admin.getByRole('dialog').getByRole('button', { name: 'Restore account' }).click();
    await expect(userRow.locator('.badge').first()).toHaveText('Active');
    await fac.goto('/my-listings');
    await expect(fac.getByText('Your account is suspended.')).toHaveCount(0);

    await admin.getByRole('link', { name: 'Audit log' }).click();
    for (const action of ['user.restore', 'user.suspend', 'book.remove', 'book.hide', 'report.resolved']) {
      await expect(admin.getByText(action, { exact: true }).first()).toBeVisible();
    }
  });

  test('forgot password page and profile editing', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByLabel('Email').fill(buyer.email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByText(/reset link is on its way/)).toBeVisible();

    await page.goto('/reset-password/' + 'a'.repeat(64));
    await page.getByLabel('New password').fill('another-password');
    await page.getByRole('button', { name: 'Set new password' }).click();
    await expect(page.getByRole('alert')).toContainText('invalid or has expired');

    const buyerPage = ctx.buyer;
    await buyerPage.goto('/profile');
    await buyerPage.getByLabel('About you').fill('Third-year student.');
    await buyerPage.getByRole('button', { name: 'Save profile' }).click();
    await expect(buyerPage.getByText('Profile saved.')).toBeVisible();
    await buyerPage.getByRole('link', { name: 'View public profile' }).click();
    await expect(buyerPage.getByText('Third-year student.')).toBeVisible();

    // Theme lives in the navbar, not Settings: dark applies at once, survives a reload, and light restores the default.
    const html = buyerPage.locator('html');
    await buyerPage.goto('/profile');
    await expect(buyerPage.getByText('Appearance')).toHaveCount(0);
    await buyerPage.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await buyerPage.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await buyerPage.goto('/books');
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await buyerPage.getByRole('button', { name: 'Switch to light mode' }).click();
    await expect(html).toHaveAttribute('data-theme', 'light');
  });

  test('sample data: seeded listings are labelled, searchable and cannot be reported', async () => {
    const env = { ...process.env, MONGODB_URI: DB, JWT_SECRET: 'e2e-secret-e2e-secret-e2e-secret-e2e-1234', UPLOAD_DIR: './test-results/uploads', NODE_ENV: 'test' };
    const seed = () => execSync('node ../server/scripts/seed-demo.js', { env, encoding: 'utf8' });
    expect(seed()).toMatch(/"created":[1-9]\d+/);
    expect(seed()).toMatch(/"created":0/);

    const page = ctx.student;
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Recently listed' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Listed by faculty' })).toBeVisible();
    await expect(page.locator('.badge-sample').first()).toHaveText('Example');
    await expect(page.getByText('Not affiliated with or endorsed by BML Munjal University')).toBeVisible();

    // Subject cards carry an icon and open the filtered catalogue; no more than eight are shown.
    await expect(page.locator('.dept-card')).toHaveCount(8);
    const physics = page.locator('.dept-card', { hasText: 'Physics' });
    await expect(physics.locator('svg')).toBeVisible();
    await physics.click();
    await expect(page).toHaveURL(/subject=Physics/);
    await expect(page.getByRole('heading', { name: 'Physics', exact: true })).toBeVisible();
    await expect(page.locator('.book-card').first()).toContainText('Physics');

    await page.goto('/books?q=Discrete+Mathematics+and+Its');
    await expect(page.locator('.book-card').first()).toContainText('Rosen');
    await page.locator('.book-card a').first().click();
    await expect(page.getByText('Example listing.')).toBeVisible();
    await expect(page.getByText('Example price')).toBeVisible();
    // Fictional sellers reply automatically, so example listings can be messaged and negotiated, but not reported.
    await expect(page.getByRole('button', { name: /^Buy now/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Message seller' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Report this listing' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Related books' })).toBeVisible();

    await page.goto('/books?sellerRole=faculty&subject=Physics');
    await expect(page.locator('.book-card .badge-faculty').first()).toBeVisible();
    // Handouts covering two subjects are split by book: LADE's differential-equations texts file separately.
    await page.goto('/books?subject=Differential+Equations');
    await expect(page.locator('.book-card').first()).toContainText('Differential Equations');
    await expect(page.getByText('Linear Algebra and Its Applications')).toHaveCount(0);

    // Every cover shown must be loaded; broken photos fall back to a designed cover.
    await page.goto('/books');
    await page.waitForLoadState('networkidle');
    const broken = await page.locator('.cover img').evaluateAll((imgs) => imgs.filter((i) => i.complete && !i.naturalWidth).map((i) => i.src));
    expect(broken).toEqual([]);
  });

  test('an automated example seller answers chat and negotiates, without switching accounts', async ({ browser }) => {
    const page = await newUser(browser);
    await register(page, { name: 'Neha Buyer', email: `neha${stamp}@uni.test`, password: 'password-nehaa', role: 'Student' });
    await page.goto('/books?q=Data+Communications+and+Networking');
    await page.locator('.book-card a').first().click();
    await expect(page.getByText('The seller replies automatically')).toBeVisible();
    await page.getByRole('button', { name: 'Message seller' }).click();
    await expect(page).toHaveURL(/\/messages\/[a-f\d]{24}/);
    await expect(page.getByText('Fictional seller. Replies are automated.')).toBeVisible();
    const chips = page.getByRole('group', { name: 'Suggested messages' }).getByRole('button');
    const last = page.locator('.thread-body .bubble').last();
    await expect(chips).toHaveText(['Is this book still available?', 'Can you tell me more about its condition?', 'Would you consider a lower price?']);

    await chips.first().click();
    await expect(last).toContainText("Yes, it's still available");
    // The normal input still sends anything typed.
    await page.getByLabel('Write a message').fill('Hey, do you still have this one?');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.locator('.bubble.mine').last()).toContainText('do you still have this one?');
    await expect(last).toContainText('still available');

    await page.getByRole('button', { name: 'Would you consider a lower price?' }).click();
    await expect(last).toContainText('What price did you have in mind?');
    await expect(chips.nth(2)).toHaveText('What is your best price?');
    await chips.first().click();
    await expect(page.locator('.offer-card.offer-counter')).toBeVisible();
    await expect(last).toContainText('I can offer it for');
    await page.getByRole('button', { name: 'I accept your offer.' }).click();
    await expect(page.locator('.deal-strip')).toContainText('Agreed at');
    await page.getByRole('button', { name: 'When can we meet?' }).click();
    await expect(last).toContainText('Please bring');
    await page.getByRole('button', { name: "I've collected the book. Thank you!" }).click();
    await expect(last).toContainText('marked the book as sold');
    await page.goto('/transactions');
    await expect(page.locator('.request-card').first()).toContainText('Completed');
  });

  test('home showcase: three covers only, spotlight on hover, each opens its own listing before and after rotation', async ({ browser }) => {
    // The showcase rotates through photographed listings; add four so the test does not depend on example covers,
    // which are not in the repository.
    const lister = await newUser(browser);
    await lister.request.post('/api/auth/register', { data: { name: 'Showcase Seller', email: `showcase${stamp}@uni.test`, password: 'password-showcase', role: 'student' } });
    for (let n = 1; n <= 4; n += 1) {
      const res = await lister.request.post('/api/books', {
        multipart: {
          title: `Showcase Book ${n}`, author: 'Test Author', subject: 'Physics', edition: '2nd', publicationYear: '2018',
          description: 'A clean copy listed for the showcase test.', price: String(100 + n * 50), condition: 'Good',
          images: { name: `cover${n}.png`, mimeType: 'image/png', buffer: PNG },
        },
      });
      expect(res.status()).toBe(201);
    }
    const page = await newUser(browser);
    await page.goto('/');
    const visual = page.locator('.hero-visual');
    const covers = page.locator('.fan-item');
    await expect(covers).toHaveCount(3);
    // Nothing but the covers and the decoration: no stats box, card, title, price or badge overlays.
    await expect(visual.locator('.hero-tag, .hero-card, .badge, h3, p')).toHaveCount(0);
    await expect(visual).not.toContainText(/Books across|Just listed|₹|Example/);
    const hrefs = () => covers.evaluateAll((links) => links.map((a) => a.getAttribute('href')));
    const lit = () => covers.evaluateAll((links) => links.map((a) => a.classList.contains('on')));

    // The centre cover (drawn last, on top) is in the spotlight by default.
    expect(await lit()).toEqual([false, false, true]);
    for (let i = 0; i < 3; i += 1) {
      await covers.nth(i).hover();
      await expect.poll(lit).toEqual([0, 1, 2].map((k) => k === i));
      await expect(page.locator('.fan.engaged')).toHaveCount(1);
      // Wait out the 0.3 s transition, then the other two are dimmed and the chosen one is not.
      await page.waitForTimeout(400);
      const brightness = await covers.evaluateAll((links) => links.map((a) => getComputedStyle(a).filter));
      brightness.forEach((f, k) => (k === i ? expect(f).not.toContain('brightness') : expect(f).toContain('brightness(0.5)')));
    }

    // Clicks at the element's visible centre; Playwright fails if an overlapping element would take the click.
    const opens = async (link) => {
      const href = await link.getAttribute('href');
      const [title, price] = (await link.getAttribute('aria-label') ?? '').split(/, (?=₹)/);
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
      if (title) await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
      if (price) await expect(page.locator('.details-price')).toContainText(price);
      await expect(page.locator('.seller-card h2 a')).not.toBeEmpty();
      await page.goBack();
      await expect(page).toHaveURL(/\/$/);
      await expect(covers).toHaveCount(3);
    };
    const checkAll = async () => {
      expect(new Set(await hrefs()).size).toBe(3);
      for (let i = 0; i < 3; i += 1) await opens(covers.nth(i));
    };
    await checkAll();

    // Pointing at a cover pauses rotation.
    await covers.nth(2).hover();
    const held = await hrefs();
    await page.waitForTimeout(7000);
    expect(await hrefs()).toEqual(held);

    // Moving away resumes it, the spotlight returns to the centre, and every link follows the new books.
    await page.mouse.move(5, 5);
    await expect.poll(lit).toEqual([false, false, true]);
    await expect.poll(hrefs, { timeout: 10_000 }).not.toEqual(held);
    await checkAll();

    // Keyboard: Tab focuses and spotlights a cover; Enter opens it.
    await covers.nth(1).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(covers.first()).toBeFocused();
    await expect.poll(lit).toEqual([true, false, false]);
    const first = await covers.first().getAttribute('href');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${first}$`));

    // Touch: the first tap selects a cover, the second opens it.
    const phone = await newUser(browser, { viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true });
    await phone.goto('/');
    const tapCovers = phone.locator('.fan-item');
    const left = tapCovers.first();
    const leftHref = await left.getAttribute('href');
    await left.tap();
    await expect(left).toHaveClass(/\bon\b/);
    await expect(phone).toHaveURL(/\/$/);
    await left.tap();
    await expect(phone).toHaveURL(new RegExp(`${leftHref}$`));
  });

  test('responsive: no horizontal overflow on any page at phone, tablet, laptop and desktop', async () => {
    fs.mkdirSync(SHOTS, { recursive: true });
    const member = ctx.student;
    const admin = ctx.admin;
    const anyBook = await member.request.get('/api/books?limit=1').then((r) => r.json());
    const memberPaths = ['/', '/books', `/books/${anyBook.items[0]._id}`, '/dashboard', '/sell', '/my-listings', '/wishlist', '/requests', '/transactions', '/messages', '/notifications', '/profile'];
    const adminPaths = ['/admin', '/admin/users', '/admin/listings', '/admin/reports', '/admin/audit'];
    const problems = [];
    for (const [label, viewport] of Object.entries(VIEWPORTS)) {
      for (const [page, paths] of [[member, memberPaths], [admin, adminPaths]]) {
        await page.setViewportSize(viewport);
        for (const p of paths) {
          await page.goto(p);
          await page.waitForLoadState('networkidle');
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          if (overflow > 0) problems.push(`${label} ${p}: ${overflow}px`);
          await page.screenshot({ path: path.join(SHOTS, `${label}${p.replace(/\//g, '_').replace(/_books_[a-f\d]+/, '_book')}.png`), fullPage: true });
        }
      }
    }
    expect(problems).toEqual([]);
  });

  test('the mobile menu opens and every item works', async () => {
    const page = ctx.student;
    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto('/');
    await expect(page.locator('.nav')).toBeHidden();
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.locator('.nav').getByRole('link', { name: 'My listings' }).click();
    await expect(page).toHaveURL(/my-listings/);
    await expect(page.locator('.nav')).toBeHidden();
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.getByRole('button', { name: 'Priya' }).click();
    await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
    await page.locator('h1').click();
    await expect(page.getByRole('button', { name: 'Log out' })).toBeHidden();
  });

  test('no uncaught browser errors happened during the whole run', async () => {
    expect(ctx.errors).toEqual([]);
  });

  test('removing sample data keeps real members and listings', async () => {
    const env = { ...process.env, MONGODB_URI: DB, JWT_SECRET: 'e2e-secret-e2e-secret-e2e-secret-e2e-1234', UPLOAD_DIR: './test-results/uploads', NODE_ENV: 'test' };
    execSync('node ../server/scripts/remove-demo.js', { env });
    const page = ctx.student;
    await page.goto('/books');
    await expect(page.locator('.badge-sample')).toHaveCount(0);
    await expect(page.locator('.book-card').first()).toBeVisible();
    await page.goto('/my-listings');
    await expect(page.locator('.listing-row').first()).toBeVisible();
  });
});
