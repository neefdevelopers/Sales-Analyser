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
        <div className="filter-pill-bar">
          <div className="filter-pill-items">
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
          <div className="filter-pill-actions">
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => setShowFilters(true)}
              style={{ fontSize: '11.5px', padding: '5px 12px', height: 'auto' }}
            >
              Change Filters ▾
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={handleResetFilters}
                style={{ fontSize: '11.5px', padding: '5px 10px', color: '#dc2626', height: 'auto' }}
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
        <div className="filter-card">
          <div className="filter-card-header">
            <div className="filter-title-wrap">
              <div className="filter-icon-box">
                <Filter size={15} />
              </div>
              <strong className="filter-title">Filtration</strong>
              <span className="filter-desc">
                (Filter products by name or catalog status)
              </span>
            </div>
            <button
              type="button"
              className="filter-hide-btn"
              onClick={() => setShowFilters(false)}
            >
              <X size={14} /> Hide
            </button>
          </div>

          <div className="filter-body">
            <div className="filter-row">
              <div className="filter-search-row">
                <div className="search-input-wrap">
                  <Search size={16} />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search products by name or code..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="filter-fields-wrap">
                <div className="filter-field">
                  <span className="filter-field-label">Status</span>
                  <select
                    className="form-control"
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All Products</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                  </select>
                </div>

                {hasActiveFilters && (
                  <div className="filter-field" style={{ justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleResetFilters}
                      style={{ minHeight: '36px', padding: '6px 12px', fontSize: '12px' }}
                      title="Reset filters"
                    >
                      <X size={13} style={{ marginRight: '4px' }} /> Reset
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Table Card */}
      <div className="table-card">
        {/* Desktop & Laptop Table View */}
        <div className="responsive-table-view">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Prepaid Incentive</th>
                  <th>COD Incentive</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center', width: '130px' }}>Actions</th>
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
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
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

        {/* Mobile & Small Tablet Data Card View (<= 768px) */}
        <div className="responsive-card-view">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>Loading catalog...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <div className="empty-state-icon"><Package size={24} /></div>
              <div className="empty-state-title">No products found</div>
              <div className="empty-state-desc">Create your first product to enable staff sales and order entry.</div>
              <button className="btn btn-primary btn-sm" onClick={openCreateModal} style={{ marginTop: '12px' }}>
                <Plus size={14} /> Add Product
              </button>
            </div>
          ) : (
            filteredProducts.map((p) => (
              <div key={p.id} className="mobile-data-card">
                <div className="mobile-card-header">
                  <div className="mobile-card-title-group">
                    <span className="mobile-card-title">{p.name}</span>
                  </div>
                  <span className={`badge ${p.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                    {p.status}
                  </span>
                </div>

                <div className="mobile-card-grid">
                  <div className="mobile-card-item">
                    <span className="mobile-card-label">Prepaid Incentive</span>
                    <span className="mobile-card-val success" style={{ fontSize: '14px' }}>
                      ₹{p.prepaid_incentive_value}
                    </span>
                  </div>

                  <div className="mobile-card-item">
                    <span className="mobile-card-label">COD Incentive</span>
                    <span className="mobile-card-val accent" style={{ fontSize: '14px' }}>
                      ₹{p.cod_incentive_value}
                    </span>
                  </div>
                </div>

                <div className="mobile-card-footer">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => openEditModal(p)}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    <Edit2 size={14} />
                    <span>Edit Product</span>
                  </button>

                  <button
                    type="button"
                    className={`btn ${p.status === 'active' ? 'btn-danger' : 'btn-secondary'} btn-sm`}
                    onClick={() => handleToggleStatus(p)}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    {p.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))
          )}
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
