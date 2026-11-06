import assert from 'node:assert/strict';
import { after, before, mock, test } from 'node:test';
import { admin, app, createApp, member, request, setupDb, teardownDb } from './helpers.js';
import { UNIVERSITY, User } from '../src/models/User.js';

before(setupDb);
after(teardownDb);

test('registration hashes the password and sets an httpOnly cookie', async () => {
  const res = await request(app).post('/api/auth/register').send({ name: 'Asha', email: 'ASHA@uni.edu', password: 'password123', role: 'student', university: 'State', program: 'B.Tech' }).expect(201);
  // Every account belongs to the one supported university, whatever the client sends.
  assert.equal(res.body.user.university, UNIVERSITY);
  assert.equal(res.body.user.program, 'B.Tech');
  assert.match(res.headers['set-cookie'][0], /HttpOnly/);
  assert.match(res.headers['set-cookie'][0], /SameSite=Lax/);
  assert.equal(res.body.user.passwordHash, undefined);
  const stored = await User.findOne({ email: 'asha@uni.edu' }).select('+passwordHash');
  assert.match(stored.passwordHash, /^\$2b\$12\$/);
});

test('cannot self-register as admin, or set status through registration', async () => {
  await request(app).post('/api/auth/register').send({ name: 'Eve', email: 'eve@uni.edu', password: 'password123', role: 'admin', university: 'State' }).expect(400);
  const res = await request(app).post('/api/auth/register').send({ name: 'Eve', email: 'eve2@uni.edu', password: 'password123', role: 'student', university: 'State', status: 'suspended', tokenVersion: 9 }).expect(201);
  assert.equal(res.body.user.status, 'active');
  assert.equal(res.body.user.university, UNIVERSITY);
});

test('registration validation and duplicate email', async () => {
  const base = { name: 'Bob', email: 'bob@uni.edu', password: 'password123', role: 'faculty', university: 'State' };
  await request(app).post('/api/auth/register').send({ ...base, email: 'nope' }).expect(400);
  await request(app).post('/api/auth/register').send({ ...base, password: 'short' }).expect(400);
  await request(app).post('/api/auth/register').send(base).expect(201);
  await request(app).post('/api/auth/register').send(base).expect(409);
});

test('NoSQL operator injection on login is rejected', async () => {
  await request(app).post('/api/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } }).expect(400);
});

test('login, /me, logout', async () => {
  const m = await member();
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: m.email, password: 'wrong-password' }).expect(401);
  await agent.post('/api/auth/login').send({ email: 'ghost@uni.edu', password: 'wrong-password' }).expect(401);
  await agent.post('/api/auth/login').send({ email: m.email, password: 'password123' }).expect(200);
  assert.equal((await agent.get('/api/auth/me')).body.user.email, m.email);
  await agent.post('/api/auth/logout').expect(200);
  assert.equal((await agent.get('/api/auth/me')).body.user, null);
});

test('a forged or garbage token is not accepted', async () => {
  const res = await request(app).get('/api/users/me/dashboard').set('Cookie', 'token=abc.def.ghi').expect(401);
  assert.ok(res.body.error);
});

test('profile update cannot change role or status', async () => {
  const m = await member();
  const res = await m.agent.patch('/api/users/me').send({ name: 'New Name', university: 'Other U', bio: 'hi', role: 'admin', status: 'suspended' }).expect(200);
  assert.equal(res.body.user.name, 'New Name');
  assert.equal(res.body.user.role, 'student');
  assert.equal(res.body.user.status, 'active');
});

test('password reset: single use, unknown email is indistinguishable, old sessions die', async () => {
  const m = await member();
  const info = mock.method(console, 'info', () => {});
  await request(app).post('/api/auth/forgot-password').send({ email: 'ghost@uni.edu' }).expect(200);
  assert.equal(info.mock.callCount(), 0);
  const res = await request(app).post('/api/auth/forgot-password').send({ email: m.email }).expect(200);
  assert.deepEqual(res.body, { ok: true });
  const token = info.mock.calls[0].arguments[0].match(/reset-password\/([a-f\d]{64})/)[1];
  info.mock.restore();
  await request(app).post('/api/auth/reset-password').send({ token: 'f'.repeat(64), password: 'brand-new-pass' }).expect(400);
  await request(app).post('/api/auth/reset-password').send({ token, password: 'brand-new-pass' }).expect(200);
  await request(app).post('/api/auth/reset-password').send({ token, password: 'another-pass-1' }).expect(400);
  await m.agent.get('/api/users/me/dashboard').expect(401);
  await request(app).post('/api/auth/login').send({ email: m.email, password: 'brand-new-pass' }).expect(200);
});

test('change password requires the current one and keeps this session', async () => {
  const m = await member();
  await m.agent.post('/api/auth/change-password').send({ currentPassword: 'bad', newPassword: 'brand-new-pass' }).expect(400);
  await m.agent.post('/api/auth/change-password').send({ currentPassword: 'password123', newPassword: 'brand-new-pass' }).expect(200);
  await m.agent.get('/api/users/me/dashboard').expect(200);
});

test('login is rate limited', async () => {
  const limited = createApp({ authLimit: 2 });
  const body = { email: 'x@uni.edu', password: 'whatever' };
  await request(limited).post('/api/auth/login').send(body).expect(401);
  await request(limited).post('/api/auth/login').send(body).expect(401);
  await request(limited).post('/api/auth/login').send(body).expect(429);
});

test('role guards: anonymous gets 401, members 403 on all admin routes', async () => {
  const m = await member('faculty');
  const paths = ['stats', 'users', 'books', 'reports', 'audit-logs'];
  for (const p of paths) {
    await request(app).get(`/api/admin/${p}`).expect(401);
    await m.agent.get(`/api/admin/${p}`).expect(403);
  }
  const id = '507f1f77bcf86cd799439011';
  await m.agent.patch(`/api/admin/users/${id}/suspend`).send({ reason: 'because' }).expect(403);
  await m.agent.patch(`/api/admin/books/${id}/remove`).send({ reason: 'because' }).expect(403);
  await m.agent.patch(`/api/admin/reports/${id}`).send({ status: 'resolved', decision: 'done' }).expect(403);
  const a = await admin();
  await a.agent.get('/api/admin/stats').expect(200);
});
