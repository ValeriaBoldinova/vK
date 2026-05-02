import db from '../db.js';
import { verifySocketToken } from '../middleware/auth.js';

// roomCode -> { sessionId, quizId, organizerSocketId, participants: Map, questions, currentIdx, phase, timers }
const rooms = new Map();

function getLeaderboard(sessionId) {
  return db.prepare(`
    SELECT u.id, u.name,
           COALESCE(SUM(pa.score), 0) as total_score,
           COUNT(CASE WHEN pa.is_correct = 1 THEN 1 END) as correct_count
    FROM session_participants sp
    JOIN users u ON u.id = sp.user_id
    LEFT JOIN participant_answers pa ON pa.user_id = sp.user_id AND pa.session_id = sp.session_id
    WHERE sp.session_id = ?
    GROUP BY u.id, u.name
    ORDER BY total_score DESC
  `).all(sessionId);
}

function calcScore(isCorrect, timeTaken, timeLimit) {
  if (!isCorrect) return 0;
  const ratio = Math.max(0, 1 - timeTaken / timeLimit);
  return Math.round(500 + 500 * ratio);
}

function calcMultipleScore(selectedIds, correctIds, allOptionIds, timeTaken, timeLimit) {
  const correctSet = new Set(correctIds);
  const wrongIds = allOptionIds.filter(id => !correctSet.has(id));
  const selectedCorrect = selectedIds.filter(id => correctSet.has(id)).length;
  const selectedWrong = selectedIds.filter(id => !correctSet.has(id)).length;
  const precision = correctIds.length > 0 ? selectedCorrect / correctIds.length : 0;
  const penalty = wrongIds.length > 0 ? selectedWrong / wrongIds.length : 0;
  const accuracy = Math.max(0, precision - penalty);
  if (accuracy === 0) return 0;
  const ratio = Math.max(0, 1 - timeTaken / timeLimit);
  return Math.round(accuracy * (500 + 500 * ratio));
}

function endQuestion(io, roomCode) {
  const room = rooms.get(roomCode);
  if (!room || room.phase !== 'question') return;

  const question = room.questions[room.currentIdx];
  const correctOptions = db.prepare('SELECT id FROM options WHERE question_id = ? AND is_correct = 1').all(question.id);
  const correctIds = correctOptions.map(o => o.id);
  const allOptions = db.prepare('SELECT id FROM options WHERE question_id = ?').all(question.id);
  const allIds = allOptions.map(o => o.id);
  const timeLimit = room.timeLimit;

  // Calculate scores for participants who didn't answer
  for (const [userId, p] of room.participants.entries()) {
    if (!p.answeredCurrentQuestion) {
      try {
        db.prepare(`
          INSERT OR IGNORE INTO participant_answers (session_id, question_id, user_id, selected_options, is_correct, score, time_taken)
          VALUES (?, ?, ?, '[]', 0, 0, ?)
        `).run(room.sessionId, question.id, userId, timeLimit);
      } catch {}
    }
  }

  room.phase = 'results';
  if (room.timers.question) {
    clearTimeout(room.timers.question);
    room.timers.question = null;
  }

  const leaderboard = getLeaderboard(room.sessionId);
  const questionsTotal = room.questions.length;
  const isLast = room.currentIdx >= questionsTotal - 1;

  io.to(roomCode).emit('question_ended', {
    questionId: question.id,
    correctOptionIds: correctIds,
    leaderboard,
    isLast,
    nextIn: isLast ? null : 5,
  });

  if (isLast) {
    room.timers.advance = setTimeout(() => finishQuiz(io, roomCode), 5000);
  } else {
    room.timers.advance = setTimeout(() => startQuestion(io, roomCode, room.currentIdx + 1), 5000);
  }
}

