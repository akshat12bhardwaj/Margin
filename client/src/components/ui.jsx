import { useEffect, useId, useRef, useState } from 'react';
import { SEMESTERS, STATUS_LABELS, statusTone, SUBJECT_GROUPS } from '../constants.js';

const ICONS = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4-4',
  heart: 'M12 20s-7-4.6-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.4-9 9-9 9z',
  bell: 'M6 9a6 6 0 1 1 12 0c0 6 2 7 2 8H4c0-1 2-2 2-8zm4 11a2 2 0 0 0 4 0',
  chat: 'M4 5h16v11H9l-5 4z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  flag: 'M6 21V4m0 1h11l-2 4 2 4H6',
  book: 'M5 4h5a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H5zm14 0h-5a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h5z',
  x: 'M6 6l12 12M18 6 6 18',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 8v5m0-8.5v.5',
  // Subject symbols, named by `icon` in shared/subjects.mjs
  laptop: 'M4 5h16v11H4zM2 19h20M10 8.5 8 10.5l2 2m4-4 2 2-2 2',
  chip: 'M7 7h10v10H7zM10 10h4v4h-4zM10 3v4m4-4v4m-4 10v4m4-4v4M3 10h4m-4 4h4m10-4h4m-4 4h4',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  gear: 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm0 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19 12h2.5M2.5 12H5M12 19v2.5M12 2.5V5M17 17l1.7 1.7M7 17l-1.7 1.7M7 7 5.3 5.3M17 7l1.7-1.7',
  building: 'M4 21V9l8-5 8 5v12M2 21h20M9 21v-6h6v6M9 11h.01M15 11h.01',
  sigma: 'M18 5H6l6 7-6 7h12',
  atom: 'M2 12a10 4 0 1 0 20 0 10 4 0 1 0-20 0zM7 3.34A10 4 60 1 0 17 20.66 10 4 60 1 0 7 3.34zM17 3.34A10 4 -60 1 0 7 20.66 10 4 -60 1 0 17 3.34zM12 11.5v1',
  flask: 'M9 3h6M10 3v6l-5.5 10a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3M7 15h10',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  briefcase: 'M3 7h18v13H3zM9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18',
  scale: 'M12 3v18M7 21h10M5 7h14M5 7l-3 6a3 3 0 0 0 6 0zm14 0-3 6a3 3 0 0 0 6 0z',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
  tree: 'M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM6 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM18 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM11 6.8 7 15.2M13 6.8l4 8.4',
  braces: 'M8 4C6 4 5 5 5 7v2c0 1-1 3-2 3 1 0 2 2 2 3v2c0 2 1 3 3 3M16 4c2 0 3 1 3 3v2c0 1 1 3 2 3-1 0-2 2-2 3v2c0 2-1 3-3 3',
  database: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zm0 0v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  monitor: 'M3 4h18v12H3zM8 20h8M12 16v4',
  network: 'M9 2h6v5H9zM2 17h6v5H2zM16 17h6v5h-6zM12 7v5M5 17v-5h14v5',
  branch: 'M6 3v12M18 9a9 9 0 0 1-9 9M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  brain: 'M12 5a3 3 0 0 0-5.6-1.5A3 3 0 0 0 4 8.5a3.5 3.5 0 0 0 .5 6.5A3 3 0 0 0 9 19.5 3 3 0 0 0 12 20zm0 0a3 3 0 0 1 5.6-1.5A3 3 0 0 1 20 8.5a3.5 3.5 0 0 1-.5 6.5 3 3 0 0 1-4.5 4.5A3 3 0 0 1 12 20zm0 0v15',
  spark: 'M11 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z',
  chart: 'M4 20h16M7 16v-4M12 16V8M17 16V5',
  stack: 'M12 3 3 7.5l9 4.5 9-4.5zM3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5',
  shield: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6zM9 12l2 2 4-4',
  signal: 'M12 13a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM8.5 10.5a5 5 0 0 1 7 0M5.6 7.6a9 9 0 0 1 12.8 0M12 15v6',
  cloud: 'M7 18a4 4 0 0 1-.6-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z',
  states: 'M6 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM9 12h6m-2-2 2 2-2 2M4 7.5C5 4 9 3 12 5',
  terminal: 'M3 4h18v16H3zM7 9l3 3-3 3M12 15h5',
  integral: 'M16 4c-2-1.5-4.5-.5-4.5 2.5v11c0 3-2.5 4-4.5 2.5',
  matrix: 'M7 4H5v16h2M17 4h2v16h-2M9 9h.01M12 9h.01M15 9h.01M9 15h.01M12 15h.01M15 15h.01',
  wave: 'M2 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0',
  leaf: 'M5 19C5 10 10 5 20 4c-1 10-6 15-15 15zm0 0 8-8',
  ruler: 'M3 17 17 3l4 4L7 21zM7 13l2 2m1-5 2 2m1-5 2 2',
  rocket: 'M12 15l-3-3c1-5 4-8 10-9-1 6-4 9-9 10zM9 12H5l2-3h4m1 6v4l3-2v-4M6 16c-1 1-2 3-2 4 1 0 3-1 4-2',
};

