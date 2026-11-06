import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { Field, SemesterSelect } from '../components/ui.jsx';
import { PROGRAMS, UNIVERSITY } from '../constants.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useForm, useTitle } from '../hooks.js';

function AuthCard({ title, intro, children, foot }) {
  return (
    <div className="auth-wrap">
      <aside className="auth-aside">
        <p className="eyebrow">BMU students and faculty</p>
        <h2>Every book deserves a <em>second</em> reader.</h2>
        <p>List what you have finished with, and find what your next course needs from people on your own campus.</p>
      </aside>
      <div className="card auth-card">
        <h1>{title}</h1>
        {intro && <p className="muted">{intro}</p>}
        {children}
        {foot && <p className="auth-foot">{foot}</p>}
      </div>
    </div>
  );
}

const SIGN_IN_ERRORS = {
  google: 'Google sign-in did not complete. Please try again.',
  'google-admin': 'Administrator accounts must log in with a password.',
  deactivated: 'This account has been deactivated. Contact the platform administrator.',
};

function GoogleButton() {
  const { googleEnabled } = useAuth();
  if (!googleEnabled) return null;
  return (
    <a href="/api/auth/google" className="btn btn-block google-button">
      <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.7 1.2 9.1 3.6l6.8-6.8C35.8 2.5 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.2 5.6c4.2-3.9 7.1-9.6 7.1-17.1z" />
        <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.1z" />
        <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2 1.4-4.6 2.2-8.7 2.2-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
      </svg>
      Continue with Google
    </a>
  );
}

function RoleField({ form }) {
  return (
    <fieldset className="segmented">
      <legend className="field-label">I am a</legend>
      {['student', 'faculty'].map((role) => (
        <label key={role} className={form.values.role === role ? 'on' : ''}>
          <input type="radio" name="role" value={role} checked={form.values.role === role} onChange={form.bind('role').onChange} />
          {role === 'student' ? 'Student' : 'Teacher / Faculty'}
        </label>
      ))}
    </fieldset>
  );
}

export function ProgramInput({ form }) {
  return (
    <>
      <input list="program-options" maxLength={80} placeholder="e.g. B.Tech" {...form.bind('program')} />
      <datalist id="program-options">{PROGRAMS.map((p) => <option key={p} value={p} />)}</datalist>
    </>
  );
}

function AcademicFields({ form }) {
  const faculty = form.values.role === 'faculty';
  return (
    <>
      <p className="university-line"><span className="field-label">University</span>{UNIVERSITY}</p>
      {faculty && <p className="small muted">Faculty status is self-declared. It shows as a label on your listings and is not verified.</p>}
      {faculty ? (
        <Field label="Designation" error={form.errors.designation}>
          <input placeholder="e.g. Assistant Professor" {...form.bind('designation')} />
        </Field>
      ) : (
        <div className="grid-2">
          <Field label="Programme" error={form.errors.program}>
            <ProgramInput form={form} />
          </Field>
          <Field label="Semester" error={form.errors.semester}>
            <SemesterSelect {...form.bind('semester')} />
          </Field>
        </div>
      )}
    </>
  );
}

export function Login() {
  useTitle('Log in');
  const { login } = useAuth();
  const [params] = useSearchParams();
  const form = useForm({ email: '', password: '' });
  const [error, setError] = useState(SIGN_IN_ERRORS[params.get('error')] ?? null);
  return (
    <AuthCard title="Welcome back" foot={<>New here? <Link to="/register">Create an account</Link></>}>
      <GoogleButton />
      <form
        className="stack"
        onSubmit={form.submit(
          async (values) => {
            setError(null);
            await login(values); // GuestOnly then redirects
          },
          (err) => setError(err.message),
        )}
      >
        <Field label="Email" error={form.errors.email}>
          <input type="email" autoComplete="email" required {...form.bind('email')} />
        </Field>
        <Field label="Password" error={form.errors.password}>
          <input type="password" autoComplete="current-password" required {...form.bind('password')} />
        </Field>
        <Link to="/forgot-password" className="small">Forgot password?</Link>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={form.busy}>{form.busy ? 'Logging in…' : 'Log in'}</button>
      </form>
    </AuthCard>
  );
}

