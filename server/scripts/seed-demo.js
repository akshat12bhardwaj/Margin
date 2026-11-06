// Usage: npm run seed:demo    Safe to re-run. Adds --allow-production only with explicit authorization.
import mongoose from 'mongoose';
import { config } from '../src/config.js';
import { refusalReason, seedDemo } from '../demo/seed.js';

const refusal = refusalReason(config.mongoUri, process.env.NODE_ENV, process.argv.includes('--allow-production'));
if (refusal) {
  console.error(`Refusing to seed: ${refusal} Pass --allow-production only if this is explicitly authorized.`);
  process.exit(1);
}
await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
console.log(`Seeding sample data into "${mongoose.connection.name}"`);
console.log(JSON.stringify(await seedDemo()));
await mongoose.disconnect();