function startQuestion(io, roomCode, idx) {
  const room = rooms.get(roomCode);
  if (!room) return;
  if (room.timers.advance) { clearTimeout(room.timers.advance); room.timers.advance = null; }

  if (idx >= room.questions.length) {
    finishQuiz(io, roomCode);
    return;
  }

  room.currentIdx = idx;
  room.phase = 'question';
  room.timeLimit = room.quizTimeLimit;

  // Reset answered flags
  for (const p of room.participants.values()) p.answeredCurrentQuestion = false;

  db.prepare('UPDATE sessions SET current_question = ? WHERE id = ?').run(idx, room.sessionId);

  const question = room.questions[idx];
  // Send question without correct answers
  const safeOptions = question.options.map(o => ({ id: o.id, text: o.text }));
  const deadline = Date.now() + room.timeLimit * 1000;

  io.to(roomCode).emit('question_started', {
    questionIndex: idx,
    totalQuestions: room.questions.length,
    question: {
      id: question.id,
      text: question.text,
      image_url: question.image_url,
      type: question.type,
      options: safeOptions,
    },
    timeLimit: room.timeLimit,
    deadline,
  });

  room.timers.question = setTimeout(() => endQuestion(io, roomCode), room.timeLimit * 1000);
}

function finishQuiz(io, roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  if (room.timers.advance) { clearTimeout(room.timers.advance); room.timers.advance = null; }
  if (room.timers.question) { clearTimeout(room.timers.question); room.timers.question = null; }

  room.phase = 'ended';
  db.prepare('UPDATE sessions SET status = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?').run('finished', room.sessionId);

  const leaderboard = getLeaderboard(room.sessionId);
  io.to(roomCode).emit('quiz_ended', { leaderboard });
}

