import React from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Sidebar from '../../components/Sidebar'
import { MessageSquare, History, BellRing } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import './Company.css'

export default function CompanyLayout() {
  const { session } = useAuth()
  const instance = session?.company?.instance
  const [activeCount, setActiveCount] = useState(0)
  const [pendingAlerts, setPendingAlerts] = useState(0)

  // Conta conversas ativas
  useEffect(() => {
    if (!instance) return
    supabase.from('conversations').select('id', { count: 'exact' })
      .eq('instancia', instance).eq('status', 'active')
      .then(({ count }) => setActiveCount(count || 0))

    const ch = supabase.channel('layout-conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `instancia=eq.${instance}` },
        () => {
          supabase.from('conversations').select('id', { count: 'exact' })
            .eq('instancia', instance).eq('status', 'active')
            .then(({ count }) => setActiveCount(count || 0))
        })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [instance])

  // Conta alertas pendentes reais
  useEffect(() => {
    if (!instance) return
    supabase.from('alerts').select('id', { count: 'exact' })
      .eq('instancia', instance).eq('resolved', false)
      .then(({ count }) => setPendingAlerts(count || 0))

    const ch = supabase.channel('layout-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts', filter: `instancia=eq.${instance}` },
        () => {
          supabase.from('alerts').select('id', { count: 'exact' })
            .eq('instancia', instance).eq('resolved', false)
            .then(({ count }) => setPendingAlerts(count || 0))
        })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [instance])

  const links = [
    { to: '/painel/conversas', icon: MessageSquare, label: 'Conversas',
      badge: activeCount > 0 ? activeCount : null, badgeColor: 'cyan' },
    { to: '/painel/historico', icon: History,       label: 'Histórico' },
    { to: '/painel/alertas',   icon: BellRing,      label: 'Alertas',
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
