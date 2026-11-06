import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { Loaded } from '../../components/ui.jsx';
import { formatDateTime } from '../../constants.js';
import { useFetch, useTitle } from '../../hooks.js';
import { Stat } from '../Dashboard.jsx';

function UserList({ title, rows, unit, empty }) {
  return (
    <section className="card panel">
      <h3>{title}</h3>
      {rows.length ? (
        <ul className="plain-list">
          {rows.map((r) => (
            <li key={r.user._id}>
              <Link to={`/admin/users?q=${encodeURIComponent(r.user.email)}`}>{r.user.name}</Link>
              <span className="muted small">{r.count} {unit}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">{empty}</p>
      )}
    </section>
  );
}

export default function AdminDashboard() {
  useTitle('Admin overview');
  const state = useFetch(() => api.get('/admin/stats'), []);
  return (
    <>
      <h1>Marketplace overview</h1>
      <Loaded state={state}>
        {(s) => (
          <>
            <div className="stats">
              <Stat to="/admin/users" value={s.totalUsers} label="Registered users" />
              <Stat to="/admin/users?role=student" value={s.students} label="Students" />
              <Stat to="/admin/users?role=faculty" value={s.faculty} label="Faculty" />
              <Stat to="/admin/users?status=suspended" value={s.suspendedUsers} label="Suspended accounts" alert />
              <Stat to="/admin/listings?status=active" value={s.activeListings} label="Active listings" />
              <Stat value={s.completedTransactions} label="Completed transactions" />
              <Stat value={s.pendingTransactions} label="Pending transactions" />
              <Stat to="/admin/reports?status=pending" value={s.openReports} label="Open reports" alert />
              <Stat to="/admin/reports?targetType=book" value={s.reportedListings} label="Reported listings" alert />
              <Stat to="/admin/reports?targetType=user" value={s.reportedUsers} label="Reported users" alert />
            </div>

            {s.demoListings > 0 && <p className="sample-notice">Sample data is loaded: {s.demoListings} listings and {s.demoUsers} fictional accounts. They are not counted in the totals above. Remove them with <code>npm run demo:remove</code>.</p>}

            <h2 className="section-title">Suspicious activity</h2>
            <div className="stats stats-small">
              <Stat to="/admin/listings?flagged=true" value={s.suspicious.flaggedListings} label="Flagged listings" alert />
              <Stat to="/admin/listings?status=hidden" value={s.suspicious.hiddenListings} label="Hidden listings" alert />
            </div>
            <div className="panels">
              <UserList title="Repeat offenders" rows={s.suspicious.repeatOffenders} unit="upheld reports" empty="No one has two or more upheld reports." />
              <UserList title="Several open reports" rows={s.suspicious.multipleOpenReports} unit="open reports" empty="No user has more than one open report." />
              <UserList title="Rapid listing in 24 hours" rows={s.suspicious.rapidListers} unit="new listings" empty="No one has posted 10 or more listings today." />
            </div>

            <div className="row-between">
              <h2 className="section-title">Recent admin actions</h2>
              <Link to="/admin/audit">Full audit log</Link>
            </div>
            {s.recentActions.length ? (
              <ul className="card activity">
                {s.recentActions.map((a) => (
                  <li key={a._id}>
                    <div>
                      <code>{a.action}</code> by {a.admin?.name}
                      {a.reason && <div className="small muted">{a.reason}</div>}
                    </div>
                    <span className="small muted">{formatDateTime(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No moderation actions yet.</p>
            )}
          </>
        )}
      </Loaded>
    </>
  );
}