export function Register() {
  useTitle('Create account');
  const { register } = useAuth();
  const [params] = useSearchParams();
  const form = useForm({ role: params.get('role') === 'faculty' ? 'faculty' : 'student', name: '', email: '', password: '', program: '', semester: '', designation: '' });
  const [error, setError] = useState(null);
  return (
    <AuthCard title="Create your account" intro="List books, send purchase requests and message sellers." foot={<>Already registered? <Link to="/login">Log in</Link></>}>
      <GoogleButton />
      <form
        className="stack"
        onSubmit={form.submit(
          async (values) => {
            setError(null);
            await register(values);
          },
          (err) => setError(err.message),
        )}
      >
        <RoleField form={form} />
        <Field label="Full name" required error={form.errors.name}>
          <input autoComplete="name" required minLength={2} {...form.bind('name')} />
        </Field>
        <Field label="Email" required error={form.errors.email}>
          <input type="email" autoComplete="email" required {...form.bind('email')} />
        </Field>
        <Field label="Password" required error={form.errors.password} hint="At least 8 characters.">
          <input type="password" autoComplete="new-password" required minLength={8} {...form.bind('password')} />
        </Field>
        <AcademicFields form={form} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={form.busy}>{form.busy ? 'Creating…' : 'Create account'}</button>
      </form>
    </AuthCard>
  );
}

export function GoogleSignup() {
  useTitle('Finish signing up');
  const { setUser } = useAuth();
  const form = useForm({ role: 'student', program: '', semester: '', designation: '' });
  const [error, setError] = useState(null);
  return (
    <AuthCard title="Almost done" intro="Your Google account is verified. Tell us what you study or teach." foot={<Link to="/login">Back to log in</Link>}>
      <form
        className="stack"
        onSubmit={form.submit(
          async (values) => {
            setError(null);
            const res = await api.post('/auth/google/complete', values);
            setUser(res.user);
          },
          (err) => setError(err.message),
        )}
      >
        <RoleField form={form} />
        <AcademicFields form={form} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={form.busy}>{form.busy ? 'Creating…' : 'Create account'}</button>
      </form>
    </AuthCard>
  );
}

export function ForgotPassword() {
  useTitle('Forgot password');
  const form = useForm({ email: '' });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  return (
    <AuthCard title="Reset your password" foot={<Link to="/login">Back to log in</Link>}>
      {sent ? (
        <p className="notice" role="status">If an account exists for that email, a reset link is on its way. It is valid for one hour.</p>
      ) : (
        <form
          className="stack"
          onSubmit={form.submit(
            async (values) => {
              setError(null);
              await api.post('/auth/forgot-password', values);
              setSent(true);
            },
            (err) => setError(err.message),
          )}
        >
          <p className="muted">Enter your account email and we will send a reset link.</p>
          <Field label="Email" error={form.errors.email}>
            <input type="email" autoComplete="email" required {...form.bind('email')} />
          </Field>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={form.busy}>{form.busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
    </AuthCard>
  );
}

export function ResetPassword() {
  useTitle('Choose a new password');
  const { token } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const form = useForm({ password: '' });
  const [error, setError] = useState(null);
  return (
    <AuthCard title="Choose a new password">
      <form
        className="stack"
        onSubmit={form.submit(
          async ({ password }) => {
            setError(null);
            await api.post('/auth/reset-password', { token, password });
            toast.success('Password changed. Please log in.');
            navigate('/login');
          },
          (err) => setError(err.message),
        )}
      >
        <Field label="New password" error={form.errors.password} hint="At least 8 characters.">
          <input type="password" autoComplete="new-password" required minLength={8} {...form.bind('password')} />
        </Field>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={form.busy}>{form.busy ? 'Saving…' : 'Set new password'}</button>
      </form>
    </AuthCard>
  );
}
