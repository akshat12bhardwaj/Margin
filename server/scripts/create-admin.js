// Usage: npm run create-admin -- "Admin Name" admin@example.edu "StrongPassword123"
// Administrators can only be created here; the public API rejects the admin role.
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { config } from '../src/config.js';
import { User } from '../src/models/User.js';

const [name, email, password] = process.argv.slice(2);
if (!name || !email?.includes('@') || !password || password.length < 12) {
  console.error('Usage: npm run create-admin -- "Name" email@example.edu "password of at least 12 characters"');
  process.exit(1);
}

await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
if (await User.exists({ email: email.toLowerCase() })) {
  console.error('An account with that email already exists.');
  process.exitCode = 1;
} else {
  await User.create({ name, email, role: 'admin', university: 'Platform', passwordHash: await bcrypt.hash(password, 12) });
  console.log(`Administrator ${email} created.`);
}
await mongoose.disconnect();
