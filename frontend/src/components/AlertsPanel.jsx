import React from 'react';
import { AlertTriangle, AlertCircle, Sparkles, Clock, CheckCircle } from 'lucide-react';

export default function AlertsPanel({ alerts = [], onExplainAlert }) {
  return (
    <div className="glass-panel" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>Storage Incidents & Alert Stream</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Deterministic threshold and rolling baseline alerts across monitored fleet</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {alerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-dim)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={28} color="#10b981" />
            <span>All monitored storage volumes operating within normal limits</span>
          </div>
        ) : (
          alerts.map((a) => {
            const isCrit = a.severity === 'critical';
            const isOpen = a.status === 'open';
            return (
              <div
                key={a.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  background: isCrit ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.06)',
                  border: `1px solid ${isCrit ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.2)'}`,
                  borderRadius: 12,
                  gap: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ padding: 8, borderRadius: 8, background: isCrit ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)' }}>
                    {isCrit ? <AlertCircle size={20} color="#f87171" /> : <AlertTriangle size={20} color="#fbbf24" />}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span className={`badge ${isCrit ? 'badge-critical' : 'badge-warning'}`}>
                        {a.severity}
                      </span>
                      <span style={{ fontWeight: 600, color: '#ffffff', fontSize: 14 }}>
                        {a.message || `${a.type} incident`}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: 'var(--text-muted)' }}>
                      <span>Host: <strong style={{ color: '#cbd5e1' }}>{a.hostname}</strong></span>
                      {a.volume_mount && <span>Mount: <strong style={{ color: '#cbd5e1' }}>{a.volume_mount}</strong></span>}
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} />
                        {new Date(a.opened_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => onExplainAlert(a)}
                    className="btn-explain"
                  >
                    <Sparkles size={14} />
                    Explain with Gemini
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
