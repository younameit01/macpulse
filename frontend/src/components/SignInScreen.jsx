import React, { useState } from 'react';
import {
  Sun,
  Moon,
  AlertTriangle,
  Lock,
  Mail,
  Eye,
  EyeOff,
  LogIn,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import MacPulseBackground from './MacPulseBackground';

export function MacPulseLogo({ size = 44 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: 'linear-gradient(135deg, #1e3a8a, #2563eb, #38bdf8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(37, 99, 235, 0.35)',
        flexShrink: 0,
      }}
    >
      <svg
        width={size * 0.58}
        height={size * 0.58}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    </div>
  );
}

// Alias for backwards compatibility
export const MacAiLogo = MacPulseLogo;

export function AuthLoadingScreen() {
  return (
    <div
      className="dashboard-root"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: 20,
      }}
    >
      <div
        className="card-container"
        style={{
          width: '100%',
          maxWidth: 420,
          padding: '48px 36px',
          alignItems: 'center',
          textAlign: 'center',
          gap: 20,
        }}
      >
        <div className="ai-orb-outer">
          <div className="ai-orb-ring" />
          <div className="ai-orb-center">
            <MacPulseLogo size={36} />
          </div>
        </div>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>
            Securing your workspace…
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Verifying cryptographic token and role credentials
          </p>
        </div>
        <div className="ai-shimmer-container" style={{ width: '80%', marginTop: 8 }}>
          <div className="ai-shimmer-line" style={{ width: '100%' }} />
          <div className="ai-shimmer-line" style={{ width: '70%' }} />
        </div>
      </div>
    </div>
  );
}

export default function SignInScreen({ theme, toggleTheme }) {
  const { login, isLoading: authLoading } = useAuth();

  const [email, setEmail] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('email') || '';
    }
    return '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const emailTrim = email.trim();
    if (!emailTrim) {
      setError('Please enter your administrator email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      await login({ email: emailTrim, password });
    } catch (err) {
      setError(err.message || 'Invalid email or password. Please verify your credentials and try again.');
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
        overflow: 'hidden',
      }}
    >
      {/* Three.js 3D Animated Hero Background */}
      <MacPulseBackground theme={theme} />

      {/* Top Bar with Theme Toggle */}
      <div
        style={{
          position: 'absolute',
          top: 24,
          right: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          zIndex: 10,
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

      {/* Centered Symmetrical Authentication Card */}
      <div
        className="card-container"
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: 440,
          padding: '40px 36px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 22,
          borderRadius: 20,
          background: theme === 'dark' ? 'rgba(17, 28, 53, 0.76)' : 'rgba(255, 255, 255, 0.82)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: theme === 'dark' ? '1px solid rgba(56, 189, 248, 0.22)' : '1px solid rgba(215, 226, 242, 0.85)',
          boxShadow: theme === 'dark'
            ? '0 24px 60px rgba(0, 0, 0, 0.5), 0 0 32px rgba(37, 99, 235, 0.12)'
            : '0 16px 40px rgba(30, 58, 138, 0.09), 0 2px 10px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* Brand Logo & Title */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <MacPulseLogo size={48} />
          <div>
            <h1
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: 'var(--text-main)',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              MacPulse
            </h1>
            <p
              style={{
                fontSize: 13,
                color: 'var(--text-muted)',
                marginTop: 6,
                lineHeight: 1.5,
                maxWidth: 340,
              }}
            >
              Monitor, investigate, and resolve I/O issues across your Mac infrastructure.
            </p>
          </div>
        </div>

        {/* Sign In Form */}
        <form
          onSubmit={handleSubmit}
          style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 15, textAlign: 'left' }}
        >
          {/* Email Field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label
              htmlFor="auth-email"
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)' }}
            >
              Email Address
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Mail
                size={15}
                color="var(--text-dim)"
                style={{ position: 'absolute', left: 12, pointerEvents: 'none' }}
              />
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="admin@organization.com"
                disabled={submitting}
                autoComplete="email"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: 10,
                  border: error ? '1px solid var(--alert-crit-border)' : '1px solid var(--border-subtle)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontSize: 13,
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>

          {/* Password Field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label
              htmlFor="auth-password"
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)' }}
            >
              Password
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock
                size={15}
                color="var(--text-dim)"
                style={{ position: 'absolute', left: 12, pointerEvents: 'none' }}
              />
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter your password"
                disabled={submitting}
                autoComplete="current-password"
                style={{
                  width: '100%',
                  padding: '10px 36px 10px 36px',
                  borderRadius: 10,
                  border: error ? '1px solid var(--alert-crit-border)' : '1px solid var(--border-subtle)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontSize: 13,
                  outline: 'none',
                  fontFamily: 'inherit',
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
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Inline Error Message Banner (Positioned directly below password field on the same page) */}
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '11px 13px',
                background: 'rgba(219, 51, 46, 0.08)',
                border: '1px solid var(--alert-crit-border)',
                borderRadius: 10,
                color: 'var(--alert-crit-border)',
                fontSize: 12,
                lineHeight: 1.45,
                textAlign: 'left',
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ whiteSpace: 'pre-line' }}>{error}</span>
            </div>
          )}

          {/* Primary CTA */}
          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="submit"
              disabled={submitting || authLoading}
              className="btn-primary"
              style={{
                width: '100%',
                height: 42,
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 11,
                justifyContent: 'center',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.85 : 1,
              }}
            >
              {submitting ? (
                <span>Signing In…</span>
              ) : (
                <>
                  <LogIn size={15} />
                  <span>Sign In</span>
                </>
              )}
            </button>

            <span style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
              Authorized administrators only.
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
