/**
 * Alert deduplication and grouping utility.
 * Groups identical alerts across host, volume/mount, type, and severity,
 * aggregating occurrence counts and identifying the latest timestamp.
 */

export function groupAlerts(alerts = []) {
  if (!Array.isArray(alerts) || alerts.length === 0) return [];

  const groups = new Map();

  for (const alert of alerts) {
    if (!alert) continue;

    // Normalizing grouping key: host + volume/mount + type + severity + status
    const hostKey = alert.host_id || alert.hostname || 'global';
    const volKey = alert.volume_id || alert.volume_mount || 'system';
    const typeKey = alert.type || 'unknown';
    const sevKey = alert.severity || 'warning';
    const statusKey = alert.status || 'open';
    const key = `${hostKey}::${volKey}::${typeKey}::${sevKey}::${statusKey}`;

    const alertCount = Math.max(1, Number(alert.occurrence_count) || 1);
    const alertOpenedAt = alert.opened_at ? new Date(alert.opened_at).getTime() : Date.now();
    const alertLastSeenAt = alert.last_seen_at
      ? new Date(alert.last_seen_at).getTime()
      : alertOpenedAt;

    if (!groups.has(key)) {
      groups.set(key, {
        ...alert,
        occurrence_count: alertCount,
        opened_at: alert.opened_at,
        last_seen_at: alert.last_seen_at || alert.opened_at,
        _first_timestamp: alertOpenedAt,
        _latest_timestamp: Math.max(alertOpenedAt, alertLastSeenAt),
        _occurrences: [alert],
      });
    } else {
      const existing = groups.get(key);
      existing.occurrence_count += alertCount;
      existing._occurrences.push(alert);

      // Keep latest timestamp
      if (alertLastSeenAt > existing._latest_timestamp) {
        existing._latest_timestamp = alertLastSeenAt;
        existing.last_seen_at = alert.last_seen_at || alert.opened_at;
        // Keep most up-to-date evidence and message
        existing.evidence = alert.evidence || existing.evidence;
        existing.message = alert.message || existing.message;
        existing.id = alert.id; // use freshest alert id for actions like Explain
      }

      // Keep earliest opened_at
      if (alertOpenedAt < existing._first_timestamp) {
        existing._first_timestamp = alertOpenedAt;
        existing.opened_at = alert.opened_at;
      }
    }
  }

  // Convert to array and sort by latest timestamp descending
  return Array.from(groups.values()).sort(
    (a, b) => b._latest_timestamp - a._latest_timestamp
  );
}

export function parseUtcDate(dateStr) {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  const s = String(dateStr).trim();
  const hasTz = s.endsWith('Z') || /[+-]\d{2}(:\d{2})?$/.test(s);
  const normalized = hasTz ? s : `${s.replace(' ', 'T')}Z`;
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? new Date(dateStr) : d;
}

export function formatLocalTime(dateStr) {
  if (!dateStr) return '—';
  const d = parseUtcDate(dateStr);
  return isNaN(d.getTime())
    ? String(dateStr)
    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatLocalDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = parseUtcDate(dateStr);
  return isNaN(d.getTime())
    ? String(dateStr)
    : `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

export function formatRelativeAlertTime(dateStr) {
  if (!dateStr) return 'Just now';
  const time = parseUtcDate(dateStr).getTime();
  if (isNaN(time)) return 'Just now';
  const diffSec = Math.max(1, Math.floor((Date.now() - time) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
