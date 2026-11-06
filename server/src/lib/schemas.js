import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const idParams = z.object({ id: objectId });
export const paging = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
};
// Empty form fields arrive as ''; treat them as absent.
const blankToUndefined = (v) => (v === '' || v === null ? undefined : v);
export const optional = (schema) => z.preprocess(blankToUndefined, schema.optional());
// Without this, z.coerce.number() would quietly turn a blank field into 0.
export const required = (schema) => z.preprocess(blankToUndefined, schema);
// B.Tech runs eight semesters.
export const semester = optional(z.coerce.number().int('Choose a semester from 1 to 8').min(1, 'Choose a semester from 1 to 8').max(8, 'Choose a semester from 1 to 8'));
export const reason = z.string('Please give a reason').trim().min(3, 'Please give a reason').max(1000);
