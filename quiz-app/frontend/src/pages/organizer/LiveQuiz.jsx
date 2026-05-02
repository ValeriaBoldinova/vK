import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../../context/AuthContext.jsx';
import Timer from '../../components/Timer.jsx';
import Leaderboard from '../../components/Leaderboard.jsx';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export default function LiveQuiz() {
  const { roomCode } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const [phase, setPhase] = useState('lobby'); // lobby | starting | question | results | ended
  const [participants, setParticipants] = useState([]);
  const [session, setSession] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionMeta, setQuestionMeta] = useState(null); // index, total, timeLimit, deadline
  const [correctIds, setCorrectIds] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [countdown, setCountdown] = useState(null);
  const [error, setError] = useState('');
  const [nextIn, setNextIn] = useState(null);

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_lobby', { roomCode, token });
    });

    socket.on('lobby_joined', ({ session: s, participants: p }) => {
      setSession(s);
      setParticipants(p);
      setPhase('lobby');
    });

    socket.on('participant_joined', ({ participants: p }) => setParticipants(p));
    socket.on('participant_left', ({ id }) => setParticipants(p => p.filter(x => x.id !== id)));

    socket.on('quiz_starting', ({ in: secs }) => {
      setCountdown(secs);
      setPhase('starting');
      let c = secs;
      const t = setInterval(() => { c--; setCountdown(c); if (c <= 0) clearInterval(t); }, 1000);
    });

    socket.on('question_started', ({ question, questionIndex, totalQuestions, timeLimit, deadline }) => {
      setCurrentQuestion(question);
      setQuestionMeta({ index: questionIndex, total: totalQuestions, timeLimit, deadline });
      setCorrectIds([]);
      setPhase('question');
    });

    socket.on('question_ended', ({ correctOptionIds, leaderboard: lb, isLast, nextIn: ni }) => {
      setCorrectIds(correctOptionIds);
      setLeaderboard(lb);
      setNextIn(ni);
      setPhase('results');
    });

    socket.on('quiz_ended', ({ leaderboard: lb }) => {
      setLeaderboard(lb);
      setPhase('ended');
    });

    socket.on('error', ({ message }) => setError(message));

    return () => socket.disconnect();
  }, [roomCode]);

  const startQuiz = () => {
    const token = sessionStorage.getItem('token');
    socketRef.current?.emit('start_quiz', { roomCode, token });
  };

  const skipToNext = () => {
    const token = sessionStorage.getItem('token');
    socketRef.current?.emit('skip_to_next', { roomCode, token });
  };

  const endQuiz = () => {
    if (!confirm('Завершить квиз досрочно?')) return;
    const token = sessionStorage.getItem('token');
    socketRef.current?.emit('end_quiz', { roomCode, token });
  };

  if (error) return (
    <div className="quiz-arena" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ textAlign: 'center', color: '#fff' }}>
        <div style={{ fontSize: '2rem', marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: '1.2rem', marginBottom: 16 }}>{error}</div>
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>На главную</button>
      </div>
    </div>
  );

  return (
    <div className="quiz-arena">
      <div className="quiz-arena-header">
        <div>
          <span style={{ color: 'rgba(255,255,255,.5)', fontSize: '0.85rem' }}>Код комнаты</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: 4 }}>{roomCode}</div>
        </div>
        {phase !== 'ended' && (
          <div style={{ display: 'flex', gap: 8 }}>
            {phase === 'results' && (
              <button className="btn btn-success btn-sm" onClick={skipToNext}>Следующий →</button>
            )}
            <button className="btn btn-danger btn-sm" onClick={endQuiz}>Завершить</button>
          </div>
        )}
        {questionMeta && (
          <div style={{ color: 'rgba(255,255,255,.7)', fontSize: '0.9rem' }}>
            {questionMeta.index + 1} / {questionMeta.total}
          </div>
        )}
      </div>

      <div className="quiz-arena-body">
        {phase === 'lobby' && (
          <div style={{ textAlign: 'center', maxWidth: 640, width: '100%' }}>
            <p style={{ color: 'rgba(255,255,255,.6)', marginBottom: 8, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: 2 }}>
              Код для участников
            </p>
            <div className="lobby-code">{roomCode}</div>
            <p style={{ color: 'rgba(255,255,255,.5)', marginTop: 12, marginBottom: 32 }}>
              Участники подключаются по этому коду
            </p>

            <div className="card" style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', marginBottom: 32 }}>
              <div style={{ color: 'rgba(255,255,255,.6)', marginBottom: 8, fontSize: '0.85rem', fontWeight: 600 }}>
                Участники онлайн: {participants.length}
              </div>
              <div className="participants-list">
                {participants.length === 0
                  ? <p style={{ color: 'rgba(255,255,255,.4)', width: '100%', textAlign: 'center', padding: '12px 0' }}>Ждём участников...</p>
                  : participants.map(p => <span key={p.id} className="participant-chip">{p.name}</span>)
                }
              </div>
            </div>

            <button
              className="btn btn-success btn-lg"
              onClick={startQuiz}
              disabled={participants.length === 0}
              style={{ fontSize: '1.1rem', padding: '16px 40px' }}
            >
              {participants.length === 0 ? 'Ждём участников...' : `Начать квиз (${participants.length})`}
            </button>
          </div>
        )}

        {phase === 'starting' && (
          <div style={{ textAlign: 'center', color: '#fff' }}>
            <div style={{ fontSize: '8rem', fontWeight: 900, lineHeight: 1 }}>{countdown}</div>
            <div style={{ fontSize: '1.5rem', marginTop: 16, opacity: .7 }}>Приготовьтесь!</div>
          </div>
        )}

        {(phase === 'question' || phase === 'results') && currentQuestion && (
          <div className="question-card" style={{ maxWidth: 900 }}>
            {questionMeta && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ color: 'rgba(255,255,255,.6)', fontSize: '0.85rem' }}>
                  Вопрос {questionMeta.index + 1} из {questionMeta.total}
                </span>
                {phase === 'question' && (
                  <Timer deadline={questionMeta.deadline} timeLimit={questionMeta.timeLimit} />
                )}
                {phase === 'results' && nextIn && (
                  <span style={{ color: 'rgba(255,255,255,.6)', fontSize: '0.85rem' }}>
                    Следующий через {nextIn}с...
                  </span>
                )}
              </div>
            )}

            {currentQuestion.image_url && (
              <img src={currentQuestion.image_url} className="question-image" alt="" />
            )}
            <div className="question-text">{currentQuestion.text}</div>

            <div className="options-grid">
              {currentQuestion.options.map(opt => {
                let cls = 'option-btn';
                if (phase === 'results') {
                  if (correctIds.includes(opt.id)) cls += ' correct';
                }
                return (
                  <button key={opt.id} className={cls} disabled>
                    {opt.text}
                  </button>
                );
              })}
            </div>

            {phase === 'results' && (
              <div style={{ marginTop: 24, borderTop: '1px solid rgba(255,255,255,.15)', paddingTop: 24 }}>
                <div style={{ fontWeight: 700, marginBottom: 12, color: 'rgba(255,255,255,.8)', fontSize: '0.9rem' }}>
                  ЛИДЕРБОРД
                </div>
                <Leaderboard leaderboard={leaderboard.slice(0, 5)} />
              </div>
            )}
          </div>
        )}

        {phase === 'ended' && (
          <div style={{ textAlign: 'center', maxWidth: 640, width: '100%' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>🏆</div>
            <h2 style={{ color: '#fff', fontSize: '1.8rem', fontWeight: 800, marginBottom: 24 }}>Квиз завершён!</h2>
            <div style={{ marginBottom: 32 }}>
              <Leaderboard leaderboard={leaderboard} />
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>На главную</button>
          </div>
        )}
      </div>
    </div>
  );
}
