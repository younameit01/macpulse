import React from 'react';
import { Sparkles } from 'lucide-react';
import { formatBps, formatBytes } from '../api';
import { groupAlerts, formatRelativeAlertTime } from '../alertUtils';

export default function RecentAlertsCard({
  alerts = [],
  totalOpenAlerts,
  onExplainAlert,
  onViewAll,
}) {
  const openAlerts = alerts.filter((a) => a.status === 'open');
  const groupedAlerts = groupAlerts(openAlerts);
  const displayAlerts = groupedAlerts.slice(0, 2);
  const count = typeof totalOpenAlerts === 'number' ? totalOpenAlerts : openAlerts.length;

  return (
    <div className="card-container" style={{ minHeight: 336 }}>
      {/* Header */}
      <div className="card-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 className="card-heading">Recent Alerts</h2>
          {count > 0 && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 12,
                background: 'rgba(237, 156, 26, 0.15)',
                color: 'var(--alert-warn-text)',
                border: '1px solid rgba(237, 156, 26, 0.3)',
              }}
            >
              {count} Open
            </span>
          )}
        </div>
        <button className="card-action-link" onClick={onViewAll}>
          View all →
        </button>
      </div>

      {/* Alert list */}
      <div className="alerts-list-compact">
        {displayAlerts.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No open alerts across fleet. All volumes healthy!
          </div>
        ) : (
          displayAlerts.map((a) => {
            const isCrit = a.severity === 'critical';
            const evidence = a.evidence || {};
            const count = a.occurrence_count || 1;
            const latestTimeStr = a.last_seen_at || a.opened_at;

            // Determine title
            let title = 'Storage Incident';
            if (a.type === 'abnormal_write') title = 'Abnormal Write Activity';
            else if (a.type === 'capacity_critical') title = 'Capacity Critical';
            else if (a.type === 'capacity_warning') title = 'Capacity Warning';
            else if (a.type === 'agent_offline') title = 'Agent Offline';
            else if (a.type === 'nfs_concern' || a.type === 'nfs_retrans_high') title = 'NFS Retransmission Alert';

            // Determine metric highlight
            let metricText = a.message || 'Alert threshold triggered';
            let baselineText = count > 1
              ? `Latest: ${formatRelativeAlertTime(latestTimeStr)} · Started: ${formatRelativeAlertTime(a.opened_at)}`
              : formatRelativeAlertTime(latestTimeStr);

            if (a.type === 'abnormal_write' && evidence.current_write_bps) {
              metricText = `${formatBps(evidence.current_write_bps)} write rate`;
              if (evidence.baseline_write_bps) {
                baselineText = `Baseline ${formatBps(evidence.baseline_write_bps)} · Latest: ${formatRelativeAlertTime(latestTimeStr)}`;
              }
            } else if (evidence.used_pct !== undefined) {
              metricText = `${evidence.used_pct}% storage used`;
              if (evidence.free_bytes !== undefined) {
                baselineText = `${formatBytes(evidence.free_bytes)} remaining · Latest: ${formatRelativeAlertTime(latestTimeStr)}`;
              }
            }

            return (
              <div
                key={a.id}
                className={`alert-item-card ${isCrit ? 'border-critical' : 'border-warning'}`}
                onClick={() => onExplainAlert && onExplainAlert(a, false)}
                style={{ cursor: 'pointer' }}
                title="Click to view incident telemetry details"
              >
                <div className="alert-top-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span className="alert-item-title">{title}</span>
                    {count > 1 && (
                      <span
                        className={`alert-count-badge ${isCrit ? 'critical' : ''}`}
                        title={`Repeated ${count} times`}
                      >
                        {count}x
                      </span>
                    )}
                  </div>
                  <button
                    className="alert-explain-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onExplainAlert) onExplainAlert(a, true);
                    }}
                    title="Run Gemini root-cause explanation on this alert"
                  >
                    <Sparkles size={11} />
                    Explain
                  </button>
                </div>

                <div className="alert-item-sub">
                  {a.hostname || 'Mac'}  ·  {a.volume_mount || 'System'}
                </div>

                <div className="alert-item-metric">{metricText}</div>

                <div className="alert-item-baseline">{baselineText}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
