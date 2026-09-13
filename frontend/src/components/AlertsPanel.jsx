import React, { useState, useEffect } from 'react';
import { AlertTriangle, AlertCircle, Sparkles, Clock, CheckCircle, Check, UserCheck } from 'lucide-react';
import { groupAlerts, formatRelativeAlertTime, formatLocalTime } from '../alertUtils';
import { acknowledgeAlert } from '../api';
import ResolveAlertModal from './ResolveAlertModal';

export default function AlertsPanel({
  alerts = [],
  title = 'Storage Incidents & Alert Stream',
  subtitle = 'Deterministic threshold, rolling baseline, and administrator alert lifecycle management',
  defaultFilter,
  scrollable = false,
  maxHeight,
  onExplainAlert,
  onAlertUpdated,
}) {
  const initialFilter = defaultFilter || (
    alerts.some((a) => a.status === 'open')
      ? 'open'
      : alerts.some((a) => a.status === 'acknowledged')
      ? 'acknowledged'
      : alerts.some((a) => a.status === 'closed')
      ? 'closed'
      : 'open'
  );
  const [filter, setFilter] = useState(initialFilter);
  const [userInteracted, setUserInteracted] = useState(false);
  const [localStatuses, setLocalStatuses] = useState({}); // { [id]: { status, acknowledged_by, resolved_by, resolution_note, ... } }
  const [modalAlert, setModalAlert] = useState(null);

  useEffect(() => {
    if (userInteracted) return;
    if (defaultFilter) {
      setFilter(defaultFilter);
    } else if (alerts && alerts.length > 0) {
      const hasOpen = alerts.some((a) => (localStatuses[a.id]?.status || a.status) === 'open');
      const hasAck = alerts.some((a) => (localStatuses[a.id]?.status || a.status) === 'acknowledged');
      const hasClosed = alerts.some((a) => (localStatuses[a.id]?.status || a.status) === 'closed');
      if (filter === 'open' && !hasOpen) {
        if (hasAck) setFilter('acknowledged');
        else if (hasClosed) setFilter('closed');
      }
    }
  }, [alerts, defaultFilter, userInteracted, filter, localStatuses]);

  const getEffectiveAlert = (a) => {
    return {
      ...a,
      ...(localStatuses[a.id] || {}),
    };
  };

  const mergedAlerts = alerts.map(getEffectiveAlert);

  const openAlerts = mergedAlerts.filter((a) => a.status === 'open');
  const acknowledgedAlerts = mergedAlerts.filter((a) => a.status === 'acknowledged');
  const closedAlerts = mergedAlerts.filter((a) => a.status === 'closed');

  const openGrouped = groupAlerts(openAlerts);
  const acknowledgedGrouped = groupAlerts(acknowledgedAlerts);
  const closedGrouped = groupAlerts(closedAlerts);
  const allGrouped = groupAlerts(mergedAlerts);

  const displayList =
    filter === 'open'
      ? openGrouped
      : filter === 'acknowledged'
      ? acknowledgedGrouped
      : filter === 'closed'
      ? closedGrouped
      : allGrouped;

  const handleTabChange = (f) => {
    setUserInteracted(true);
    setFilter(f);
  };

  const handleAcknowledgeClick = async (e, a) => {
    e.stopPropagation();
    try {
      const updated = await acknowledgeAlert(a.id);
      const updatedMap = {};
      if (a._occurrences && Array.isArray(a._occurrences)) {
        a._occurrences.forEach((occ) => {
          if (occ?.id) updatedMap[occ.id] = updated;
        });
      }
      updatedMap[a.id] = updated;
      alerts.forEach((item) => {
        if (
          item &&
          item.host_id === a.host_id &&
          item.volume_id === a.volume_id &&
          item.type === a.type
        ) {
          updatedMap[item.id] = updated;
        }
      });
      setLocalStatuses((prev) => ({
        ...prev,
        ...updatedMap,
      }));
      // Move immediately to acknowledged tab
      setFilter('acknowledged');
      if (onAlertUpdated) {
        onAlertUpdated(updated);
      }
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const handleResolveModalOpen = (e, a) => {
    e.stopPropagation();
    setModalAlert(a);
  };

  const handleAlertResolved = (updated) => {
    if (updated?.id) {
      const updatedMap = {};
      if (modalAlert && modalAlert._occurrences && Array.isArray(modalAlert._occurrences)) {
        modalAlert._occurrences.forEach((occ) => {
          if (occ?.id) updatedMap[occ.id] = updated;
        });
      }
      updatedMap[updated.id] = updated;
      alerts.forEach((item) => {
        if (
          modalAlert &&
          item &&
          item.host_id === modalAlert.host_id &&
          item.volume_id === modalAlert.volume_id &&
          item.type === modalAlert.type
        ) {
          updatedMap[item.id] = updated;
        }
      });
      setLocalStatuses((prev) => ({
        ...prev,
        ...updatedMap,
      }));
      setFilter('closed');
      if (onAlertUpdated) {
        onAlertUpdated(updated);
      }
    }
    setModalAlert(null);
  };

  return (
    <div className="card-container" style={{ padding: 24 }}>
      {/* Header Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h2 className="card-heading">{title}</h2>
          {subtitle && <p className="card-subheading">{subtitle}</p>}
        </div>

        {/* Filter Tabs */}
        <div
          style={{
            display: 'inline-flex',
            gap: 6,
            background: 'var(--bg-subtle)',
            padding: 4,
            borderRadius: 10,
            border: '1px solid var(--border-subtle)',
          }}
        >
          <button
            onClick={() => handleTabChange('open')}
            style={{
              background: filter === 'open' ? 'var(--bg-card)' : 'transparent',
              color: filter === 'open' ? 'var(--text-main)' : 'var(--text-muted)',
              border: 'none',
              padding: '6px 14px',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: filter === 'open' ? 700 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: filter === 'open' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <span>Open</span>
            <span
              style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 10,
                background: openGrouped.length > 0 ? 'var(--alert-crit-border)' : 'var(--border-subtle)',
                color: openGrouped.length > 0 ? '#fff' : 'var(--text-muted)',
                fontWeight: 700,
              }}
            >
              {openGrouped.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange('acknowledged')}
            style={{
              background: filter === 'acknowledged' ? 'var(--bg-card)' : 'transparent',
              color: filter === 'acknowledged' ? 'var(--text-main)' : 'var(--text-muted)',
              border: 'none',
              padding: '6px 14px',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: filter === 'acknowledged' ? 700 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: filter === 'acknowledged' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <span>Acknowledged</span>
            <span
              style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 10,
                background: 'rgba(37, 99, 235, 0.15)',
                color: 'var(--chart-read)',
                fontWeight: 700,
              }}
            >
              {acknowledgedGrouped.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange('closed')}
            style={{
              background: filter === 'closed' ? 'var(--bg-card)' : 'transparent',
              color: filter === 'closed' ? 'var(--text-main)' : 'var(--text-muted)',
              border: 'none',
              padding: '6px 14px',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: filter === 'closed' ? 700 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: filter === 'closed' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <span>Resolved History</span>
            <span
              style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 10,
                background: 'var(--border-subtle)',
                color: 'var(--text-muted)',
                fontWeight: 700,
              }}
            >
              {closedGrouped.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange('all')}
            style={{
              background: filter === 'all' ? 'var(--bg-card)' : 'transparent',
              color: filter === 'all' ? 'var(--text-main)' : 'var(--text-muted)',
              border: 'none',
              padding: '6px 14px',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: filter === 'all' ? 700 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: filter === 'all' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <span>All</span>
            <span
              style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 10,
                background: 'var(--border-subtle)',
                color: 'var(--text-muted)',
                fontWeight: 700,
              }}
            >
              {allGrouped.length}
            </span>
          </button>
        </div>
      </div>

      {/* Alert List */}
      <div
        className={scrollable ? 'alerts-scroll-6' : ''}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          ...(maxHeight ? { maxHeight, overflowY: 'auto', paddingRight: 4 } : {}),
        }}
      >
        {displayList.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: 48,
              color: 'var(--text-dim)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <CheckCircle size={32} color="#10b981" />
            <span style={{ fontSize: 14, fontWeight: 500 }}>
              {filter === 'open'
                ? 'No active open incidents. All monitored storage volumes healthy!'
                : filter === 'acknowledged'
                ? 'No currently acknowledged incidents.'
                : filter === 'closed'
                ? 'No resolved incidents in recent history.'
                : 'No alerts found across fleet.'}
            </span>
          </div>
        ) : (
          displayList.map((a) => {
            const isCrit = a.severity === 'critical';
            const isClosed = a.status === 'closed';
            const isAck = a.status === 'acknowledged';
            const count = a.occurrence_count || 1;

            return (
              <div
                key={a.id}
                onClick={() => onExplainAlert && onExplainAlert(a, false)}
                title="Click to view incident telemetry details"
                className={`alerts-panel-card ${
                  isClosed
                    ? 'status-closed'
                    : isAck
                    ? 'status-acknowledged'
                    : isCrit
                    ? 'status-critical'
                    : 'status-warning'
                }`}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  background: isClosed
                    ? 'var(--bg-subtle)'
                    : isAck
                    ? 'rgba(37, 99, 235, 0.04)'
                    : isCrit
                    ? 'rgba(219, 51, 46, 0.06)'
                    : 'rgba(237, 156, 26, 0.06)',
                  border: isClosed
                    ? '1px solid var(--border-subtle)'
                    : isAck
                    ? '1px solid rgba(37, 99, 235, 0.25)'
                    : `1px solid ${isCrit ? 'rgba(219, 51, 46, 0.25)' : 'rgba(237, 156, 26, 0.2)'}`,
                  borderLeft: `4px solid ${
                    isClosed
                      ? '#10b981'
                      : isAck
                      ? 'var(--chart-read)'
                      : isCrit
                      ? 'var(--alert-crit-border)'
                      : 'var(--alert-warn-border)'
                  }`,
                  borderRadius: 12,
                  gap: 16,
                  opacity: isClosed ? 0.85 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      padding: 8,
                      borderRadius: 8,
                      background: isClosed
                        ? 'rgba(16, 185, 129, 0.12)'
                        : isAck
                        ? 'rgba(37, 99, 235, 0.12)'
                        : isCrit
                        ? 'rgba(219, 51, 46, 0.12)'
                        : 'rgba(237, 156, 26, 0.12)',
                    }}
                  >
                    {isClosed ? (
                      <Check size={20} color="#10b981" />
                    ) : isAck ? (
                      <UserCheck size={20} color="var(--chart-read)" />
                    ) : isCrit ? (
                      <AlertCircle size={20} color="var(--alert-crit-border)" />
                    ) : (
                      <AlertTriangle size={20} color="var(--alert-warn-border)" />
                    )}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      {isClosed ? (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 10,
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981',
                            textTransform: 'uppercase',
                          }}
                        >
                          Resolved
                        </span>
                      ) : isAck ? (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 10,
                            background: 'rgba(37, 99, 235, 0.15)',
                            color: 'var(--chart-read)',
                            textTransform: 'uppercase',
                          }}
                        >
                          Acknowledged
                        </span>
                      ) : (
                        <span className={`badge ${isCrit ? 'badge-critical' : 'badge-warning'}`}>
                          {a.severity}
                        </span>
                      )}

                      {count > 1 && (
                        <span
                          className={`alert-count-badge ${isCrit && !isClosed ? 'critical' : ''}`}
                          title={`Repeated ${count} times`}
                        >
                          {count}x
                        </span>
                      )}

                      <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: 14 }}>
                        {a.message || `${a.type} incident`}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      <span>Host: <strong style={{ color: 'var(--text-main)' }}>{a.hostname}</strong></span>
                      {a.volume_mount && <span>Mount: <strong style={{ color: 'var(--text-main)' }}>{a.volume_mount}</strong></span>}

                      {/* Lifecycle Metadata */}
                      {isAck && (
                        <span style={{ color: 'var(--chart-read)' }}>
                          Acknowledged by: <strong>{a.acknowledged_by || 'Administrator'}</strong>
                          {a.acknowledged_at && (
                            <span style={{ opacity: 0.7, marginLeft: 4 }}>
                              ({formatRelativeAlertTime(a.acknowledged_at)})
                            </span>
                          )}
                        </span>
                      )}

                      {isClosed && (
                        <span style={{ color: '#10b981' }}>
                          Resolved by: <strong>{a.resolved_by || 'Administrator'}</strong>
                          {a.closed_at && (
                            <span style={{ opacity: 0.7, marginLeft: 4 }}>
                              ({formatRelativeAlertTime(a.closed_at)})
                            </span>
                          )}
                        </span>
                      )}

                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} />
                        <span>First: {formatLocalTime(a.opened_at)}</span>
                      </span>
                    </div>

                    {/* Resolution Note snippet if resolved */}
                    {isClosed && a.resolution_note && (
                      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>
                        Note: "{a.resolution_note}"
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Action 1: Open -> Acknowledge */}
                  {a.status === 'open' && (
                    <button
                      onClick={(e) => handleAcknowledgeClick(e, a)}
                      className="card-action-link"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '5px 10px',
                        borderRadius: 8,
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      title="Acknowledge this incident"
                    >
                      <UserCheck size={12} color="var(--chart-read)" />
                      Acknowledge
                    </button>
                  )}

                  {/* Action 2: Acknowledged -> Resolve Issue */}
                  {a.status === 'acknowledged' && (
                    <button
                      onClick={(e) => handleResolveModalOpen(e, a)}
                      className="card-action-link"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '5px 10px',
                        borderRadius: 8,
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      title="Resolve this incident with a resolution note"
                    >
                      <Check size={12} color="#10b981" />
                      Resolve Issue
                    </button>
                  )}

                  {/* Action: Explain with Gemini */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onExplainAlert) onExplainAlert(a, true);
                    }}
                    className="alert-explain-btn"
                    style={{ padding: '6px 12px', fontSize: 11 }}
                  >
                    <Sparkles size={13} />
                    Explain with Gemini
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* RESOLUTION MODAL */}
      {modalAlert && (
        <ResolveAlertModal
          alert={modalAlert}
          onClose={() => setModalAlert(null)}
          onResolved={handleAlertResolved}
        />
      )}
    </div>
  );
}
