import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

// Own database and upload folder: tests never touch development data or other projects on this server.
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/academic_marketplace_test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), 'academic-marketplace-test-uploads');
process.env.AUTH_RATE_LIMIT = '100000';
delete process.env.CLOUDINARY_URL;
delete process.env.SMTP_URL;
process.env.GOOGLE_CLIENT_ID = 'test-google-client';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
process.env.CLIENT_URL = 'http://localhost:5173';

const { default: bcrypt } = await import('bcrypt');
const { default: mongoose } = await import('mongoose');
const { default: request } = await import('supertest');
const { createApp } = await import('../src/app.js');
const { User } = await import('../src/models/User.js');

export const app = createApp();
export { createApp, mongoose, request };

export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==', 'base64');

export async function setupDb() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  assert.match(mongoose.connection.name, /_test$/);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
}

export const teardownDb = () => mongoose.disconnect();

let seq = 0;
export async function member(role = 'student', extra = {}) {
  const agent = request.agent(app);
  const email = `user${++seq}@uni.edu`;
  const res = await agent.post('/api/auth/register').send({ name: `User ${seq}`, email, password: 'password123', role, university: 'State University', ...extra }).expect(201);
  return { agent, id: res.body.user._id, email, user: res.body.user };
}

// Inserted directly, because the public API cannot create admins.
export async function admin() {
  const email = `admin${++seq}@uni.edu`;
  await User.create({ name: `Admin ${seq}`, email, role: 'admin', university: 'Platform', passwordHash: await bcrypt.hash('password123', 4) });
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password: 'password123' }).expect(200);
  return { agent, id: res.body.user._id, email };
}

export const LISTING = {
  title: 'Introduction to Algorithms',
  author: 'Cormen',
  subject: 'Data Structures and Algorithms',
  course: 'CS201',
  edition: '3rd',
  publicationYear: '2009',
  description: 'Well kept copy with light pencil marks.',
  price: '500',
  condition: 'Good',
};

export async function listing(seller, fields = {}) {
  const req = seller.agent.post('/api/books');
  for (const [k, v] of Object.entries({ ...LISTING, ...fields })) req.field(k, v);
  const res = await req.attach('images', PNG, { filename: 'a.png', contentType: 'image/png' }).expect(201);
  return res.body.book;
}
