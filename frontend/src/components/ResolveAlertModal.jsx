import React, { useState } from 'react';
import { X, Check, AlertCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { resolveAlert } from '../api';

export default function ResolveAlertModal({ alert, onClose, onResolved }) {
  const [resolutionNote, setResolutionNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!alert) return null;

  const isCrit = alert.severity === 'critical';
  const evidence = alert.evidence || {};

  const handleSubmit = async (e) => {
    e.preventDefault();
    const noteTrim = resolutionNote.trim();
    if (!noteTrim) {
      setError('A resolution note is required to close this incident.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const updated = await resolveAlert(alert.id, noteTrim);
      if (onResolved) {
        onResolved(updated);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to resolve alert.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div
        className="card-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 540,
          margin: 'auto',
          padding: '28px 32px',
          borderRadius: 18,
          boxShadow: 'var(--shadow-drawer)',
          animation: 'fadeIn 0.2s ease',
          gap: 20,
        }}
      >
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
                background: isCrit ? 'rgba(219, 51, 46, 0.15)' : 'rgba(237, 156, 26, 0.15)',
              }}
            >
              {isCrit ? (
                <AlertCircle size={20} color="var(--alert-crit-border)" />
              ) : (
                <AlertTriangle size={20} color="var(--alert-warn-border)" />
              )}
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)' }}>
                Resolve Alert
              </h2>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>ID: {alert.id}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Alert Context Summary */}
        <div
          style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: 14,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            fontSize: 12,
          }}
        >
          <div>
            <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>Target Host:</span>
            <div style={{ fontWeight: 600, color: 'var(--text-main)', marginTop: 2 }}>{alert.hostname}</div>
          </div>
          <div>
            <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>Mount Point:</span>
            <div className="mono-text" style={{ fontSize: 11, color: 'var(--chart-read)', marginTop: 2 }}>
              {alert.volume_mount || 'System Wide'}
            </div>
          </div>
          <div>
            <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>Rule Triggered:</span>
            <div style={{ fontWeight: 600, color: 'var(--text-main)', marginTop: 2 }}>
              {evidence.rule || alert.type}
            </div>
          </div>
          <div>
            <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>Severity:</span>
            <div style={{ marginTop: 2 }}>
              <span className={`badge ${isCrit ? 'badge-critical' : 'badge-warning'}`}>{alert.severity}</span>
            </div>
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div
            style={{
              padding: '10px 14px',
              background: 'rgba(219, 51, 46, 0.1)',
              border: '1px solid var(--alert-crit-border)',
              borderRadius: 8,
              color: 'var(--alert-crit-border)',
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              htmlFor="resolution-note"
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-main)',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>Resolution Note</span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 400 }}>Required for audit trail</span>
            </label>
            <textarea
              id="resolution-note"
              rows={4}
              value={resolutionNote}
              onChange={(e) => {
                setResolutionNote(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Describe what was done to resolve or investigate this issue…"
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-card)',
                color: 'var(--text-main)',
                fontSize: 13,
                outline: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.4,
                resize: 'vertical',
              }}
            />
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 16,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="card-action-link"
              style={{
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-card)',
                color: 'var(--text-main)',
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !resolutionNote.trim()}
              className="btn-primary"
              style={{
                padding: '8px 18px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                background: '#10b981',
                opacity: !resolutionNote.trim() ? 0.6 : 1,
                cursor: !resolutionNote.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Resolving Alert…</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Resolve Alert</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
