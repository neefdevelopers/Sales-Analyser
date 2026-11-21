// server/routes/auth.js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { get, query } from '../db.js';
import { generateToken, authenticate } from '../auth.js';

const router = Router();

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const user = await get('SELECT * FROM users WHERE username = ? OR staff_id = ?', [username.trim(), username.trim()]);
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

export default router;
