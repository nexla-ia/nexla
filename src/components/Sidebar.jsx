import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LogOut, X } from 'lucide-react'
import BrandMark from './BrandMark'
import './Sidebar.css'

export default function Sidebar({ links, role, isMobileOpen, onClose }) {
  const { session, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <aside className={`sidebar${isMobileOpen ? ' mobile-open' : ''}`}>
      <div className="sidebar-brand">
        <BrandMark size={36} color="#C9A074" strokeWidth={1.5} />
        <div>
          <div className="sidebar-brand-name">MedicinaMKT</div>
          <div className="sidebar-brand-tag">{role === 'adm' ? 'ADM Global' : 'Painel'}</div>
        </div>
        <button className="sidebar-close-btn" onClick={onClose} aria-label="Fechar menu">
          <X size={16} />
        </button>
      </div>

      <nav className="sidebar-nav">
        {links.map((link, i) => (
          <React.Fragment key={link.to || link.label}>
            {link.section && link.section !== links[i - 1]?.section && (
              <div className="sidebar-section-label">{link.section}</div>
            )}
            {link.to ? (
              <NavLink to={link.to} end={link.end}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                onClick={onClose}
              >
                <link.icon size={16} />
                {link.label}
                {link.badge ? <span className={`sidebar-badge nx-badge nx-badge-${link.badgeColor || 'cyan'}`}>{link.badge}</span> : null}
              </NavLink>
            ) : (
              <button className={`sidebar-link${link.active ? ' active' : ''}`}
                onClick={() => { link.onClick?.(); onClose?.() }}
              >
                <link.icon size={16} />
                {link.label}
                {link.badge ? <span className={`sidebar-badge nx-badge nx-badge-${link.badgeColor || 'cyan'}`}>{link.badge}</span> : null}
              </button>
            )}
          </React.Fragment>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {session?.user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{session?.user?.name}</div>
            <div className="sidebar-user-email">{session?.user?.email}</div>
          </div>
        </div>
        <button className="sidebar-logout" onClick={handleLogout} title="Sair">
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  )
}

