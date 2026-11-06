import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import BookCard, { BookCover } from '../components/BookCard.jsx';
import ReportDialog from '../components/ReportDialog.jsx';
import { ActionDialog, Icon, Loaded, RoleBadge, SampleBadge, StatusBadge } from '../components/ui.jsx';
import { formatDate, formatPrice, STATUS_LABELS } from '../constants.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useFetch, useTitle } from '../hooks.js';
import NotFound from './NotFound.jsx';

export default function BookDetails() {
  const { id } = useParams();
  const state = useFetch(() => api.get(`/books/${id}`), [id]);
  useTitle(state.data?.book.title ?? 'Book');
  if (state.error?.status === 404 || state.error?.status === 400) return <NotFound />;
  return (
    <div className="wrap page">
      <Loaded state={state}>{(data) => <Details key={data.book._id} data={data} reload={() => state.reload({ quiet: true })} />}</Loaded>
    </div>
  );
}

function Details({ data, reload }) {
  const { book, related, wishlisted, myRequest, conversationId } = data;
  const { user, canTrade, isAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [image, setImage] = useState(0);
  const [dialog, setDialog] = useState(null);
  const isOwner = user?._id === book.seller._id;
  const available = book.status === 'active';
  // Example listings belong to fictional sellers whose replies are scripted (server/src/lib/autoSeller.js).
  const example = book.isDemo;
  const automated = book.seller.isAutomatedSeller;

  // An existing chat reopens; automated sellers open straight into a new one, which offers suggested first messages.
  const contactSeller = async () => {
    if (conversationId) return navigate(`/messages/${conversationId}`);
    if (!automated) return setDialog('message');
    try {
      const res = await api.post('/conversations', { bookId: book._id });
      navigate(`/messages/${res.conversation._id}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleWishlist = async () => {
    try {
      if (wishlisted) await api.del(`/wishlist/${book._id}`);
      else await api.post('/wishlist', { bookId: book._id });
      toast.success(wishlisted ? 'Removed from wishlist.' : 'Saved to wishlist.');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      {['hidden', 'removed', 'inactive', 'deleted'].includes(book.status) && (
        <div className={`banner-inline ${book.status === 'inactive' ? '' : 'banner-bad'}`} role="status">
          <strong>This listing is {STATUS_LABELS[book.status].toLowerCase()} and not visible to buyers.</strong>
          {book.moderationReason && <> Reason: {book.moderationReason}</>}
        </div>
      )}
      <div className="details">
        <div className="gallery">
          <div className="gallery-main">
            <BookCover book={book} index={image} alt={`${book.title}, view ${image + 1}`} />
          </div>
          {book.images.length > 1 && (
            <div className="gallery-thumbs">
              {book.images.map((img, i) => (
                <button type="button" key={img.url} className={i === image ? 'on' : ''} aria-label={`Show photo ${i + 1}`} onClick={() => setImage(i)}>
                  <img src={img.url} alt="" />
                </button>
              ))}
            </div>
          )}
          {book.isDemo && book.images.length > 0 && <p className="credit">Cover image via <a href="https://openlibrary.org" target="_blank" rel="noreferrer">Open Library</a>. {book.coverNote || 'It may show a different printing.'}</p>}
        </div>

        <div className="details-info">
          <div className="row-wrap">
            <StatusBadge status={book.status} />
            <span className="badge badge-neutral">{book.condition}</span>
            {book.isDemo && <SampleBadge />}
          </div>
          <h1>{book.title}</h1>
          <p className="lead-sm">by {book.author}</p>
          <p className="details-price">
            {formatPrice(book.price)}
            {example && <small>Example price</small>}
          </p>

          <div className="buy-box">
            {example && (
              <p className="sample-notice">
                <Icon name="info" /> <strong>Example listing.</strong> This book is on a BMU course reading list, but this copy and {book.seller.name} are fictional. {automated && 'The seller replies automatically, so you can try buying, messaging and negotiating. No real book changes hands.'}
              </p>
            )}
            {!user && available && (
              <Link className="btn btn-primary btn-block" to="/login" state={{ from: location.pathname }}>Log in to buy or message</Link>
            )}
            {isOwner && (
              <>
                <p className="muted">This is your listing.</p>
                {['active', 'inactive'].includes(book.status) && <Link className="btn btn-block" to={`/my-listings/${book._id}/edit`}>Edit listing</Link>}
                <Link className="btn btn-quiet btn-block" to="/requests">View purchase requests</Link>
              </>
            )}
            {isAdmin && <Link className="btn btn-block" to={`/admin/listings?q=${encodeURIComponent(book.title)}`}>Moderate this listing</Link>}
            {user?.status === 'suspended' && <p className="muted">Your account is suspended, so you cannot buy or message.</p>}
            {canTrade && !isOwner && (
              <>
                {myRequest ? (
                  <p className="notice">
                    Your request is <strong>{STATUS_LABELS[myRequest.status].toLowerCase()}</strong>. <Link to={myRequest.status === 'completed' ? '/transactions' : '/requests'}>Track it</Link>
                  </p>
                ) : available ? (
                  <button type="button" className="btn btn-primary btn-block" onClick={() => setDialog('buy')}>Buy now · {formatPrice(book.price)}</button>
                ) : (
                  <p className="muted">This book is {STATUS_LABELS[book.status].toLowerCase()} and cannot be requested.</p>
                )}
                {/* Offers and counteroffers happen in the chat ("Make an offer"), next to the conversation. */}
                <button type="button" className="btn btn-block" onClick={contactSeller}><Icon name="chat" /> Message seller</button>
                <button type="button" className="btn btn-quiet btn-block" aria-pressed={wishlisted} onClick={toggleWishlist}>
                  <Icon name="heart" filled={wishlisted} /> {wishlisted ? 'Saved to wishlist' : 'Save to wishlist'}
                </button>
              </>
            )}
            {!example && <p className="small muted">No payment is taken on this site. Pay the seller when you meet.</p>}
          </div>

          <dl className="facts">
            <div><dt>Edition</dt><dd>{book.edition ?? 'Not stated'}</dd></div>
            <div><dt>Published</dt><dd>{book.publicationYear ?? 'Not stated'}</dd></div>
            <div><dt>Subject</dt><dd>{book.subject}</dd></div>
            {book.course && <div><dt>Course</dt><dd>{book.course}</dd></div>}
            {book.semester && <div><dt>Semester</dt><dd>{book.semester}</dd></div>}
            {book.isbn && <div><dt>ISBN</dt><dd>{book.isbn}</dd></div>}
            <div><dt>University</dt><dd>{book.university}</dd></div>
            {!book.isDemo && <div><dt>Listed</dt><dd>{formatDate(book.createdAt)}</dd></div>}
          </dl>

          <h2 className="h3">Description</h2>
          <p className="prewrap">{book.description}</p>

          <div className="card seller-card">
            <div>
              <h2 className="h3">
                <Link to={`/users/${book.seller._id}`}>{book.seller.name}</Link> <RoleBadge role={book.seller.role} />
              </h2>
              <p className="muted">
                {[book.seller.designation, book.seller.university].filter(Boolean).join(' · ')}
              </p>
            </div>
            <Link className="btn btn-small" to={`/users/${book.seller._id}`}>View profile</Link>
          </div>

          {canTrade && !isOwner && !book.isDemo && (
            <button type="button" className="link-danger" onClick={() => setDialog('report')}><Icon name="flag" /> Report this listing</button>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="section">
          <div className="section-head">
            <div>
              <p className="eyebrow">You may also need</p>
              <h2>Related books</h2>
            </div>
            <Link className="link-arrow" to={`/books?${new URLSearchParams({ subject: book.subject })}`}>More in {book.subject} <Icon name="arrow" /></Link>
          </div>
          <div className="book-grid">{related.map((b) => <BookCard key={b._id} book={b} />)}</div>
        </section>
      )}

      {dialog === 'buy' && (
        <ActionDialog
          title={`Buy “${book.title}” for ${formatPrice(book.price)}?`}
          body={`This sends ${book.seller.name} a request to buy at the full listed price of ${formatPrice(book.price)}. Once they accept, the book is reserved for you and you arrange the handover in the chat. Nothing is charged here: you pay in person when you collect it.${example ? ' This is an example listing, so no real book changes hands.' : ''}`}
          confirmLabel={`Send request at ${formatPrice(book.price)}`}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            const { request } = await api.post('/requests', { bookId: book._id });
            const { conversation } = await api.post(`/requests/${request._id}/conversation`);
            toast.success(`Request to buy at ${formatPrice(book.price)} sent.`);
            navigate(`/messages/${conversation._id}`);
          }}
        />
      )}
      {dialog === 'message' && (
        <ActionDialog
          title={`Message ${book.seller.name}`}
          confirmLabel="Send message"
          input={{ label: 'Your message', required: true, maxLength: 2000, placeholder: 'Is the book still available?' }}
          onClose={() => setDialog(null)}
          onConfirm={async (message) => {
            const res = await api.post('/conversations', { bookId: book._id, message });
            navigate(`/messages/${res.conversation._id}`);
          }}
        />
      )}
      {dialog === 'report' && <ReportDialog targetType="book" targetId={book._id} name="this listing" onClose={() => setDialog(null)} />}
    </>
  );
}
