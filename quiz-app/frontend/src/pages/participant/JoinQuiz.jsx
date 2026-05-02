import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function JoinQuiz() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || trimmed.length !== 6) {
      return setError('Введите 6-значный код комнаты');
    }
    setError('');
    setLoading(true);
    try {
      const { data } = await api.get(`/sessions/by-code/${trimmed}`);
      if (data.status === 'finished') return setError('Этот квиз уже завершён');
      navigate(`/room/${trimmed}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Комната не найдена');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', paddingTop: 40 }}>
      <div className="page-header" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 8 }}>🎮</div>
        <h1 className="page-title">Войти в квиз</h1>
        <p className="page-subtitle">Введите код комнаты от организатора</p>
      </div>

      <div className="card card-lg">
        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleJoin}>
          <div className="form-group">
            <label className="form-label">Код комнаты</label>
            <input
              className="form-input"
              type="text"
              placeholder="XXXXXX"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              style={{ textAlign: 'center', fontSize: '2rem', fontWeight: 800, letterSpacing: 8, padding: '16px' }}
              maxLength={6}
              autoFocus
              required
            />
          </div>
          <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading || code.length !== 6}>
            {loading ? 'Ищем...' : 'Войти'}
          </button>
        </form>

        <div className="divider" />
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          Попросите организатора показать код комнаты на экране
        </p>
      </div>

      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <Link to="/dashboard" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          ← Вернуться на главную
        </Link>
      </div>
    </div>
  );
}
