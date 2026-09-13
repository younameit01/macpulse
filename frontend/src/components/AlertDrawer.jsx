import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  ShieldAlert,
  Cpu,
  RefreshCw,
  Check,
  CheckCircle2,
  Clock,
  UserCheck,
  FileText,
} from 'lucide-react';
import { requestExplain, acknowledgeAlert, formatBps, formatBytes } from '../api';
import { formatRelativeAlertTime, formatLocalTime } from '../alertUtils';
import ResolveAlertModal from './ResolveAlertModal';

export default function AlertDrawer({ alert, autoExplain = false, onClose, onAlertUpdated }) {
  const [currentAlert, setCurrentAlert] = useState(alert);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);

  const [explanation, setExplanation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Stepped AI generation loader state
  const [loadStep, setLoadStep] = useState(0);

  // Progressive streaming text states
  const [streamedSummary, setStreamedSummary] = useState('');
  const [streamedInterpretation, setStreamedInterpretation] = useState('');
  const [visibleEvidenceCount, setVisibleEvidenceCount] = useState(0);
  const [visibleChecksCount, setVisibleChecksCount] = useState(0);
  const [showRisk, setShowRisk] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const isCrit = currentAlert?.severity === 'critical';
  const evidence = currentAlert?.evidence || {};
  const processAttr = evidence?.process_attribution || {};
  const count = currentAlert?.occurrence_count || 1;
  const latestTime = currentAlert?.last_seen_at || currentAlert?.opened_at;

  const isOpen = currentAlert?.status === 'open';
  const isAcknowledged = currentAlert?.status === 'acknowledged';
  const isResolved = currentAlert?.status === 'closed';

  const handleAcknowledge = async () => {
    if (!currentAlert?.id) return;
    setAcknowledging(true);
    try {
      const updated = await acknowledgeAlert(currentAlert.id);
      setCurrentAlert(updated);
      if (onAlertUpdated) {
        onAlertUpdated(updated);
      }
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    } finally {
      setAcknowledging(false);
    }
  };

  const handleExplain = async (force = false) => {
    if (!currentAlert?.id) return;
    setLoading(true);
    setError(null);
    setExplanation(null);
    try {
      const data = await requestExplain(currentAlert.id, force);
      setExplanation(data);
    } catch (err) {
      setError(err.message || 'Failed to generate explanation');
    } finally {
      setLoading(false);
    }
  };

  // Trigger AI explanation only if autoExplain is explicitly true
  useEffect(() => {
    setCurrentAlert(alert);
    setExplanation(null);
    setError(null);
    setLoading(false);
    if (alert?.id && (autoExplain || alert?.autoExplain)) {
      handleExplain(false);
    }
  }, [alert?.id, autoExplain, alert?.autoExplain]);

  // Stepped loader progress transitions
  useEffect(() => {
    if (!loading) {
      setLoadStep(0);
      return;
    }
    const t1 = setTimeout(() => setLoadStep(1), 1100);
    const t2 = setTimeout(() => setLoadStep(2), 2400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [loading]);

  // Progressive streaming typewriter effect
  useEffect(() => {
    if (!explanation) {
      setStreamedSummary('');
      setStreamedInterpretation('');
      setVisibleEvidenceCount(0);
      setVisibleChecksCount(0);
      setShowRisk(false);
      setIsStreaming(false);
      return;
    }

    setIsStreaming(true);
    let isCancelled = false;

    const summaryText = explanation.summary || '';
    const interpretationText = explanation.likely_interpretation || '';
    const evidenceItems = explanation.evidence || [];
    const checkItems = explanation.recommended_checks || [];

    let summaryIdx = 0;
    const streamSummary = () => {
      if (isCancelled) return;
      if (summaryIdx < summaryText.length) {
        summaryIdx = Math.min(summaryText.length, summaryIdx + 3);
        setStreamedSummary(summaryText.slice(0, summaryIdx));
        setTimeout(streamSummary, 16);
      } else {
        streamEvidence(0);
      }
    };

    const streamEvidence = (idx) => {
      if (isCancelled) return;
      if (idx <= evidenceItems.length) {
        setVisibleEvidenceCount(idx);
        setTimeout(() => streamEvidence(idx + 1), 120);
      } else {
        streamInterpretation();
      }
    };

    let interpIdx = 0;
    const streamInterpretation = () => {
      if (isCancelled) return;
      if (interpIdx < interpretationText.length) {
        interpIdx = Math.min(interpretationText.length, interpIdx + 3);
        setStreamedInterpretation(interpretationText.slice(0, interpIdx));
        setTimeout(streamInterpretation, 16);
      } else {
        streamChecks(0);
      }
    };

    const streamChecks = (idx) => {
      if (isCancelled) return;
      if (idx <= checkItems.length) {
        setVisibleChecksCount(idx);
        setTimeout(() => streamChecks(idx + 1), 120);
      } else {
        setShowRisk(true);
        setIsStreaming(false);
      }
    };

    streamSummary();

    return () => {
      isCancelled = true;
    };
  }, [explanation]);

  if (!currentAlert) return null;

  // Build History Timeline

  const historyList =
    currentAlert.history && currentAlert.history.length > 0
      ? currentAlert.history
      : [
          {
            event: 'Alert generated',
            timestamp: currentAlert.opened_at,
            actor: 'MacPulse Telemetry Engine',
          },
          ...(currentAlert.acknowledged_at
            ? [
                {
                  event: `Acknowledged by ${currentAlert.acknowledged_by || 'Administrator'}`,
                  timestamp: currentAlert.acknowledged_at,
                  actor: currentAlert.acknowledged_by,
                },
              ]
            : []),
          ...(currentAlert.closed_at
            ? [
                {
                  event: `Resolved by ${currentAlert.resolved_by || 'Administrator'}`,
                  timestamp: currentAlert.closed_at,
                  actor: currentAlert.resolved_by,
                  note: currentAlert.resolution_note,
                },
              ]
            : []),
        ];

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose}>
        <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  padding: 8,
                  borderRadius: 8,
                  background: isResolved
                    ? 'rgba(16, 185, 129, 0.15)'
                    : isCrit
                    ? 'rgba(219, 51, 46, 0.15)'
                    : 'rgba(237, 156, 26, 0.15)',
                }}
              >
                {isResolved ? (
                  <Check size={22} color="#10b981" />
                ) : isCrit ? (
                  <AlertCircle size={22} color="var(--alert-crit-border)" />
                ) : (
                  <AlertTriangle size={22} color="var(--alert-warn-border)" />
                )}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)' }}>
                    Incident Evidence & Explanation
                  </h2>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 9999,
                      background: isResolved
                        ? 'rgba(16, 185, 129, 0.15)'
                        : isAcknowledged
                        ? 'rgba(37, 99, 235, 0.15)'
                        : isCrit
                        ? 'rgba(219, 51, 46, 0.15)'
                        : 'rgba(237, 156, 26, 0.15)',
                      color: isResolved
                        ? '#10b981'
                        : isAcknowledged
                        ? 'var(--chart-read)'
                        : isCrit
                        ? 'var(--alert-crit-border)'
                        : 'var(--alert-warn-border)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {isResolved ? 'Resolved' : isAcknowledged ? 'Acknowledged' : 'Open'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>ID: {currentAlert.id}</div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
              aria-label="Close drawer"
            >
              <X size={20} />
            </button>
          </div>

          {/* SECTION 1: MEASURED FACTS (Always first) */}
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 10,
              }}
            >
              1. Measured Telemetry Facts
            </div>
            <div
              style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 14,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Target Host</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>{currentAlert.hostname}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Affected Mount</div>
                  <div className="mono-text" style={{ fontSize: 12, color: 'var(--chart-read)' }}>
                    {currentAlert.volume_mount || 'System Wide'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Triggered Rule</div>
                  <div className="mono-text" style={{ fontSize: 12, color: 'var(--alert-warn-text)' }}>
                    {evidence.rule || currentAlert.type}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Severity Level</div>
                  <span className={`badge ${isCrit ? 'badge-critical' : 'badge-warning'}`}>{currentAlert.severity}</span>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Occurrence Count</div>
                  <div style={{ marginTop: 2 }}>
                    <span className={`alert-count-badge ${isCrit ? 'critical' : ''}`}>
                      {count}x event{count > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Latest Detected Time</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)', marginTop: 2 }}>
                    {formatLocalTime(latestTime)}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 5 }}>
                      ({formatRelativeAlertTime(latestTime)})
                    </span>
                  </div>
                  {count > 1 && (
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                      First seen: {formatLocalTime(currentAlert.opened_at)}
                    </div>
                  )}
                </div>
              </div>

              {/* Capacity specifics */}
              {evidence.used_pct !== undefined && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
                    Observed Utilization vs Threshold
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-main)' }}>
                    <strong>{evidence.used_pct}% utilized</strong> (Rule threshold: {evidence.threshold_pct}%)
                    <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                      ({formatBytes(evidence.used_bytes)} / {formatBytes(evidence.total_bytes)})
                    </span>
                  </div>
                </div>
              )}

              {/* Write Rate specifics */}
              {evidence.current_write_bps !== undefined && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
                    Throughput Spike vs Baseline
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-main)' }}>
                    Current rate: <strong style={{ color: 'var(--alert-crit-border)' }}>{formatBps(evidence.current_write_bps)}</strong>
                    <span style={{ color: 'var(--text-dim)', margin: '0 8px' }}>vs</span>
                    Baseline: <strong>{formatBps(evidence.baseline_write_bps)}</strong> ({evidence.spike_multiplier}x multiplier)
                  </div>
                </div>
              )}

              {/* Process attribution */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
                  <Cpu size={12} />
                  <span>Process Attribution Confidence</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    className="mono-text"
                    style={{ fontSize: 12, color: processAttr.process ? 'var(--text-main)' : 'var(--text-dim)' }}
                  >
                    Process: {processAttr.process || 'Unavailable'} {processAttr.pid ? `(PID: ${processAttr.pid})` : ''}
                  </span>
                  <span className="badge" style={{ background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 10 }}>
                    {processAttr.confidence || (processAttr.process ? 'Process observed' : 'Unavailable')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* LIFECYCLE AUDIT TRAIL & HISTORY */}
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 10,
              }}
            >
              Incident Lifecycle & Audit Trail
            </div>
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 14,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              {/* Status banner */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isResolved ? (
                    <CheckCircle2 size={16} color="#10b981" />
                  ) : isAcknowledged ? (
                    <UserCheck size={16} color="var(--chart-read)" />
                  ) : (
                    <AlertCircle size={16} color="var(--alert-warn-border)" />
                  )}
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
                    Status: {isResolved ? 'Resolved' : isAcknowledged ? 'Acknowledged' : 'Open'}
                  </span>
                </div>

                {isAcknowledged && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Acknowledged by <strong>{currentAlert.acknowledged_by || 'Administrator'}</strong>
                  </span>
                )}
                {isResolved && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Resolved by <strong>{currentAlert.resolved_by || 'Administrator'}</strong>
                  </span>
                )}
              </div>

              {/* Resolved Note Audit Display */}
              {isResolved && currentAlert.resolution_note && (
                <div
                  style={{
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 10,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                    <FileText size={12} />
                    <span>Resolution Note (Audit Trail)</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-main)', lineHeight: 1.4, fontStyle: 'italic' }}>
                    "{currentAlert.resolution_note}"
                  </p>
                </div>
              )}

              {/* Sequential Event History Timeline */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={12} />
                  <span>Event Timeline</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {historyList.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 8,
                        fontSize: 12,
                        color: 'var(--text-muted)',
                      }}
                    >
                      <span className="mono-text" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-main)', minWidth: 64 }}>
                        {formatLocalTime(item.timestamp)}
                      </span>
                      <span>—</span>
                      <span style={{ color: 'var(--text-main)' }}>{item.event}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: TRIGGER ACTIONS */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              background: 'var(--bg-subtle)',
              borderRadius: 14,
              border: '1px solid var(--border-subtle)',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>Incident Actions</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {isOpen && 'Acknowledge alert to assign ownership and signal active investigation'}
                {isAcknowledged && 'Resolve issue with an audit note once mitigated'}
                {isResolved && 'Incident resolved. Historical telemetry and audit trail preserved'}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* ACTION: OPEN -> ACKNOWLEDGE */}
              {isOpen && (
                <button
                  onClick={handleAcknowledge}
                  disabled={acknowledging}
                  className="card-action-link"
                  style={{
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    padding: '7px 14px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                  }}
                >
                  <UserCheck size={13} color="var(--chart-read)" />
                  {acknowledging ? 'Acknowledging…' : 'Acknowledge'}
                </button>
              )}

              {/* ACTION: ACKNOWLEDGED -> RESOLVE ISSUE */}
              {isAcknowledged && (
                <button
                  onClick={() => setShowResolveModal(true)}
                  className="card-action-link"
                  style={{
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    padding: '7px 14px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                  }}
                >
                  <Check size={13} color="#10b981" />
                  Resolve Issue
                </button>
              )}

              {/* RESOLVED BADGE */}
              {isResolved && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 12px',
                    borderRadius: 8,
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: '#10b981',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <Check size={14} /> Resolved
                </span>
              )}
            </div>
          </div>

          {/* GLOWING AI LOADER */}
          {loading && !explanation && (
            <div className="ai-loader-box">
              <div className="ai-orb-outer">
                <div className="ai-orb-ring" />
                <div className="ai-orb-center">
                  <Sparkles size={22} color="#3b82f6" />
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>
                  {loadStep === 0 && 'Extracting & Sanitizing Incident Evidence...'}
                  {loadStep === 1 && 'Querying Gemini AI for Storage Root-Cause...'}
                  {loadStep >= 2 && 'Synthesizing Diagnostics & Mitigation Steps...'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Comparing telemetry spikes against rolling baseline distributions
                </div>
              </div>

              {/* Shimmer Placeholder Bars */}
              <div className="ai-shimmer-container">
                <div className="ai-shimmer-line" style={{ width: '85%' }} />
                <div className="ai-shimmer-line" style={{ width: '95%' }} />
                <div className="ai-shimmer-line" style={{ width: '70%' }} />
              </div>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: 12,
                background: 'rgba(219, 51, 46, 0.1)',
                border: '1px solid var(--alert-crit-border)',
                borderRadius: 8,
                color: 'var(--alert-crit-border)',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {/* SECTION 3: ON-DEMAND GEMINI EXPLANATION PROMPT */}
          {!loading && !explanation && !error && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: 12,
                background: 'var(--bg-card)',
                border: '1px dashed var(--border-subtle)',
                borderRadius: 14,
                padding: '24px 20px',
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  background: 'var(--bg-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={20} color="var(--chart-read)" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>
                  AI Root-Cause Diagnostics
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 360, margin: '0 auto', lineHeight: 1.5 }}>
                  Correlate measured telemetry, process attribution, and baseline distributions with Gemini AI to generate a structured root-cause analysis and remediation plan.
                </p>
              </div>
              <button
                onClick={() => handleExplain(true)}
                className="alert-explain-btn"
                style={{ padding: '8px 18px', fontSize: 12 }}
              >
                <Sparkles size={13} />
                Explain with Gemini
              </button>
            </div>
          )}

          {/* SECTION 3: GEMINI EXPLANATION RESULT WITH STREAMING */}
          {explanation && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 14,
                padding: 18,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>
                  <Sparkles size={16} color="var(--chart-read)" />
                  <span>Gemini Explanation</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge" style={{ background: 'var(--bg-subtle)', color: 'var(--text-main)', fontSize: 11 }}>
                    Model: {explanation.model}
                  </span>
                  <button
                    onClick={() => handleExplain(true)}
                    disabled={loading}
                    className="card-action-link"
                    title="Re-run Gemini AI root-cause analysis with latest telemetry"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      padding: '3px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-subtle)',
                      color: 'var(--text-muted)',
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                    <span>{loading ? 'Analyzing…' : 'Re-analyze'}</span>
                  </button>
                </div>
              </div>

              {/* Summary (Streamed) */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Summary
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-main)', lineHeight: 1.5 }}>
                  {streamedSummary}
                  {isStreaming && streamedSummary.length < (explanation.summary || '').length && (
                    <span className="ai-cursor" />
                  )}
                </p>
              </div>

              {/* Measured Evidence (Sequential Fade) */}
              {explanation.evidence && explanation.evidence.length > 0 && visibleEvidenceCount > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Measured Evidence
                  </div>
                  <ul style={{ paddingLeft: 18, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {explanation.evidence.slice(0, visibleEvidenceCount).map((item, idx) => (
                      <li key={idx} style={{ animation: 'fadeIn 0.25s ease forwards' }}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Likely Interpretation (Streamed) */}
              {(streamedInterpretation.length > 0 || visibleEvidenceCount >= (explanation.evidence || []).length) && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Likely Interpretation
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-main)', lineHeight: 1.5 }}>
                    {streamedInterpretation}
                    {isStreaming && streamedInterpretation.length < (explanation.likely_interpretation || '').length && (
                      <span className="ai-cursor" />
                    )}
                  </p>
                </div>
              )}

              {/* Recommended Checks (Sequential Fade) */}
              {explanation.recommended_checks && explanation.recommended_checks.length > 0 && visibleChecksCount > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Recommended Administrator Checks
                  </div>
                  <ol style={{ paddingLeft: 18, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {explanation.recommended_checks.slice(0, visibleChecksCount).map((check, idx) => (
                      <li key={idx} style={{ marginBottom: 4, animation: 'fadeIn 0.25s ease forwards' }}>{check}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Risk */}
              {explanation.risk && showRisk && (
                <div
                  style={{
                    padding: 12,
                    background: 'rgba(219, 51, 46, 0.08)',
                    borderRadius: 10,
                    border: '1px solid var(--alert-crit-border)',
                    animation: 'fadeIn 0.3s ease forwards',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--alert-crit-border)',
                      textTransform: 'uppercase',
                      marginBottom: 4,
                    }}
                  >
                    <ShieldAlert size={14} />
                    <span>Potential Risk</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-main)', lineHeight: 1.4 }}>{explanation.risk}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RESOLVE MODAL */}
      {showResolveModal && (
        <ResolveAlertModal
          alert={currentAlert}
          onClose={() => setShowResolveModal(false)}
          onResolved={(updated) => {
            setCurrentAlert(updated);
            setShowResolveModal(false);
            if (onAlertUpdated) {
              onAlertUpdated(updated);
            }
          }}
        />
      )}
    </>
  );
}
