import { Link } from 'react-router-dom';
import { useTitle } from '../hooks.js';

export default function NotFound() {
  useTitle('Page not found');
  return (
    <div className="wrap page narrow center">
      <p className="eyebrow">404</p>
      <h1>This page is not on the shelf</h1>
      <p className="muted">The link may be old, or the listing may have been taken down.</p>
      <div className="row-center">
        <Link to="/books" className="btn btn-primary">Browse books</Link>
        <Link to="/" className="btn">Go home</Link>
      </div>
    </div>
  );
}
