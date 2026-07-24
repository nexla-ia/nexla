import React from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Sidebar from '../../components/Sidebar'
import BillingBanner from '../../components/BillingBanner'
import BlockedScreen from '../../components/BlockedScreen'
import SupportWidget from '../../components/SupportWidget'
import BrandMark from '../../components/BrandMark'
import { shouldBlockAccess } from '../../lib/billing'
import { MessageSquare, History, BellRing, BarChart2, Settings2, Contact2, Calendar, Sparkles, Kanban, Stethoscope, GraduationCap, Instagram, ShieldCheck, Menu, Headset, MessagesSquare, Wallet, Target } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { latestUpdateDate } from '../../data/updates'
import './Company.css'

export default function CompanyLayout() {
  const { session, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const blocked = shouldBlockAccess(session?.company)
  const instance = session?.company?.instance
  const [pendingAlerts, setPendingAlerts] = useState(0)

  // Onboarding obrigatório: força usuário novo para o tutorial até concluir
  useEffect(() => {
    const userKey = session?.user?.email
    if (!userKey) return
    const done = localStorage.getItem(`nx_onboarding_done_${userKey}`) === 'true'
    if (!done && location.pathname !== '/painel/tutorial') {
      navigate('/painel/tutorial', { replace: true })
    }
  }, [session?.user?.email, location.pathname, navigate])

  // Garante que a tabela conversations está no Realtime
  useEffect(() => {
    supabase.rpc('ensure_table_setup', { p_table: 'conversations' })
  }, [])

  // Conta alertas pendentes reais (sem IA: conta só encaminhamentos para o usuário)
  const userId = session?.user?.id
  const aiOn = session?.company?.ai_enabled !== false
  useEffect(() => {
    if (!instance) return
    function countQuery() {
      let q = supabase.from('alerts').select('id', { count: 'exact' })
        .eq('instancia', instance).eq('resolved', false)
      if (!aiOn && userId) q = q.eq('forwarded_to_user_id', userId)
      return q
    }
    countQuery().then(({ count }) => setPendingAlerts(count || 0))

    const ch = supabase.channel('layout-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts', filter: `instancia=eq.${instance}` },
        () => { countQuery().then(({ count }) => setPendingAlerts(count || 0)) })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [instance, aiOn, userId])

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [supportUnread, setSupportUnread] = useState(0)

  const isAdmin = session?.user?.role === 'admin'
  const aiEnabled = session?.company?.ai_enabled !== false
  const lastSeen = typeof window !== 'undefined' ? localStorage.getItem('nx_news_seen') : null
  const hasNewUpdate = !lastSeen || lastSeen < latestUpdateDate()

  const links = [
    // Atendimento
    { to: '/painel/conversas', icon: MessageSquare, label: 'Conversas', section: 'Atendimento' },
    ...(aiEnabled ? [{ to: '/painel/historico', icon: History, label: 'Conversas IA', section: 'Atendimento' }] : []),
    { to: '/painel/instagram', icon: Instagram,     label: 'Instagram', section: 'Atendimento' },
    { to: '/painel/alertas',   icon: BellRing,      label: 'Alertas', section: 'Atendimento',
      badge: pendingAlerts > 0 ? pendingAlerts : null, badgeColor: 'amber' },

    // Gestão
    { to: '/painel/contatos',   icon: Contact2,     label: 'Pacientes', section: 'Gestão' },
    { to: '/painel/agenda',     icon: Calendar,     label: 'Agenda', section: 'Gestão' },
    { to: '/painel/atividades', icon: Kanban,       label: 'Kanban', section: 'Gestão' },
    ...(isAdmin ? [{ to: '/painel/financeiro', icon: Wallet, label: 'Financeiro', section: 'Gestão' }] : []),
    { to: '/painel/catalogo',   icon: Stethoscope,  label: 'Catálogo Clínico', section: 'Gestão' },
    { to: '/painel/crm',        icon: Target,       label: 'CRM', section: 'Gestão' },

    // Análise
    ...(isAdmin ? [{ to: '/painel/metricas', icon: BarChart2, label: 'Métricas', section: 'Análise' }] : []),

    // Conta & Ajuda
    ...(isAdmin ? [{ to: '/painel/admin', icon: Settings2, label: 'Configuração', section: 'Conta & Ajuda' }] : []),
    { to: '/painel/seguranca', icon: ShieldCheck,    label: 'Segurança', section: 'Conta & Ajuda' },
    { to: '/painel/tutorial',  icon: GraduationCap,  label: 'Tutorial', section: 'Conta & Ajuda' },
    { to: '/painel/novidades', icon: Sparkles,       label: 'Novidades', section: 'Conta & Ajuda',
      badge: hasNewUpdate ? 'Novo' : null, badgeColor: 'violet' },
    { to: '/painel/feedback',  icon: MessagesSquare, label: 'Feedback', section: 'Conta & Ajuda' },
    { label: 'Suporte', icon: Headset, section: 'Conta & Ajuda', onClick: () => setSupportOpen(true),
      badge: supportUnread > 0 ? supportUnread : null, badgeColor: 'amber',
      active: supportOpen },
  ]

  if (blocked) {
    return <BlockedScreen company={session?.company} onLogout={logout} />
  }

  return (
    <div className="company-root">
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}
      <Sidebar links={links} role="company" isMobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="company-main-wrap">
        <div className="company-topbar">
          <button className="topbar-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu">
            <Menu size={20} />
          </button>
          <div className="topbar-logo-mobile">
            <BrandMark size={26} color="#C9A074" strokeWidth={1.5} />
          </div>
          <div className="company-topbar-name">{session?.company?.name}</div>
          <span className={`nx-badge nx-badge-${session?.company?.plan === 'Business' ? 'violet' : session?.company?.plan === 'Pro' ? 'cyan' : 'gray'}`}>
            {session?.company?.plan}
          </span>
        </div>
        <BillingBanner company={session?.company} />
        <main className="company-main">
          <Outlet />
        </main>
      </div>
      <SupportWidget session={session} open={supportOpen} onClose={() => setSupportOpen(false)} onUnreadChange={setSupportUnread} />
    </div>
  )
}
