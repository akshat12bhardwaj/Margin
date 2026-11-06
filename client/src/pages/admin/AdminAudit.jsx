import { useState } from 'react';
import { api } from '../../api.js';
import { EmptyState, Loaded, Pagination } from '../../components/ui.jsx';
import { formatDateTime } from '../../constants.js';
import { useFetch, useTitle } from '../../hooks.js';

export default function AdminAudit() {
  useTitle('Audit log');
  const [page, setPage] = useState(1);
  const state = useFetch(() => api.get('/admin/audit-logs', { page, limit: 25 }), [page]);
  return (
    <>
      <h1>Audit log</h1>
      <p className="muted">Every moderation action, permanently recorded.</p>
      <Loaded state={state}>
        {(data) =>
          data.items.length ? (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>When</th><th>Administrator</th><th>Action</th><th>Target</th><th>Reason</th></tr>
                  </thead>
                  <tbody>
                    {data.items.map((a) => (
                      <tr key={a._id}>
                        <td>{formatDateTime(a.createdAt)}</td>
                        <td>{a.admin?.name}</td>
                        <td><code>{a.action}</code></td>
                        <td className="small muted">{a.targetType} {a.targetId.slice(-6)}</td>
                        <td>{a.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={data.page} pages={data.pages} onChange={setPage} />
            </>
          ) : (
            <EmptyState title="No actions recorded yet" />
          )
        }
      </Loaded>
    </>
  );
}
