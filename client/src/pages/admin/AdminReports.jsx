import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import { ActionDialog, EmptyState, Loaded, Pagination, StatusBadge, UserStatusBadge } from '../../components/ui.jsx';
import { formatDateTime, REPORT_CATEGORIES } from '../../constants.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useFetch, useTitle } from '../../hooks.js';

const DECISIONS = {
  resolved: { title: 'Resolve this report as upheld?', body: 'Counts against the reported user, and notifies both the reporter and the reported user. This decision is final. Hide listings or suspend users separately, if needed.', confirmLabel: 'Resolve report' },
  rejected: { title: 'Reject this report?', body: 'Notifies the reporter that it was not upheld. This decision is final.', confirmLabel: 'Reject report', danger: true },
};

export default function AdminReports() {
  useTitle('Manage reports');
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [decision, setDecision] = useState(null);
  const query = params.toString();
  const state = useFetch(() => api.get('/admin/reports', Object.fromEntries(params)), [query]);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries({ page: '', ...changes })) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next);
  };

  const startReview = async (report) => {
    try {
      await api.patch(`/admin/reports/${report._id}`, { status: 'under_review' });
      toast.success('Report is under review.');
      state.reload({ quiet: true });
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <h1>Reports</h1>
      <div className="toolbar">
        <select aria-label="Filter by status" value={params.get('status') ?? ''} onChange={(e) => update({ status: e.target.value })}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="under_review">Under review</option>
          <option value="resolved">Resolved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select aria-label="Filter by category" value={params.get('category') ?? ''} onChange={(e) => update({ category: e.target.value })}>
          <option value="">All categories</option>
          {Object.entries(REPORT_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select aria-label="Filter by target" value={params.get('targetType') ?? ''} onChange={(e) => update({ targetType: e.target.value })}>
          <option value="">Listings and users</option>
          <option value="book">Listings</option>
          <option value="user">Users</option>
        </select>
      </div>
      <Loaded state={state}>
        {(data) =>
          data.items.length ? (
            <>
              <div className="stack">
                {data.items.map((r) => (
                  <article key={r._id} className="card report">
                    <div className="row-between">
                      <h2 className="h3">{REPORT_CATEGORIES[r.category]}</h2>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="small muted">
                      Filed {formatDateTime(r.createdAt)} by {r.reporter?.name} ({r.reporter?.email})
                    </p>
                    <p className="quote prewrap">{r.description}</p>
                    <p className="small">
                      {r.book && <>Listing: <Link to={`/admin/listings?q=${encodeURIComponent(r.book.title)}`}>{r.book.title}</Link> <StatusBadge status={r.book.status} /> · </>}
                      {r.targetType === 'book' ? 'Seller' : 'Reported user'}: <Link to={`/admin/users?q=${encodeURIComponent(r.targetUser?.email ?? '')}`}>{r.targetUser?.name}</Link> <UserStatusBadge status={r.targetUser?.status} />
                    </p>
                    {r.decision && (
                      <div className="notice">
                        <strong>Decision by {r.decidedBy?.name}, {formatDateTime(r.decidedAt)}:</strong> {r.decision}
                      </div>
                    )}
                    {['pending', 'under_review'].includes(r.status) && (
                      <div className="row-wrap">
                        {r.status === 'pending' && <button type="button" className="btn btn-small" onClick={() => startReview(r)}>Start review</button>}
                        <button type="button" className="btn btn-small btn-primary" onClick={() => setDecision({ report: r, status: 'resolved' })}>Resolve</button>
                        <button type="button" className="btn btn-small btn-danger-quiet" onClick={() => setDecision({ report: r, status: 'rejected' })}>Reject</button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
              <Pagination page={data.page} pages={data.pages} onChange={(p) => update({ page: String(p) })} />
            </>
          ) : (
            <EmptyState title="No reports match">Nothing needs attention here.</EmptyState>
          )
        }
      </Loaded>
      {decision && (
        <ActionDialog
          {...DECISIONS[decision.status]}
          input={{ label: 'Decision and explanation (sent to the people affected)', required: true, maxLength: 2000 }}
          onClose={() => setDecision(null)}
          onConfirm={async (text) => {
            await api.patch(`/admin/reports/${decision.report._id}`, { status: decision.status, decision: text });
            toast.success('Decision recorded.');
            state.reload({ quiet: true });
          }}
        />
      )}
    </>
  );
}
