import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function ParticipantDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/sessions/history/me').then(({ data }) => setHistory(data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Привет, {user.name}!</h1>
          <p className="page-subtitle">Присоединяйтесь к квизам по коду комнаты</p>
        </div>
        <Link to="/join" className="btn btn-primary btn-lg">🎮 Войти в квиз</Link>
      </div>

      <div style={{ marginBottom: 32 }}>
        <div className="card" style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)',
          color: '#fff', padding: '32px', borderRadius: 16
        }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>Готовы к игре?</h2>
          <p style={{ opacity: .7, marginBottom: 20 }}>Введите код комнаты от организатора и начните отвечать</p>
          <Link to="/join" className="btn btn-primary">Войти по коду →</Link>
        </div>
      </div>

      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 16 }}>История квизов</h2>

      {history.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div className="empty-state-icon">🎯</div>
          <div className="empty-state-title">Вы ещё не участвовали в квизах</div>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>Попросите организатора код комнаты</p>
          <Link to="/join" className="btn btn-primary">Войти в первый квиз</Link>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Квиз</th>
                <th>Организатор</th>
                <th>Мои очки</th>
                <th>Верных</th>
                <th>Дата</th>
              </tr>
            </thead>
            <tbody>
              {history.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.quiz_title}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{s.organizer_name}</td>
                  <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{s.my_score}</td>
                  <td>{s.correct_count} ✓</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {new Date(s.created_at).toLocaleDateString('ru-RU')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
