import React, { useState } from 'react';
import { X, Sparkles, AlertCircle, AlertTriangle, CheckCircle2, ShieldAlert, Cpu, HardDrive, RefreshCw } from 'lucide-react';
import { requestExplain, formatBps, formatBytes } from '../api';

export default function AlertDrawer({ alert, onClose }) {
  const [explanation, setExplanation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!alert) return null;

  const isCrit = alert.severity === 'critical';
  const evidence = alert.evidence || {};
  const processAttr = evidence.process_attribution || {};

  const handleExplain = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await requestExplain(alert.id);
      setExplanation(data);
    } catch (err) {
      setError(err.message || 'Failed to generate explanation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: 8, borderRadius: 8, background: isCrit ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)' }}>
              {isCrit ? <AlertCircle size={22} color="#f87171" /> : <AlertTriangle size={22} color="#fbbf24" />}
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#ffffff' }}>Incident Evidence & Explanation</h2>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>ID: {alert.id}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* SECTION 1: MEASURED FACTS (Always before AI text per Section 9.4) */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            1. Measured Telemetry Facts
          </div>
          <div style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Target Host</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>{alert.hostname}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Affected Mount</div>
                <div className="mono-text" style={{ fontSize: 13, color: '#60a5fa' }}>{alert.volume_mount || 'System Wide'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Triggered Rule</div>
                <div className="mono-text" style={{ fontSize: 12, color: '#fbbf24' }}>{evidence.rule || alert.type}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Severity Level</div>
                <span className={`badge ${isCrit ? 'badge-critical' : 'badge-warning'}`}>{alert.severity}</span>
              </div>
            </div>

            {/* Capacity specifics */}
            {evidence.used_pct !== undefined && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Observed Utilization vs Threshold</div>
                <div style={{ fontSize: 13, color: '#ffffff' }}>
                  <strong>{evidence.used_pct}% utilized</strong> (Rule threshold: {evidence.threshold_pct}%)
                  <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                    ({formatBytes(evidence.used_bytes)} / {formatBytes(evidence.total_bytes)})
                  </span>
                </div>
              </div>
            )}

            {/* Write Rate specifics */}
            {evidence.current_write_bps !== undefined && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Throughput Spike vs Baseline</div>
                <div style={{ fontSize: 13, color: '#ffffff' }}>
                  Current rate: <strong style={{ color: '#f87171' }}>{formatBps(evidence.current_write_bps)}</strong>
                  <span style={{ color: 'var(--text-dim)', margin: '0 8px' }}>vs</span>
                  Baseline: <strong>{formatBps(evidence.baseline_write_bps)}</strong> ({evidence.spike_multiplier}x multiplier)
                </div>
              </div>
            )}

            {/* Process attribution */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
                <Cpu size={12} />
                <span>Process Attribution Confidence</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="mono-text" style={{ fontSize: 13, color: processAttr.process ? '#a78bfa' : 'var(--text-dim)' }}>
                  Process: {processAttr.process || 'Unavailable'} {processAttr.pid ? `(PID: ${processAttr.pid})` : ''}
                </span>
                <span className="badge badge-apfs" style={{ fontSize: 10 }}>
                  {processAttr.confidence || (processAttr.process ? 'Process observed' : 'Unavailable')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: TRIGGER EXPLAIN */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: 'rgba(139, 92, 246, 0.08)', borderRadius: 12, border: '1px solid rgba(139, 92, 246, 0.2)' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>Request AI Root-Cause Explanation</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Analyzes sanitized telemetry metrics without inspecting file contents</div>
          </div>
          <button
            onClick={handleExplain}
            disabled={loading}
            className="btn-explain"
            style={{ padding: '8px 18px', fontSize: 13 }}
          >
            {loading ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                {explanation ? 'Re-Explain' : 'Explain Incident'}
              </>
            )}
          </button>
        </div>

        {error && (
          <div style={{ padding: 12, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, color: '#f87171', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* SECTION 3: GEMINI EXPLANATION RESULT */}
        {explanation && (
          <div className="ai-explain-card">
            <div className="ai-header">
              <div className="ai-badge">
                <Sparkles size={16} />
                <span>Gemini Root-Cause Explanation</span>
              </div>
              <span className="badge badge-apfs" style={{ fontSize: 11 }}>
                Model: {explanation.model} ({explanation.status})
              </span>
            </div>

            {/* Summary */}
            <div>
              <div className="ai-section-title">Summary</div>
              <p className="ai-summary">{explanation.summary}</p>
            </div>

            {/* Measured Evidence */}
            {explanation.evidence && explanation.evidence.length > 0 && (
              <div>
                <div className="ai-section-title">Measured Evidence</div>
                <ul className="ai-bullet-list">
                  {explanation.evidence.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Likely Interpretation */}
            <div>
              <div className="ai-section-title">Likely Interpretation</div>
              <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5 }}>
                {explanation.likely_interpretation}
              </p>
            </div>

            {/* Recommended Checks */}
            {explanation.recommended_checks && explanation.recommended_checks.length > 0 && (
              <div>
                <div className="ai-section-title">Recommended Administrator Checks</div>
                <ol className="ai-bullet-list" style={{ listStyleType: 'decimal' }}>
                  {explanation.recommended_checks.map((check, idx) => (
                    <li key={idx} style={{ marginBottom: 4 }}>{check}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Risk */}
            {explanation.risk && (
              <div style={{ padding: 12, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', marginBottom: 4 }}>
                  <ShieldAlert size={14} />
                  <span>Potential Risk</span>
                </div>
                <p style={{ fontSize: 12, color: '#fca5a5', lineHeight: 1.4 }}>{explanation.risk}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
