// src/views/manager/ProductManagement.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { useSessionState } from '../../hooks/useSessionState';
import {
  Package,
  Plus,
  Search,
  CheckCircle,
  AlertCircle,
  Edit2,
  Filter,
  X,
  ChevronDown
} from 'lucide-react';

export default function ProductManagement() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useSessionState('filter_product_search', '');
  const [statusFilter, setStatusFilter] = useSessionState('filter_product_status', 'all');
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Exact required fields: Product Name, Prepaid Incentive, COD Incentive
  const [name, setName] = useState('');
  const [prepaidIncentive, setPrepaidIncentive] = useState('');
  const [codIncentive, setCodIncentive] = useState('');

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    try {
      // Manager passes all=true to see both active and inactive products
      const res = await api.get('/products?all=true');
      setProducts(res.products || []);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingProduct(null);
    setName('');
    setPrepaidIncentive('');
    setCodIncentive('');
    setFormError('');
    setShowModal(true);
  }

  function openEditModal(prod) {
    setEditingProduct(prod);
    setName(prod.name);
    setPrepaidIncentive(String(prod.prepaid_incentive_value || ''));
    setCodIncentive(String(prod.cod_incentive_value || ''));
    setFormError('');
    setShowModal(true);
  }

  async function handleToggleStatus(prod) {
    const newStatus = prod.status === 'active' ? 'inactive' : 'active';
    try {
      await api.put(`/products/${prod.id}`, { status: newStatus });
      setNotification(`Product "${prod.name}" marked as ${newStatus}.`);
      setTimeout(() => setNotification(''), 4000);
      fetchProducts();
    } catch (err) {
      alert('Failed to update product status: ' + err.message);
    }
  }

  async function handleSaveProduct(e) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    const payload = {
      name: name.trim(),
      price: editingProduct ? (editingProduct.price || 0) : 0,
      prepaid_incentive_type: 'fixed',
      prepaid_incentive_basis: 'per_unit',
      prepaid_incentive_value: parseFloat(prepaidIncentive) || 0,
      cod_incentive_type: 'fixed',
      cod_incentive_basis: 'per_unit',
      cod_incentive_value: parseFloat(codIncentive) || 0
    };

    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload);
        setNotification(`Product "${name}" updated successfully.`);
      } else {
        await api.post('/products', payload);
        setNotification(`Product "${name}" created successfully.`);
      }

      setTimeout(() => setNotification(''), 4000);
      setShowModal(false);
      fetchProducts();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const filteredProducts = products.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.code && p.code.toLowerCase().includes(q));
  });

  const hasActiveFilters = Boolean(search.trim() || statusFilter !== 'all');
  const activeFilterCount = (search.trim() ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);

  function handleResetFilters() {
    setSearch('');
    setStatusFilter('all');
  }

  return (
    <div className="page-body">
      {/* Toast Notification */}
      {notification && (
        <div className="toast-container">
          <div className="toast success">
            <CheckCircle size={18} color="var(--success-solid)" />
            <span>{notification}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Product Management</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setShowFilters(!showFilters)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '8px 14px',
              fontWeight: 600,
              fontSize: '12.5px'
            }}
          >
            <Filter size={14} />
            <span>Filtration</span>
            {hasActiveFilters && (
              <span
                style={{
                  background: showFilters ? '#ffffff' : 'var(--primary-600)',
                  color: showFilters ? 'var(--primary-600)' : '#ffffff',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '1px 6px',
                  marginLeft: '2px'
                }}
              >
                {activeFilterCount}
              </span>
            )}
            <ChevronDown
              size={14}
              style={{
                transform: showFilters ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s ease'
              }}
            />
          </button>

          <button className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={16} />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Compact Applied Filtration Pill Bar (when collapsed) */}
      {!showFilters && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            background: '#f8fafc',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 14px',
            marginBottom: '18px',
            fontSize: '12.5px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              <Filter size={13} color="var(--primary-600)" /> Active Filters:
            </span>
            {statusFilter !== 'all' && (
              <span className="badge badge-info" style={{ fontSize: '11.5px' }}>
                Status: {statusFilter === 'active' ? 'Active Only' : 'Inactive Only'}
              </span>
            )}
            {search.trim() && (
              <span className="badge badge-neutral" style={{ fontSize: '11.5px' }}>
                Search: "{search.trim()}"
              </span>
            )}
            {!hasActiveFilters && (
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                Showing all product catalog
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => setShowFilters(true)}
              style={{ fontSize: '11.5px', padding: '3px 10px', height: 'auto' }}
            >
              Change Filters ▾
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={handleResetFilters}
                style={{ fontSize: '11.5px', padding: '3px 8px', color: '#dc2626', height: 'auto' }}
                title="Reset filters"
              >
                <X size={12} style={{ marginRight: '4px' }} /> Reset
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dedicated Filtration Section Card (when expanded) */}
      {showFilters && (
        <div className="table-card" style={{ marginBottom: '18px', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'var(--primary-50)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Filter size={15} />
              </div>
              <strong style={{ fontSize: '13.5px', color: 'var(--text-main)', letterSpacing: '0.2px' }}>Filtration</strong>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                (Filter products by name or catalog status)
              </span>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => setShowFilters(false)}
              style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}
            >
              <X size={14} /> Hide
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div className="search-input-wrap" style={{ flex: '1 1 260px', maxWidth: '380px' }}>
              <Search size={16} />
              <input
                type="text"
                className="search-input"
                placeholder="Search products by name or code..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Status:</span>
                <select
                  className="form-control"
                  style={{ width: 'auto', padding: '5px 10px', fontSize: '12.5px' }}
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Products</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleResetFilters}
                  style={{ padding: '5px 10px', fontSize: '12px' }}
                  title="Reset filters"
                >
                  <X size={13} style={{ marginRight: '4px' }} /> Reset
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Product Table Card */}
      <div className="table-card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Prepaid Incentive</th>
                <th>COD Incentive</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '32px' }}>Loading catalog...</td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="5">
                    <div className="empty-state">
                      <div className="empty-state-icon"><Package size={24} /></div>
                      <div className="empty-state-title">No products found</div>
                      <div className="empty-state-desc">Create your first product to enable staff sales and order entry.</div>
                      <button className="btn btn-primary btn-sm" onClick={openCreateModal}>
                        <Plus size={14} /> Add Product
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--primary-700)' }}>
                        ₹{p.prepaid_incentive_value}
                      </strong>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--warning-text)' }}>
                        ₹{p.cod_incentive_value}
                      </strong>
                    </td>
                    <td>
                      <span className={`badge ${p.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEditModal(p)}
                          title="Edit Product"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          className={`btn ${p.status === 'active' ? 'btn-danger' : 'btn-secondary'} btn-sm`}
                          onClick={() => handleToggleStatus(p)}
                          title={p.status === 'active' ? 'Deactivate Product' : 'Activate Product'}
                        >
                          {p.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simplified Add / Edit Product Modal: Exactly 3 fields */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveProduct}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px' }}>
                    {formError}
                  </div>
                )}

                {/* 1. Product Name */}
                <div className="form-group">
                  <label className="form-label">Product Name <span className="required">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter product name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                {/* 2. Prepaid Incentive */}
                <div className="form-group">
                  <label className="form-label">Incentive for PREPAID (₹) <span className="required">*</span></label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control"
                    placeholder="e.g. 150"
                    value={prepaidIncentive}
                    onChange={e => setPrepaidIncentive(e.target.value)}
                    required
                  />
                </div>

                {/* 3. Cash On Delivery (COD) Incentive */}
                <div className="form-group">
                  <label className="form-label">Incentive for CASH ON DELIVERY (₹) <span className="required">*</span></label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control"
                    placeholder="e.g. 100"
                    value={codIncentive}
                    onChange={e => setCodIncentive(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editingProduct ? 'Save Changes' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
