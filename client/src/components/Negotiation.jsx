import { useState } from 'react';
import { api } from '../api.js';
import { formatPrice } from '../constants.js';
import { useToast } from '../context/ToastContext.jsx';
import { ActionDialog, Field, Modal } from './ui.jsx';

// Amount plus an optional note: used to make an offer and to counter one.
export function AmountDialog({ title, body, confirmLabel, initial, max, noteLabel = 'Message (optional)', notePlaceholder, onConfirm, onClose }) {
  const [amount, setAmount] = useState(initial === undefined ? '' : String(initial));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onConfirm(Number(amount), note.trim());
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        {body && <p className="muted">{body}</p>}
        <Field label="Amount (₹)" required hint={max !== undefined ? `Listed at ${formatPrice(max)}. Offers cannot go above it.` : undefined}>
          <input type="number" inputMode="numeric" min="0" max={max} step="1" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label={noteLabel}>
          <textarea rows="3" maxLength={1000} value={note} placeholder={notePlaceholder} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="row-end">
          <button type="button" className="btn btn-quiet" onClick={onClose}>Back</button>
          <button type="submit" className="btn btn-primary" disabled={busy || amount === ''}>{busy ? 'Working…' : confirmLabel}</button>
        </div>
      </form>
    </Modal>
  );
}

// While pending, whoever did not make the current offer answers it.
export const isMyTurn = (request, role) => request.status === 'pending' && request.offerBy !== role;

export function negotiationSummary(request, role, otherName) {
  const amount = formatPrice(request.price);
  if (request.status === 'accepted') return `Agreed at ${amount}. Arrange the handover and pay in person.`;
  if (request.status === 'completed') return `Sold for ${amount}.`;
  if (request.status !== 'pending') return null;
  if (isMyTurn(request, role)) return `${otherName} ${request.offerBy === 'seller' ? 'countered with' : 'offered'} ${amount}. Your response is needed.`;
  return `You ${role === 'seller' ? 'countered with' : 'offered'} ${amount}. Waiting for ${otherName}.`;
}

const notePrompt = { label: 'Note (optional)', maxLength: 500 };

export default function NegotiationActions({ request, role, otherName, onChange }) {
  const toast = useToast();
  const [dialog, setDialog] = useState(null);
  const run = async (action, body, done) => {
    await api.patch(`/requests/${request._id}/${action}`, body);
    toast.success(done);
    onChange();
  };
  const amount = formatPrice(request.price);
  const myTurn = isMyTurn(request, role);
  const open = request.status === 'pending' || request.status === 'accepted';
  if (!open) return null;

  return (
    <div className="row-wrap negotiation-actions">
      {myTurn && (
        <>
          <button type="button" className="btn btn-primary btn-small" onClick={() => setDialog('accept')}>Accept {amount}</button>
          <button type="button" className="btn btn-small" onClick={() => setDialog('counter')}>Counter</button>
          <button type="button" className="btn btn-quiet btn-small" onClick={() => setDialog('reject')}>Decline</button>
        </>
      )}
      {role === 'seller' && request.status === 'accepted' && <button type="button" className="btn btn-primary btn-small" onClick={() => setDialog('complete')}>Mark as sold</button>}
      {(!myTurn || request.status === 'accepted') && <button type="button" className="btn btn-quiet btn-small" onClick={() => setDialog('cancel')}>Cancel request</button>}

      {dialog === 'accept' && (
        <ActionDialog
          title={`Accept ${amount}?`}
          body={role === 'seller'
            ? `The book is reserved for ${otherName} at ${amount} and other requests wait. You then arrange payment and handover together.`
            : `You agree to buy at ${amount}. The book is reserved for you; pay the seller when you meet.`}
          confirmLabel={`Accept ${amount}`}
          input={notePrompt}
          onClose={() => setDialog(null)}
          onConfirm={(note) => run('accept', { note }, `Accepted at ${amount}. The book is reserved.`)}
        />
      )}
      {dialog === 'counter' && (
        <AmountDialog
          title="Make a counteroffer"
          body={`${otherName}'s offer is ${amount}. Suggest a different price.`}
          confirmLabel="Send counteroffer"
          max={request.listPrice}
          noteLabel="Note (optional)"
          onClose={() => setDialog(null)}
          onConfirm={(value, note) => run('counter', { amount: value, note }, `Counteroffer of ${formatPrice(value)} sent.`)}
        />
      )}
      {dialog === 'reject' && (
        <ActionDialog title={`Decline ${amount}?`} body="This closes the request. They can make a new offer later." confirmLabel="Decline" danger input={notePrompt} onClose={() => setDialog(null)} onConfirm={(note) => run('reject', { note }, 'Offer declined.')} />
      )}
      {dialog === 'cancel' && (
        <ActionDialog title="Cancel this request?" body="The other person is notified, and a reserved book becomes available again." confirmLabel="Cancel request" danger input={notePrompt} onClose={() => setDialog(null)} onConfirm={(note) => run('cancel', { note }, 'Request cancelled.')} />
      )}
      {dialog === 'complete' && (
        <ActionDialog
          title="Mark this book as sold?"
          body={`Only do this after the exchange has happened, at the agreed ${amount}. The listing closes, this cannot be undone, and any other requests are cancelled.`}
          confirmLabel="Mark as sold"
          onClose={() => setDialog(null)}
          onConfirm={() => run('complete', {}, 'Sale completed. The listing is now closed.')}
        />
      )}
    </div>
  );
}
