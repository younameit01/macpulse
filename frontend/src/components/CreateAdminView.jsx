import React, { useState } from 'react';
import { UserPlus, Check, Copy, AlertCircle, ShieldAlert, CheckCircle, RefreshCw, ExternalLink, MailCheck, Shield, ShieldCheck, UserCheck } from 'lucide-react';
import { createAdminUser } from '../api';
import { useAuth } from '../auth/AuthProvider';

export default function CreateAdminView({ onBack }) {
  const { isSuperAdmin } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [createdAdmin, setCreatedAdmin] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Authorization Check: Only Super Admin can access
  if (!isSuperAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div
          className="card-container"
          style={{
            padding: '48px 36px',
            alignItems: 'center',
            textAlign: 'center',
            gap: 16,
            maxWidth: 580,
            margin: '40px auto 0',
          }}
        >
          <div
            style={{
              padding: 14,
              borderRadius: '50%',
              background: 'rgba(219, 51, 46, 0.12)',
              color: 'var(--alert-crit-border)',
            }}
          >
            <ShieldAlert size={32} />
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>
              403 · Not Authorized
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Only a <strong>Super Admin</strong> can create new administrator accounts for MacPulse.
            </p>
          </div>
          <button onClick={onBack} className="btn-primary" style={{ marginTop: 8 }}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const validate = () => {
    const errs = {};
    if (!name.trim()) {
      errs.name = 'Full Name is required.';
    }
    const emailTrim = email.trim();
    if (!emailTrim) {
      errs.email = 'Email Address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      errs.email = 'Please enter a valid email address.';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError(null);

    try {
      const data = await createAdminUser({
        name: name.trim(),
        email: email.trim(),
      });
      setCreatedAdmin(data);
    } catch (err) {
      const errMsg = err.message || '';
      if (errMsg.toLowerCase().includes('already exists') || errMsg.includes('409')) {
        setError('An account already exists for this email address.');
      } else {
        setError(errMsg || "We couldn't create this Admin account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const inviteUrl = createdAdmin?.setup_link || (
    typeof window !== 'undefined' && createdAdmin?.email
      ? `${window.location.origin}/?email=${encodeURIComponent(createdAdmin.email)}`
      : ''
  );

  const handleCopyLink = () => {
    if (!inviteUrl) return;
    const fallbackCopy = (text) => {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      } catch (e) {
        console.warn('Fallback copy failed', e);
      }
    };

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(inviteUrl)
        .then(() => {
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 2500);
        })
        .catch(() => {
          fallbackCopy(inviteUrl);
        });
    } else {
      fallbackCopy(inviteUrl);
    }
  };

  const handleResetForm = () => {
    setName('');
    setEmail('');
    setError(null);
    setFieldErrors({});
    setCreatedAdmin(null);
    setCopiedLink(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Main Container */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 640 }}>
          {/* SUCCESS STATE */}
          {createdAdmin ? (
            <div
              className="card-container"
              style={{
                padding: '36px 32px',
                display: 'flex',
                flexDirection: 'column',
                gap: 24,
                borderRadius: 18,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#10b981',
                    flexShrink: 0,
                  }}
                >
                  <CheckCircle size={24} />
                </div>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)' }}>
                    Admin Invitation Ready
                  </h2>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                    An administrator invitation link has been generated for <strong style={{ color: 'var(--text-main)' }}>{createdAdmin.name}</strong> ({createdAdmin.email}).
                  </p>
                </div>
              </div>

              {/* Information & Direct Access Card */}
              <div
                style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                {/* Notice: Invitation Onboarding */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <UserCheck size={18} color="var(--chart-read)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ fontSize: 13, color: 'var(--text-main)', lineHeight: 1.5 }}>
                    <strong>Dedicated Invitation Link:</strong> Share this link with {createdAdmin.name}. When opened, they will see a personalized welcome screen to establish their own password and activate their <strong>Admin</strong> access.
                  </div>
                </div>

                {/* Direct In-App Invitation Link */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      One-Time Invitation Link
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      Share with {createdAdmin.name}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="text"
                      readOnly
                      value={inviteUrl}
                      className="mono-text"
                      style={{
                        flex: 1,
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 8,
                        padding: '9px 12px',
                        fontSize: 12,
                        color: 'var(--text-main)',
                        outline: 'none',
                        textOverflow: 'ellipsis',
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="btn-primary"
                      style={{
                        padding: '9px 16px',
                        fontSize: 12,
                        borderRadius: 8,
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {copiedLink ? (
                        <>
                          <Check size={14} />
                          <span>Copied Link</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Copy Invitation Link</span>
                        </>
                      )}
                    </button>
                    <a
                      href={inviteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="card-action-link"
                      style={{
                        padding: '9px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 12,
                        textDecoration: 'none',
                      }}
                      title="Open invitation in new tab"
                    >
                      <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="card-action-link"
                  style={{
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    padding: '8px 18px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  Invite Another Admin
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="btn-primary"
                  style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13 }}
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          ) : (
            /* FORM STATE */
            <div
              className="card-container"
              style={{
                padding: '32px 36px',
                display: 'flex',
                flexDirection: 'column',
                gap: 24,
                borderRadius: 18,
              }}
            >
              {/* Header */}
              <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        background: 'var(--bg-subtle)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--chart-read)',
                      }}
                    >
                      <UserPlus size={22} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-main)' }}>
                        Create Admin
                      </h2>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                        Invite an administrator to monitor fleet metrics and resolve storage issues.
                      </p>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 9999,
                      background: 'rgba(37, 99, 235, 0.08)',
                      color: 'var(--chart-read)',
                      border: '1px solid var(--border-subtle)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <ShieldCheck size={13} />
                    <span>Authorized as Super Admin</span>
                  </span>
                </div>
              </div>

              {/* Top-Level Error Banner */}
              {error && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 16px',
                    background: 'rgba(219, 51, 46, 0.08)',
                    border: '1px solid var(--alert-crit-border)',
                    borderRadius: 10,
                    color: 'var(--alert-crit-border)',
                    fontSize: 13,
                  }}
                >
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Field: Full Name */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label
                    htmlFor="admin-full-name"
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-main)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>Full Name</span>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 400 }}>Required</span>
                  </label>
                  <input
                    id="admin-full-name"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (fieldErrors.name) {
                        setFieldErrors((prev) => ({ ...prev, name: null }));
                      }
                    }}
                    placeholder="e.g. Sarah Jenkins"
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: fieldErrors.name ? '1px solid var(--alert-crit-border)' : '1px solid var(--border-subtle)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      fontSize: 14,
                      outline: 'none',
                      transition: 'border-color 0.15s ease',
                      fontFamily: 'inherit',
                    }}
                  />
                  {fieldErrors.name && (
                    <span style={{ fontSize: 11, color: 'var(--alert-crit-border)' }}>{fieldErrors.name}</span>
                  )}
                </div>

                {/* Field: Email Address */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label
                    htmlFor="admin-email"
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-main)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>Email Address</span>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 400 }}>Required</span>
                  </label>
                  <input
                    id="admin-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) {
                        setFieldErrors((prev) => ({ ...prev, email: null }));
                      }
                    }}
                    placeholder="sarah@example.com"
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: fieldErrors.email ? '1px solid var(--alert-crit-border)' : '1px solid var(--border-subtle)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      fontSize: 14,
                      outline: 'none',
                      transition: 'border-color 0.15s ease',
                      fontFamily: 'inherit',
                    }}
                  />
                  {fieldErrors.email && (
                    <span style={{ fontSize: 11, color: 'var(--alert-crit-border)' }}>{fieldErrors.email}</span>
                  )}
                </div>

                {/* Field: Role Assignment (Explicit Admin designation) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-main)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>Role to Assign</span>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 400 }}>Fixed for invitations</span>
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Shield size={16} color="var(--chart-read)" />
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>Admin</span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Fleet monitoring, incident triage & alert resolution
                    </span>
                  </div>
                </div>

                {/* Automatic Role Assignment & Self Password Setup Explainer */}
                <div
                  style={{
                    padding: '14px 16px',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 10,
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    lineHeight: 1.45,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div>
                    <strong style={{ color: 'var(--text-main)' }}>Automatic Role Assignment:</strong> Accounts created through this console are granted the <strong>Admin</strong> role with fleet monitoring, Gemini incident explanations, and alert acknowledgement/resolution capabilities.
                  </div>
                  <div>
                    <strong style={{ color: 'var(--text-main)' }}>Self-Service Password Creation:</strong> An email with a secure link will be sent to the administrator so they can establish their own password.
                  </div>
                </div>

                {/* Actions Row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 12,
                    marginTop: 8,
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: 18,
                  }}
                >
                  <button
                    type="button"
                    onClick={onBack}
                    disabled={loading}
                    className="card-action-link"
                    style={{
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      padding: '9px 18px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary"
                    style={{
                      padding: '9px 24px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      minWidth: 140,
                      justifyContent: 'center',
                    }}
                  >
                    {loading ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Sending Invitation…</span>
                      </>
                    ) : (
                      <>
                        <UserPlus size={14} />
                        <span>Create Admin</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
