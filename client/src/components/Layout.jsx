import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Icon } from './ui.jsx';

const POLL_MS = 20000;

function useSummary(user) {
  const [summary, setSummary] = useState({ notifications: 0, messages: 0 });
  const { pathname } = useLocation();
  useEffect(() => {
    if (!user) return undefined;
    const load = () => api.get('/notifications/summary').then(setSummary).catch(() => {});
    load();
    // shortcut: badges poll instead of using websockets, fine at campus scale; use Socket.IO for instant delivery.
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [user, pathname]);
  return summary;
}

const Count = ({ n }) => (n > 0 ? <span className="count">{n > 99 ? '99+' : n}</span> : null);

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Margin home">
      Margin<i>.</i>
    </Link>
  );
}

export default function Layout() {
  const { user, isAdmin, canTrade, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const accountRef = useRef(null);
  const summary = useSummary(user);
  const { theme, setTheme } = useTheme();
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  useEffect(() => {
    setOpen(false);
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    const closeOutside = (e) => {
      if (!accountRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('click', closeOutside);
    return () => document.removeEventListener('click', closeOutside);
  }, []);

  const signOut = async () => {
    try {
      await logout();
      navigate('/');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="app">
      <a href="#main" className="skip">Skip to content</a>
      <p className="topbar">For the BMU community · No fees, pay in person</p>
      <header className="site-head wrap">
        <div className="head-row">
          <Logo />
          <button type="button" className="icon-btn nav-toggle" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <Icon name={open ? 'x' : 'menu'} />
          </button>
          <nav className={open ? 'nav nav-open' : 'nav'} aria-label="Main">
            <NavLink end to="/">Home</NavLink>
            <NavLink to="/books">Browse books</NavLink>
            {(!user || canTrade) && <NavLink to="/sell">Sell a book</NavLink>}
            {isAdmin && <NavLink to="/admin">Admin</NavLink>}
            {user && !isAdmin && (
              <>
                <NavLink to="/wishlist">Wishlist</NavLink>
                <NavLink to="/messages">Messages <Count n={summary.messages} /></NavLink>
              </>
            )}
            {user && <NavLink to="/notifications">Alerts <Count n={summary.notifications} /></NavLink>}
            <span className="nav-spacer" />
            {user ? (
              <div className={menuOpen ? 'account open' : 'account'} ref={accountRef}>
                <button type="button" className="account-toggle" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>{user.name.split(' ')[0]}</button>
                <div className="account-menu">
                  {isAdmin ? (
                    <NavLink to="/admin">Admin dashboard</NavLink>
                  ) : (
                    <>
                      <NavLink to="/dashboard">Dashboard</NavLink>
                      <NavLink to="/my-listings">My listings</NavLink>
                      <NavLink to="/requests">Purchase requests</NavLink>
                      <NavLink to="/transactions">Transactions</NavLink>
                    </>
                  )}
                  <NavLink to="/profile">Settings</NavLink>
                  <button type="button" onClick={signOut}>Log out</button>
                </div>
              </div>
            ) : (
              <>
                <NavLink to="/login">Log in</NavLink>
                <Link to="/register" className="btn btn-primary btn-small">Create account</Link>
              </>
            )}
          </nav>
          <button type="button" className="icon-btn theme-toggle" aria-label={`Switch to ${nextTheme} mode`} title={`Switch to ${nextTheme} mode`} onClick={() => setTheme(nextTheme)}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
        </div>
      </header>
      {user?.status === 'suspended' && (
        <div className="banner banner-bad" role="alert">
          <div className="wrap">
            <strong>Your account is suspended.</strong> {user.statusReason} You can still read your messages and history, but cannot buy, sell, message or report.
          </div>
        </div>
      )}
      <main id="main">
        <Outlet />
      </main>
      <footer className="site-foot">
        <div className="wrap foot-row">
          <div>
            <Logo />
            <p>Students and faculty pass on the course books they no longer need. Buyers and sellers arrange payment and handover themselves.</p>
          </div>
          <nav aria-label="Footer">
            <Link to="/books">Browse books</Link>
            <Link to={user ? '/sell' : '/register'}>Sell a book</Link>
            {!user && <Link to="/register">Create account</Link>}
            {user && !isAdmin && <Link to="/my-listings">Your listings</Link>}
          </nav>
        </div>
        <div className="wrap"><p className="foot-legal">An independent student-built marketplace for the BML Munjal University community. Not affiliated with or endorsed by BML Munjal University.</p></div>
      </footer>
    </div>
  );
}
