import { NavLink, useNavigate } from 'react-router-dom';
import { PAGES } from '../data/mockData';

export default function AppShell({ children }) {
  const navigate = useNavigate();

  return (
    <>
      <div className="topbar">
        <div className="logo">TS</div>
        <div>
          <div className="product">Timesheet Management System</div>
          <div className="sub">Internal Staff Portal</div>
        </div>
        <div className="spacer" />
        <span className="pill">DD/MM/YYYY</span>
        <div className="avatar">
          <div className="dot">CW</div>
          <div>Chris Wong ▼</div>
        </div>
      </div>
      <div className="layout">
        <aside className="side">
          <div className="nav-title">Main Menu</div>
          <nav className="nav">
            {PAGES.map((p) => (
              <NavLink
                key={p.id}
                to={`/${p.id}`}
                className={({ isActive }) => isActive ? 'active' : ''}
              >
                <span className="icon">{p.icon}</span>
                {p.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="main-content">{children}</main>
      </div>
    </>
  );
}
