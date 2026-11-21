// src/views/Login.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Award, Lock, User } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '16px' }}>
      <div className="login-card" style={{ width: '100%', maxWidth: '420px', background: 'white', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '36px 32px', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, var(--primary-600), #818cf8)', borderRadius: '14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', marginBottom: '14px', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)' }}>
            <Award size={26} />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>SalesPulse</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Employee Sales Report Management System</p>
        </div>

        {error && (
          <div style={{ padding: '12px 14px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', borderRadius: 'var(--radius-md)', marginBottom: '18px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group" style={{ marginBottom: '18px' }}>
            <label className="form-label" style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Username or Employee ID
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-control"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username or Staff ID"
                required
                autoFocus
                autoComplete="username"
                style={{ width: '100%', height: '42px', fontSize: '13.5px' }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '22px' }}>
            <label className="form-label" style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                autoComplete="current-password"
                style={{ width: '100%', height: '42px', fontSize: '13.5px' }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', height: '42px', fontSize: '14px', fontWeight: 600, justifyContent: 'center' }}
            disabled={submitting}
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
