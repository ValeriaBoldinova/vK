import { Router } from 'express';
import db from '../db.js';
import { authMiddleware, requireOrganizer } from '../middleware/auth.js';

const router = Router();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Create session (organizer)
router.post('/', authMiddleware, requireOrganizer, (req, res) => {
  const { quiz_id } = req.body;
  if (!quiz_id) return res.status(400).json({ error: 'quiz_id required' });

  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ? AND organizer_id = ?').get(quiz_id, req.user.id);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

  const questions = db.prepare('SELECT id FROM questions WHERE quiz_id = ?').all(quiz_id);
  if (questions.length === 0) return res.status(400).json({ error: 'Quiz has no questions' });

  let roomCode;
  let attempts = 0;
  do {
    roomCode = generateRoomCode();
    attempts++;
  } while (db.prepare('SELECT id FROM sessions WHERE room_code = ?').get(roomCode) && attempts < 10);

  const result = db.prepare(
    'INSERT INTO sessions (quiz_id, room_code, organizer_id) VALUES (?, ?, ?)'
  ).run(quiz_id, roomCode, req.user.id);

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(result.lastInsertRowid);
  res.json(session);
});

// Get session by room code
router.get('/by-code/:roomCode', authMiddleware, (req, res) => {
  const session = db.prepare(`
    SELECT s.*, q.title as quiz_title, q.description as quiz_description, q.category,
           u.name as organizer_name
    FROM sessions s
    JOIN quizzes q ON q.id = s.quiz_id
    JOIN users u ON u.id = s.organizer_id
    WHERE s.room_code = ?
  `).get(req.params.roomCode.toUpperCase());
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

// List organizer's sessions
router.get('/my', authMiddleware, requireOrganizer, (req, res) => {
  const sessions = db.prepare(`
    SELECT s.*, q.title as quiz_title,
           COUNT(DISTINCT sp.user_id) as participant_count
    FROM sessions s
    JOIN quizzes q ON q.id = s.quiz_id
    LEFT JOIN session_participants sp ON sp.session_id = s.id
    WHERE s.organizer_id = ?
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `).all(req.user.id);
  res.json(sessions);
});

// Get session results (leaderboard)
router.get('/:id/results', authMiddleware, (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const leaderboard = db.prepare(`
    SELECT u.id, u.name,
           COALESCE(SUM(pa.score), 0) as total_score,
           COUNT(CASE WHEN pa.is_correct = 1 THEN 1 END) as correct_count,
           COUNT(pa.id) as answered_count
    FROM session_participants sp
    JOIN users u ON u.id = sp.user_id
    LEFT JOIN participant_answers pa ON pa.user_id = sp.user_id AND pa.session_id = sp.session_id
    WHERE sp.session_id = ?
    GROUP BY u.id, u.name
    ORDER BY total_score DESC
  `).all(req.params.id);

  res.json({ session, leaderboard });
});

// Participant history
router.get('/history/me', authMiddleware, (req, res) => {
  const sessions = db.prepare(`
    SELECT s.*, q.title as quiz_title, u.name as organizer_name,
           COALESCE(SUM(pa.score), 0) as my_score,
           COUNT(CASE WHEN pa.is_correct = 1 THEN 1 END) as correct_count
    FROM session_participants sp
    JOIN sessions s ON s.id = sp.session_id
    JOIN quizzes q ON q.id = s.quiz_id
    JOIN users u ON u.id = s.organizer_id
    LEFT JOIN participant_answers pa ON pa.user_id = ? AND pa.session_id = s.id
    WHERE sp.user_id = ?
    GROUP BY s.id
    ORDER BY sp.joined_at DESC
  `).all(req.user.id, req.user.id);
  res.json(sessions);
});

export default router;
