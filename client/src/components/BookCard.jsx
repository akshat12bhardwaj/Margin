import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatPrice, subjectInfo } from '../constants.js';
import { Icon, RoleBadge, StatusBadge } from './ui.jsx';

const COVER_THEMES = [
  ['#1c2b20', '#f3efe3'], ['#a66441', '#fff8ee'], ['#3f5b3f', '#f3efe3'], ['#c3cbb0', '#1c2b20'],
  ['#5a2c1b', '#f3e3d6'], ['#c8ae90', '#1c2b20'], ['#635745', '#f3efe3'], ['#e5ddc9', '#3f2a1a'],
];

// Same book, same colours, wherever it appears.
const themeFor = (title) => COVER_THEMES[[...title].reduce((sum, c) => sum + c.charCodeAt(0), 0) % COVER_THEMES.length];

// Field-themed line art for generated covers, drawn here so it can never be mistaken for a real book's cover.
const ART = {
  laptop: (
    <>
      <path d="M22 30 10 42l12 12M78 30l12 12-12 12" />
      <path d="M32 28h28M32 38h38M40 48h24M40 58h32M32 68h18M56 68h12" />
    </>
  ),
  sigma: (
    <>
      <text x="8" y="58" fontSize="44">∑</text>
      <text x="54" y="46" fontSize="36">∫</text>
      <text x="66" y="88" fontSize="22">π</text>
      <text x="14" y="90" fontSize="16">√x²</text>
    </>
  ),
  atom: (
    <>
      <ellipse cx="50" cy="50" rx="40" ry="13" />
      <ellipse cx="50" cy="50" rx="40" ry="13" transform="rotate(60 50 50)" />
      <ellipse cx="50" cy="50" rx="40" ry="13" transform="rotate(120 50 50)" />
      <circle cx="50" cy="50" r="4" fill="currentColor" />
    </>
  ),
  chip: (
    <>
      <path d="M8 22h28v18h16M8 52h20v28h40M92 30H72v40H60M48 8v22M74 92V78" />
      <circle cx="52" cy="40" r="3" /><circle cx="68" cy="80" r="3" /><circle cx="60" cy="70" r="3" /><circle cx="48" cy="30" r="3" /><circle cx="74" cy="78" r="3" />
    </>
  ),
  bolt: <path d="M56 8 26 56h22l-6 36 32-50H52z" />,
  gear: (
    <>
      <circle cx="40" cy="58" r="24" strokeWidth="9" strokeDasharray="7 6" />
      <circle cx="40" cy="58" r="15" /><circle cx="40" cy="58" r="5" />
      <circle cx="76" cy="28" r="13" strokeWidth="7" strokeDasharray="5 5" />
      <circle cx="76" cy="28" r="6" />
    </>
  ),
  trend: <path d="M10 88h82M10 88V10M16 74l18-18 14 12 28-34M64 34h12v12" />,
  briefcase: <path d="M10 88h82M20 88V60h12v28M44 88V40h12v48M68 88V24h12v64" />,
};
const DEFAULT_ART = <path d="M14 24h72M14 40h72M14 56h52M14 72h64" />;

// A photo when there is one, otherwise (or if it fails to load) a designed cover with the title and author.
export function BookCover({ book, alt = '', index = 0 }) {
  const [failed, setFailed] = useState(null);
  const url = book.images?.[index]?.url;
  if (url && failed !== url) {
    return (
      <span className="cover">
        <img src={url} alt={alt} loading="lazy" decoding="async" width="400" height="600" onError={() => setFailed(url)} />
      </span>
    );
  }
  const [bg, ink] = themeFor(book.title);
  const subject = subjectInfo(book.subject);
  return (
    <span className="cover" role={alt ? 'img' : undefined} aria-label={alt || undefined}>
      <span className="cover-made" style={{ '--cover-bg': bg, '--cover-ink': ink }} aria-hidden="true">
        <span className="cover-top">
          <Icon name={subject?.icon ?? 'book'} />
          {subject && <i>{subject.short}</i>}
        </span>
        <b>{book.title}</b>
        <svg className="cover-art" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {ART[subject?.art] ?? DEFAULT_ART}
        </svg>
        {book.author && <small>{book.author}</small>}
      </span>
    </span>
  );
}

export const editionLabel = (book) => (book.edition ? `${book.edition} edition` : 'Edition not stated');

export function BookGridSkeleton({ count = 4 }) {
  return (
    <div className="book-grid" role="status" aria-label="Loading books">
      {Array.from({ length: count }, (_, i) => <span key={i} className="skel skel-card" />)}
    </div>
  );
}

export default function BookCard({ book, footer }) {
  return (
    <article className="book-card">
      <Link to={`/books/${book._id}`} className="book-link">
        <div className="book-cover">
          <div className="book-tags">
            <span />
            <span className="book-status"><StatusBadge status={book.status} /></span>
          </div>
          <BookCover book={book} alt={`Cover of ${book.title}`} />
          <span className="book-condition">{book.condition}</span>
        </div>
        <div className="book-body">
          <div className="book-title-row">
            <h3>{book.title}</h3>
            <p className="book-price">{formatPrice(book.price)}</p>
          </div>
          <p className="book-author">{book.author}</p>
          <p className="book-meta">{editionLabel(book)}</p>
          {(book.course || book.subject) && <p className="book-meta book-course">{book.course || book.subject}</p>}
          {book.seller?.name && (
            <p className="book-seller">
              {book.seller.name} <RoleBadge role={book.seller.role} />
            </p>
          )}
        </div>
      </Link>
      {footer}
    </article>
  );
}
