const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

export async function fetchOverview() {
  const res = await fetch(`${API_BASE}/api/v1/overview`);
  if (!res.ok) throw new Error(`Overview fetch failed: ${res.statusText}`);
  return res.json();
}

export async function fetchHostDetail(hostId) {
  const res = await fetch(`${API_BASE}/api/v1/hosts/${hostId}`);
  if (!res.ok) throw new Error(`Host detail fetch failed: ${res.statusText}`);
  return res.json();
}

export async function fetchHostMetrics(hostId, minutes = 15) {
  const res = await fetch(`${API_BASE}/api/v1/hosts/${hostId}/metrics?minutes=${minutes}`);
  if (!res.ok) throw new Error(`Host metrics fetch failed: ${res.statusText}`);
  return res.json();
}

export async function fetchVolumeDetail(volumeId) {
  const res = await fetch(`${API_BASE}/api/v1/volumes/${encodeURIComponent(volumeId)}`);
  if (!res.ok) throw new Error(`Volume detail fetch failed: ${res.statusText}`);
  return res.json();
}

export async function fetchVolumeMetrics(volumeId, minutes = 15) {
  const res = await fetch(`${API_BASE}/api/v1/volumes/${encodeURIComponent(volumeId)}/metrics?minutes=${minutes}`);
  if (!res.ok) throw new Error(`Volume metrics fetch failed: ${res.statusText}`);
  return res.json();
}

export async function fetchAlerts(status = null, severity = null) {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (severity) params.append('severity', severity);
  const res = await fetch(`${API_BASE}/api/v1/alerts?${params.toString()}`);
  if (!res.ok) throw new Error(`Alerts fetch failed: ${res.statusText}`);
  return res.json();
}

export async function requestExplain(alertId) {
  const res = await fetch(`${API_BASE}/api/v1/alerts/${alertId}/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Explain request failed: ${res.statusText}`);
  return res.json();
}

export function subscribeOverviewStream(onData, onError) {
  const url = `${API_BASE}/api/v1/stream/overview`;
  let eventSource = null;
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
      } catch (err) {
        // ignore ping
      }
    };

    eventSource.onerror = (err) => {
      if (onError) onError(err);
    };
  } catch (err) {
    if (onError) onError(err);
  }

  return () => {
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
