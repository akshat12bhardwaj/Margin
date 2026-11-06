// Handlers read only req.data, so they only ever see validated input.
export const validate = (schemas) => (req, res, next) => {
  req.data = {};
  for (const [source, schema] of Object.entries(schemas)) Object.assign(req.data, schema.parse(req[source] ?? {}));
  next();
};
