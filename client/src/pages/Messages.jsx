import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { BookCover } from '../components/BookCard.jsx';
import NegotiationActions, { AmountDialog, isMyTurn, negotiationSummary } from '../components/Negotiation.jsx';
import { EmptyState, ErrorState, Loaded, RoleBadge, Spinner, StatusBadge } from '../components/ui.jsx';
import { formatDateTime, formatPrice } from '../constants.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useFetch, useTitle } from '../hooks.js';

const POLL_MS = 5000;
const otherParty = (c, me) => (c.buyer._id === me ? c.seller : c.buyer);
const EVENT_LABELS = { offer: 'Offer', counter: 'Counteroffer', accepted: 'Accepted', rejected: 'Declined', cancelled: 'Cancelled', completed: 'Sold' };
const OPEN = ['pending', 'accepted'];

function Thread({ id, onActivity }) {
  const { user, canTrade } = useAuth();
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [offering, setOffering] = useState(false);
  const bottom = useRef(null);
  const state = useFetch(() => api.get(`/conversations/${id}`), [id]);
  const count = state.data?.messages.length;

  useEffect(() => {
    // shortcut: the open thread polls instead of using websockets, fine at campus scale; use Socket.IO for instant delivery.
    const timer = setInterval(() => state.reload({ quiet: true }), POLL_MS);
    return () => clearInterval(timer);
  }, [state.reload]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest' });
    onActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  // A suggestion is sent as it is; whatever is typed in the box stays there.
  const send = async (e, suggestion) => {
    e.preventDefault();
    const message = suggestion ?? text;
    if (!message.trim()) return;
    setBusy(true);
    try {
      await api.post(`/conversations/${id}/messages`, { message });
      if (!suggestion) setText('');
      await state.reload({ quiet: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (state.loading && !state.data) return <Spinner />;
  if (state.error && !state.data) return <ErrorState error={state.error} />;
  const { conversation, messages, request, suggestions = [] } = state.data;
  const other = otherParty(conversation, user._id);
  const role = conversation.buyer._id === user._id ? 'buyer' : 'seller';
  const reload = () => state.reload({ quiet: true });
  const openRequest = request && OPEN.includes(request.status) ? request : null;
  // Actions sit on the newest negotiation card while the request is still open.
  const actionCardId = openRequest && messages.findLast((m) => m.kind !== 'text' && m.request === openRequest._id)?._id;
  const canOffer = canTrade && role === 'buyer' && !openRequest && conversation.book.status === 'active';

  return (
    <>
      <header className="thread-head">
        <Link to="/messages" className="thread-back" aria-label="Back to conversations">←</Link>
        <div>
          <strong><Link to={`/users/${other._id}`}>{other.name}</Link></strong> <RoleBadge role={other.role} />
          <div className="small muted">
            About <Link to={`/books/${conversation.book._id}`}>{conversation.book.title}</Link>
          </div>
        </div>
        <StatusBadge status={conversation.book.status} />
      </header>
      {request && negotiationSummary(request, role, other.name) && (
        <p className={`deal-strip ${isMyTurn(request, role) ? 'deal-turn' : ''}`} role="status">
          <StatusBadge status={request.status} /> {negotiationSummary(request, role, other.name)}
        </p>
      )}
      <div className="thread-body" aria-live="polite">
        {messages.length === 0 && <p className="muted center">No messages yet. Say hello and suggest a time and place to meet.</p>}
        {messages.map((m) =>
          m.kind === 'text' ? (
            <div key={m._id} className={m.sender === user._id ? 'bubble mine' : 'bubble'}>
              <p>{m.body}</p>
              <time>{formatDateTime(m.createdAt)}</time>
            </div>
          ) : (
            <div key={m._id} className={`offer-card offer-${m.kind}${m.sender === user._id ? ' mine' : ''}`}>
              <span className="offer-label">{m.sender === user._id ? 'You' : other.name.split(' ')[0]} · {EVENT_LABELS[m.kind]}</span>
              {['offer', 'counter'].includes(m.kind) ? <strong className="offer-amount">{formatPrice(m.amount)}</strong> : <p>{m.body}</p>}
              {canTrade && m._id === actionCardId && <NegotiationActions request={openRequest} role={role} otherName={other.name} onChange={reload} />}
              <time>{formatDateTime(m.createdAt)}</time>
            </div>
          ),
        )}
        <div ref={bottom} />
      </div>
      {canTrade && suggestions.length > 0 && (
        <div className="suggestions" role="group" aria-label="Suggested messages">
          {suggestions.map((s) => (
            <button key={s} type="button" className="chip" disabled={busy} onClick={(e) => send(e, s)}>{s}</button>
          ))}
        </div>
      )}
      {canTrade ? (
        <form className="composer" onSubmit={send}>
          {canOffer && <button type="button" className="btn" onClick={() => setOffering(true)}>Make an offer</button>}
          <input aria-label="Write a message" placeholder="Write a message" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
          <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>Send</button>
        </form>
      ) : (
        <p className="composer muted">Your account is suspended, so you cannot send messages.</p>
      )}
      {offering && (
        <AmountDialog
          title="Make an offer"
          body={`Listed at ${formatPrice(conversation.book.price)}. The seller can accept, decline or counter.`}
          confirmLabel="Send offer"
          initial={conversation.book.price}
          max={conversation.book.price}
          onClose={() => setOffering(false)}
          onConfirm={async (offer, message) => {
            await api.post('/requests', { bookId: conversation.book._id, offer, message });
            await reload();
          }}
        />
      )}
    </>
  );
}

export default function Messages() {
  useTitle('Messages');
  const { id } = useParams();
  const { user } = useAuth();
  const list = useFetch(() => api.get('/conversations'), []);
  const refreshList = () => list.reload({ quiet: true });

  return (
    <div className="wrap page">
      <h1>Messages</h1>
      <Loaded state={list}>
        {({ items }) =>
          !items.length && !id ? (
            <EmptyState title="No conversations yet" action={<Link className="btn btn-primary" to="/books">Browse books</Link>}>
              Message a seller from any book page to start one.
            </EmptyState>
          ) : (
            <div className={id ? 'inbox inbox-open' : 'inbox'}>
              <ul className="convo-list">
                {items.map((c) => {
                  const other = otherParty(c, user._id);
                  const unread = c.buyer._id === user._id ? c.buyerUnread : c.sellerUnread;
                  return (
                    <li key={c._id}>
                      <Link to={`/messages/${c._id}`} className={c._id === id ? 'convo on' : 'convo'}>
                        <span className="thumb thumb-sm"><BookCover book={c.book} /></span>
                        <span className="convo-text">
                          <strong>{other.name}</strong>
                          <span className="small muted ellipsis">{c.book.title}</span>
                          <span className="small ellipsis">{c.lastMessage || 'No messages yet'}</span>
                        </span>
                        {unread > 0 && <span className="count">{unread}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <section className="thread">
                {id ? <Thread key={id} id={id} onActivity={refreshList} /> : <p className="muted center thread-empty">Choose a conversation.</p>}
              </section>
            </div>
          )
        }
      </Loaded>
    </div>
  );
}
