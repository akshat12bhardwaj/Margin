import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import RequestCard from '../components/RequestCard.jsx';
import { EmptyState, Loaded } from '../components/ui.jsx';
import { useFetch, useTitle } from '../hooks.js';

function RequestList({ state: requestState, tabs, empty }) {
  const [params, setParams] = useSearchParams();
  const side = params.get('side') === 'selling' ? 'selling' : 'buying';
  const state = useFetch(() => api.get('/requests', { side, state: requestState }), [side, requestState]);
  return (
    <>
      <div className="tabs" role="tablist">
        {Object.entries(tabs).map(([key, label]) => (
          <button type="button" key={key} role="tab" aria-selected={side === key} className={side === key ? 'tab on' : 'tab'} onClick={() => setParams({ side: key })}>
            {label}
          </button>
        ))}
      </div>
      <Loaded state={state}>
        {({ items }) =>
          items.length ? (
            <div className="stack">
              {items.map((r) => <RequestCard key={r._id} request={r} side={side} onChange={() => state.reload({ quiet: true })} />)}
            </div>
          ) : (
            empty(side)
          )
        }
      </Loaded>
    </>
  );
}

export function PurchaseRequests() {
  useTitle('Purchase requests');
  return (
    <div className="wrap page">
      <h1>Purchase requests</h1>
      <p className="muted">Requests still in progress. Finished ones move to <Link to="/transactions">Transactions</Link>.</p>
      <RequestList
        state="open"
        tabs={{ buying: 'Books I want', selling: 'Requests for my books' }}
        empty={(side) =>
          side === 'buying' ? (
            <EmptyState title="No open requests" action={<Link className="btn btn-primary" to="/books">Browse books</Link>}>When you ask to buy a book, you can track it here.</EmptyState>
          ) : (
            <EmptyState title="No requests for your books" action={<Link className="btn" to="/my-listings">View my listings</Link>}>Buyers’ requests appear here for you to accept or decline.</EmptyState>
          )
        }
      />
    </div>
  );
}

export function Transactions() {
  useTitle('Transactions');
  return (
    <div className="wrap page">
      <h1>Transactions</h1>
      <p className="muted">Your finished purchases and sales, including declined and cancelled requests.</p>
      <RequestList
        state="closed"
        tabs={{ buying: 'Purchase history', selling: 'Selling history' }}
        empty={(side) => <EmptyState title={side === 'buying' ? 'No purchase history yet' : 'No selling history yet'}>Completed, declined and cancelled requests are kept here.</EmptyState>}
      />
    </div>
  );
}
