import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Leaderboard from '../components/Leaderboard.jsx';

export default function Results() {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/sessions/${sessionId}/results`).then(({ data }) => setData(data)).finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!data) return <div className="page-header"><h1 className="page-title">Результаты не найдены</h1></div>;

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="page-header">
        <h1 className="page-title">Результаты квиза</h1>
        <p className="page-subtitle">{data.session?.quiz_title || 'Квиз завершён'}</p>
      </div>

      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)',
        borderRadius: 16, padding: '32px', marginBottom: 24, color: '#fff'
      }}>
        <Leaderboard leaderboard={data.leaderboard} highlightId={user.id} />
      </div>

      <button className="btn btn-secondary" onClick={() => navigate(user.role === 'organizer' ? '/dashboard' : '/join')}>
        ← Назад
      </button>
    </div>
  );
}
