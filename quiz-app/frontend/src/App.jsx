import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';

import Login from './pages/auth/Login.jsx';
import Register from './pages/auth/Register.jsx';
import OrganizerDashboard from './pages/organizer/Dashboard.jsx';
import ParticipantDashboard from './pages/participant/ParticipantDashboard.jsx';
import CreateQuiz from './pages/organizer/CreateQuiz.jsx';
import EditQuiz from './pages/organizer/EditQuiz.jsx';
import LiveQuiz from './pages/organizer/LiveQuiz.jsx';
import JoinQuiz from './pages/participant/JoinQuiz.jsx';
import QuizGame from './pages/participant/QuizGame.jsx';
import Profile from './pages/Profile.jsx';
import Results from './pages/Results.jsx';

function Dashboard() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return user.role === 'organizer' ? <OrganizerDashboard /> : <ParticipantDashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Full-screen quiz views (no navbar) */}
          <Route path="/live/:roomCode" element={
            <ProtectedRoute role="organizer"><LiveQuiz /></ProtectedRoute>
          } />
          <Route path="/room/:roomCode" element={
            <ProtectedRoute><QuizGame /></ProtectedRoute>
          } />

          {/* Layout routes */}
          <Route path="/*" element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/quiz/create" element={
                    <ProtectedRoute role="organizer"><CreateQuiz /></ProtectedRoute>
                  } />
                  <Route path="/quiz/:id/edit" element={
                    <ProtectedRoute role="organizer"><EditQuiz /></ProtectedRoute>
                  } />
                  <Route path="/join" element={<JoinQuiz />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/results/:sessionId" element={<Results />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
