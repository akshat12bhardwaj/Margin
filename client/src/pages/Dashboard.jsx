import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { EmptyState, Loaded, StatusBadge } from '../components/ui.jsx';
import { formatDate, formatPrice } from '../constants.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useFetch, useTitle } from '../hooks.js';

export function Stat({ to, value, label, alert }) {
  const body = (
    <>
      <strong className={alert && value > 0 ? 'stat-alert' : undefined}>{value}</strong>
      <span>{label}</span>
    </>
  );
  return to ? <Link to={to} className="card stat">{body}</Link> : <div className="card stat">{body}</div>;
}

export default function Dashboard() {
  useTitle('Dashboard');
  const { user, canTrade } = useAuth();
  const state = useFetch(() => api.get('/users/me/dashboard'), []);
  return (
    <div className="wrap page">
      <div className="row-between dash-head">
        <div>
          <h1>Hello, {user.name.split(' ')[0]}</h1>
          <p className="muted capitalize">{user.role} · {user.university}</p>
        </div>
        {canTrade && <Link to="/sell" className="btn btn-primary">List a book</Link>}
      </div>
      <Loaded state={state}>
        {(d) => (
          <>
            <div className="stats">
              <Stat to="/my-listings" value={d.activeListings} label="Active listings" />
              <Stat to="/requests?side=selling" value={d.incomingOpen} label="Requests for my books" alert />
              <Stat to="/requests" value={d.outgoingOpen} label="My open requests" />
              <Stat to="/transactions?side=selling" value={d.soldListings} label="Books sold" />
              <Stat to="/messages" value={d.unreadConversations} label="Unread conversations" alert />
              <Stat to="/wishlist" value={d.wishlist} label="On my wishlist" />
            </div>
            <h2 className="section-title">Recent activity</h2>
            {d.recentRequests.length ? (
              <ul className="card activity">
                {d.recentRequests.map((r) => (
                  <li key={r._id}>
                    <div>
                      <Link to={`/books/${r.book._id}`}>{r.book.title}</Link>
                      <div className="small muted">
                        {r.seller === user._id ? 'Selling' : 'Buying'} · {formatPrice(r.price)} · {formatDate(r.updatedAt)}
                      </div>
                    </div>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Nothing yet" action={<Link className="btn" to="/books">Browse books</Link>}>Your purchase requests and sales will show up here.</EmptyState>
            )}
          </>
        )}
      </Loaded>
    </div>
  );
}
