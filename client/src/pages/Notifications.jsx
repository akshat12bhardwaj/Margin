import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { EmptyState, Loaded, Pagination } from '../components/ui.jsx';
import { formatDateTime } from '../constants.js';
import { useToast } from '../context/ToastContext.jsx';
import { useFetch, useTitle } from '../hooks.js';

export default function Notifications() {
  useTitle('Notifications');
  const toast = useToast();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const state = useFetch(() => api.get('/notifications', { page, limit: 20 }), [page]);

  const open = async (n) => {
    try {
      if (!n.read) await api.patch(`/notifications/${n._id}/read`);
      if (n.link) navigate(n.link);
      else state.reload({ quiet: true });
    } catch (err) {
      toast.error(err.message);
    }
  };
  const readAll = async () => {
    try {
      await api.patch('/notifications/read-all');
      state.reload({ quiet: true });
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="wrap page narrow">
      <div className="row-between">
        <h1>Notifications</h1>
        {state.data?.items.some((n) => !n.read) && <button type="button" className="btn btn-small" onClick={readAll}>Mark all as read</button>}
      </div>
      <Loaded state={state}>
        {(data) =>
          data.items.length ? (
            <>
              <ul className="notes">
                {data.items.map((n) => (
                  <li key={n._id}>
                    <button type="button" className={n.read ? 'note' : 'note unread'} onClick={() => open(n)}>
                      <span>{n.message}</span>
                      <time>{formatDateTime(n.createdAt)}</time>
                    </button>
                  </li>
                ))}
              </ul>
              <Pagination page={data.page} pages={data.pages} onChange={setPage} />
            </>
          ) : (
            <EmptyState title="You are all caught up">Requests, messages and decisions about your reports appear here.</EmptyState>
          )
        }
      </Loaded>
    </div>
  );
}
