import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

const CATEGORIES = ['General', 'Наука', 'История', 'Спорт', 'Музыка', 'Кино', 'Технологии', 'Природа'];

export default function OrganizerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(null); // quiz id being launched

  useEffect(() => {
    Promise.all([
      api.get('/quizzes'),
      api.get('/sessions/my'),
    ]).then(([qRes, sRes]) => {
      setQuizzes(qRes.data);
      setSessions(sRes.data);
    }).finally(() => setLoading(false));
  }, []);

  const deleteQuiz = async (id) => {
    if (!confirm('Удалить квиз? Это действие нельзя отменить.')) return;
    await api.delete(`/quizzes/${id}`);
    setQuizzes(q => q.filter(x => x.id !== id));
  };

  const launchQuiz = async (quizId) => {
    setCreating(quizId);
    try {
      const { data } = await api.post('/sessions', { quiz_id: quizId });
      navigate(`/live/${data.room_code}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка запуска');
    } finally {
      setCreating(null);
    }
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Мои квизы</h1>
          <p className="page-subtitle">Привет, {user.name}! Создавай и запускай квизы.</p>
        </div>
        <Link to="/quiz/create" className="btn btn-primary">+ Новый квиз</Link>
      </div>

      {quizzes.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div className="empty-state-icon">🎯</div>
          <div className="empty-state-title">У вас ещё нет квизов</div>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>Создайте первый квиз и пригласите участников</p>
          <Link to="/quiz/create" className="btn btn-primary">Создать квиз</Link>
        </div>
      ) : (
        <div className="grid grid-2">
          {quizzes.map(quiz => (
            <div key={quiz.id} className="quiz-card" onClick={() => navigate(`/quiz/${quiz.id}/edit`)}>
              <div>
                <div className="quiz-card-title">{quiz.title}</div>
                {quiz.description && <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 4 }}>{quiz.description}</p>}
              </div>
              <div className="quiz-card-meta">
                <span className="badge badge-blue">{quiz.category}</span>
                <span className="badge badge-gray">{quiz.question_count} вопросов</span>
                <span className="badge badge-gray">{quiz.time_per_question}с/вопрос</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }} onClick={e => e.stopPropagation()}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => launchQuiz(quiz.id)}
                  disabled={creating === quiz.id || quiz.question_count === 0}
                  title={quiz.question_count === 0 ? 'Добавьте хотя бы один вопрос' : ''}
                >
                  {creating === quiz.id ? '...' : '▶ Запустить'}
                </button>
                <Link to={`/quiz/${quiz.id}/edit`} className="btn btn-secondary btn-sm" onClick={e => e.stopPropagation()}>
                  Редактировать
                </Link>
                <button className="btn btn-danger btn-sm" onClick={() => deleteQuiz(quiz.id)}>Удалить</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sessions.length > 0 && (
        <>
          <div style={{ marginTop: 40, marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>История сессий</h2>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Квиз</th>
                  <th>Код комнаты</th>
                  <th>Участники</th>
                  <th>Статус</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => s.status === 'finished' && navigate(`/results/${s.id}`)}>
                    <td style={{ fontWeight: 600 }}>{s.quiz_title}</td>
                    <td><code style={{ fontWeight: 700, letterSpacing: 2 }}>{s.room_code}</code></td>
                    <td>{s.participant_count}</td>
                    <td>
                      <span className={`badge ${s.status === 'finished' ? 'badge-green' : s.status === 'active' ? 'badge-orange' : 'badge-gray'}`}>
                        {s.status === 'finished' ? 'Завершён' : s.status === 'active' ? 'Активен' : 'Ожидание'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {new Date(s.created_at).toLocaleDateString('ru-RU')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
