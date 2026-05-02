import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/users/profile').then(({ data }) => setProfile(data)).finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  const stats = profile?.stats;

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="page-header">
        <h1 className="page-title">Профиль</h1>
      </div>

      <div className="card card-lg" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary) 0%, #0f3460 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: '2rem', fontWeight: 800, flexShrink: 0,
          }}>
            {profile?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{profile?.name}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{profile?.email}</div>
            <div style={{ marginTop: 6 }}>
              <span className={`badge ${profile?.role === 'organizer' ? 'badge-blue' : 'badge-green'}`}>
                {profile?.role === 'organizer' ? '🎯 Организатор' : '🎮 Участник'}
              </span>
            </div>
          </div>
        </div>

        <div className="divider" />

        <div className="stats-grid">
          {profile?.role === 'organizer' ? (
            <>
              <div className="stat-card">
                <div className="stat-value">{stats?.quiz_count || 0}</div>
                <div className="stat-label">Квизов создано</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats?.session_count || 0}</div>
                <div className="stat-label">Сессий проведено</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats?.total_participants || 0}</div>
                <div className="stat-label">Всего участников</div>
              </div>
            </>
          ) : (
            <>
              <div className="stat-card">
                <div className="stat-value">{stats?.sessions_joined || 0}</div>
                <div className="stat-label">Квизов пройдено</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats?.total_score || 0}</div>
                <div className="stat-label">Всего очков</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats?.correct_answers || 0}</div>
                <div className="stat-label">Верных ответов</div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Информация об аккаунте</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          <div>Имя: <strong style={{ color: 'var(--text)' }}>{profile?.name}</strong></div>
          <div>Email: <strong style={{ color: 'var(--text)' }}>{profile?.email}</strong></div>
          <div>Роль: <strong style={{ color: 'var(--text)' }}>{profile?.role === 'organizer' ? 'Организатор' : 'Участник'}</strong></div>
          <div>Дата регистрации: <strong style={{ color: 'var(--text)' }}>
            {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('ru-RU') : '—'}
          </strong></div>
        </div>
        <div className="divider" />
        <button className="btn btn-danger btn-sm" onClick={handleLogout}>Выйти из аккаунта</button>
      </div>
    </div>
  );
}
