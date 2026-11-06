import { createRequire } from 'node:module';

const require = createRequire(new URL('../server/package.json', import.meta.url));
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

export const ADMIN = { email: 'admin@e2e.test', password: 'admin-password-123' };

// Only ever drops the dedicated e2e database.
export default async function globalSetup() {
  const conn = await mongoose.createConnection('mongodb://127.0.0.1:27017/academic_marketplace_e2e').asPromise();
  if (conn.name !== 'academic_marketplace_e2e') throw new Error(`Refusing to reset ${conn.name}`);
  // Keep collections so the server's indexes survive; it starts before this runs.
  for (const c of await conn.db.collections()) await c.deleteMany({});
  await conn.collection('users').insertOne({
    name: 'Site Admin', email: ADMIN.email, role: 'admin', university: 'Platform', status: 'active', tokenVersion: 0,
    department: '', designation: '', bio: '', statusReason: '',
    passwordHash: await bcrypt.hash(ADMIN.password, 4), createdAt: new Date(), updatedAt: new Date(),
  });
  await conn.close();
}
