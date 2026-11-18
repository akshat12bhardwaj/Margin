import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import { ActionDialog, EmptyState, Loaded, Modal, Pagination, StatusBadge, UserStatusBadge } from '../../components/ui.jsx';
import { formatDate, formatPrice, REPORT_CATEGORIES } from '../../constants.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useFetch, useTitle } from '../../hooks.js';

const ACTIONS = {
  suspend: { title: 'Suspend this account?', body: 'They can log in and read, but cannot buy, sell, message or report. Their live listings are hidden and open requests cancelled.', confirmLabel: 'Suspend account', danger: true, done: 'Account suspended.' },
  deactivate: { title: 'Deactivate this account?', body: 'They are logged out and cannot log in. Their live listings are hidden and open requests cancelled.', confirmLabel: 'Deactivate account', danger: true, done: 'Account deactivated.' },
  restore: { title: 'Restore this account?', body: 'Full access returns, and listings hidden by the restriction become available again.', confirmLabel: 'Restore account', done: 'Account restored.' },
};

function UserDetail({ id, onClose }) {
  const state = useFetch(() => api.get(`/admin/users/${id}`), [id]);
  return (
    <Modal title="Account activity" onClose={onClose} wide>
      <Loaded state={state}>
        {({ user, listings, requests, reportsAgainst, reportsFiled, actions }) => (
          <div className="stack">
            <div>
              <strong>{user.name}</strong> <UserStatusBadge status={user.status} />
              <p className="muted small">{user.email} · <span className="capitalize">{user.role}</span> · {user.university} · Joined {formatDate(user.createdAt)} · {reportsFiled} reports filed</p>
              {user.statusReason && <p className="small">Reason on file: {user.statusReason}</p>}
            </div>
            <section>
              <h3>Reports against this user ({reportsAgainst.length})</h3>
              {reportsAgainst.length ? (
                <ul className="plain-list">
                  {reportsAgainst.map((r) => (
                    <li key={r._id}>
                      <span>{REPORT_CATEGORIES[r.category]}{r.book ? ` · ${r.book.title}` : ''}</span>
                      <StatusBadge status={r.status} />
                    </li>
                  ))}
                </ul>
              ) : <p className="muted small">None.</p>}
            </section>
            <section>
              <h3>Listings ({listings.length})</h3>
              {listings.length ? (
                <ul className="plain-list">
                  {listings.map((b) => (
                    <li key={b._id}>
                      <Link to={`/books/${b._id}`}>{b.title}</Link>
                      <span>{formatPrice(b.price)} <StatusBadge status={b.status} /></span>
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
                      <span>{r.book?.title} · {r.buyer?.name} → {r.seller?.name}</span>
                      <StatusBadge status={r.status} />
                    </li>
                  ))}
                </ul>
              ) : <p className="muted small">None.</p>}
            </section>
            <section>
              <h3>Moderation history ({actions.length})</h3>
              {actions.length ? (
                <ul className="plain-list">
                  {actions.map((a) => (
                    <li key={a._id}>
                      <span><code>{a.action}</code> {a.reason}</span>
                      <span className="muted small">{a.admin?.name} · {formatDate(a.createdAt)}</span>
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

export default function AdminUsers() {
  useTitle('Manage users');
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [detail, setDetail] = useState(null);
  const [action, setAction] = useState(null);
  const query = params.toString();
  const state = useFetch(() => api.get('/admin/users', Object.fromEntries(params)), [query]);
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
      <h1>Users</h1>
      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); update({ q: q.trim() }); }}>
        <input aria-label="Search users" placeholder="Name, email or university" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit" className="btn">Search</button>
        <select aria-label="Filter by role" value={params.get('role') ?? ''} onChange={(e) => update({ role: e.target.value })}>
          <option value="">All roles</option>
          <option value="student">Students</option>
          <option value="faculty">Faculty</option>
          <option value="admin">Administrators</option>
        </select>
        <select aria-label="Filter by status" value={params.get('status') ?? ''} onChange={(e) => update({ status: e.target.value })}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="deactivated">Deactivated</option>
        </select>
      </form>
      <Loaded state={state}>
        {(data) =>
          data.items.length ? (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>User</th><th>Role</th><th>Status</th><th>Reports</th><th>Joined</th><th><span className="sr-only">Actions</span></th></tr>
                  </thead>
                  <tbody>
                    {data.items.map((u) => (
                      <tr key={u._id}>
                        <td><strong>{u.name}</strong>{u.isDemo && <span className="small muted"> · Simulated</span>}<div className="small muted">{u.email}</div><div className="small muted">{u.university}</div></td>
                        <td className="capitalize">{u.role}</td>
                        <td><UserStatusBadge status={u.status} /></td>
                        <td>
                          {u.openReports} open, {u.upheldReports} upheld
                          {u.repeatOffender && <div><span className="badge badge-bad">Repeat offender</span></div>}
                        </td>
                        <td>{formatDate(u.createdAt)}</td>
                        <td>
                          <div className="row-wrap">
                            <button type="button" className="btn btn-small" onClick={() => setDetail(u._id)}>Activity</button>
                            {u.role !== 'admin' && u.status === 'active' && (
                              <>
                                <button type="button" className="btn btn-small btn-danger-quiet" onClick={() => setAction({ kind: 'suspend', user: u })}>Suspend</button>
                                <button type="button" className="btn btn-small btn-danger-quiet" onClick={() => setAction({ kind: 'deactivate', user: u })}>Deactivate</button>
                              </>
                            )}
                            {u.role !== 'admin' && u.status !== 'active' && (
                              <button type="button" className="btn btn-small" onClick={() => setAction({ kind: 'restore', user: u })}>Restore</button>
                            )}
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
            <EmptyState title="No users match" />
          )
        }
      </Loaded>
      {detail && <UserDetail id={detail} onClose={() => setDetail(null)} />}
      {action && (
        <ActionDialog
          {...ACTIONS[action.kind]}
          title={`${ACTIONS[action.kind].title.replace('this account', action.user.name)}`}
          input={{ label: 'Reason (recorded and sent to the user)', required: true }}
          onClose={() => setAction(null)}
          onConfirm={async (reason) => {
            await api.patch(`/admin/users/${action.user._id}/${action.kind}`, { reason });
            toast.success(ACTIONS[action.kind].done);
            state.reload({ quiet: true });
          }}
        />
      )}
    </>
  );
}
