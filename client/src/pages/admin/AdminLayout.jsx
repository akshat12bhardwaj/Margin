import { NavLink, Outlet } from 'react-router-dom';

export default function AdminLayout() {
  return (
    <div className="wrap page admin-shell">
      <nav className="tabs admin-tabs" aria-label="Administration">
        <p className="eyebrow">Administration</p>
        <NavLink end to="/admin" className="tab">Overview</NavLink>
        <NavLink to="/admin/users" className="tab">Users</NavLink>
        <NavLink to="/admin/listings" className="tab">Listings</NavLink>
        <NavLink to="/admin/reports" className="tab">Reports</NavLink>
        <NavLink to="/admin/audit" className="tab">Audit log</NavLink>
      </nav>
      <div className="admin-main"><Outlet /></div>
    </div>
  );
}
