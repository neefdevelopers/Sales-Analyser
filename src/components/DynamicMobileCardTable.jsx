// src/components/DynamicMobileCardTable.jsx
import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * DynamicMobileCardTable
 * Transforms tabular data into a clean, vertically stacked card layout for mobile screens.
 *
 * Props:
 * - rows: Array of data row objects
 * - cols: Array of column definitions [{ label, type }]
 * - getRowTitle: (row, idx) => string | ReactNode (primary title displayed at top of card)
 * - getRowSubtitle: (row, idx) => string | ReactNode (optional subtitle below title)
 * - getRowBadge: (row, idx) => ReactNode (optional badge in header, e.g. currency total or status)
 * - renderActions: (row, idx) => ReactNode (action buttons at bottom of card)
 * - onRowClick: (row, idx) => void (optional tap handler for the whole card)
 * - initialFieldsCount: number of fields shown before "View all fields" toggle (default: 4)
 * - emptyMessage: text to show when rows are empty
 */
export default function DynamicMobileCardTable({
  rows = [],
  cols = [],
  getRowTitle,
  getRowSubtitle,
  getRowBadge,
  renderActions,
  onRowClick,
  initialFieldsCount = 4,
  emptyMessage = 'No records found'
}) {
  // Track expanded state for each card independently
  const [expandedRows, setExpandedRows] = useState({});

  function toggleExpand(id, e) {
    if (e) e.stopPropagation();
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  }

  if (!rows || rows.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <p style={{ margin: 0, fontSize: '13.5px' }}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="mobile-card-container">
      {rows.map((row, idx) => {
        const rowId = row.id || `row-${idx}`;
        const isExpanded = !!expandedRows[rowId];

        // Format column values
        const renderedFields = cols.map((col, colIdx) => {
          const val = row.data ? row.data[col.label] : row[col.key || col.label];
          let formattedVal = val;
          let valClass = '';

          if (col.type === 'currency') {
            const num = typeof val === 'number' ? val : parseFloat(val);
            if (!isNaN(num) && num > 0) {
              formattedVal = `₹${num.toLocaleString()}`;
              valClass = 'currency';
            } else {
              formattedVal = val !== undefined && val !== null && val !== '' ? val : '—';
            }
          } else if (col.type === 'number') {
            const num = typeof val === 'number' ? val : parseFloat(val);
            formattedVal = !isNaN(num) && num > 0 ? num.toLocaleString() : (val || '—');
            valClass = 'number';
          } else if (col.type === 'date') {
            formattedVal = val || '—';
          } else {
            formattedVal = val !== undefined && val !== null && String(val).trim() !== '' ? String(val) : '—';
          }

          return {
            label: col.label,
            value: formattedVal,
            valClass,
            colIdx
          };
        });

        const hasManyFields = renderedFields.length > initialFieldsCount;
        const visibleFields = hasManyFields && !isExpanded
          ? renderedFields.slice(0, initialFieldsCount)
          : renderedFields;

        const title = getRowTitle ? getRowTitle(row, idx) : (row.recordDate || `#${idx + 1}`);
        const subtitle = getRowSubtitle ? getRowSubtitle(row, idx) : null;
        const badge = getRowBadge ? getRowBadge(row, idx) : null;
        const actions = renderActions ? renderActions(row, idx) : null;

        return (
          <div
            key={rowId}
            className={`mobile-data-card ${onRowClick ? 'clickable' : ''}`}
            onClick={onRowClick ? () => onRowClick(row, idx) : undefined}
          >
            {/* Card Header */}
            {(title || badge) && (
              <div className="mobile-card-header">
                <div className="mobile-card-title-group">
                  <div className="mobile-card-title">{title}</div>
                  {subtitle && <div className="mobile-card-subtitle">{subtitle}</div>}
                </div>
                {badge && <div>{badge}</div>}
              </div>
            )}

            {/* Vertically Stacked Key-Value Fields */}
            <div className="mobile-card-fields">
              {visibleFields.map(f => (
                <div key={f.colIdx} className="mobile-card-field-row">
                  <span className="mobile-card-field-label">{f.label}</span>
                  <span className={`mobile-card-field-val ${f.valClass}`}>
                    {f.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Expand / Collapse Toggle for Tables with Many Columns */}
            {hasManyFields && (
              <button
                type="button"
                className="mobile-card-expand-btn"
                onClick={(e) => toggleExpand(rowId, e)}
              >
                {isExpanded ? (
                  <>
                    <ChevronUp size={14} />
                    <span>Collapse Details</span>
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} />
                    <span>View All {renderedFields.length} Fields ({renderedFields.length - initialFieldsCount} more)</span>
                  </>
                )}
              </button>
            )}

            {/* Card Actions (if any) */}
            {actions && (
              <div className="mobile-card-actions" onClick={e => e.stopPropagation()}>
                {actions}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
