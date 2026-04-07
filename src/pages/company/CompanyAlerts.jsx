import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { BellRing, Calendar, HelpCircle, Phone, CheckCircle2, Clock } from 'lucide-react'
import './Company.css'

function formatTime(ts) {
  if (!ts) return ''
  const date = new Date(ts)
  const now = new Date()
  const diffMin = Math.floor((now - date) / 60000)
  const diffH = Math.floor(diffMin / 60)

  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `${diffMin}min`
  if (diffH < 24) return `${diffH}h`

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  if (isYesterday) return 'Ontem'

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function CompanyAlerts() {
  const { session } = useAuth()
  const companyId = session?.company?.id

  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [realtimeStatus, setRealtimeStatus] = useState('connecting')

  // Carrega alertas do banco
  useEffect(() => {
    if (!companyId) return
    setLoading(true)
    supabase
      .from('alerts')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setAlerts(data)
        setLoading(false)
      })
  }, [companyId])

  // Realtime: escuta novos alertas em tempo real
  useEffect(() => {
    if (!companyId) return
    setRealtimeStatus('connecting')

    const channel = supabase
      .channel('realtime-alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts', filter: `company_id=eq.${companyId}` },
        (payload) => {
          if (payload.new) {
            setAlerts(prev => [payload.new, ...prev])
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeStatus('error')
      })

    return () => { supabase.removeChannel(channel) }
  }, [companyId])

  async function resolve(id) {
    const { error } = await supabase
      .from('alerts')
      .update({ resolved: true })
      .eq('id', id)

    if (!error) {
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, resolved: true } : a))
    }
  }

  const filtered = alerts.filter(a => {
    if (filter === 'pending') return !a.resolved
    if (filter === 'resolved') return a.resolved
    return true
  })

  const pending  = alerts.filter(a => !a.resolved).length
  const resolved = alerts.filter(a =>  a.resolved).length

  return (
    <div className="alerts-root">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: 4 }}>
            Alertas da IA
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {loading ? 'Carregando...' : 'Pedidos de ajuda e avisos de agendamento'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Indicador Realtime */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: realtimeStatus === 'connected' ? '#16A34A' : realtimeStatus === 'error' ? '#DC2626' : '#9CA3AF',
            background: realtimeStatus === 'connected' ? '#F0FDF4' : realtimeStatus === 'error' ? '#FEF2F2' : '#F9FAFB',
            border: `1px solid ${realtimeStatus === 'connected' ? '#BBF7D0' : realtimeStatus === 'error' ? '#FECACA' : '#E5E7EB'}`,
            borderRadius: 20, padding: '4px 10px',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: realtimeStatus === 'connected' ? '#16A34A' : realtimeStatus === 'error' ? '#DC2626' : '#9CA3AF',
              boxShadow: realtimeStatus === 'connected' ? '0 0 0 2px #BBF7D0' : 'none',
              display: 'inline-block',
              animation: realtimeStatus === 'connected' ? 'pulse-dot 2s infinite' : 'none',
            }} />
            {realtimeStatus === 'connected' ? 'Ao vivo' : realtimeStatus === 'error' ? 'Erro de conexão' : 'Conectando...'}
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 6 }}>
            {['all', 'pending', 'resolved'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={filter === f ? 'nx-btn-primary' : 'nx-btn-ghost'}
                style={{ fontSize: 12, padding: '7px 14px' }}
              >
                {f === 'all' ? `Todos (${alerts.length})` : f === 'pending' ? `Pendentes (${pending})` : `Resolvidos (${resolved})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!loading && filtered.length === 0 && (
        <div className="nx-card" style={{
          padding: '3rem', textAlign: 'center', color: 'var(--text-muted)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        }}>
          <BellRing size={28} style={{ opacity: 0.2 }} />
          <div style={{ fontSize: 14 }}>Nenhum alerta {filter === 'pending' ? 'pendente' : filter === 'resolved' ? 'resolvido' : ''} encontrado.</div>
        </div>
      )}

      {filtered.map(alert => (
        <div key={alert.id} className={`alert-card ${alert.resolved ? 'resolved' : 'unresolved'}`}>
          <div className="alert-icon" style={{
            background: alert.type === 'help' ? '#FFFBEB' : '#EFF6FF',
            border: `1px solid ${alert.type === 'help' ? '#FDE68A' : '#BFDBFE'}`,
          }}>
            {alert.type === 'help'
              ? <HelpCircle size={16} style={{ color: 'var(--accent-amber)' }} />
              : <Calendar size={16} style={{ color: 'var(--accent-cyan)' }} />
            }
          </div>

          <div className="alert-body">
            <div className="alert-title">{alert.contact_name}</div>
            <div className="alert-msg">{alert.message}</div>
            <div className="alert-footer">
              <span className={`nx-badge ${alert.type === 'help' ? 'nx-badge-amber' : 'nx-badge-cyan'}`}>
                {alert.type === 'help' ? 'Pedido de ajuda' : 'Agendamento'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={11} /> {formatTime(alert.created_at)}
              </span>
              <a
                href={`https://wa.me/${alert.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="nx-btn-ghost"
                style={{ fontSize: 12, padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                onClick={e => e.stopPropagation()}
              >
                <Phone size={11} /> Contatar
              </a>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
            {alert.resolved ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--accent-green)' }}>
                <CheckCircle2 size={14} /> Resolvido
              </span>
            ) : (
              <button className="nx-btn-primary" style={{ fontSize: 12, padding: '7px 14px' }} onClick={() => resolve(alert.id)}>
                <CheckCircle2 size={13} /> Marcar resolvido
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
