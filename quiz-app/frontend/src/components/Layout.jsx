import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <nav className="nav">
        <NavLink to="/dashboard" className="nav-brand" style={{ textDecoration: 'none' }}>
          Quiz<span>Live</span>
        </NavLink>
        <div className="nav-links">
          {user?.role === 'organizer' ? (
            <>
              <NavLink to="/dashboard" className="nav-link">Мои квизы</NavLink>
              <NavLink to="/quiz/create" className="nav-link">Создать квиз</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/join" className="nav-link">Войти в квиз</NavLink>
              <NavLink to="/dashboard" className="nav-link">Квизы</NavLink>
            </>
          )}
          <NavLink to="/profile" className="nav-link">Профиль</NavLink>
          <span className="nav-user">{user?.name}</span>
          <button className="btn btn-sm btn-secondary" onClick={handleLogout} style={{ marginLeft: 8 }}>
            Выйти
          </button>
        </div>
      </nav>
      <main className="main-content">{children}</main>
    </div>
  );
}
