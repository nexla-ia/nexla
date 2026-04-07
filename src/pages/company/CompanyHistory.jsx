import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { Search, MessageSquare, Bot, User, PhoneCall } from 'lucide-react'
import './Company.css'

function formatPhone(sessionId) {
  return sessionId.replace(/@.*$/, '')
}

function parseContent(content) {
  return content.replace(/^\*[^*]+\*:\n/, '').trim()
}

// Formata timestamp do banco (UTC) convertendo pra horário local
function formatMsgTime(ts) {
  if (!ts) return ''
  const date = new Date(ts)
  const now = new Date()

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()

  const hhmm = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  if (isToday) return hhmm
  if (isYesterday) return `Ontem ${hhmm}`
  return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hhmm}`
}

// Label relativa para a lista de contatos (ex: "agora", "5 min", "2h", "Ontem", "DD/MM")
function formatContactTime(ts) {
  if (!ts) return ''
  const date = new Date(ts)
  const now = new Date()
  const diffMs = now - date
  const diffMin = Math.floor(diffMs / 60000)
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

export default function CompanyHistory() {
  const { session } = useAuth()
  const historyTable = session?.company?.history_table

  const [contacts, setContacts] = useState([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [realtimeStatus, setRealtimeStatus] = useState('connecting') // 'connecting' | 'connected' | 'error'
  const bottomRef = useRef(null)
  const selectedRef = useRef(null)

  // Mantém ref sincronizada com state para uso em closures do Realtime
  useEffect(() => { selectedRef.current = selected }, [selected])

  // Carrega lista de contatos únicos com timestamp da última mensagem
  useEffect(() => {
    if (!historyTable) return
    setLoadingContacts(true)
    supabase
      .from(historyTable)
      .select('session_id, data')
      .order('id', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          const seen = new Set()
          const unique = []
          for (const row of data) {
            if (!seen.has(row.session_id)) {
              seen.add(row.session_id)
              unique.push({
                session_id: row.session_id,
                phone: formatPhone(row.session_id),
                lastTs: row.data, // primeira ocorrência = mais recente (ordenado desc)
              })
            }
          }
          setContacts(unique)
        }
        setLoadingContacts(false)
      })
  }, [historyTable])

  // Carrega mensagens com timestamp
  useEffect(() => {
    if (!selected || !historyTable) return
    setLoadingMsgs(true)
    setMessages([])
    supabase
      .from(historyTable)
      .select('id, message, data')
      .eq('session_id', selected.session_id)
      .order('id', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) {
          setMessages(data.map(row => ({
            id: row.id,
            type: row.message?.type,
            content: parseContent(row.message?.content || ''),
            ts: row.data,
          })))
        }
        setLoadingMsgs(false)
      })
  }, [selected, historyTable])

  // Realtime: escuta novos INSERTs na tabela via WebSocket (sem polling)
  useEffect(() => {
    if (!historyTable) return

    setRealtimeStatus('connecting')

    const channel = supabase
      .channel(`realtime-${historyTable}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: historyTable },
        (payload) => {
          const row = payload.new
          if (!row) return

          // Atualiza lista de contatos: move o contato pro topo com novo lastTs
          setContacts(prev => {
            const exists = prev.find(c => c.session_id === row.session_id)
            if (exists) {
              return [
                { ...exists, lastTs: row.data },
                ...prev.filter(c => c.session_id !== row.session_id),
              ]
            }
            return [{ session_id: row.session_id, phone: formatPhone(row.session_id), lastTs: row.data }, ...prev]
          })

          // Usa ref para evitar closure stale — sem precisar recriar o canal
          if (selectedRef.current?.session_id === row.session_id) {
            setMessages(msgs => [
              ...msgs,
              {
                id: row.id,
                type: row.message?.type,
                content: parseContent(row.message?.content || ''),
                ts: row.data,
              },
            ])
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeStatus('error')
      })

    return () => { supabase.removeChannel(channel) }
  }, [historyTable])

  // Scroll pro final quando mensagens carregam
  useEffect(() => {
    if (!loadingMsgs) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loadingMsgs])

  const filtered = contacts.filter(c => c.phone.includes(search))

  return (
    <div className="history-root">
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: 4 }}>
            Histórico de Conversas
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {loadingContacts ? 'Carregando...' : `${contacts.length} conversa(s) registrada(s)`}
          </div>
        </div>
        {historyTable && (
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
        )}
      </div>

      <div style={{ display: 'flex', gap: '1.5rem' }}>
        {/* Lista */}
        <div style={{ width: 280, flexShrink: 0 }}>
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="nx-input"
              style={{ paddingLeft: 32 }}
              placeholder="Buscar contato..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {!historyTable ? (
            <div className="nx-card" style={{ padding: '1.5rem', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
              Tabela de histórico não configurada.
            </div>
          ) : (
            <div className="nx-card" style={{ overflow: 'hidden' }}>
              {loadingContacts && (
                <div style={{ padding: '1.5rem', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>Carregando...</div>
              )}
              {!loadingContacts && filtered.length === 0 && (
                <div style={{ padding: '1.5rem', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>Nenhum contato encontrado.</div>
              )}
              {filtered.map((c, i) => (
                <div
                  key={c.session_id}
                  onClick={() => setSelected(c)}
                  style={{
                    padding: '10px 14px',
                    borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                    cursor: 'pointer',
                    background: selected?.session_id === c.session_id ? '#EFF6FF' : 'transparent',
                    borderLeft: selected?.session_id === c.session_id ? '2px solid #2563EB' : '2px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-primary)' }}>{c.phone}</div>
                    {c.lastTs && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
                        {formatContactTime(c.lastTs)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Painel de mensagens */}
        <div style={{ flex: 1 }}>
          {!selected ? (
            <div className="nx-card" style={{
              padding: '3rem',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 12, color: 'var(--text-muted)', minHeight: 300,
            }}>
              <MessageSquare size={32} style={{ opacity: 0.2 }} />
              <div style={{ fontSize: 14 }}>Selecione uma conversa para visualizar o histórico</div>
            </div>
          ) : (
            <div className="nx-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* Header */}
              <div style={{
                padding: '14px 18px',
                borderBottom: '0.5px solid var(--border)',
                background: 'var(--bg-surface)',
                display: 'flex', alignItems: 'center', gap: 12,
                flexShrink: 0,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: '#F1F5F9', border: '0.5px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <User size={16} style={{ opacity: 0.4 }} />
                </div>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--text-primary)' }}>{selected.phone}</div>
                  {!loadingMsgs && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{messages.length} mensagem(ns)</div>
                  )}
                </div>
              </div>

              {/* Mensagens */}
              <div style={{
                padding: '1.25rem 1.5rem',
                display: 'flex', flexDirection: 'column', gap: 10,
                maxHeight: 440, overflowY: 'auto',
              }}>
                {loadingMsgs && (
                  <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', padding: '2rem' }}>Carregando mensagens...</div>
                )}
                {!loadingMsgs && messages.length === 0 && (
                  <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', padding: '2rem' }}>Sem mensagens.</div>
                )}
                {messages.map(msg => {
                  const isHuman = msg.type === 'human'
                  return (
                    <div key={msg.id} style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isHuman ? 'flex-start' : 'flex-end',
                    }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 10, fontWeight: 500, textTransform: 'uppercase',
                        letterSpacing: '0.07em', marginBottom: 3,
                        color: isHuman ? 'var(--text-muted)' : '#2563EB',
                      }}>
                        {isHuman ? <><User size={10} /> Cliente</> : <><Bot size={10} /> IA</>}
                      </div>
                      <div style={{
                        maxWidth: '72%',
                        background: isHuman ? '#F1F5F9' : '#2563EB',
                        color: isHuman ? 'var(--text-primary)' : '#fff',
                        borderRadius: isHuman ? '12px 12px 12px 2px' : '12px 12px 2px 12px',
                        padding: '8px 12px',
                        fontSize: 13,
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                      }}>
                        {msg.content}
                      </div>
                      {msg.ts && (
                        <div style={{
                          fontSize: 10, color: 'var(--text-muted)', marginTop: 2,
                        }}>
                          {formatMsgTime(msg.ts)}
                        </div>
                      )}
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {/* Botão assumir */}
              <div style={{
                padding: '12px 18px',
                borderTop: '0.5px solid var(--border)',
                background: 'var(--bg-surface)',
                flexShrink: 0,
              }}>
                <a
                  href={`https://wa.me/${selected.phone}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: '#25D366', color: '#fff',
                    border: 'none', borderRadius: 8,
                    padding: '9px 18px', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', textDecoration: 'none',
                    boxShadow: '0 1px 4px rgba(37,211,102,0.3)',
                  }}
                >
                  <PhoneCall size={15} />
                  Ver conversa no WhatsApp
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
