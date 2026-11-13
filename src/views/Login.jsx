// src/views/Login.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Award, Lock, User, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function Login() {
  const { login, switchDemo, demoAccounts } = useAuth();
  const [username, setUsername] = useState('manager');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleQuickSwitch(uname) {
    setError('');
    switchDemo(uname);
  }

  // Filter manager and staff for quick switch buttons
  const managerAccount = demoAccounts.find(a => a.role === 'brand_manager');
  const staffAccounts = demoAccounts.filter(a => a.role === 'sales_staff').slice(0, 3);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '16px' }}>
      <div className="login-card" style={{ width: '100%', maxWidth: '440px', background: 'white', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '32px', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, var(--primary-600), #818cf8)', borderRadius: 'var(--radius-md)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', marginBottom: '12px', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }}>
            <Award size={24} />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>SalesPulse</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Employee Sales Report Management System</p>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Username or Employee ID</label>
            <input
              type="text"
              className="form-control"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="e.g. manager or AS100"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Quick Demo Evaluation Buttons */}
        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px', textAlign: 'center' }}>
            One-Click Demo Evaluator Login:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {managerAccount ? (
              <button
                key={managerAccount.id}
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ justifyContent: 'space-between' }}
                onClick={() => handleQuickSwitch(managerAccount.username)}
              >
                <span>👔 Brand Manager ({managerAccount.name.replace(' (Brand Manager)', '')})</span>
                <span className="badge badge-info">{managerAccount.username} / admin123</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ justifyContent: 'space-between' }}
                onClick={() => handleQuickSwitch('manager')}
              >
                <span>👔 Brand Manager (Arun Varma)</span>
                <span className="badge badge-info">manager / admin123</span>
              </button>
            )}

            {staffAccounts.map((acc) => (
              <button
                key={acc.id}
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ justifyContent: 'space-between' }}
                onClick={() => handleQuickSwitch(acc.username)}
              >
                <span>💼 Sales Staff ({acc.name})</span>
                <span className="badge badge-neutral">{acc.staff_id}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
