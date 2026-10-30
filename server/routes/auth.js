// server/routes/auth.js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { get, query } from '../db.js';
import { generateToken, authenticate } from '../auth.js';

const router = Router();

// Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const user = get('SELECT * FROM users WHERE username = ? OR staff_id = ?', [username.trim(), username.trim()]);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  if (user.status !== 'active') {
    return res.status(403).json({ error: 'Your account is currently inactive. Contact your Brand Manager.' });
  }

  const isPasswordMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isPasswordMatch) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const token = generateToken(user);

  res.json({
    token,
    user: {
      id: user.id,
      staff_id: user.staff_id,
      name: user.name,
      username: user.username,
      role: user.role,
      status: user.status
    }
  });
});

// Current user profile
router.get('/me', authenticate, (req, res) => {
  res.json({
    user: req.user
  });
});

// Demo switch: convenience for testing between manager and staff
router.post('/demo-switch', (req, res) => {
  const { username } = req.body;
  const user = get('SELECT * FROM users WHERE username = ?', [username]);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  const token = generateToken(user);
  res.json({
    token,
    user: {
      id: user.id,
      staff_id: user.staff_id,
      name: user.name,
      username: user.username,
      role: user.role,
      status: user.status
    }
  });
});

// Get demo accounts list for easy switching in development/evaluation
router.get('/demo-accounts', (req, res) => {
  const accounts = query('SELECT id, staff_id, name, username, role, status FROM users ORDER BY role, id');
  res.json({ accounts });
});

export default router;
