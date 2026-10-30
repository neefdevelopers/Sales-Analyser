// server/auth.js
// Authentication & role-based authorization middleware

import jwt from 'jsonwebtoken';
import { get } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'antigravity_sales_management_secret_key_2026';

export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      staff_id: user.staff_id,
      name: user.name,
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authenticate(req, res, next) {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Verify user still exists and is active
    const user = get('SELECT id, staff_id, name, username, role, status FROM users WHERE id = ?', [decoded.id]);
    
    if (!user) {
      return res.status(401).json({ error: 'User account no longer exists.' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is deactivated. Please contact your Brand Manager.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Requires one of: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`
      });
    }

    next();
  };
}
