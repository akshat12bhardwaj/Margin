import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { BookCover, editionLabel } from '../components/BookCard.jsx';
import { ActionDialog, EmptyState, Loaded, StatusBadge } from '../components/ui.jsx';
import { formatDate, formatPrice } from '../constants.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useFetch, useTitle } from '../hooks.js';

export default function MyListings() {
  useTitle('My listings');
  const { canTrade } = useAuth();
  const toast = useToast();
  const state = useFetch(() => api.get('/books/mine'), []);
  const [confirm, setConfirm] = useState(null);

  const setStatus = async (book, status) => {
    try {
      await api.patch(`/books/${book._id}/status`, { status });
      toast.success(status === 'active' ? 'Listing is live again.' : 'Listing deactivated.');
      state.reload({ quiet: true });
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="wrap page">
      <div className="row-between">
        <h1>My listings</h1>
        {canTrade && <Link to="/sell" className="btn btn-primary">List a book</Link>}
      </div>
      <Loaded state={state}>
        {({ items }) =>
          items.length ? (
            <div className="stack">
              {items.map((book) => (
                <article key={book._id} className="card listing-row">
                  <Link to={`/books/${book._id}`} className="thumb"><BookCover book={book} /></Link>
                  <div className="listing-main">
                    <div className="row-between">
                      <h2 className="h3"><Link to={`/books/${book._id}`}>{book.title}</Link></h2>
                      <StatusBadge status={book.status} />
                    </div>
                    <p className="muted">{formatPrice(book.price)} · {editionLabel(book)} · {book.condition} · Listed {formatDate(book.createdAt)}</p>
                    {book.moderationReason && <p className="field-error">Moderator note: {book.moderationReason}</p>}
                    {book.status === 'reserved' && <p className="muted"><Link to="/requests">Complete or cancel the accepted request</Link> to change this listing.</p>}
                    {canTrade && ['active', 'inactive'].includes(book.status) && (
                      <div className="row-wrap">
                        <Link className="btn btn-small" to={`/my-listings/${book._id}/edit`}>Edit</Link>
                        {book.status === 'active' ? (
                          <button type="button" className="btn btn-small" onClick={() => setConfirm({ kind: 'deactivate', book })}>Deactivate</button>
                        ) : (
                          <button type="button" className="btn btn-small" onClick={() => setStatus(book, 'active')}>Reactivate</button>
                        )}
                        <button type="button" className="btn btn-small btn-danger-quiet" onClick={() => setConfirm({ kind: 'delete', book })}>Delete</button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="You have no listings yet" action={canTrade && <Link to="/sell" className="btn btn-primary">List your first book</Link>}>
              Turn the books you have finished with into cash for next semester.
            </EmptyState>
          )
        }
      </Loaded>
      {confirm?.kind === 'deactivate' && (
        <ActionDialog
          title="Deactivate this listing?"
          body="It disappears from search and any pending requests are cancelled. You can reactivate it later."
          confirmLabel="Deactivate"
          onClose={() => setConfirm(null)}
          onConfirm={() => setStatus(confirm.book, 'inactive')}
        />
      )}
      {confirm?.kind === 'delete' && (
        <ActionDialog
          title="Delete this listing?"
          body={`“${confirm.book.title}” will be removed and any pending requests cancelled. This cannot be undone.`}
          confirmLabel="Delete listing"
          danger
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await api.del(`/books/${confirm.book._id}`);
            toast.success('Listing deleted.');
            state.reload({ quiet: true });
          }}
        />
      )}
    </div>
  );
}
