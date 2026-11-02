// src/components/ErrorBoundary.jsx
import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div className="table-card" style={{ maxWidth: '500px', width: '100%', padding: '32px 24px', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--danger-bg)', color: 'var(--danger-text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <AlertCircle size={24} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-main)' }}>Something went wrong</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>
              {this.state.error?.message || 'An unexpected rendering error occurred in this view.'}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={this.handleRetry} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <RefreshCw size={14} />
                <span>Try Again</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
