import { useCallback, useEffect, useRef, useState } from 'react';

// Loads data on mount and whenever `deps` change; a stale response never overwrites a newer one.
export function useFetch(load, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const latest = useRef(0);
  const run = useCallback(async ({ quiet = false } = {}) => {
    const id = ++latest.current;
    if (!quiet) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await load();
      if (id === latest.current) setState({ data, loading: false, error: null });
    } catch (error) {
      if (id === latest.current) setState((s) => ({ data: quiet ? s.data : null, loading: false, error }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    run();
  }, [run]);
  return { ...state, reload: run };
}

export function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Margin` : 'Margin — Course books for the BMU community';
  }, [title]);
}

// Form state plus server-side field errors.
export function useForm(initial) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const bind = (name) => ({
    name,
    value: values[name] ?? '',
    onChange: (e) => {
      setValues((v) => ({ ...v, [name]: e.target.value }));
      setErrors((x) => ({ ...x, [name]: undefined }));
    },
    'aria-invalid': errors[name] ? true : undefined,
  });
  const submit = (handler, onError) => async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await handler(values);
    } catch (err) {
      setErrors(err.fields ?? {});
      onError?.(err);
    } finally {
      setBusy(false);
    }
  };
  return { values, setValues, errors, busy, bind, submit };
}
