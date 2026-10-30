// src/views/manager/ProductManagement.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import {
  Package,
  Plus,
  Search,
  CheckCircle,
  AlertCircle,
  Edit2
} from 'lucide-react';

export default function ProductManagement() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
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
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.code && p.code.toLowerCase().includes(q));
  });

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

        <button className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={16} />
          <span>Add Product</span>
        </button>
      </div>

      {/* Product Table Card */}
      <div className="table-card">
        <div className="table-toolbar">
          <div className="search-input-wrap">
            <Search size={16} />
            <input
              type="text"
              className="search-input"
              placeholder="Search products by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

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
