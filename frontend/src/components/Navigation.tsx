import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { menuItemsByRole, roleLabels } from './role-navigation';

export function Navigation() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return null;
  }

  function handleLogout(): void {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <aside className="navigation">
      <div>
        <a className="brand" href="/" aria-label="TrackIt home">
          TrackIt
        </a>
        <p className="role-label">{roleLabels[user.role]}</p>
      </div>

      <nav aria-label="Primary navigation">
        <ul className="menu-list">
          {menuItemsByRole[user.role].map((menuItem) => (
            <li
              key={menuItem.label}
              className={
                menuItem.path ? 'menu-item menu-item-link' : 'menu-item'
              }
            >
              {menuItem.path ? (
                <NavLink
                  className={({ isActive }) =>
                    isActive ? 'menu-link menu-link-active' : 'menu-link'
                  }
                  to={menuItem.path}
                >
                  {menuItem.label}
                </NavLink>
              ) : (
                menuItem.label
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="account-summary">
        <span>{user.name}</span>
        <small>{user.email}</small>
        <button className="logout-button" type="button" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </aside>
  );
}
