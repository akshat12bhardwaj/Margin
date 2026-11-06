import { api } from '../api.js';
import { REPORT_CATEGORIES } from '../constants.js';
import { useToast } from '../context/ToastContext.jsx';
import { useForm } from '../hooks.js';
import { Field, Modal } from './ui.jsx';

export default function ReportDialog({ targetType, targetId, name, onClose }) {
  const toast = useToast();
  const form = useForm({ category: '', description: '' });
  return (
    <Modal title={`Report ${name}`} onClose={onClose}>
      <form
        className="stack"
        onSubmit={form.submit(
          async (values) => {
            await api.post('/reports', { targetType, targetId, ...values });
            toast.success('Report submitted. An administrator will review it.');
            onClose();
          },
          (err) => toast.error(err.message),
        )}
      >
        <p className="muted">Reports are private. Only administrators see who filed them.</p>
        <Field label="What is wrong?" required error={form.errors.category}>
          <select {...form.bind('category')} required>
            <option value="">Choose a category</option>
            {Object.entries(REPORT_CATEGORIES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>
        <Field label="Details" required error={form.errors.description} hint="What happened? At least 10 characters.">
          <textarea {...form.bind('description')} rows="4" required minLength={10} maxLength={2000} />
        </Field>
        <div className="row-end">
          <button type="button" className="btn btn-quiet" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-danger" disabled={form.busy}>{form.busy ? 'Sending…' : 'Submit report'}</button>
        </div>
      </form>
    </Modal>
  );
}