export function Icon({ name, filled }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="skeleton" role="status" aria-label={label}>
      <i /><i /><i />
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="state" role="alert">
      <h2>That did not load</h2>
      <p>{error?.message ?? 'Something went wrong.'}</p>
      {onRetry && (
        <button type="button" className="btn" onClick={() => onRetry()}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="state">
      <span className="state-icon">
        <Icon name="book" />
      </span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

// Renders the loading, error and ready states every data-backed page needs.
export function Loaded({ state, children, fallback }) {
  if (state.loading && !state.data) return fallback ?? <Spinner />;
  if (state.error && !state.data) return <ErrorState error={state.error} onRetry={state.reload} />;
  return children(state.data);
}

export function Field({ label, error, hint, required, children }) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {required && <span className="req" aria-hidden="true"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

// Grouped native select: keyboard type-ahead and the phone's own picker work without a custom widget.
export function SubjectSelect({ empty = 'Choose a subject', counts, ...props }) {
  return (
    <select {...props}>
      <option value="">{empty}</option>
      {SUBJECT_GROUPS.map((g) => (
        <optgroup key={g.name} label={g.name}>
          {g.subjects.map((s) => <option key={s.name} value={s.name}>{s.name}{counts?.[s.name] ? ` (${counts[s.name]})` : ''}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

export function SemesterSelect({ empty = 'Not specified', ...props }) {
  return (
    <select {...props}>
      <option value="">{empty}</option>
      {SEMESTERS.map((s) => <option key={s} value={s}>Semester {s}</option>)}
    </select>
  );
}

export function StatusBadge({ status }) {
  return <span className={`badge badge-${statusTone(status)}`}>{STATUS_LABELS[status] ?? status}</span>;
}

// Accounts are "Active"; the same status on a listing reads "Available".
export function UserStatusBadge({ status }) {
  return <span className={`badge badge-${statusTone(status)}`}>{status === 'active' ? 'Active' : STATUS_LABELS[status]}</span>;
}

export function RoleBadge({ role }) {
  if (role === 'faculty') return <span className="badge badge-faculty">Faculty</span>;
  if (role === 'student') return <span className="badge badge-student">Student</span>;
  return null;
}

export function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" className="btn btn-quiet" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button type="button" className="btn btn-quiet" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </nav>
  );
}

export function Modal({ title, onClose, children, wide }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog ref={ref} className={wide ? 'modal modal-wide' : 'modal'} aria-labelledby={titleId} onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <header className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          <Icon name="x" />
        </button>
      </header>
      {children}
    </dialog>
  );
}

// Confirmation for any consequential action, optionally collecting a reason or note.
export function ActionDialog({ title, body, confirmLabel, danger, input, onConfirm, onClose }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onConfirm(text.trim());
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
        {input && (
          <Field label={input.label} required={input.required} hint={input.hint}>
            <textarea rows="3" value={text} onChange={(e) => setText(e.target.value)} required={input.required} minLength={input.required ? 3 : undefined} maxLength={input.maxLength ?? 1000} placeholder={input.placeholder} />
          </Field>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="row-end">
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Back
          </button>
          <button type="submit" className={danger ? 'btn btn-danger' : 'btn btn-primary'} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