export function registerSocketHandlers(io) {
  io.on('connection', (socket) => {

    socket.on('join_lobby', ({ roomCode, token }) => {
      const user = verifySocketToken(token);
      if (!user) return socket.emit('error', { message: 'Authentication failed' });

      const code = roomCode?.toUpperCase();
      const session = db.prepare(`
        SELECT s.*, q.time_per_question FROM sessions s
        JOIN quizzes q ON q.id = s.quiz_id
        WHERE s.room_code = ?
      `).get(code);

      if (!session) return socket.emit('error', { message: 'Room not found' });
      if (session.status === 'finished') return socket.emit('error', { message: 'Quiz already finished' });

      socket.join(code);
      socket.data = { userId: user.id, userName: user.name, roomCode: code, role: user.role };

      if (user.role === 'organizer' && session.organizer_id === user.id) {
        // Organizer re/joins
        if (!rooms.has(code)) {
          const questions = db.prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_num, id').all(session.quiz_id);
          for (const q of questions) {
            q.options = db.prepare('SELECT * FROM options WHERE question_id = ?').all(q.id);
          }
          rooms.set(code, {
            sessionId: session.id,
            quizId: session.quiz_id,
            quizTimeLimit: session.time_per_question,
            organizerSocketId: socket.id,
            participants: new Map(),
            questions,
            currentIdx: -1,
            phase: 'lobby',
            timeLimit: session.time_per_question,
            timers: { question: null, advance: null },
          });
        } else {
          rooms.get(code).organizerSocketId = socket.id;
        }
        const room = rooms.get(code);
        const participants = Array.from(room.participants.values()).map(p => ({ id: p.userId, name: p.name }));
        socket.emit('lobby_joined', { session, participants, isOrganizer: true });
      } else {
        // Participant joins
        if (!rooms.has(code)) return socket.emit('error', { message: 'Organizer not connected yet' });
        const room = rooms.get(code);

        if (session.status === 'active') {
          return socket.emit('error', { message: 'Quiz already in progress' });
        }

        try {
          db.prepare('INSERT OR IGNORE INTO session_participants (session_id, user_id) VALUES (?, ?)').run(session.id, user.id);
        } catch {}

        room.participants.set(user.id, {
          socketId: socket.id,
          userId: user.id,
          name: user.name,
          answeredCurrentQuestion: false,
        });

        const participants = Array.from(room.participants.values()).map(p => ({ id: p.userId, name: p.name }));
        socket.emit('lobby_joined', { session, participants, isOrganizer: false });
        io.to(code).emit('participant_joined', { id: user.id, name: user.name, participants });
      }
    });

    socket.on('start_quiz', ({ roomCode, token }) => {
      const user = verifySocketToken(token);
      if (!user || user.role !== 'organizer') return socket.emit('error', { message: 'Not authorized' });

      const code = roomCode?.toUpperCase();
      const room = rooms.get(code);
      if (!room) return socket.emit('error', { message: 'Room not found' });
      if (room.phase !== 'lobby') return socket.emit('error', { message: 'Quiz already started' });
      if (room.questions.length === 0) return socket.emit('error', { message: 'No questions in quiz' });

      db.prepare('UPDATE sessions SET status = ?, started_at = CURRENT_TIMESTAMP WHERE id = ?').run('active', room.sessionId);
      io.to(code).emit('quiz_starting', { in: 3 });
      setTimeout(() => startQuestion(io, code, 0), 3000);
    });

    socket.on('submit_answer', ({ roomCode, questionId, selectedOptions, timeTaken, token }) => {
      const user = verifySocketToken(token);
      if (!user) return socket.emit('error', { message: 'Authentication failed' });

      const code = roomCode?.toUpperCase();
      const room = rooms.get(code);
      if (!room || room.phase !== 'question') return socket.emit('error', { message: 'No active question' });

      const currentQuestion = room.questions[room.currentIdx];
      if (currentQuestion.id !== questionId) return socket.emit('error', { message: 'Wrong question' });

      const participant = room.participants.get(user.id);
      if (!participant || participant.answeredCurrentQuestion) {
        return socket.emit('error', { message: 'Already answered' });
      }

      participant.answeredCurrentQuestion = true;
      const effectiveTime = Math.min(timeTaken, room.timeLimit);

      // Calculate score
      const selected = Array.isArray(selectedOptions) ? selectedOptions : [selectedOptions];
      let score = 0;
      let isCorrect = false;

      if (currentQuestion.type === 'single') {
        const correctOption = currentQuestion.options.find(o => o.is_correct);
        isCorrect = correctOption && selected.includes(correctOption.id);
        score = calcScore(isCorrect, effectiveTime, room.timeLimit);
      } else {
        const correctIds = currentQuestion.options.filter(o => o.is_correct).map(o => o.id);
        const allIds = currentQuestion.options.map(o => o.id);
        score = calcMultipleScore(selected, correctIds, allIds, effectiveTime, room.timeLimit);
        isCorrect = score > 0 && selected.sort().join() === correctIds.sort().join();
      }

      try {
        db.prepare(`
          INSERT OR REPLACE INTO participant_answers (session_id, question_id, user_id, selected_options, is_correct, score, time_taken)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(room.sessionId, questionId, user.id, JSON.stringify(selected), isCorrect ? 1 : 0, score, effectiveTime);
      } catch {}

      socket.emit('answer_received', { questionId, score, isCorrect });

      // Check if all participants answered
      const allAnswered = Array.from(room.participants.values()).every(p => p.answeredCurrentQuestion);
      if (allAnswered) {
        if (room.timers.question) { clearTimeout(room.timers.question); room.timers.question = null; }
        setTimeout(() => endQuestion(io, code), 500);
      }
    });

    socket.on('skip_to_next', ({ roomCode, token }) => {
      const user = verifySocketToken(token);
      if (!user || user.role !== 'organizer') return;
      const code = roomCode?.toUpperCase();
      const room = rooms.get(code);
      if (!room || room.phase !== 'results') return;
      if (room.timers.advance) { clearTimeout(room.timers.advance); room.timers.advance = null; }
      const nextIdx = room.currentIdx + 1;
      if (nextIdx >= room.questions.length) finishQuiz(io, code);
      else startQuestion(io, code, nextIdx);
    });

    socket.on('end_quiz', ({ roomCode, token }) => {
      const user = verifySocketToken(token);
      if (!user || user.role !== 'organizer') return;
      const code = roomCode?.toUpperCase();
      const room = rooms.get(code);
      if (!room) return;
      if (room.timers.question) { clearTimeout(room.timers.question); room.timers.question = null; }
      finishQuiz(io, code);
    });

    socket.on('disconnect', () => {
      const { roomCode, userId, role } = socket.data || {};
      if (!roomCode) return;
      const room = rooms.get(roomCode);
      if (!room) return;
      if (role !== 'organizer') {
        const participant = room.participants.get(userId);
        if (participant && participant.socketId === socket.id) {
          room.participants.delete(userId);
          io.to(roomCode).emit('participant_left', { id: userId });
        }
      }
    });
  });
}
