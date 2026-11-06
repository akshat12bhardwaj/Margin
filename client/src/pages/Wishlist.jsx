import { Link } from 'react-router-dom';
import { api } from '../api.js';
import BookCard from '../components/BookCard.jsx';
import { EmptyState, Loaded, StatusBadge } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useFetch, useTitle } from '../hooks.js';

export default function Wishlist() {
  useTitle('Wishlist');
  const { canTrade, user } = useAuth();
  const toast = useToast();
  // The API refuses suspended accounts here, so do not ask.
  const state = useFetch(() => (canTrade ? api.get('/wishlist') : Promise.resolve({ items: [] })), [user?.status]);

  const remove = async (id) => {
    try {
      await api.del(`/wishlist/${id}`);
      toast.success('Removed from wishlist.');
      state.reload({ quiet: true });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const RemoveButton = ({ id }) => (
    <button type="button" className="btn btn-quiet btn-small btn-block" onClick={() => remove(id)}>Remove</button>
  );

  return (
    <div className="wrap page">
      <h1>Wishlist</h1>
      <Loaded state={state}>
        {({ items }) =>
          items.length ? (
            <div className="book-grid">
              {items.map((book) =>
                book.status === 'unavailable' ? (
                  <article className="book-card book-gone" key={book._id}>
                    <div className="book-body">
                      <h3>{book.title}</h3>
                      <StatusBadge status="unavailable" />
                      <p className="muted">The seller or a moderator took this listing down.</p>
                    </div>
                    <RemoveButton id={book._id} />
                  </article>
                ) : (
                  <BookCard key={book._id} book={book} footer={<RemoveButton id={book._id} />} />
                ),
              )}
            </div>
          ) : (
            <EmptyState title="Nothing saved yet" action={<Link className="btn btn-primary" to="/books">Browse books</Link>}>
              Save books to compare them or come back later.
            </EmptyState>
          )
        }
      </Loaded>
    </div>
  );
}
