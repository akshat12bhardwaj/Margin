import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import BookCard, { BookGridSkeleton } from '../components/BookCard.jsx';
import { EmptyState, Field, Icon, Loaded, Pagination, SampleBadge, SemesterSelect, SubjectSelect } from '../components/ui.jsx';
import { CONDITIONS } from '../constants.js';
import { useFetch, useTitle } from '../hooks.js';

const FILTERS = ['subject', 'sellerRole', 'course', 'semester', 'edition', 'minPrice', 'maxPrice'];
const fromParams = (params) => ({
  ...Object.fromEntries(FILTERS.map((k) => [k, params.get(k) ?? ''])),
  condition: params.get('condition')?.split(',') ?? [],
});

export default function Browse() {
  useTitle('Browse books');
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState(() => fromParams(params));
  const [q, setQ] = useState(params.get('q') ?? '');
  const query = params.toString();
  const results = useFetch(() => api.get('/books', { ...Object.fromEntries(params), limit: 12 }), [query]);
  const facets = useFetch(() => api.get('/books/facets'), []);
  const counts = Object.fromEntries(facets.data?.subjects.map((s) => [s.name, s.count]) ?? []);

  // The URL is the source of truth, so filtered views can be shared and survive the back button.
  useEffect(() => {
    setDraft(fromParams(params));
    setQ(params.get('q') ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries({ page: '', ...changes })) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next);
  };
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const toggleCondition = (c) => setDraft((d) => ({ ...d, condition: d.condition.includes(c) ? d.condition.filter((x) => x !== c) : [...d.condition, c] }));
  const applyFilters = (e) => {
    e.preventDefault();
    update({ ...draft, condition: draft.condition.join(',') });
  };
  const activeFilters = [...FILTERS, 'condition'].filter((k) => params.get(k)).length;

  return (
    <div className="wrap page">
      <div className="browse-head">
        <p className="eyebrow">Course books at BMU</p>
        <h1>{params.get('q') ? <>Results for “{params.get('q')}”</> : <>Browse <em>every</em> book</>}</h1>
      </div>
      <form
        className="search-bar"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: q.trim() });
        }}
      >
        <Icon name="search" />
        <input aria-label="Search books" placeholder="Search by title, author, ISBN or subject" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit" className="btn btn-primary">Search</button>
      </form>

      <div className="browse">
        <details className="filters" open={window.innerWidth > 900}>
          <summary>Filters{activeFilters > 0 && <span className="count">{activeFilters}</span>}</summary>
          <form onSubmit={applyFilters} className="stack">
            <Field label="Subject">
              <SubjectSelect empty="All subjects" value={draft.subject} onChange={set('subject')} counts={counts} />
            </Field>
            <Field label="Seller">
              <select value={draft.sellerRole} onChange={set('sellerRole')}>
                <option value="">Students and faculty</option>
                <option value="student">Students</option>
                <option value="faculty">Faculty</option>
              </select>
            </Field>
            <Field label="Course"><input value={draft.course} onChange={set('course')} placeholder="e.g. CSE2020" /></Field>
            <div className="grid-2">
              <Field label="Semester"><SemesterSelect empty="Any" value={draft.semester} onChange={set('semester')} /></Field>
              <Field label="Edition"><input value={draft.edition} onChange={set('edition')} placeholder="e.g. 3rd" /></Field>
            </div>
            <div className="grid-2">
              <Field label="Min price"><input type="number" min="0" value={draft.minPrice} onChange={set('minPrice')} /></Field>
              <Field label="Max price"><input type="number" min="0" value={draft.maxPrice} onChange={set('maxPrice')} /></Field>
            </div>
            <fieldset className="checks">
              <legend className="field-label">Condition</legend>
              {CONDITIONS.map((c) => (
                <label key={c}>
                  <input type="checkbox" checked={draft.condition.includes(c)} onChange={() => toggleCondition(c)} /> {c}
                </label>
              ))}
            </fieldset>
            <button type="submit" className="btn btn-primary btn-block">Apply filters</button>
            <button type="button" className="btn btn-quiet btn-block" onClick={() => setParams(params.get('q') ? { q: params.get('q') } : {})}>Clear filters</button>
          </form>
        </details>

        <section className="browse-results" aria-live="polite">
          <div className="row-between results-head">
            <h2>{params.get('subject') || 'All books'}</h2>
            <label className="sort">
              Sort by
              <select value={params.get('sort') ?? 'newest'} onChange={(e) => update({ sort: e.target.value })}>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="year_desc">Publication year</option>
              </select>
            </label>
          </div>
          <Loaded state={results} fallback={<BookGridSkeleton count={6} />}>
            {(data) => (
              <>
                <p className="muted result-count">
                  {data.total} {data.total === 1 ? 'book' : 'books'}
                  {data.items.some((b) => b.isDemo) && <span className="small"> · includes <SampleBadge /> listings: reading-list books from fictional sellers, not real offers</span>}
                </p>
                {data.items.length ? (
                  <div className="book-grid book-grid-3">
                    {data.items.map((book) => <BookCard key={book._id} book={book} />)}
                  </div>
                ) : (
                  <EmptyState title="No books match" action={<Link className="btn" to="/books">Show all books</Link>}>
                    Try fewer filters or a different search term.
                  </EmptyState>
                )}
                <Pagination page={data.page} pages={data.pages} onChange={(page) => { update({ page: String(page) }); window.scrollTo(0, 0); }} />
              </>
            )}
          </Loaded>
        </section>
      </div>
    </div>
  );
}
