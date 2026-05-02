import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/client.js';

const CATEGORIES = ['General', 'Наука', 'История', 'Спорт', 'Музыка', 'Кино', 'Технологии', 'Природа', 'Еда', 'Путешествия'];

export default function CreateQuiz() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', description: '', category: 'General', time_per_question: 30 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/quizzes', form);
      navigate(`/quiz/${data.id}/edit`);
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка создания');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="page-header">
        <Link to="/dashboard" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>← Назад</Link>
        <h1 className="page-title" style={{ marginTop: 8 }}>Новый квиз</h1>
      </div>

      <div className="card card-lg">
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Название квиза *</label>
            <input
              className="form-input"
              type="text"
              placeholder="Например: Викторина о природе"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Описание</label>
            <textarea
              className="form-input form-textarea"
              placeholder="Краткое описание квиза..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Категория</label>
            <select
              className="form-select"
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            >
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Время на вопрос: {form.time_per_question} сек</label>
            <input
              type="range" min={10} max={120} step={5}
              value={form.time_per_question}
              onChange={e => setForm(f => ({ ...f, time_per_question: +e.target.value }))}
              style={{ width: '100%', accentColor: 'var(--primary)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              <span>10с</span><span>120с</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ flex: 1 }}>
              {loading ? 'Создаём...' : 'Создать и добавить вопросы →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
