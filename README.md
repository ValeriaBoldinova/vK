# QuizLive — Интерактивные квизы в реальном времени
Ссылка на фигму - https://www.figma.com/design/OXkWVD2dSC5IB8v0eLy9pr/Untitled?node-id=0-1&t=Bs6hFyczg4flSlKw-1

MVP веб-приложения для проведения квизов на мероприятиях (задание VK).

## Стек

| Слой | Технология |
|------|-----------|
| Backend | Node.js, Express, Socket.IO |
| База данных | SQLite (better-sqlite3) |
| Аутентификация | JWT |
| Frontend | React 18, Vite, React Router v6 |
| Real-time | Socket.IO (WebSocket) |

## Функциональность

- ✅ Регистрация и авторизация (роли: **участник** / **организатор**)
- ✅ Создание квизов с категориями и настройкой времени
- ✅ Вопросы с одиночным и множественным выбором
- ✅ Вопросы с изображениями (загрузка файла)
- ✅ Запуск квиза с кодом комнаты (6 символов)
- ✅ Real-time отображение вопросов через WebSocket
- ✅ Серверный таймер + авто-переход к следующему вопросу
- ✅ Система очков (бонус за скорость ответа)
- ✅ Лидерборд в реальном времени
- ✅ Личный кабинет с историей для обеих ролей

## Быстрый запуск

```bash
cd quiz-app
bash start.sh
```

Откройте [http://localhost:5173](http://localhost:5173)

### Ручной запуск (два терминала)

**Терминал 1 — Backend:**
```bash
cd quiz-app/backend
npm install
npm run dev
# → http://localhost:3001
```

**Терминал 2 — Frontend:**
```bash
cd quiz-app/frontend
npm install
npm run dev
# → http://localhost:5173
```

## Сценарий использования

### Организатор:
1. Регистрируется с ролью **Организатор**
2. Создаёт квиз (название, категория, время на вопрос)
3. Добавляет вопросы (текст/фото, одиночный/множественный выбор)
4. Нажимает **Запустить квиз** → получает 6-значный код комнаты
5. Показывает код участникам
6. Нажимает **Начать квиз** когда все собрались
7. Видит результаты в реальном времени и лидерборд

### Участник:
1. Регистрируется с ролью **Участник**
2. Нажимает **Войти в квиз**, вводит код
3. Ждёт старта в лобби
4. Отвечает на вопросы пока идёт таймер
5. Видит результат ответа и текущий рейтинг
6. По окончании — итоговый лидерборд

## Структура проекта

```
quiz-app/
├── backend/
│   ├── src/
│   │   ├── app.js              — Express + Socket.IO сервер
│   │   ├── db.js               — SQLite схема и инициализация
│   │   ├── middleware/auth.js  — JWT middleware
│   │   ├── routes/
│   │   │   ├── auth.js         — /api/auth
│   │   │   ├── quizzes.js      — /api/quizzes
│   │   │   ├── sessions.js     — /api/sessions
│   │   │   └── users.js        — /api/users
│   │   └── socket/handlers.js  — Socket.IO события
│   └── uploads/                — загруженные изображения
└── frontend/
    └── src/
        ├── pages/
        │   ├── auth/           — Login, Register
        │   ├── organizer/      — Dashboard, CreateQuiz, EditQuiz, LiveQuiz
        │   └── participant/    — JoinQuiz, QuizGame, ParticipantDashboard
        ├── components/         — Layout, Timer, Leaderboard
        └── context/            — AuthContext (JWT)
```

## Socket.IO события

| Событие | Направление | Описание |
|---------|-------------|----------|
| `join_lobby` | client→server | Подключиться к комнате |
| `lobby_joined` | server→client | Подтверждение + данные сессии |
| `participant_joined` | server→all | Новый участник в лобби |
| `start_quiz` | organizer→server | Запустить квиз |
| `quiz_starting` | server→all | Обратный отсчёт (3с) |
| `question_started` | server→all | Новый вопрос (без правильных ответов) |
| `submit_answer` | client→server | Ответ участника |
| `answer_received` | server→client | Результат ответа + очки |
| `question_ended` | server→all | Правильные ответы + лидерборд |
| `skip_to_next` | organizer→server | Принудительный переход |
| `quiz_ended` | server→all | Финальный лидерборд |

## Система очков

- **Одиночный выбор:** `round(500 + 500 × (1 - t/T))` при верном ответе, 0 при неверном
- **Множественный выбор:** пропорционально доле выбранных правильных ответов минус штраф за неверные
- `t` — время ответа в секундах, `T` — лимит на вопрос
- Максимум **1000 очков** за мгновенный ответ, минимум **500** за ответ в последний момент
