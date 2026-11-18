import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import BookCard, { BookCover, BookGridSkeleton, editionLabel } from '../components/BookCard.jsx';
import { EmptyState, Icon } from '../components/ui.jsx';
import { formatPrice, subjectInfo } from '../constants.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useFetch, useTitle } from '../hooks.js';

const STEPS = [
  ['Find your course book', 'Search by title, author, ISBN or subject, then narrow by course, semester, edition and condition.'],
  ['Send a purchase request', 'The seller is notified and can accept or decline. Accepting reserves the book for you alone.'],
  ['Meet and exchange', 'Agree the details in messages, then pay and collect in person. The seller closes the listing afterwards.'],
];
const AFFORDABLE_LIMIT = 400;
// More cards than this turns the band into a wall; the full list is one click away on Browse.
const HOME_SUBJECTS = 8;

// Several copies of one title are normal, but a home page shelf reads better showing different books.
const distinctBooks = (items, count) => {
  const seen = new Set();
  return items.filter((b) => !seen.has(b.title) && seen.add(b.title)).slice(0, count);
};

const LEAF = 'M50 2C22 18 8 44 12 70c2 14 14 26 38 28 24-2 36-14 38-28C92 44 78 18 50 2zm0 8v84M50 30 26 18m24 26L18 34m32 28L16 56m34 22L26 80m24-50 24-12M50 44l32-10M50 62l34-6M50 78l24 2';
const Leaf = ({ className }) => (
  <svg className={`hero-leaf ${className}`} viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><path d={LEAF} fill="currentColor" fillOpacity="0.5" /></svg>
);

function SectionHead({ eyebrow, title, to, link }) {
  return (
    <div className="section-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {to && <Link className="link-arrow" to={to}>{link} <Icon name="arrow" /></Link>}
    </div>
  );
}

