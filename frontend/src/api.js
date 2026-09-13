const API_BASE = import.meta.env.VITE_API_BASE || (
  typeof window !== 'undefined'
    ? ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '3000' || window.location.port === '5173')
        ? `${window.location.protocol}//${window.location.hostname}:8000`
        : '')
    : 'http://localhost:8000'
);

let getAccessTokenFn = null;

export function setAuthTokenGetter(fn) {
  getAccessTokenFn = fn;
}

async function authHeaders(customHeaders = {}) {
  const headers = { ...customHeaders };
  let token = null;

  if (getAccessTokenFn) {
    try {
      token = await getAccessTokenFn();
    } catch (err) {
      console.warn('Failed to retrieve access token for API request:', err);
    }
  }

  // Resilient fallback to localStorage if getter was unset or returned empty
  if (!token && typeof window !== 'undefined') {
    try {
      token = localStorage.getItem('macai_auth_token');
    } catch (err) {
      console.warn('Failed to retrieve access token from localStorage:', err);
    }
  }

  // Development/session fallback: if user profile exists in localStorage
  if (!token && typeof window !== 'undefined') {
    try {
      const storedUser = localStorage.getItem('macai_auth_user');
      if (storedUser) {
        const u = JSON.parse(storedUser);
        if (u.role === 'Super Admin') {
          token = 'super-admin-demo-token';
        } else if (u.role === 'Admin') {
          token = 'admin-demo-token';
        }
      }
    } catch (err) {}
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function loginUser({ email, password }) {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || `Sign in failed (${res.status})`);
  }
  return data;
}

export async function signupUser({ email, password, name }) {
  const res = await fetch(`${API_BASE}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || `Sign up failed (${res.status})`);
  }
  return data;
}

export async function fetchCurrentUser() {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/me`, { headers });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch profile: ${res.statusText}`);
  }
  return res.json();
}

export async function createAdminUser({ name, email }) {
  const headers = await authHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch(`${API_BASE}/api/v1/admins`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name, email }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to create admin: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchOverview() {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/overview`, { headers });
  if (!res.ok) throw new Error(`Overview fetch failed: ${res.statusText}`);
  return res.json();
}

export async function fetchHostDetail(hostId) {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/hosts/${hostId}`, { headers });
  if (!res.ok) throw new Error(`Host detail fetch failed: ${res.statusText}`);
  return res.json();
}

export async function fetchHostMetrics(hostId, minutes = 15) {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/hosts/${hostId}/metrics?minutes=${minutes}`, { headers });
  if (!res.ok) throw new Error(`Host metrics fetch failed: ${res.statusText}`);
  return res.json();
}

export async function fetchVolumeDetail(volumeId) {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/volumes/detail?volume_id=${encodeURIComponent(volumeId)}`, { headers });
  if (!res.ok) throw new Error(`Volume detail fetch failed: ${res.statusText}`);
  return res.json();
}

export async function fetchVolumeMetrics(volumeId, minutes = 15) {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/volumes/detail/metrics?volume_id=${encodeURIComponent(volumeId)}&minutes=${minutes}`, { headers });
  if (!res.ok) throw new Error(`Volume metrics fetch failed: ${res.statusText}`);
  return res.json();
}

export async function fetchAlerts(status = null, severity = null) {
  const headers = await authHeaders();
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (severity) params.append('severity', severity);
  const res = await fetch(`${API_BASE}/api/v1/alerts?${params.toString()}`, { headers });
  if (!res.ok) throw new Error(`Alerts fetch failed: ${res.statusText}`);
  return res.json();
}

export async function requestExplain(alertId, force = false) {
  const headers = await authHeaders({ 'Content-Type': 'application/json' });
  const url = `${API_BASE}/api/v1/alerts/${alertId}/explain${force ? '?force=true' : ''}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
  });
  if (!res.ok) throw new Error(`Explain request failed: ${res.statusText}`);
  return res.json();
}

export async function acknowledgeAlert(alertId, note = null) {
  const headers = await authHeaders({ 'Content-Type': 'application/json' });
  const url = `${API_BASE}/api/v1/alerts/${alertId}/acknowledge`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ note }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Acknowledge alert failed: ${res.statusText}`);
  }
  return res.json();
}

export async function resolveAlert(alertId, resolutionNote = '') {
  const headers = await authHeaders({ 'Content-Type': 'application/json' });
  const url = `${API_BASE}/api/v1/alerts/${alertId}/resolve`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ resolution_note: resolutionNote }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Resolve alert failed: ${res.statusText}`);
  }
  return res.json();
}

export function subscribeOverviewStream(onData, onError) {
  const url = `${API_BASE}/api/v1/stream/overview`;
  let eventSource = null;
  let retryTimer = null;
  let isClosed = false;

  function connect() {
    if (isClosed) return;

    try {
      eventSource = new EventSource(url);

      eventSource.addEventListener('overview', (event) => {
        try {
          const data = JSON.parse(event.data);
          onData(data);
        } catch (err) {
          console.error('Error parsing SSE overview data:', err);
        }
      });

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onData(data);
        } catch (_err) {
          // ignore ping
        }
      };

      eventSource.onerror = (err) => {
        if (onError) onError(err);
        // Automatically reconnect if EventSource permanently closed
        if (eventSource && eventSource.readyState === EventSource.CLOSED && !isClosed) {
          eventSource.close();
          eventSource = null;
          retryTimer = setTimeout(connect, 3000);
        }
      };
    } catch (err) {
      if (onError) onError(err);
      if (!isClosed) {
        retryTimer = setTimeout(connect, 3000);
      }
    }
  }

  connect();

  return () => {
    isClosed = true;
    if (retryTimer) clearTimeout(retryTimer);
    if (eventSource) {
      eventSource.close();
    }
  };
}

export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatBps(bps) {
  if (!bps || bps === 0) return '0 B/s';
  return `${formatBytes(bps)}/s`;
}

export async function fetchInviteInfo(token) {
  const res = await fetch(`${API_BASE}/api/v1/auth/invite-info?token=${encodeURIComponent(token)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || `Failed to fetch invitation (${res.status})`);
  }
  return data;
}

export async function acceptInviteUser({ inviteToken, password }) {
  const res = await fetch(`${API_BASE}/api/v1/auth/accept-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invite_token: inviteToken, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || `Failed to activate invitation (${res.status})`);
  }
  return data;
}

