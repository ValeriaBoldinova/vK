import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../../context/AuthContext.jsx';
import Timer from '../../components/Timer.jsx';
import Leaderboard from '../../components/Leaderboard.jsx';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export default function QuizGame() {
  const { roomCode } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const socketRef = useRef(null);

  const [phase, setPhase] = useState('lobby'); // lobby | starting | question | answer_wait | results | ended
  const [participants, setParticipants] = useState([]);
  const [session, setSession] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionMeta, setQuestionMeta] = useState(null);
  const [selected, setSelected] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [answerResult, setAnswerResult] = useState(null); // { score, isCorrect }
  const [correctIds, setCorrectIds] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [countdown, setCountdown] = useState(null);
  const [error, setError] = useState('');
  const questionStartRef = useRef(0);

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
      setSelected([]);
      setSubmitted(false);
      setAnswerResult(null);
      setCorrectIds([]);
      questionStartRef.current = Date.now();
      setPhase('question');
    });

    socket.on('answer_received', ({ score, isCorrect }) => {
      setAnswerResult({ score, isCorrect });
      setPhase('answer_wait');
    });

    socket.on('question_ended', ({ correctOptionIds, leaderboard: lb }) => {
      setCorrectIds(correctOptionIds);
      setLeaderboard(lb);
      setPhase('results');
    });

    socket.on('quiz_ended', ({ leaderboard: lb }) => {
      setLeaderboard(lb);
      setPhase('ended');
    });

    socket.on('error', ({ message }) => setError(message));

    return () => socket.disconnect();
  }, [roomCode]);

  const toggleOption = (id) => {
    if (submitted) return;
    if (!currentQuestion) return;
    if (currentQuestion.type === 'single') {
      setSelected([id]);
    } else {
      setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
    }
  };

  const submitAnswer = () => {
    if (submitted || selected.length === 0) return;
    const timeTaken = (Date.now() - questionStartRef.current) / 1000;
    const token = sessionStorage.getItem('token');
    setSubmitted(true);
    socketRef.current?.emit('submit_answer', {
      roomCode,
      questionId: currentQuestion.id,
      selectedOptions: selected,
      timeTaken,
      token,
    });
  };

  if (error) return (
    <div className="quiz-arena" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ textAlign: 'center', color: '#fff' }}>
        <div style={{ fontSize: '2rem', marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: '1.2rem', marginBottom: 16 }}>{error}</div>
        <button className="btn btn-secondary" onClick={() => navigate('/join')}>Выйти</button>
      </div>
    </div>
  );

  return (
    <div className="quiz-arena">
      <div className="quiz-arena-header">
        <div>
          <span style={{ color: 'rgba(255,255,255,.5)', fontSize: '0.82rem' }}>Код комнаты</span>
          <div style={{ fontWeight: 700 }}>{roomCode}</div>
        </div>
        {questionMeta && (
          <div style={{ color: 'rgba(255,255,255,.6)', fontSize: '0.85rem' }}>
            {questionMeta.index + 1} / {questionMeta.total}
          </div>
        )}
        <div style={{ color: 'rgba(255,255,255,.6)', fontSize: '0.85rem' }}>{user.name}</div>
      </div>

      <div className="quiz-arena-body">
        {phase === 'lobby' && (
          <div style={{ textAlign: 'center', color: '#fff', maxWidth: 480, width: '100%' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>⏳</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 8 }}>
              {session?.quiz_title || 'Загрузка...'}
            </h2>
            <p style={{ color: 'rgba(255,255,255,.6)', marginBottom: 32 }}>
              Ждём пока организатор запустит квиз
            </p>
            <div className="card" style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)' }}>
              <div style={{ color: 'rgba(255,255,255,.6)', fontSize: '0.85rem', marginBottom: 8 }}>
                Участники ({participants.length}):
              </div>
              <div className="participants-list">
                {participants.map(p => (
                  <span key={p.id} className="participant-chip" style={p.id === user.id ? { borderColor: '#0077ff', color: '#60a5fa' } : {}}>
                    {p.name}{p.id === user.id ? ' (вы)' : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {phase === 'starting' && (
          <div style={{ textAlign: 'center', color: '#fff' }}>
            <div style={{ fontSize: '8rem', fontWeight: 900, lineHeight: 1 }}>{countdown}</div>
            <div style={{ fontSize: '1.5rem', marginTop: 16, opacity: .7 }}>Приготовьтесь!</div>
          </div>
        )}

        {(phase === 'question' || phase === 'answer_wait') && currentQuestion && (
          <div className="question-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ color: 'rgba(255,255,255,.6)', fontSize: '0.85rem' }}>
                Вопрос {questionMeta?.index + 1} из {questionMeta?.total}
              </span>
              {phase === 'question' && (
                <Timer deadline={questionMeta?.deadline} timeLimit={questionMeta?.timeLimit} />
              )}
              {phase === 'answer_wait' && (
                <span style={{ color: 'rgba(255,255,255,.5)', fontSize: '0.85rem' }}>Ждём остальных...</span>
              )}
            </div>

            {currentQuestion.image_url && (
              <img src={currentQuestion.image_url} className="question-image" alt="" />
            )}
            <div className="question-text">{currentQuestion.text}</div>

            {currentQuestion.type === 'multiple' && phase === 'question' && !submitted && (
              <p style={{ textAlign: 'center', color: 'rgba(255,255,255,.5)', fontSize: '0.85rem', marginBottom: 12 }}>
                Можно выбрать несколько вариантов
              </p>
            )}

            <div className="options-grid">
              {currentQuestion.options.map(opt => {
                let cls = 'option-btn';
                if (selected.includes(opt.id)) cls += ' selected';
                return (
                  <button
                    key={opt.id}
                    className={cls}
                    onClick={() => toggleOption(opt.id)}
                    disabled={submitted}
                  >
                    {opt.text}
                  </button>
                );
              })}
            </div>

            {phase === 'question' && !submitted && selected.length > 0 && (
              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <button className="btn btn-success btn-lg" onClick={submitAnswer}>
                  Ответить ✓
                </button>
              </div>
            )}

            {phase === 'answer_wait' && answerResult && (
              <div className="score-feedback" style={{ marginTop: 16 }}>
                <div className={`score-big ${answerResult.isCorrect ? 'correct' : 'wrong'}`}>
                  {answerResult.isCorrect ? `+${answerResult.score}` : '0'}
                </div>
                <div style={{ color: 'rgba(255,255,255,.7)', marginTop: 8, fontSize: '1.1rem' }}>
                  {answerResult.isCorrect ? '✓ Правильно!' : '✗ Неверно'}
                </div>
              </div>
            )}

            {phase === 'answer_wait' && !answerResult && (
              <div style={{ textAlign: 'center', marginTop: 20, color: 'rgba(255,255,255,.5)' }}>
                <div className="spinner" style={{ margin: '0 auto', borderTopColor: '#fff' }} />
              </div>
            )}
          </div>
        )}

        {phase === 'results' && currentQuestion && (
          <div className="question-card">
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div className="question-text" style={{ fontSize: '1.1rem' }}>{currentQuestion.text}</div>
            </div>
            <div className="options-grid" style={{ marginBottom: 24 }}>
              {currentQuestion.options.map(opt => {
                let cls = 'option-btn';
                if (correctIds.includes(opt.id)) {
                  cls += selected.includes(opt.id) ? ' correct' : ' missed';
                } else if (selected.includes(opt.id)) {
                  cls += ' wrong';
                }
                return <button key={opt.id} className={cls} disabled>{opt.text}</button>;
              })}
            </div>
            {answerResult && (
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div className={`score-big ${answerResult.isCorrect ? 'correct' : 'wrong'}`} style={{ fontSize: '2.5rem' }}>
                  {answerResult.isCorrect ? `+${answerResult.score}` : '0'}
                </div>
              </div>
            )}
            <div style={{ borderTop: '1px solid rgba(255,255,255,.15)', paddingTop: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 12, color: 'rgba(255,255,255,.7)', fontSize: '0.85rem' }}>
                ТЕКУЩИЙ РЕЙТИНГ
              </div>
              <Leaderboard leaderboard={leaderboard.slice(0, 5)} highlightId={user.id} />
            </div>
          </div>
        )}

        {phase === 'ended' && (
          <div style={{ textAlign: 'center', maxWidth: 560, width: '100%' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🏆</div>
            <h2 style={{ color: '#fff', fontSize: '1.8rem', fontWeight: 800, marginBottom: 8 }}>Квиз завершён!</h2>
            {(() => {
              const myPos = leaderboard.findIndex(x => x.id === user.id);
              const myEntry = leaderboard[myPos];
              return myEntry ? (
                <p style={{ color: 'rgba(255,255,255,.7)', marginBottom: 24, fontSize: '1.1rem' }}>
                  Вы заняли {myPos + 1} место с {myEntry.total_score} очками
                </p>
              ) : null;
            })()}
            <div style={{ marginBottom: 32 }}>
              <Leaderboard leaderboard={leaderboard} highlightId={user.id} />
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/join')}>Ещё квиз</button>
          </div>
        )}
      </div>
    </div>
  );
}
