export function isValidIsbn(isbn) {
  if (!/^(\d{9}[\dX]|\d{13})$/.test(isbn)) return false;
  const digits = [...isbn].map((c) => (c === 'X' ? 10 : Number(c)));
  if (isbn.length === 13) return digits.reduce((sum, d, i) => sum + d * (i % 2 ? 3 : 1), 0) % 10 === 0;
  return digits.reduce((sum, d, i) => sum + d * (10 - i), 0) % 11 === 0;
}
