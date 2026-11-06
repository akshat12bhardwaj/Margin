import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Field, Icon, Loaded, SemesterSelect, SubjectSelect } from '../components/ui.jsx';
import { CONDITIONS, subjectInfo } from '../constants.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useFetch, useForm, useTitle } from '../hooks.js';
import NotFound from './NotFound.jsx';

const MAX_IMAGES = 6;
const MAX_BYTES = 5 * 1024 * 1024;
const TEXT_FIELDS = ['title', 'author', 'isbn', 'subject', 'course', 'semester', 'edition', 'publicationYear', 'description', 'price', 'condition'];

function PhotoPicker({ existing, setExisting, files, setFiles, error }) {
  const toast = useToast();
  const [previews, setPreviews] = useState([]);
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [files]);

  const add = (e) => {
    const picked = [...e.target.files];
    e.target.value = '';
    const valid = picked.filter((f) => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return toast.error(`${f.name}: use JPEG, PNG or WebP.`), false;
      if (f.size > MAX_BYTES) return toast.error(`${f.name} is larger than 5 MB.`), false;
      return true;
    });
    const room = MAX_IMAGES - existing.length - files.length;
    if (valid.length > room) toast.error(`A listing can have at most ${MAX_IMAGES} photos.`);
    setFiles([...files, ...valid.slice(0, room)]);
  };

  return (
    <div className="field">
      <span className="field-label">Photos<span className="req" aria-hidden="true"> *</span></span>
      <div className="photo-grid">
        {existing.map((img) => (
          <div className="photo" key={img.url}>
            <img src={img.url} alt="Listing" />
            <button type="button" className="icon-btn" aria-label="Remove photo" onClick={() => setExisting(existing.filter((x) => x !== img))}><Icon name="x" /></button>
          </div>
        ))}
        {previews.map((url, i) => (
          <div className="photo" key={url}>
            <img src={url} alt="New upload preview" />
            <button type="button" className="icon-btn" aria-label="Remove photo" onClick={() => setFiles(files.filter((_, j) => j !== i))}><Icon name="x" /></button>
          </div>
        ))}
        {existing.length + files.length < MAX_IMAGES && (
          <label className="photo-add">
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={add} data-testid="photo-input" />
            + Add photos
          </label>
        )}
      </div>
      <span className="field-hint">Up to {MAX_IMAGES} JPEG, PNG or WebP photos, 5 MB each. Show the cover and any wear.</span>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

function Form({ initial, book, legacySubject }) {
  const { canTrade, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const form = useForm(initial);
  const [existing, setExisting] = useState(book?.images ?? []);
  const [files, setFiles] = useState([]);
  const [photoError, setPhotoError] = useState(null);
  const [error, setError] = useState(null);

  if (!canTrade) return <p className="notice">Your account is suspended, so you cannot list books. {user?.statusReason}</p>;

  const save = form.submit(
    async (values) => {
      setError(null);
      setPhotoError(null);
      if (!existing.length && !files.length) {
        setPhotoError('Add at least one photo of the book.');
        throw Object.assign(new Error('Add at least one photo of the book.'), { fields: {} });
      }
      const body = new FormData();
      for (const k of TEXT_FIELDS) body.append(k, values[k] ?? '');
      for (const img of existing) body.append('keepImages', img.url);
      for (const f of files) body.append('images', f);
      const res = book ? await api.patch(`/books/${book._id}`, body) : await api.post('/books', body);
      toast.success(book ? 'Listing updated.' : 'Your book is listed.');
      navigate(`/books/${res.book._id}`);
    },
    (err) => setError(err.message),
  );

  return (
    <form className="card form-card stack" onSubmit={save} noValidate={false}>
      <PhotoPicker existing={existing} setExisting={setExisting} files={files} setFiles={setFiles} error={photoError} />
      <h2 className="h3">About the book</h2>
      <Field label="Title" required error={form.errors.title}><input required minLength={2} maxLength={200} {...form.bind('title')} /></Field>
      <div className="grid-2">
        <Field label="Author" required error={form.errors.author}><input required minLength={2} maxLength={200} {...form.bind('author')} /></Field>
        <Field label="ISBN" error={form.errors.isbn} hint="10 or 13 digits, if the book has one."><input {...form.bind('isbn')} /></Field>
      </div>
      <div className="grid-3">
        <Field label="Edition" required error={form.errors.edition}><input required placeholder="e.g. 3rd" maxLength={40} {...form.bind('edition')} /></Field>
        <Field label="Publication year" required error={form.errors.publicationYear}><input type="number" required min="1800" max={new Date().getFullYear() + 1} {...form.bind('publicationYear')} /></Field>
        <Field label="Condition" required error={form.errors.condition}>
          <select required {...form.bind('condition')}>
            <option value="">Choose</option>
            {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Description" required error={form.errors.description} hint="Highlighting, missing pages, what is included.">
        <textarea rows="5" required minLength={10} maxLength={3000} {...form.bind('description')} />
      </Field>
      <h2 className="h3">Where it is used</h2>
      <div className="grid-2">
        <Field label="Subject" required error={form.errors.subject} hint={legacySubject && `Was “${legacySubject}”, which is not in the subject list. Choose the closest subject.`}>
          <SubjectSelect required {...form.bind('subject')} />
        </Field>
        <Field label="Course" error={form.errors.course} hint="Name or code"><input maxLength={120} {...form.bind('course')} /></Field>
      </div>
      <div className="grid-2">
        <Field label="Semester" error={form.errors.semester}><SemesterSelect {...form.bind('semester')} /></Field>
      </div>
      <h2 className="h3">Price</h2>
      <div className="grid-2">
        <Field label="Selling price (₹)" required error={form.errors.price} hint="What you want for it. Buyers can make an offer.">
          <input type="number" required min="1" step="any" {...form.bind('price')} />
        </Field>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="row-end">
        <Link to={book ? `/books/${book._id}` : '/my-listings'} className="btn btn-quiet">Cancel</Link>
        <button type="submit" className="btn btn-primary" disabled={form.busy}>{form.busy ? 'Saving…' : book ? 'Save changes' : 'Publish listing'}</button>
      </div>
    </form>
  );
}

export function CreateListing() {
  useTitle('Sell a book');
  return (
    <div className="wrap page narrow">
      <h1>Sell a book</h1>
      <p className="muted">Buyers in the BMU community see this listing right away.</p>
      <Form initial={{}} />
    </div>
  );
}

export function EditListing() {
  useTitle('Edit listing');
  const { id } = useParams();
  const { user } = useAuth();
  const state = useFetch(() => api.get(`/books/${id}`), [id]);
  if (state.error?.status === 404 || state.error?.status === 400) return <NotFound />;
  return (
    <div className="wrap page narrow">
      <h1>Edit listing</h1>
      <Loaded state={state}>
        {({ book }) => {
          if (book.seller._id !== user._id) return <NotFound />;
          if (!['active', 'inactive'].includes(book.status)) return <p className="notice">A {book.status} listing cannot be edited.</p>;
          // A pre-catalogue free-text subject loads as unselected, so saving requires a valid choice.
          const known = subjectInfo(book.subject);
          const initial = Object.fromEntries(TEXT_FIELDS.map((k) => [k, book[k] ?? '']));
          return <Form book={book} initial={{ ...initial, subject: known ? book.subject : '' }} legacySubject={known ? null : book.subject} />;
        }}
      </Loaded>
    </div>
  );
}
