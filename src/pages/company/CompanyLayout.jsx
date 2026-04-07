import React from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth, mockAlerts } from '../../context/AuthContext'
import Sidebar from '../../components/Sidebar'
import { MessageSquare, History, BellRing } from 'lucide-react'
import './Company.css'

export default function CompanyLayout() {
  const { session } = useAuth()
  const companyId = session?.company?.id
  const pendingAlerts = (mockAlerts[companyId] || []).filter(a => !a.resolved).length

  const links = [
    // { to: '/painel',           end: true, icon: MessageSquare, label: 'Contatos'  },
    { to: '/painel/historico',            icon: History,       label: 'Histórico de Conversa' },
    { to: '/painel/alertas',              icon: BellRing,      label: 'Alertas',
      badge: pendingAlerts > 0 ? pendingAlerts : null, badgeColor: 'amber' },
  ]

  return (
    <div className="company-root">
      <Sidebar links={links} role="company" />
      <div className="company-main-wrap">
        <div className="company-topbar">
          <div className="company-topbar-name">{session?.company?.name}</div>
          <span className={`nx-badge nx-badge-${session?.company?.plan === 'Business' ? 'violet' : session?.company?.plan === 'Pro' ? 'cyan' : 'gray'}`}>
            {session?.company?.plan}
          </span>
        </div>
        <main className="company-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
