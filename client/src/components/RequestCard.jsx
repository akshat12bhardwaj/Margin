import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { formatDate, formatDateTime, formatPrice, STATUS_LABELS } from '../constants.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { BookCover } from './BookCard.jsx';
import NegotiationActions, { isMyTurn, negotiationSummary } from './Negotiation.jsx';
import { Icon, RoleBadge, StatusBadge } from './ui.jsx';

export default function RequestCard({ request, side, onChange }) {
  const { canTrade } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { book, status } = request;
  const other = side === 'selling' ? request.buyer : request.seller;
  const isSeller = side === 'selling';
  const role = isSeller ? 'seller' : 'buyer';
  const summary = negotiationSummary(request, role, other.name);

  const openChat = async () => {
    try {
      const { conversation } = await api.post(`/requests/${request._id}/conversation`);
      navigate(`/messages/${conversation._id}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <article className="card request-card">
      <Link to={`/books/${book._id}`} className="thumb">
        <BookCover book={book} />
      </Link>
      <div className="request-main">
        <div className="row-between">
          <h3><Link to={`/books/${book._id}`}>{book.title}</Link></h3>
          {isMyTurn(request, role) ? <span className="badge badge-warn">Your turn</span> : <StatusBadge status={status} />}
        </div>
        <p className="muted">
          <strong className="request-price">{formatPrice(request.price)}</strong>
          {request.listPrice > request.price && <s className="small"> {formatPrice(request.listPrice)}</s>} · {isSeller ? 'Buyer' : 'Seller'}: <Link to={`/users/${other._id}`}>{other.name}</Link> <RoleBadge role={other.role} /> · {formatDate(request.createdAt)}
        </p>
        {request.isDemo && <p className="small muted">Simulated exchange</p>}
        {request.message && <p className="quote">“{request.message}”</p>}
        {summary && <p className={status === 'pending' ? 'notice notice-quiet' : 'notice'}>{summary}</p>}
        <details className="timeline">
          <summary>Offer and status history</summary>
          <ol>
            {request.history.map((h) => (
              <li key={`${h.status}-${h.at}`}>
                <strong>{STATUS_LABELS[h.status]}</strong>{h.amount !== undefined && <> · {formatPrice(h.amount)}</>} <span className="muted">{formatDateTime(h.at)}</span>
                {h.note && <div className="muted">{h.note}</div>}
              </li>
            ))}
          </ol>
        </details>
        {canTrade && (
          <div className="row-wrap">
            <NegotiationActions request={request} role={role} otherName={other.name} onChange={onChange} />
            <button type="button" className="btn btn-quiet btn-small" onClick={openChat}><Icon name="chat" /> Message {isSeller ? 'buyer' : 'seller'}</button>
          </div>
        )}
      </div>
    </article>
  );
}
