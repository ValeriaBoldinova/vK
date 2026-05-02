import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/client.js';

const CATEGORIES = ['General', 'Наука', 'История', 'Спорт', 'Музыка', 'Кино', 'Технологии', 'Природа', 'Еда', 'Путешествия'];

function QuestionForm({ onSave, onCancel, initial }) {
  const [text, setText] = useState(initial?.text || '');
  const [type, setType] = useState(initial?.type || 'single');
  const [options, setOptions] = useState(
    initial?.options?.length >= 2
      ? initial.options.map(o => ({ text: o.text, is_correct: !!o.is_correct }))
      : [{ text: '', is_correct: true }, { text: '', is_correct: false }, { text: '', is_correct: false }, { text: '', is_correct: false }]
  );
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(initial?.image_url || null);
  const [error, setError] = useState('');

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const addOption = () => setOptions(o => [...o, { text: '', is_correct: false }]);
  const removeOption = (i) => setOptions(o => o.filter((_, idx) => idx !== i));
  const toggleCorrect = (i) => {
    if (type === 'single') {
      setOptions(o => o.map((opt, idx) => ({ ...opt, is_correct: idx === i })));
    } else {
      setOptions(o => o.map((opt, idx) => idx === i ? { ...opt, is_correct: !opt.is_correct } : opt));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!text.trim()) return setError('Введите текст вопроса');
    const valid = options.filter(o => o.text.trim());
    if (valid.length < 2) return setError('Нужно минимум 2 варианта ответа');
    if (!valid.some(o => o.is_correct)) return setError('Отметьте хотя бы один правильный ответ');

    const fd = new FormData();
    fd.append('text', text);
    fd.append('type', type);
    fd.append('options', JSON.stringify(valid));
    if (image) fd.append('image', image);
    onSave(fd);
  };

  return (
    <div className="question-builder">
      <h3 style={{ fontWeight: 700, marginBottom: 16 }}>{initial ? 'Редактировать вопрос' : 'Новый вопрос'}</h3>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Текст вопроса *</label>
          <textarea
            className="form-input form-textarea"
            placeholder="Введите вопрос..."
            value={text}
            onChange={e => setText(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Изображение (необязательно)</label>
          <input type="file" accept="image/*" onChange={handleImageChange} style={{ fontSize: '0.9rem' }} />
          {preview && (
            <img src={preview} alt="preview" style={{ marginTop: 8, maxHeight: 160, borderRadius: 8, objectFit: 'contain' }} />
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Тип вопроса</label>
          <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
            <option value="single">Одиночный выбор</option>
            <option value="multiple">Множественный выбор</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">
            Варианты ответов
            <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8, fontSize: '0.82rem' }}>
              ({type === 'single' ? 'выберите один правильный' : 'можно несколько правильных'})
            </span>
          </label>
          {options.map((opt, i) => (
            <div key={i} className="option-row">
              <input
                type={type === 'single' ? 'radio' : 'checkbox'}
                checked={opt.is_correct}
                onChange={() => toggleCorrect(i)}
                className="option-correct-check"
                title="Правильный ответ"
              />
              <input
                className="form-input"
                style={{ flex: 1 }}
                type="text"
                placeholder={`Вариант ${i + 1}`}
                value={opt.text}
                onChange={e => setOptions(o => o.map((x, idx) => idx === i ? { ...x, text: e.target.value } : x))}
              />
              {options.length > 2 && (
                <button type="button" className="btn btn-danger btn-sm btn-icon" onClick={() => removeOption(i)}>✕</button>
              )}
            </div>
          ))}
          {options.length < 6 && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={addOption} style={{ marginTop: 4 }}>
              + Добавить вариант
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" type="submit">Сохранить</button>
          <button className="btn btn-secondary" type="button" onClick={onCancel}>Отмена</button>
        </div>
      </form>
    </div>
  );
}

export default function EditQuiz() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editMeta, setEditMeta] = useState(false);
  const [metaForm, setMetaForm] = useState({});

  useEffect(() => {
    api.get(`/quizzes/${id}`).then(({ data }) => {
      setQuiz(data);
      setMetaForm({ title: data.title, description: data.description, category: data.category, time_per_question: data.time_per_question });
    }).catch(() => navigate('/dashboard')).finally(() => setLoading(false));
  }, [id]);

  const saveQuestion = async (fd, questionId) => {
    setSaving(true);
    try {
      const { data } = questionId
        ? await api.put(`/quizzes/questions/${questionId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        : await api.post(`/quizzes/${id}/questions`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setQuiz(data);
      setShowAddForm(false);
      setEditingQuestion(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const deleteQuestion = async (questionId) => {
    if (!confirm('Удалить вопрос?')) return;
    const { data } = await api.delete(`/quizzes/questions/${questionId}`);
    setQuiz(data);
  };

  const saveMeta = async () => {
    setSaving(true);
    try {
      const { data } = await api.put(`/quizzes/${id}`, metaForm);
      setQuiz(data);
      setEditMeta(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка');
    } finally {
      setSaving(false);
    }
  };

  const launchQuiz = async () => {
    try {
      const { data } = await api.post('/sessions', { quiz_id: id });
      navigate(`/live/${data.room_code}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка запуска');
    }
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!quiz) return null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
        <Link to="/dashboard" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>← Назад</Link>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={launchQuiz} disabled={quiz.questions?.length === 0}>
          ▶ Запустить квиз
        </button>
      </div>

      {/* Quiz meta */}
      {editMeta ? (
        <div className="card card-lg" style={{ marginBottom: 24 }}>
          <h2 style={{ marginBottom: 16, fontWeight: 700 }}>Настройки квиза</h2>
          <div className="form-group">
            <label className="form-label">Название</label>
            <input className="form-input" value={metaForm.title} onChange={e => setMetaForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Описание</label>
            <textarea className="form-input form-textarea" value={metaForm.description} onChange={e => setMetaForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Категория</label>
            <select className="form-select" value={metaForm.category} onChange={e => setMetaForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Время на вопрос: {metaForm.time_per_question} сек</label>
            <input type="range" min={10} max={120} step={5} value={metaForm.time_per_question}
              onChange={e => setMetaForm(f => ({ ...f, time_per_question: +e.target.value }))}
              style={{ width: '100%', accentColor: 'var(--primary)' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={saveMeta} disabled={saving}>Сохранить</button>
            <button className="btn btn-secondary" onClick={() => setEditMeta(false)}>Отмена</button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{quiz.title}</h1>
              {quiz.description && <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>{quiz.description}</p>}
              <div className="quiz-card-meta" style={{ marginTop: 8 }}>
                <span className="badge badge-blue">{quiz.category}</span>
                <span className="badge badge-gray">{quiz.questions?.length || 0} вопросов</span>
                <span className="badge badge-gray">{quiz.time_per_question}с/вопрос</span>
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditMeta(true)}>Изменить</button>
          </div>
        </div>
      )}

      {/* Questions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Вопросы ({quiz.questions?.length || 0})</h2>
        {!showAddForm && (
          <button className="btn btn-primary btn-sm" onClick={() => { setShowAddForm(true); setEditingQuestion(null); }}>
            + Добавить вопрос
          </button>
        )}
      </div>

      {showAddForm && (
        <div style={{ marginBottom: 16 }}>
          <QuestionForm onSave={(fd) => saveQuestion(fd, null)} onCancel={() => setShowAddForm(false)} />
        </div>
      )}

      {quiz.questions?.length === 0 && !showAddForm && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div className="empty-state-icon">❓</div>
          <div className="empty-state-title">Вопросов пока нет</div>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Добавьте хотя бы один вопрос для запуска квиза</p>
          <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>Добавить первый вопрос</button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {quiz.questions?.map((q, i) => (
          <div key={q.id}>
            {editingQuestion?.id === q.id ? (
              <QuestionForm
                initial={q}
                onSave={(fd) => saveQuestion(fd, q.id)}
                onCancel={() => setEditingQuestion(null)}
              />
            ) : (
              <div className="card">
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, flexShrink: 0, fontSize: '0.9rem',
                  }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>{q.text}</div>
                    {q.image_url && <img src={q.image_url} alt="" style={{ maxHeight: 120, borderRadius: 8, marginBottom: 8, objectFit: 'contain' }} />}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {q.options?.map(opt => (
                        <span key={opt.id} style={{
                          padding: '3px 10px', borderRadius: 6, fontSize: '0.82rem',
                          background: opt.is_correct ? 'var(--success-light)' : 'var(--surface2)',
                          color: opt.is_correct ? 'var(--success)' : 'var(--text-muted)',
                          border: `1px solid ${opt.is_correct ? 'var(--success)' : 'var(--border)'}`,
                          fontWeight: opt.is_correct ? 600 : 400,
                        }}>
                          {opt.is_correct ? '✓ ' : ''}{opt.text}
                        </span>
                      ))}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <span className={`badge ${q.type === 'multiple' ? 'badge-blue' : 'badge-gray'}`}>
                        {q.type === 'multiple' ? 'Множественный' : 'Одиночный'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditingQuestion(q)}>Изменить</button>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteQuestion(q.id)}>✕</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
