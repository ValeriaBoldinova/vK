#!/bin/bash
set -e

echo "=== QuizLive — Установка зависимостей ==="

# Backend
echo ""
echo "📦 Устанавливаем backend зависимости..."
cd backend
npm install
cd ..

# Frontend
echo ""
echo "📦 Устанавливаем frontend зависимости..."
cd frontend
npm install
cd ..

echo ""
echo "=== Запуск серверов ==="
echo ""
echo "Backend: http://localhost:3001"
echo "Frontend: http://localhost:5173"
echo ""
echo "Нажмите Ctrl+C для остановки"
echo ""

# Start both servers
(cd backend && npm run dev) &
BACKEND_PID=$!

(cd frontend && npm run dev) &
FRONTEND_PID=$!

# Trap Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

wait
