import mongoose from 'mongoose';
import { createApp } from './app.js';
import { config } from './config.js';

await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
const app = createApp();
// Fails startup if a unique index cannot be built, instead of silently losing the double-sale guarantee.
await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
console.log(`MongoDB connected: ${mongoose.connection.name}`);
app.listen(config.port, () => console.log(`API listening on http://localhost:${config.port}`));
