import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import BookCard from '../components/BookCard.jsx';
import ReportDialog from '../components/ReportDialog.jsx';
import { EmptyState, Field, Icon, Loaded, RoleBadge, SemesterSelect } from '../components/ui.jsx';
import { formatDate } from '../constants.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useFetch, useForm, useTitle } from '../hooks.js';
import { ProgramInput } from './AuthPages.jsx';
import NotFound from './NotFound.jsx';

export function PublicProfile() {
  const { id } = useParams();
  const { user: me, canTrade } = useAuth();
  const [reporting, setReporting] = useState(false);
  const state = useFetch(() => api.get(`/users/${id}`), [id]);
  useTitle(state.data?.user.name ?? 'Profile');
  if (state.error?.status === 404 || state.error?.status === 400) return <NotFound />;
  return (
    <div className="wrap page">
      <Loaded state={state}>
        {({ user, listings, soldCount }) => (
          <>
            <section className="card profile-head">
              <span className="avatar" aria-hidden="true">{user.name[0].toUpperCase()}</span>
              <div className="profile-main">
                <h1>{user.name} <RoleBadge role={user.role} /></h1>
                <p className="muted">{[user.designation, user.program, user.university].filter(Boolean).join(' · ')}</p>
                {user.bio && <p className="prewrap">{user.bio}</p>}
                {!user.isDemo && <p className="small muted">Member since {formatDate(user.createdAt)} · {soldCount} sold</p>}
                {user.status === 'suspended' && <p className="field-error">This account is currently restricted.</p>}
              </div>
              {me?._id === user._id ? (
                <Link to="/profile" className="btn btn-small">Edit profile</Link>
              ) : (
                canTrade && !user.isDemo && <button type="button" className="link-danger" onClick={() => setReporting(true)}><Icon name="flag" /> Report user</button>
              )}
            </section>
            <h2 className="section-title">Books for sale</h2>
            {listings.length ? (
              <div className="book-grid">
                {listings.map((book) => <BookCard key={book._id} book={book} />)}
              </div>
            ) : (
              <EmptyState title="Nothing for sale right now" />
            )}
            {reporting && <ReportDialog targetType="user" targetId={user._id} name={user.name} onClose={() => setReporting(false)} />}
          </>
        )}
      </Loaded>
    </div>
  );
}

function PasswordForm() {
  const toast = useToast();
  const form = useForm({ currentPassword: '', newPassword: '' });
  return (
    <form
      className="card form-card stack"
      onSubmit={form.submit(
        async (values) => {
          await api.post('/auth/change-password', values);
          form.setValues({ currentPassword: '', newPassword: '' });
          toast.success('Password changed.');
        },
        (err) => toast.error(err.message),
      )}
    >
      <h2 className="h3">Change password</h2>
      <Field label="Current password" error={form.errors.currentPassword}>
        <input type="password" autoComplete="current-password" required {...form.bind('currentPassword')} />
      </Field>
      <Field label="New password" error={form.errors.newPassword} hint="At least 8 characters.">
        <input type="password" autoComplete="new-password" required minLength={8} {...form.bind('newPassword')} />
      </Field>
      <div className="row-end">
        <button type="submit" className="btn" disabled={form.busy}>{form.busy ? 'Saving…' : 'Change password'}</button>
      </div>
    </form>
  );
}

export function EditProfile() {
  useTitle('Settings');
  const { user, setUser, isAdmin } = useAuth();
  const toast = useToast();
  const form = useForm({
    name: user.name,
    program: user.program ?? '',
    semester: user.semester ?? '',
    designation: user.designation ?? '',
    bio: user.bio ?? '',
  });
  return (
    <div className="wrap page narrow">
      <div className="row-between">
        <h1>Settings</h1>
        {!isAdmin && <Link to={`/users/${user._id}`}>View public profile</Link>}
      </div>
      <p className="muted">{user.email} · <span className="capitalize">{user.role}</span> account</p>
      <div className="stack">
        <form
          className="card form-card stack"
          onSubmit={form.submit(
            async (values) => {
              const res = await api.patch('/users/me', values);
              setUser(res.user);
              toast.success('Profile saved.');
            },
            (err) => toast.error(err.message),
          )}
        >
          <Field label="Full name" required error={form.errors.name}><input required minLength={2} {...form.bind('name')} /></Field>
          <p className="university-line"><span className="field-label">University</span>{user.university}</p>
          <div className="grid-2">
            {user.role === 'faculty' && <Field label="Designation" error={form.errors.designation}><input {...form.bind('designation')} /></Field>}
            {user.role === 'student' && <Field label="Programme" error={form.errors.program}><ProgramInput form={form} /></Field>}
            {user.role === 'student' && <Field label="Semester" error={form.errors.semester}><SemesterSelect {...form.bind('semester')} /></Field>}
          </div>
          <Field label="About you" error={form.errors.bio} hint="Shown on your public profile. Do not include private contact details.">
            <textarea rows="3" maxLength={500} {...form.bind('bio')} />
          </Field>
          <div className="row-end">
            <button type="submit" className="btn btn-primary" disabled={form.busy || user.status !== 'active'}>{form.busy ? 'Saving…' : 'Save profile'}</button>
          </div>
        </form>
        <PasswordForm />
      </div>
    </div>
  );
}
