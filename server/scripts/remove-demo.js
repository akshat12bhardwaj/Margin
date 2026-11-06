// Usage: npm run demo:remove    Deletes sample accounts and listings only. Real members and listings stay.
import mongoose from 'mongoose';
import { config } from '../src/config.js';
import { removeDemo } from '../demo/seed.js';

await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
console.log(`Removing sample data from "${mongoose.connection.name}"`);
console.log(JSON.stringify(await removeDemo()));
await mongoose.disconnect();
