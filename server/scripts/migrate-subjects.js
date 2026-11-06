// Usage: npm run migrate:subjects                 dry run, changes nothing
//        npm run migrate:subjects -- --apply      maps listings onto the subject catalogue
//        add --remove-original-price (with --apply) to delete stored original prices. That cannot be undone.
import mongoose from 'mongoose';
import { config } from '../src/config.js';
import { migrateSubjects } from '../demo/migrate-subjects.js';

const apply = process.argv.includes('--apply');
const removeOriginalPrice = process.argv.includes('--remove-original-price');
await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
const r = await migrateSubjects({ apply, removeOriginalPrice });
console.log(`${apply ? 'APPLIED to' : 'DRY RUN on'} "${mongoose.connection.name}": ${r.total} listings, ${r.alreadyValid} already valid, ${r.changes.length} to map, ${r.flagged.length} flagged.`);
const tally = {};
for (const c of r.changes) tally[`${c.from} -> ${c.to}`] = (tally[`${c.from} -> ${c.to}`] ?? 0) + 1;
console.table(tally);
if (r.flagged.length) {
  console.log('Flagged for review (left unchanged, no confident match):');
  console.table(r.flagged.map((f) => ({ id: String(f._id), title: f.title, subject: f.subject, course: f.course, status: f.status })));
}
console.log(`Listings by status before: ${JSON.stringify(r.before)}  after: ${JSON.stringify(r.after)}`);
console.log(`Subjects updated: ${r.updated}. Listings storing an original price: ${r.withOriginalPrice} (hidden from the API)${removeOriginalPrice && apply ? `, removed: ${r.originalPricesRemoved}` : ''}.`);
await mongoose.disconnect();
