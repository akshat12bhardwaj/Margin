import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import { ActionDialog, EmptyState, Loaded, Modal, Pagination, StatusBadge, SampleBadge } from '../../components/ui.jsx';
import { formatDate, formatDateTime, formatPrice, REPORT_CATEGORIES } from '../../constants.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useFetch, useTitle } from '../../hooks.js';

const ACTIONS = {
  hide: { title: 'Temporarily hide this listing?', body: 'It leaves search while you investigate, and open requests are cancelled. You can restore it later.', confirmLabel: 'Hide listing', danger: true, done: 'Listing hidden.' },
  remove: { title: 'Remove this listing?', body: 'For fraudulent or inappropriate listings. It leaves search, the seller is told why, and open requests are cancelled.', confirmLabel: 'Remove listing', danger: true, done: 'Listing removed.' },
  restore: { title: 'Restore this listing?', body: 'Clears its flag and, if it was hidden or removed, makes it available again.', confirmLabel: 'Restore listing', done: 'Listing restored.' },
};

function ListingHistory({ id, onClose }) {
  const state = useFetch(() => api.get(`/admin/books/${id}`), [id]);
  return (
    <Modal title="Listing history" onClose={onClose} wide>
      <Loaded state={state}>
        {({ book, reports, requests, actions }) => (
          <div className="stack">
            <div>
              <strong>{book.title}</strong> <StatusBadge status={book.status} />
              <p className="muted small">Seller: {book.seller?.name} ({book.seller?.email}) · Listed {formatDateTime(book.createdAt)} · Last changed {formatDateTime(book.updatedAt)}</p>
              {book.moderationReason && <p className="small">Moderation note: {book.moderationReason}</p>}
            </div>
            <section>
              <h3>Reports ({reports.length})</h3>
              {reports.length ? (
                <ul className="plain-list">
                  {reports.map((r) => (
                    <li key={r._id}>
                      <span>{REPORT_CATEGORIES[r.category]}: {r.description} <span className="muted small">({r.reporter?.name})</span></span>
                      <StatusBadge status={r.status} />
                    </li>
                  ))}
                </ul>
              ) : <p className="muted small">None.</p>}
            </section>
            <section>
              <h3>Purchase requests ({requests.length})</h3>
              {requests.length ? (
                <ul className="plain-list">
                  {requests.map((r) => (
                    <li key={r._id}>
                      <span>{r.buyer?.name} · {formatPrice(r.price)} · {formatDate(r.createdAt)}</span>
                      <StatusBadge status={r.status} />
                    </li>
                  ))}
                </ul>
              ) : <p className="muted small">None.</p>}
            </section>
            <section>
              <h3>Moderation actions ({actions.length})</h3>
              {actions.length ? (
                <ul className="plain-list">
                  {actions.map((a) => (
                    <li key={a._id}>
                      <span><code>{a.action}</code> {a.reason}</span>
                      <span className="muted small">{a.admin?.name} · {formatDateTime(a.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="muted small">None.</p>}
            </section>
          </div>
        )}
      </Loaded>
    </Modal>
  );
}

export default function AdminListings() {
  useTitle('Manage listings');
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [history, setHistory] = useState(null);
  const [action, setAction] = useState(null);
  const query = params.toString();
  const state = useFetch(() => api.get('/admin/books', Object.fromEntries(params)), [query]);
  useEffect(() => setQ(params.get('q') ?? ''), [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (changes) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries({ page: '', ...changes })) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next);
  };

  return (
    <>
      <h1>Listings</h1>
      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); update({ q: q.trim() }); }}>
        <input aria-label="Search listings" placeholder="Title, author or ISBN" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit" className="btn">Search</button>
        <select aria-label="Filter by status" value={params.get('status') ?? ''} onChange={(e) => update({ status: e.target.value })}>
          <option value="">All statuses</option>
          {['active', 'reserved', 'sold', 'inactive', 'hidden', 'removed', 'deleted'].map((s) => <option key={s} value={s} className="capitalize">{s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
        <label className="check-inline">
          <input type="checkbox" checked={params.get('flagged') === 'true'} onChange={(e) => update({ flagged: e.target.checked ? 'true' : '' })} /> Flagged only
        </label>
      </form>
      <Loaded state={state}>
        {(data) =>
          data.items.length ? (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Listing</th><th>Seller</th><th>Price</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr>
                  </thead>
                  <tbody>
                    {data.items.map((b) => (
                      <tr key={b._id}>
                        <td>
                          <Link to={`/books/${b._id}`}><strong>{b.title}</strong></Link> {b.isDemo && <SampleBadge />}
                          <div className="small muted">{b.author} · {b.edition ?? 'Edition not stated'} · {formatDate(b.createdAt)}</div>
                        </td>
                        <td>{b.seller?.name}<div className="small muted">{b.seller?.email}</div></td>
                        <td>{formatPrice(b.price)}</td>
                        <td>
                          <StatusBadge status={b.status} />
                          {b.flagged && <div><span className="badge badge-bad">Flagged</span></div>}
                        </td>
                        <td>
                          <div className="row-wrap">
                            <button type="button" className="btn btn-small" onClick={() => setHistory(b._id)}>History</button>
                            {['active', 'inactive', 'reserved'].includes(b.status) && <button type="button" className="btn btn-small btn-danger-quiet" onClick={() => setAction({ kind: 'hide', book: b })}>Hide</button>}
                            {['active', 'inactive', 'reserved', 'hidden'].includes(b.status) && <button type="button" className="btn btn-small btn-danger-quiet" onClick={() => setAction({ kind: 'remove', book: b })}>Remove</button>}
                            {(['hidden', 'removed'].includes(b.status) || b.flagged) && <button type="button" className="btn btn-small" onClick={() => setAction({ kind: 'restore', book: b })}>Restore</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={data.page} pages={data.pages} onChange={(p) => update({ page: String(p) })} />
            </>
          ) : (
            <EmptyState title="No listings match" />
          )
        }
      </Loaded>
      {history && <ListingHistory id={history} onClose={() => setHistory(null)} />}
      {action && (
        <ActionDialog
          {...ACTIONS[action.kind]}
          input={{ label: 'Reason (recorded and sent to the seller)', required: true }}
          onClose={() => setAction(null)}
          onConfirm={async (reason) => {
            await api.patch(`/admin/books/${action.book._id}/${action.kind}`, { reason });
            toast.success(ACTIONS[action.kind].done);
            state.reload({ quiet: true });
          }}
        />
      )}
    </>
  );
}
