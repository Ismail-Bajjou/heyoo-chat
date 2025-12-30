import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTheme } from '../context/useTheme';
import '../styles/Login.css';

const passwordRules = 'At least 8 characters, 1 uppercase, 1 number';

const LoginPage = ({ onLogin, onRegister }) => {
  const theme = useTheme();
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const validatePassword = (val) => {
    const hasLength = val.length >= 8;
    const hasUpper = /[A-Z]/.test(val);
    const hasNumber = /\d/.test(val);
    return hasLength && hasUpper && hasNumber;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) return setError('Email is required');
    if (!password) return setError('Password is required');

    if (mode === 'register') {
      if (!username.trim()) return setError('Username is required');
      if (!validatePassword(password)) return setError(passwordRules);
      if (password !== confirm) return setError('Passwords do not match');
    }

    setLoading(true);
    const action = mode === 'login' ? onLogin : onRegister;
    const payload = mode === 'login' ? { email, password } : { email, password, username };
    const result = await action(payload);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: theme.colors.background
    }}>
      <div style={{
        padding: '2rem',
        borderRadius: '1rem',
        backgroundColor: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{
          textAlign: 'center',
          background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: '2rem'
        }}>
          💬 Heyoo
        </h1>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              color: theme.colors.text,
              fontWeight: '500'
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              placeholder="Enter your email"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                border: error ? `2px solid #ef4444` : `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                fontSize: '1rem',
                outline: 'none'
              }}
            />
          </div>

          {mode === 'register' && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                color: theme.colors.text,
                fontWeight: '500'
              }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(''); }}
                placeholder="Choose a username"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  border: error ? `2px solid #ef4444` : `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  fontSize: '1rem',
                  outline: 'none'
                }}
              />
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              color: theme.colors.text,
              fontWeight: '500'
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                placeholder="Enter your password"
                style={{
                  width: '100%',
                  padding: '0.75rem 2.5rem 0.75rem 1rem',
                  borderRadius: '0.5rem',
                  border: error ? `2px solid #ef4444` : `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  fontSize: '1rem',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: theme.colors.text,
                  opacity: 0.6,
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {mode === 'register' && passwordFocused && (
              <div style={{
                marginTop: '0.5rem',
                padding: '0.5rem',
                backgroundColor: theme.colors.surface,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '0.5rem',
                fontSize: '0.875rem'
              }}>
                <p style={{ margin: '0.25rem 0', color: password.length >= 8 ? '#10b981' : '#ef4444' }}>
                  {password.length >= 8 ? '✓' : '✗'} At least 8 characters
                </p>
                <p style={{ margin: '0.25rem 0', color: /[A-Z]/.test(password) ? '#10b981' : '#ef4444' }}>
                  {/[A-Z]/.test(password) ? '✓' : '✗'} At least 1 uppercase letter
                </p>
                <p style={{ margin: '0.25rem 0', color: /\d/.test(password) ? '#10b981' : '#ef4444' }}>
                  {/\d/.test(password) ? '✓' : '✗'} At least 1 number
                </p>
              </div>
            )}
          </div>

          {mode === 'register' && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                color: theme.colors.text,
                fontWeight: '500'
              }}>
                Confirm Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError(''); }}
                  placeholder="Re-enter password"
                  style={{
                    width: '100%',
                    padding: '0.75rem 2.5rem 0.75rem 1rem',
                    borderRadius: '0.5rem',
                    border: error ? `2px solid #ef4444` : `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    fontSize: '1rem',
                    outline: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(prev => !prev)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: theme.colors.text,
                    opacity: 0.6,
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0
                  }}
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}

          {error && (
            <p style={{
              color: '#ef4444',
              fontSize: '0.875rem',
              marginTop: '0.25rem',
              marginBottom: '0.5rem'
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              backgroundColor: theme.colors.accent,
              color: '#ffffff',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              opacity: loading ? 0.8 : 1
            }}
          >
            {loading ? 'Please wait...' : (mode === 'login' ? 'Log In' : 'Create Account')}
          </button>
        </form>

        <p style={{
          textAlign: 'center',
          color: theme.colors.text,
          marginTop: '1.5rem',
          fontSize: '0.9rem'
        }}>
          {mode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            style={{
              background: 'none',
              border: 'none',
              color: theme.colors.accent,
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            {mode === 'login' ? 'Create an account' : 'Log in'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
