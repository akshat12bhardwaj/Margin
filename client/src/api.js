export class ApiError extends Error {
  constructor(message, status, fields) {
    super(message);
    this.status = status;
    this.fields = fields ?? {};
  }
}

async function request(method, path, body) {
  const isForm = body instanceof FormData;
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
      body: isForm ? body : body && JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('auth:expired'));
    throw new ApiError(data.error || 'Something went wrong. Please try again.', res.status, data.fields);
  }
  return data;
}

const withQuery = (path, params) => {
  const entries = Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? `${path}?${new URLSearchParams(entries)}` : path;
};

export const api = {
  get: (path, params) => request('GET', withQuery(path, params)),
  post: (path, body = {}) => request('POST', path, body),
  patch: (path, body = {}) => request('PATCH', path, body),
  del: (path) => request('DELETE', path),
};
