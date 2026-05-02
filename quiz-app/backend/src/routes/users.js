import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/profile', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.user.id);

  const stats = req.user.role === 'organizer'
    ? db.prepare(`
        SELECT COUNT(DISTINCT q.id) as quiz_count,
               COUNT(DISTINCT s.id) as session_count,
               COUNT(DISTINCT sp.user_id) as total_participants
        FROM quizzes q
        LEFT JOIN sessions s ON s.quiz_id = q.id
        LEFT JOIN session_participants sp ON sp.session_id = s.id
        WHERE q.organizer_id = ?
      `).get(req.user.id)
    : db.prepare(`
        SELECT COUNT(DISTINCT sp.session_id) as sessions_joined,
               COALESCE(SUM(pa.score), 0) as total_score,
               COUNT(CASE WHEN pa.is_correct = 1 THEN 1 END) as correct_answers
        FROM session_participants sp
        LEFT JOIN participant_answers pa ON pa.user_id = sp.user_id AND pa.session_id = sp.session_id
        WHERE sp.user_id = ?
      `).get(req.user.id);

  res.json({ ...user, stats });
});

export default router;
