const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function request(path, options = {}, token = null, _retried = false) {
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Access token expired? Try a silent cookie refresh once, then replay.
  if (
    res.status === 401 &&
    !_retried &&
    !path.startsWith('/auth/')
  ) {
    try {
      const r = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (r.ok) return request(path, options, token, true);
    } catch {
      // fall through to normal error handling
    }
  }

  const data = await res.json();

  if (!res.ok) {
    const error = new Error(data?.error?.message || 'Request failed');
    error.code = data?.error?.code;
    error.status = res.status;
    throw error;
  }

  return data;
}

function blobRequest(path, token) {
  return fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  }).then(async (res) => {
    if (!res.ok) {
      let message = 'Request failed';
      try {
        const data = await res.json();
        message = data?.error?.message || message;
      } catch {
        // not JSON
      }
      const error = new Error(message);
      error.status = res.status;
      throw error;
    }
    return res.blob();
  });
}

// ── Auth ──────────────────────────────────────────
export const authApi = {
  register: (email, password, firstName, lastName) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, firstName, lastName }),
    }),

  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  refresh: () => request('/auth/refresh', { method: 'POST' }),

  logout: () => request('/auth/logout', { method: 'POST' }),

  me: () => request('/auth/me'),

  twoFactorLogin: (mfaToken, code) =>
    request('/auth/2fa/login', { method: 'POST', body: JSON.stringify({ mfaToken, code }) }),

  google: (credential) =>
    request('/auth/google', { method: 'POST', body: JSON.stringify({ credential }) }),

  twoFactorSetup: () => request('/auth/2fa/setup', { method: 'POST' }),
  twoFactorEnable: (code) =>
    request('/auth/2fa/enable', { method: 'POST', body: JSON.stringify({ code }) }),
  twoFactorDisable: (code) =>
    request('/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ code }) }),

  changePassword: (token, currentPassword, newPassword) =>
    request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }, token),

  forgotPassword: (email) =>
    request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

  resetPassword: (token, newPassword) =>
    request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),

  deleteAccount: (token, password) =>
    request('/auth/account', { method: 'DELETE', body: JSON.stringify({ password }) }, token),
};

// ── User ──────────────────────────────────────────
export const userApi = {
  me: (token) => request('/users/me', {}, token),
  update: (token, body) =>
    request('/users/me', { method: 'PUT', body: JSON.stringify(body) }, token),
};

// ── Business profile ──────────────────────────────
export const businessApi = {
  get: (token) => request('/business', {}, token),
  update: (token, body) =>
    request('/business', { method: 'PUT', body: JSON.stringify(body) }, token),
};

// ── Payment settings ──────────────────────────────
export const paymentSettingsApi = {
  get: (token) => request('/payment-settings', {}, token),
  update: (token, body) =>
    request('/payment-settings', { method: 'PUT', body: JSON.stringify(body) }, token),
  stripeConnect: (token) =>
    request('/payment-settings/stripe/connect', { method: 'POST' }, token),
  stripeStatus: (token) => request('/payment-settings/stripe/status', {}, token),
};

// ── Clients ───────────────────────────────────────
export const clientApi = {
  list: (token, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/clients${query ? '?' + query : ''}`, {}, token);
  },
  get: (token, id) => request(`/clients/${id}`, {}, token),
  create: (token, body) =>
    request('/clients', { method: 'POST', body: JSON.stringify(body) }, token),
  update: (token, id, body) =>
    request(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(body) }, token),
  remove: (token, id) =>
    request(`/clients/${id}`, { method: 'DELETE' }, token),
};

// ── Dashboard ─────────────────────────────────────
export const dashboardApi = {
  get: (token) => request('/dashboard', {}, token),
};

// ── Public (unauthenticated, for invoice recipients) ──
export const publicApi = {
  getInvoice: (id) => request(`/public/invoices/${id}`),
  checkout: (id) => request(`/public/invoices/${id}/checkout`, { method: 'POST' }),
};

// ── Guest ─────────────────────────────────────────
export const guestApi = {
  // Returns a PDF Blob (the endpoint streams a PDF, not JSON).
  createInvoice: async (body) => {
    const res = await fetch(`${BASE_URL}/guest/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let message = 'Could not generate invoice';
      try {
        const data = await res.json();
        message = data?.error?.message || message;
      } catch {
        // not JSON
      }
      const error = new Error(message);
      error.status = res.status;
      throw error;
    }

    return res.blob();
  },
};

// ── Invoices ──────────────────────────────────────
export const invoiceApi = {
  list: (token, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/invoices${query ? '?' + query : ''}`, {}, token);
  },

  summary: (token) => request('/invoices/summary', {}, token),

  get: (token, invoiceId) => request(`/invoices/${invoiceId}`, {}, token),

  create: (token, body) =>
    request('/invoices', { method: 'POST', body: JSON.stringify(body) }, token),

  update: (token, invoiceId, body) =>
    request(`/invoices/${invoiceId}`, { method: 'PUT', body: JSON.stringify(body) }, token),

  remove: (token, invoiceId) =>
    request(`/invoices/${invoiceId}`, { method: 'DELETE' }, token),

  duplicate: (token, invoiceId) =>
    request(`/invoices/${invoiceId}/duplicate`, { method: 'POST' }, token),

  send: (token, invoiceId) =>
    request(`/invoices/${invoiceId}/send`, { method: 'POST' }, token),

  resend: (token, invoiceId, body = {}) =>
    request(`/invoices/${invoiceId}/resend`, { method: 'POST', body: JSON.stringify(body) }, token),

  markPaid: (token, invoiceId) =>
    request(`/invoices/${invoiceId}/mark-paid`, { method: 'POST' }, token),

  pdf: (token, invoiceId) => blobRequest(`/invoices/${invoiceId}/pdf`, token),

  pdfUrl: (invoiceId) => `${BASE_URL}/invoices/${invoiceId}/pdf`,
};

// ── Payments ──────────────────────────────────────
export const paymentApi = {
  history: (token) => request('/payments', {}, token),

  // PaymentIntent flow (Stripe Elements) — returns a client secret.
  pay: (token, invoiceId) =>
    request(`/payments/${invoiceId}/pay`, { method: 'POST' }, token),

  // Hosted Stripe Checkout — returns { url } to redirect the browser to.
  checkout: (token, invoiceId) =>
    request('/payments/stripe/checkout', {
      method: 'POST',
      body: JSON.stringify({ invoiceId }),
    }, token),
};
