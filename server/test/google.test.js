import assert from 'node:assert/strict';
import { after, before, mock, test } from 'node:test';
import jwt from 'jsonwebtoken';
import { admin, app, member, request, setupDb, teardownDb } from './helpers.js';
import { User } from '../src/models/User.js';

before(setupDb);
after(teardownDb);

const CLIENT = 'http://localhost:5173';
let seq = 0;

function idToken(claims = {}) {
  seq += 1;
  return jwt.sign({ iss: 'https://accounts.google.com', aud: 'test-google-client', sub: `google-${seq}`, email: `g${seq}@gmail.com`, email_verified: true, name: `Google ${seq}`, ...claims }, 'google-key');
}

// Runs the whole redirect flow with Google's token endpoint replaced.
async function signIn(token, agent = request.agent(app)) {
  const start = await agent.get('/api/auth/google').expect(302);
  const url = new URL(start.headers.location);
  assert.equal(url.host, 'accounts.google.com');
  assert.equal(url.searchParams.get('redirect_uri'), `${CLIENT}/api/auth/google/callback`);
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    fetchMock.mock.restore();
    return new Response(JSON.stringify({ id_token: token }));
  });
  const res = await agent.get('/api/auth/google/callback').query({ state: url.searchParams.get('state'), code: 'abc' }).expect(302);
  fetchMock.mock.restore();
  return { agent, location: res.headers.location };
}

const COMPLETE = { role: 'student', university: 'State University', semester: 3 };

test('/me says Google sign-in is available', async () => {
  assert.equal((await request(app).get('/api/auth/me')).body.googleEnabled, true);
});

test('a new Google user finishes signup and can sign in again', async () => {
  const token = idToken({ email: 'New.Person@gmail.com', name: 'New Person' });
  const { agent, location } = await signIn(token);
  assert.equal(location, `${CLIENT}/register/google`);
  assert.equal((await agent.get('/api/auth/me')).body.user, null);

  await agent.post('/api/auth/google/complete').send({ university: 'State University' }).expect(400);
  await agent.post('/api/auth/google/complete').send({ ...COMPLETE, role: 'admin' }).expect(400);
  const res = await agent.post('/api/auth/google/complete').send({ ...COMPLETE, name: 'Spoofed', email: 'spoof@uni.edu', status: 'suspended' }).expect(201);
  assert.equal(res.body.user.name, 'New Person');
  assert.equal(res.body.user.email, 'new.person@gmail.com');
  assert.equal(res.body.user.status, 'active');
  assert.equal(res.body.user.googleId, undefined);
  assert.equal((await agent.get('/api/auth/me')).body.user.email, 'new.person@gmail.com');

  const again = await signIn(token);
  assert.equal(again.location, `${CLIENT}/dashboard`);
  assert.equal((await again.agent.get('/api/auth/me')).body.user.email, 'new.person@gmail.com');
  await request(app).post('/api/auth/login').send({ email: 'new.person@gmail.com', password: 'password123' }).expect(401);
});

test('signup cannot be completed without a Google cookie, or with a session token', async () => {
  const m = await member();
  await request(app).post('/api/auth/google/complete').send(COMPLETE).expect(400);
  const session = jwt.sign({ sub: m.id, v: 0 }, process.env.JWT_SECRET);
  await request(app).post('/api/auth/google/complete').set('Cookie', `google_signup=${session}`).send(COMPLETE).expect(400);
});

test('a signup token is not accepted as a session', async () => {
  const pending = jwt.sign({ gid: 'x', email: 'x@gmail.com', name: 'X' }, process.env.JWT_SECRET, { audience: 'google-signup' });
  const res = await request(app).get('/api/auth/me').set('Cookie', `token=${pending}`).expect(200);
  assert.equal(res.body.user, null);
});

test('linking an existing account removes its password and ends its sessions', async () => {
  const m = await member();
  const { agent, location } = await signIn(idToken({ email: m.email }));
  assert.equal(location, `${CLIENT}/dashboard`);
  assert.equal((await agent.get('/api/auth/me')).body.user.email, m.email);
  await m.agent.get('/api/users/me/dashboard').expect(401);
  await request(app).post('/api/auth/login').send({ email: m.email, password: 'password123' }).expect(401);
  await agent.post('/api/auth/change-password').send({ currentPassword: 'password123', newPassword: 'brand-new-pass' }).expect(400);
});

test('a different Google identity cannot take over a linked account', async () => {
  const email = `linked${++seq}@gmail.com`;
  const { agent } = await signIn(idToken({ email }));
  await agent.post('/api/auth/google/complete').send(COMPLETE).expect(201);
  const { location } = await signIn(idToken({ email, sub: 'someone-else' }));
  assert.equal(location, `${CLIENT}/login?error=google`);
});

test('admin and deactivated accounts cannot use Google', async () => {
  const a = await admin();
  assert.equal((await signIn(idToken({ email: a.email }))).location, `${CLIENT}/login?error=google-admin`);
  const m = await member();
  await User.updateOne({ email: m.email }, { status: 'deactivated' });
  assert.equal((await signIn(idToken({ email: m.email }))).location, `${CLIENT}/login?error=deactivated`);
});

test('unverified email, wrong audience and wrong issuer are rejected', async () => {
  const error = mock.method(console, 'error', () => {});
  for (const claims of [{ email_verified: false }, { aud: 'another-app' }, { iss: 'https://evil.example' }]) {
    assert.equal((await signIn(idToken(claims))).location, `${CLIENT}/login?error=google`);
  }
  error.mock.restore();
});

test('a callback without the matching state is rejected before contacting Google', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => assert.fail('must not call Google'));
  const res = await request(app).get('/api/auth/google/callback').query({ state: 'forged', code: 'abc' }).set('Cookie', 'google_state=real').expect(302);
  assert.equal(res.headers.location, `${CLIENT}/login?error=google`);
  await request(app).get('/api/auth/google/callback').query({ state: 'x', code: 'abc' }).expect(302);
  assert.equal(fetchMock.mock.callCount(), 0);
  fetchMock.mock.restore();
});
