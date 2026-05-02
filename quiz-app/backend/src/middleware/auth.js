import jwt from 'jsonwebtoken';
import db from '../db.js';

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireOrganizer(req, res, next) {
  if (req.user?.role !== 'organizer') {
    return res.status(403).json({ error: 'Organizer access required' });
  }
  next();
}

export function verifySocketToken(token) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    return db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(payload.id);
  } catch {
    return null;
  }
}
