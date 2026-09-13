import React, { useState, useEffect } from 'react';
import { Sun, Moon, Lock, Shield, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, UserCheck } from 'lucide-react';
import { fetchInviteInfo } from '../api';
import { useAuth } from '../auth/AuthProvider';
import { MacPulseLogo } from './SignInScreen';

export default function AcceptInviteScreen({ token, theme, toggleTheme, onCancel }) {
  const { acceptInvite } = useAuth();

  const [inviteInfo, setInviteInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [infoError, setInfoError] = useState(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoadingInfo(true);
    fetchInviteInfo(token)
      .then((data) => {
        if (!isMounted) return;
        if (data.valid) {
          setInviteInfo(data);
        } else {
          setInfoError(data.error || 'This invitation link is invalid or has already been accepted.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setInfoError(err.message || 'Failed to verify invitation link.');
      })
      .finally(() => {
        if (isMounted) setLoadingInfo(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError('Please enter a password.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setSubmitting(true);
    try {
      await acceptInvite({ inviteToken: token, password });
      // Remove query parameters from URL upon successful activation
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (err) {
      setError(err.message || 'Failed to activate your account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="dashboard-root"
      data-theme={theme}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '24px 16px',
        position: 'relative',
      }}
    >
      {/* Top Bar with Theme Toggle */}
      <div
        style={{
          position: 'absolute',
          top: 24,
          right: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={toggleTheme}
          className="theme-switch-btn"
          aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
        >
          <div className="theme-switch-thumb">
            {theme === 'dark' ? (
              <Moon className="switch-icon-moon" size={14} color="#0f172a" fill="#0f172a" />
            ) : (
              <Sun className="switch-icon-sun" size={15} color="#eab308" fill="#eab308" />
            )}
          </div>
        </button>
      </div>

      {/* Main Container */}
      <div
        className="card-container"
        style={{
          width: '100%',
          maxWidth: 460,
          padding: '40px 36px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 20,
          borderRadius: 20,
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
        }}
      >
        <MacPulseLogo size={48} />

        {loadingInfo ? (
          <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div className="animate-spin" style={{ width: 28, height: 28, border: '3px solid var(--border-subtle)', borderTopColor: 'var(--chart-read)', borderRadius: '50%' }} />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Verifying invitation…</span>
          </div>
        ) : infoError ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: '50%',
                background: 'rgba(219, 51, 46, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--alert-crit-border)',
              }}
            >
              <AlertCircle size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>
                Invitation Invalid or Expired
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {infoError}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="btn-primary"
              style={{ padding: '9px 20px', borderRadius: 10, fontSize: 13 }}
            >
              Go to Sign In
            </button>
          </div>
        ) : (
          /* VALID INVITATION FORM */
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '3px 10px',
                  borderRadius: 9999,
                  background: 'rgba(37, 99, 235, 0.1)',
                  color: 'var(--chart-read)',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: 8,
                }}
              >
                <UserCheck size={13} />
                <span>Administrator Invitation</span>
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                Welcome, {inviteInfo.name}!
              </h1>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
                You have been invited to join <strong>MacPulse</strong> as an Administrator.
              </p>
            </div>

            {/* Invitee Summary Card */}
            <div
              style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                padding: '12px 14px',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                fontSize: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>Account Email:</span>
                <strong style={{ color: 'var(--text-main)' }}>{inviteInfo.email}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>Assigned Role:</span>
                <span style={{ color: 'var(--chart-read)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Shield size={12} /> {inviteInfo.role}
                </span>
              </div>
            </div>

            {/* Password Creation Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' }}>
              {/* Password Field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label htmlFor="invite-password" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)' }}>
                  Create Your Password
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Lock size={15} color="var(--text-dim)" style={{ position: 'absolute', left: 12, pointerEvents: 'none' }} />
                  <input
                    id="invite-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Choose a secure password"
                    disabled={submitting}
                    autoComplete="new-password"
                    style={{
                      width: '100%',
                      padding: '10px 36px',
                      borderRadius: 10,
                      border: error ? '1px solid var(--alert-crit-border)' : '1px solid var(--border-subtle)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      background: 'transparent',
                      border: 'none',
                      padding: 4,
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                    }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label htmlFor="invite-confirm" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)' }}>
                  Confirm Password
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Lock size={15} color="var(--text-dim)" style={{ position: 'absolute', left: 12, pointerEvents: 'none' }} />
                  <input
                    id="invite-confirm"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Re-enter your password"
                    disabled={submitting}
                    autoComplete="new-password"
                    style={{
                      width: '100%',
                      padding: '10px 36px',
                      borderRadius: 10,
                      border: error ? '1px solid var(--alert-crit-border)' : '1px solid var(--border-subtle)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  Passwords must be at least 8 characters long (15+ recommended for Auth0).
                </span>
              </div>

              {/* Error Banner */}
              {error && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '10px 12px',
                    background: 'rgba(219, 51, 46, 0.08)',
                    border: '1px solid var(--alert-crit-border)',
                    borderRadius: 8,
                    color: 'var(--alert-crit-border)',
                    fontSize: 12,
                    lineHeight: 1.4,
                  }}
                >
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{error}</span>
                </div>
              )}

              {/* Primary Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary"
                style={{
                  width: '100%',
                  height: 42,
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 11,
                  justifyContent: 'center',
                  marginTop: 6,
                }}
              >
                {submitting ? (
                  <span>Activating Account…</span>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Accept Invitation & Access MacPulse</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
