import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { BellRing, CheckCircle2, Clock } from 'lucide-react'
import './Company.css'

// AudioContext persistente — criado na primeira interação do usuário
let _audioCtx = null

function getAudioCtx() {
  if (!_audioCtx) {
    const AudioCtx = window.AudioContext || (/** @type {any} */ (window)).webkitAudioContext
    _audioCtx = new AudioCtx()
  }
  if (_audioCtx.state === 'suspended') _audioCtx.resume()
  return _audioCtx
}

// Inicializa o contexto na primeira interação (desbloqueio do browser)
function unlockAudio() {
  getAudioCtx()
  document.removeEventListener('click', unlockAudio)
  document.removeEventListener('keydown', unlockAudio)
}
document.addEventListener('click', unlockAudio)
document.addEventListener('keydown', unlockAudio)

function playNotificationSound() {
  try {
    const ctx = getAudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
  } catch (_) {}
}

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
  const instance = session?.company?.instance

  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [realtimeStatus, setRealtimeStatus] = useState('connecting')
  const [unreadCount, setUnreadCount] = useState(0)

  // Atualiza título da aba com contador de alertas não lidos
  useEffect(() => {
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) Alertas — NEXLA`
    } else {
      document.title = 'NEXLA'
    }
    return () => { document.title = 'NEXLA' }
  }, [unreadCount])

  // Carrega alertas filtrados pela instância da empresa
  useEffect(() => {
    if (!instance) return
    setLoading(true)
    supabase
      .from('alerts')
      .select('*')
      .eq('instancia', instance)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setAlerts(data)
        setLoading(false)
      })
  }, [instance])

  // Realtime: só recebe alertas da instância desta empresa
  useEffect(() => {
    if (!instance) return
    setRealtimeStatus('connecting')

    const channel = supabase
      .channel(`realtime-alerts-${instance}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts', filter: `instancia=eq.${instance}` },
        (payload) => {
          if (!payload.new) return
          setAlerts(prev => [payload.new, ...prev])
          setUnreadCount(c => c + 1)
          playNotificationSound()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'alerts', filter: `instancia=eq.${instance}` },
        (payload) => {
          if (payload.new) setAlerts(prev => prev.map(a => a.id === payload.new.id ? payload.new : a))
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeStatus('error')
      })

    return () => { supabase.removeChannel(channel) }
  }, [instance])

  async function resolve(id) {
    await supabase.from('alerts').update({ resolved: true }).eq('id', id)
  }

  // Zera contador ao focar na aba
  useEffect(() => {
    function onFocus() { setUnreadCount(0) }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

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
            {unreadCount > 0 && (
              <span style={{
                marginLeft: 8, background: '#DC2626', color: '#fff',
                borderRadius: 20, fontSize: 11, fontWeight: 700,
                padding: '2px 8px', verticalAlign: 'middle',
              }}>
                {unreadCount} novo{unreadCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {loading ? 'Carregando...' : 'Avisos enviados pelo agente de IA'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Indicador Realtime */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12,
            color: realtimeStatus === 'connected' ? '#16A34A' : realtimeStatus === 'error' ? '#DC2626' : '#9CA3AF',
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

      {!instance && (
        <div className="nx-card" style={{ padding: '2rem', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          Instância não configurada para esta empresa.
        </div>
      )}

      {!loading && instance && filtered.length === 0 && (
        <div className="nx-card" style={{
          padding: '3rem', textAlign: 'center', color: 'var(--text-muted)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        }}>
          <BellRing size={28} style={{ opacity: 0.2 }} />
          <div style={{ fontSize: 14 }}>
            Nenhum alerta {filter === 'pending' ? 'pendente' : filter === 'resolved' ? 'resolvido' : ''} encontrado.
          </div>
        </div>
      )}

      {filtered.map(alert => (
        <div key={alert.id} className={`alert-card ${alert.resolved ? 'resolved' : 'unresolved'}`}>
          <div className="alert-icon" style={{
            background: '#FFFBEB',
            border: '1px solid #FDE68A',
            alignSelf: 'flex-start',
          }}>
            <BellRing size={16} style={{ color: '#D97706' }} />
          </div>

          <div className="alert-body">
            <div className="alert-msg" style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {alert.mensagem}
            </div>
            <div className="alert-footer">
              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={11} /> {formatTime(alert.created_at)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                instância: {alert.instancia}
              </span>
            </div>
          </div>

          <div style={{ flexShrink: 0 }}>
            {alert.resolved ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#16A34A' }}>
                <CheckCircle2 size={14} /> Resolvido
              </span>
            ) : (
              <button
                className="nx-btn-primary"
                style={{ fontSize: 12, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 5 }}
                onClick={() => resolve(alert.id)}
              >
                <CheckCircle2 size={13} /> Marcar resolvido
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
