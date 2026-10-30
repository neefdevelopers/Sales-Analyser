// server/routes/staff.js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, get, run } from '../db.js';
import { authenticate, requireRole } from '../auth.js';

const router = Router();

// GET all staff members (Brand Manager only)
router.get('/', authenticate, requireRole('brand_manager'), (req, res) => {
  const staff = query(`
    SELECT id, staff_id, name, username, role, status, created_at, updated_at
    FROM users
    WHERE role = 'sales_staff'
    ORDER BY name ASC
  `);
  res.json({ staff });
});

// GET single staff profile (Brand Manager or the staff member themselves)
router.get('/:id', authenticate, (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  
  // Security check: Sales staff can only access their own profile
  if (req.user.role === 'sales_staff' && req.user.id !== targetId) {
    return res.status(403).json({ error: 'You are only authorized to view your own profile.' });
  }

  const staff = get(`
    SELECT id, staff_id, name, username, role, status, created_at, updated_at
    FROM users
    WHERE id = ?
  `, [targetId]);

  if (!staff) {
    return res.status(404).json({ error: 'Staff member not found.' });
  }

  // Also fetch manager remarks for this staff member
  const remarkRecord = get('SELECT remarks, updated_at FROM staff_performance_remarks WHERE staff_id = ?', [targetId]);

  res.json({
    staff,
    performanceRemarks: remarkRecord?.remarks || ''
  });
});

// POST create new staff member (Brand Manager only)
router.post('/', authenticate, requireRole('brand_manager'), (req, res) => {
  let { staff_id, name, username, password, status = 'active' } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Staff name is required.' });
  }
  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Login username is required.' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  // Generate unique staff_id if not provided
  if (!staff_id || !staff_id.trim()) {
    const lastStaff = get("SELECT staff_id FROM users WHERE role = 'sales_staff' ORDER BY id DESC LIMIT 1");
    let nextNum = 1;
    if (lastStaff && lastStaff.staff_id.startsWith('STF-')) {
      const match = lastStaff.staff_id.match(/STF-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    staff_id = `STF-${String(nextNum).padStart(3, '0')}`;
  } else {
    staff_id = staff_id.trim().toUpperCase();
  }

  // Validate duplicate staff_id
  const existingStaffId = get('SELECT id FROM users WHERE staff_id = ?', [staff_id]);
  if (existingStaffId) {
    return res.status(400).json({ error: `Staff ID "${staff_id}" is already assigned to another user.` });
  }

  // Validate duplicate username
  const existingUsername = get('SELECT id FROM users WHERE username = ?', [username.trim()]);
  if (existingUsername) {
    return res.status(400).json({ error: `Username "${username}" is already taken.` });
  }

  const password_hash = bcrypt.hashSync(password, 10);
  const now = new Date().toISOString();

  try {
    const result = run(
      `INSERT INTO users (staff_id, name, username, password_hash, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'sales_staff', ?, ?, ?)`,
      [staff_id, name.trim(), username.trim(), password_hash, status === 'inactive' ? 'inactive' : 'active', now, now]
    );

    const created = get('SELECT id, staff_id, name, username, role, status, created_at FROM users WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ staff: created, message: 'Staff account created successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create staff account: ' + err.message });
  }
});

// PUT update staff details / activate / deactivate (Brand Manager only)
router.put('/:id', authenticate, requireRole('brand_manager'), (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  const targetUser = get('SELECT * FROM users WHERE id = ?', [targetId]);

  if (!targetUser) {
    return res.status(404).json({ error: 'Staff member not found.' });
  }

  // Safety rule: Brand Manager cannot modify another manager or admin accounts
  if (targetUser.role === 'brand_manager' && targetUser.id !== req.user.id) {
    return res.status(403).json({ error: "Cannot modify another Brand Manager's account." });
  }

  const { name, staff_id, username, status } = req.body;

  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ error: 'Staff name cannot be empty.' });
  }

  if (staff_id !== undefined && staff_id.trim()) {
    const idCheck = get('SELECT id FROM users WHERE staff_id = ? AND id != ?', [staff_id.trim().toUpperCase(), targetId]);
    if (idCheck) {
      return res.status(400).json({ error: `Staff ID "${staff_id}" is already used.` });
    }
  }

  if (username !== undefined && username.trim()) {
    const userCheck = get('SELECT id FROM users WHERE username = ? AND id != ?', [username.trim(), targetId]);
    if (userCheck) {
      return res.status(400).json({ error: `Username "${username}" is already in use.` });
    }
  }

  const now = new Date().toISOString();

  try {
    run(
      `UPDATE users SET
        name = ?,
        staff_id = ?,
        username = ?,
        status = ?,
        updated_at = ?
      WHERE id = ?`,
      [
        name !== undefined ? name.trim() : targetUser.name,
        staff_id !== undefined ? staff_id.trim().toUpperCase() : targetUser.staff_id,
        username !== undefined ? username.trim() : targetUser.username,
        status !== undefined ? status : targetUser.status,
        now,
        targetId
      ]
    );

    const updated = get('SELECT id, staff_id, name, username, role, status, updated_at FROM users WHERE id = ?', [targetId]);
    res.json({ staff: updated, message: 'Staff member updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update staff member: ' + err.message });
  }
});

// POST reset password (Brand Manager only)
router.post('/:id/reset-password', authenticate, requireRole('brand_manager'), (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  const targetUser = get('SELECT * FROM users WHERE id = ?', [targetId]);

  if (!targetUser) {
    return res.status(404).json({ error: 'Staff member not found.' });
  }

  if (targetUser.role === 'brand_manager' && targetUser.id !== req.user.id) {
    return res.status(403).json({ error: "Cannot reset another Brand Manager's password." });
  }

  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  const now = new Date().toISOString();

  run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [newHash, now, targetId]);

  res.json({ message: `Password reset successfully for ${targetUser.name}.` });
});

export default router;
