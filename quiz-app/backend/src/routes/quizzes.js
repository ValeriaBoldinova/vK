import { Router } from 'express';
import multer from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';
import { authMiddleware, requireOrganizer } from '../middleware/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const storage = multer.diskStorage({
  destination: join(__dirname, '../../uploads'),
  filename: (req, file, cb) => {
    const ext = file.originalname.split('.').pop();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  },
});

const router = Router();

function getQuizWithQuestions(quizId) {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(quizId);
  if (!quiz) return null;
  const questions = db.prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_num, id').all(quizId);
  for (const q of questions) {
    q.options = db.prepare('SELECT * FROM options WHERE question_id = ?').all(q.id);
  }
  quiz.questions = questions;
  return quiz;
}

// List all quizzes (organizer sees own, participant sees all)
router.get('/', authMiddleware, (req, res) => {
  let quizzes;
  if (req.user.role === 'organizer') {
    quizzes = db.prepare('SELECT q.*, COUNT(qu.id) as question_count FROM quizzes q LEFT JOIN questions qu ON qu.quiz_id = q.id WHERE q.organizer_id = ? GROUP BY q.id ORDER BY q.created_at DESC').all(req.user.id);
  } else {
    quizzes = db.prepare('SELECT q.*, u.name as organizer_name, COUNT(qu.id) as question_count FROM quizzes q JOIN users u ON u.id = q.organizer_id LEFT JOIN questions qu ON qu.quiz_id = q.id GROUP BY q.id ORDER BY q.created_at DESC').all();
  }
  res.json(quizzes);
});

// Get single quiz with questions
router.get('/:id', authMiddleware, (req, res) => {
  const quiz = getQuizWithQuestions(req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  if (req.user.role === 'organizer' && quiz.organizer_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.json(quiz);
});

// Create quiz
router.post('/', authMiddleware, requireOrganizer, (req, res) => {
  const { title, description, category, time_per_question } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const result = db.prepare(
    'INSERT INTO quizzes (title, description, category, time_per_question, organizer_id) VALUES (?, ?, ?, ?, ?)'
  ).run(title, description || '', category || 'General', time_per_question || 30, req.user.id);
  res.json(getQuizWithQuestions(result.lastInsertRowid));
});

// Update quiz
router.put('/:id', authMiddleware, requireOrganizer, (req, res) => {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ? AND organizer_id = ?').get(req.params.id, req.user.id);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  const { title, description, category, time_per_question } = req.body;
  db.prepare('UPDATE quizzes SET title = ?, description = ?, category = ?, time_per_question = ? WHERE id = ?')
    .run(title || quiz.title, description ?? quiz.description, category || quiz.category, time_per_question || quiz.time_per_question, quiz.id);
  res.json(getQuizWithQuestions(quiz.id));
});

// Delete quiz
router.delete('/:id', authMiddleware, requireOrganizer, (req, res) => {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ? AND organizer_id = ?').get(req.params.id, req.user.id);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  db.prepare('DELETE FROM quizzes WHERE id = ?').run(quiz.id);
  res.json({ ok: true });
});

// Add question to quiz
router.post('/:id/questions', authMiddleware, requireOrganizer, upload.single('image'), (req, res) => {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ? AND organizer_id = ?').get(req.params.id, req.user.id);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

  const { text, type } = req.body;
  let options;
  try {
    options = JSON.parse(req.body.options || '[]');
  } catch {
    return res.status(400).json({ error: 'Invalid options format' });
  }

  if (!text) return res.status(400).json({ error: 'Question text required' });
  if (!options || options.length < 2) return res.status(400).json({ error: 'At least 2 options required' });
  if (!options.some(o => o.is_correct)) return res.status(400).json({ error: 'At least one correct option required' });

  const image_url = req.file ? `/uploads/${req.file.filename}` : null;
  const maxOrder = db.prepare('SELECT MAX(order_num) as m FROM questions WHERE quiz_id = ?').get(quiz.id).m || 0;

  const qResult = db.prepare(
    'INSERT INTO questions (quiz_id, text, image_url, type, order_num) VALUES (?, ?, ?, ?, ?)'
  ).run(quiz.id, text, image_url, type || 'single', maxOrder + 1);

  const questionId = qResult.lastInsertRowid;
  for (const opt of options) {
    db.prepare('INSERT INTO options (question_id, text, is_correct) VALUES (?, ?, ?)').run(questionId, opt.text, opt.is_correct ? 1 : 0);
  }
  res.json(getQuizWithQuestions(quiz.id));
});

// Update question
router.put('/questions/:questionId', authMiddleware, requireOrganizer, upload.single('image'), (req, res) => {
  const question = db.prepare(`
    SELECT q.*, qz.organizer_id FROM questions q
    JOIN quizzes qz ON qz.id = q.quiz_id
    WHERE q.id = ? AND qz.organizer_id = ?
  `).get(req.params.questionId, req.user.id);
  if (!question) return res.status(404).json({ error: 'Question not found' });

  const { text, type } = req.body;
  let options;
  try {
    options = JSON.parse(req.body.options || '[]');
  } catch {
    return res.status(400).json({ error: 'Invalid options format' });
  }

  const image_url = req.file ? `/uploads/${req.file.filename}` : question.image_url;
  db.prepare('UPDATE questions SET text = ?, image_url = ?, type = ? WHERE id = ?')
    .run(text || question.text, image_url, type || question.type, question.id);

  if (options.length >= 2) {
    db.prepare('DELETE FROM options WHERE question_id = ?').run(question.id);
    for (const opt of options) {
      db.prepare('INSERT INTO options (question_id, text, is_correct) VALUES (?, ?, ?)').run(question.id, opt.text, opt.is_correct ? 1 : 0);
    }
  }
  res.json(getQuizWithQuestions(question.quiz_id));
});

// Delete question
router.delete('/questions/:questionId', authMiddleware, requireOrganizer, (req, res) => {
  const question = db.prepare(`
    SELECT q.*, qz.organizer_id, qz.id as quiz_id FROM questions q
    JOIN quizzes qz ON qz.id = q.quiz_id
    WHERE q.id = ? AND qz.organizer_id = ?
  `).get(req.params.questionId, req.user.id);
  if (!question) return res.status(404).json({ error: 'Question not found' });
  db.prepare('DELETE FROM questions WHERE id = ?').run(question.id);
  res.json(getQuizWithQuestions(question.quiz_id));
});

export default router;
