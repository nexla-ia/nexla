import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { MessageSquare, Bot, User, PhoneCall } from 'lucide-react'
import './Company.css'

function formatPhone(sessionId) {
  return sessionId.replace(/@.*$/, '')
}

function parseContent(content) {
  return content.replace(/^\*[^*]+\*:\n/, '').trim()
}

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
  const [realtimeStatus, setRealtimeStatus] = useState('connecting')
  const bottomRef = useRef(null)
  const selectedRef = useRef(null)

  useEffect(() => { selectedRef.current = selected }, [selected])

  useEffect(() => {
    if (!historyTable) return
    // Garante RLS + Realtime configurados (idempotente, seguro chamar sempre)
    supabase.rpc('ensure_table_setup', { p_table: historyTable })
    setLoadingContacts(true)
    supabase
      .from(historyTable)
      .select('*')
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
                lastTs: row.data || row.created_at || null,
              })
            }
          }
          setContacts(unique)
        }
        setLoadingContacts(false)
      })
  }, [historyTable])

  useEffect(() => {
    if (!selected || !historyTable) return
    setLoadingMsgs(true)
    setMessages([])
    supabase
      .from(historyTable)
      .select('*')
      .eq('session_id', selected.session_id)
      .order('id', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) {
          setMessages(data.map(row => ({
            id: row.id,
            type: row.message?.type,
            content: parseContent(row.message?.content || ''),
            ts: row.data || row.created_at || null,
          })))
        }
        setLoadingMsgs(false)
      })
  }, [selected, historyTable])

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

          const ts = row.data || row.created_at || null
          setContacts(prev => {
            const exists = prev.find(c => c.session_id === row.session_id)
            if (exists) {
              return [
                { ...exists, lastTs: ts },
                ...prev.filter(c => c.session_id !== row.session_id),
              ]
            }
            return [{ session_id: row.session_id, phone: formatPhone(row.session_id), lastTs: ts }, ...prev]
          })

          if (selectedRef.current?.session_id === row.session_id) {
            setMessages(msgs => [
              ...msgs,
              {
                id: row.id,
                type: row.message?.type,
                content: parseContent(row.message?.content || ''),
                ts,
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

  useEffect(() => {
    if (!loadingMsgs) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loadingMsgs])

  const filtered = contacts.filter(c => c.phone.includes(search))

  return (
    <div className="contacts-root">
      {/* Lista lateral */}
      <div className="contacts-list">
        <div className="contacts-list-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="contacts-list-title">Histórico de Conversa</div>
            {historyTable && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 11,
                color: realtimeStatus === 'connected' ? '#16A34A' : realtimeStatus === 'error' ? '#DC2626' : '#9CA3AF',
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: realtimeStatus === 'connected' ? '#16A34A' : realtimeStatus === 'error' ? '#DC2626' : '#9CA3AF',
                  display: 'inline-block',
                  animation: realtimeStatus === 'connected' ? 'pulse-dot 2s infinite' : 'none',
                }} />
                {realtimeStatus === 'connected' ? 'Ao vivo' : realtimeStatus === 'error' ? 'Erro' : '...'}
              </div>
            )}
          </div>
          <input
            className="contacts-search"
            placeholder="Buscar por telefone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="contacts-list-body">
          {!historyTable && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Tabela de histórico não configurada.
            </div>
          )}
          {historyTable && loadingContacts && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Carregando...
            </div>
          )}
          {historyTable && !loadingContacts && filtered.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Nenhum contato encontrado.
            </div>
          )}
          {filtered.map(c => (
            <div
              key={c.session_id}
              className={`contact-item ${selected?.session_id === c.session_id ? 'selected' : ''}`}
              onClick={() => setSelected(c)}
            >
              <div className="contact-avatar"><User size={14} style={{ opacity: 0.4 }} /></div>
              <div className="contact-info">
                <div className="contact-name">{c.phone}</div>
                <div className="contact-preview">Ver conversa completa</div>
              </div>
              <div className="contact-meta">
                {c.lastTs && (
                  <div className="contact-time">{formatContactTime(c.lastTs)}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Painel de chat */}
      <div className="chat-panel">
        {!selected ? (
          <div className="chat-empty">
            <MessageSquare size={32} style={{ opacity: 0.2 }} />
            <div style={{ fontSize: 14 }}>Selecione uma conversa para visualizar o histórico</div>
          </div>
        ) : (
          <>
            <div className="chat-header">
              <div className="contact-avatar" style={{ width: 38, height: 38, fontSize: 15 }}>
                <User size={14} style={{ opacity: 0.4 }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--text-primary)' }}>{selected.phone}</div>
                {!loadingMsgs && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{messages.length} mensagem(ns)</div>
                )}
              </div>
            </div>

            <div className="chat-body">
              {loadingMsgs && (
                <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: '2rem' }}>
                  Carregando mensagens...
                </div>
              )}
              {!loadingMsgs && messages.length === 0 && (
                <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: '2rem' }}>
                  Sem mensagens.
                </div>
              )}
              {messages.map(msg => {
                const isHuman = msg.type === 'human'
                return (
                  <div key={msg.id}>
                    <div className="msg-label" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      justifyContent: isHuman ? 'flex-start' : 'flex-end',
                      color: isHuman ? 'var(--text-muted)' : '#2563EB',
                    }}>
                      {isHuman ? <><User size={10} /> Cliente</> : <><Bot size={10} /> IA</>}
                    </div>
                    <div className={`msg-row ${isHuman ? 'ai' : 'client'}`}>
                      <div className="msg-bubble">
                        {msg.content}
                      </div>
                    </div>
                    {msg.ts && (
                      <div className="msg-time" style={{ textAlign: isHuman ? 'left' : 'right' }}>
                        {formatMsgTime(msg.ts)}
                      </div>
                    )}
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

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
          </>
        )}
      </div>
    </div>
  )
}