// Facets arrive sorted by listing count, so these are the subjects with the most books on offer.
function Subjects({ subjects }) {
  return (
    <section className="dark-band">
      <div className="wrap section">
        <SectionHead eyebrow="(01) Subjects" title="Start from your subject." to="/books" link="All subjects" />
        <nav className="dept-grid" aria-label="Subjects">
          {subjects.slice(0, HOME_SUBJECTS).map((s) => (
            <Link key={s.name} className="dept-card" to={`/books?${new URLSearchParams({ subject: s.name })}`} title={s.name}>
              <span className="dept-icon"><Icon name={subjectInfo(s.name).icon} /></span>
              <strong>{subjectInfo(s.name).short}</strong>
              <span className="dept-count">{s.count} {s.count === 1 ? 'book' : 'books'}</span>
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}

const ROTATE_MS = 6000;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Three covers from the newest photographed listings, stepping by one every few seconds. One cover is in the
// spotlight: the centre one by default, or whichever the visitor points at, focuses or taps; the others dim.
// Rotation stops while a cover is selected and never runs for visitors who prefer reduced motion.
// On touch, the first tap on a cover selects it and the second opens it.
function Showcase({ items }) {
  const pool = items.filter((b) => b.images[0]);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(null);
  const box = useRef(null);
  const lastInput = useRef('mouse');
  const armed = useRef(null);
  const rotates = pool.length > 3;
  useEffect(() => {
    if (!rotates || selected !== null || reducedMotion()) return undefined;
    const timer = setInterval(() => {
      armed.current = null;
      setOffset((o) => o + 1);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [rotates, selected]);
  // A tap anywhere else lets go of a touch selection.
  useEffect(() => {
    if (selected === null) return undefined;
    const away = (e) => {
      if (box.current?.contains(e.target)) return;
      armed.current = null;
      setSelected(null);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [selected]);
  const fan = pool.slice(0, 3).map((_, i) => pool[(offset + i) % pool.length]);
  if (!fan.length) return null;
  const spotlight = selected ?? fan.length - 1;
  const release = () => {
    armed.current = null;
    setSelected(null);
  };
  return (
    <div
      ref={box}
      className={`fan${selected === null ? '' : ' engaged'}`}
      // Keyed by step, so each rotation fades in fresh links rather than retargeting old ones.
      key={offset}
      onPointerDown={(e) => { lastInput.current = e.pointerType; }}
      onKeyDown={() => { lastInput.current = 'keyboard'; }}
      // Touch pointers "leave" as soon as the finger lifts, so only a mouse leaving ends the selection here.
      onPointerLeave={(e) => e.pointerType === 'mouse' && release()}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && lastInput.current !== 'touch' && release()}
    >
      {fan.map((book, i) => (
        <Link
          key={book._id}
          className={`fan-item${i === spotlight ? ' on' : ''}`}
          to={`/books/${book._id}`}
          aria-label={`${book.title}, ${formatPrice(book.price)}`}
          // pointerover, not mouseenter: it fires for a mouse already resting inside after Back, and says what pointer it is.
          onPointerOver={(e) => e.pointerType === 'mouse' && setSelected(i)}
          // Only keyboard focus selects; a tap also focuses the link, which must not count as the first tap.
          onFocus={(e) => e.currentTarget.matches(':focus-visible') && setSelected(i)}
          onClick={(e) => {
            if (lastInput.current !== 'touch' || armed.current === i) return;
            e.preventDefault();
            armed.current = i;
            setSelected(i);
          }}
        >
          <BookCover book={book} />
        </Link>
      ))}
    </div>
  );
}

function Shelf({ eyebrow, title, params, to, link, band }) {
  const state = useFetch(() => api.get('/books', { limit: 24, ...params }), []);
  if (!state.loading && !state.data?.items.length) return null;
  return (
    <section className={band ? 'band' : undefined}>
      <div className="wrap section">
        <SectionHead eyebrow={eyebrow} title={title} to={to} link={link} />
        {state.data ? (
          <div className="book-grid">{distinctBooks(state.data.items, 4).map((book) => <BookCard key={book._id} book={book} />)}</div>
        ) : <BookGridSkeleton />}
      </div>
    </section>
  );
}

function Affordable() {
  const state = useFetch(() => api.get('/books', { limit: 24, maxPrice: AFFORDABLE_LIMIT, sort: 'price_asc' }), []);
  if (!state.data?.items.length) return null;
  return (
    <section className="wrap section">
      <SectionHead eyebrow="(03) Easy on the budget" title={<>Used textbooks under {formatPrice(AFFORDABLE_LIMIT)}</>} to={`/books?maxPrice=${AFFORDABLE_LIMIT}&sort=price_asc`} link="See all" />
      <ol className="ranked">
        {distinctBooks(state.data.items, 5).map((book, i) => (
          <li key={book._id}>
            <Link to={`/books/${book._id}`}>
              <span className="rank">0{i + 1}</span>
              <BookCover book={book} />
              <div>
                <h3>{book.title}</h3>
                <p>{book.condition} · {editionLabel(book)} · {book.seller?.name}</p>
              </div>
              <span className="price">{formatPrice(book.price)}</span>
              <span className="link-arrow">View <Icon name="arrow" /></span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function Landing() {
  useTitle();
  const navigate = useNavigate();
  const { user, canTrade } = useAuth();
  const [q, setQ] = useState('');
  const latest = useFetch(() => api.get('/books', { limit: 8 }), []);
  const facets = useFetch(() => api.get('/books/facets'), []);
  const items = latest.data?.items ?? [];
  const f = facets.data;
  const hasBooks = f ? f.total > 0 : false;
  const subjects = f?.subjects ?? [];
  const sellPath = user ? '/sell' : '/register';

  return (
    <>
      <section className="hero wrap">
        <div className="hero-grid">
          <div>
            <p className="eyebrow">For BMU students and faculty</p>
            <h1>Course books,<br />passed <em>on.</em></h1>
            <p className="lead">Find and exchange course books within the BMU community. Used textbooks and older editions, for less than new.</p>
            <form
              className="hero-search"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(`/books${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
              }}
            >
              <Icon name="search" />
              <input aria-label="Search books" placeholder="Title, author, ISBN or subject" value={q} onChange={(e) => setQ(e.target.value)} />
              <button type="submit" className="btn btn-primary">Search</button>
            </form>
            {(!user || canTrade) && (
              <p className="hero-actions">
                <span className="muted">Finished with a book?</span>
                <Link className="link-arrow" to={sellPath}>List it in a few minutes <Icon name="arrow" /></Link>
              </p>
            )}
            {hasBooks && (
              <div className="hero-stats">
                <div><strong>{f.subjects.length}</strong><span>Subjects</span></div>
                <div><strong>{f.courses.length}</strong><span>Courses</span></div>
              </div>
            )}
          </div>
          <div className="hero-visual">
            <Leaf className="hero-leaf-a" />
            <Leaf className="hero-leaf-b" />
            <Showcase items={items} />
          </div>
        </div>
      </section>

      {subjects.length > 0 && (
        <div className="ticker" aria-hidden="true">
          <div className="ticker-track">
            {[...subjects, ...subjects].map((s, i) => <span key={`${s.name}-${i}`}>{s.name}</span>)}
          </div>
        </div>
      )}

      {subjects.length > 0 && <Subjects subjects={subjects} />}

      <section className="wrap section">
        <SectionHead eyebrow="(02) New on the shelf" title="Recently listed" to="/books" link="See all books" />
        {latest.loading && !latest.data && <BookGridSkeleton />}
        {latest.data && (items.length ? (
          <div className="book-grid">{items.map((book) => <BookCard key={book._id} book={book} />)}</div>
        ) : (
          <EmptyState title="The shelves are empty so far" action={<Link className="btn btn-primary" to={sellPath}>List the first book</Link>}>
            Be the first to list a course book.
          </EmptyState>
        ))}
      </section>

      {subjects.slice(0, 2).map((s) => (
        <Shelf key={s.name} eyebrow="Popular subject" title={s.name} params={{ subject: s.name, sort: 'price_asc' }} to={`/books?${new URLSearchParams({ subject: s.name })}`} link="See all" />
      ))}

      <Affordable />
      <Shelf band eyebrow="(04) From faculty shelves" title="Listed by faculty" params={{ sellerRole: 'faculty' }} to="/books?sellerRole=faculty" link="See all" />
      <Shelf eyebrow="(05) Latest printings" title="Recently published editions" params={{ sort: 'year_desc' }} to="/books?sort=year_desc" link="See all" />

      <section className="band">
        <div className="wrap section">
          <SectionHead eyebrow="(06) How it works" title="Three steps. No middleman." />
          <ol className="steps">
            {STEPS.map(([title, text], i) => (
              <li key={title}>
                <span className="step-num">0{i + 1}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
          <p className="notice">Margin does not process payments. A purchase request is not a payment: you settle up directly with the seller when you meet.</p>
        </div>
      </section>

      <section className="wrap section">
        <div className="cta">
          <div>
            <p className="eyebrow">Sell a book</p>
            <h2>Your finished books can fund next semester.</h2>
            <p>Older editions you no longer need are often exactly what someone else can afford. Students and faculty list books the same way.</p>
          </div>
          <div className="row-wrap">
            {(!user || canTrade) && <Link to={sellPath} className="btn btn-light">Sell a book <Icon name="arrow" /></Link>}
            {!user && <Link to="/register?role=faculty" className="btn cta-alt">Join as faculty</Link>}
          </div>
        </div>
      </section>
    </>
  );
}
