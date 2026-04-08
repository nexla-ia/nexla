import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { MessageSquare, Bot, User, PhoneCall, CheckCircle2, X } from 'lucide-react'
import './Company.css'

function formatPhone(sessionId) {
  return sessionId.replace(/@.*$/, '')
}

function parseContent(content) {
  return content.replace(/^\*[^*]+\*:\n/, '').trim()
}

function isToolMessage(row) {
  const type = row.message?.type
  const content = row.message?.content || ''
  if (type === 'tool') return true
  if (type === 'ai' && /^Calling \w+ with input:/i.test(content.trim())) return true
  return false
}

function formatMsgTime(ts) {
  if (!ts) return ''
  const date = new Date(ts)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const hhmm = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return hhmm
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return `Ontem ${hhmm}`
  return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hhmm}`
}

function formatContactTime(ts) {
  if (!ts) return ''
  const date = new Date(ts)
  const now = new Date()
  const diffMin = Math.floor((now - date) / 60000)
  const diffH = Math.floor(diffMin / 60)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `${diffMin}min`
  if (diffH < 24) return `${diffH}h`
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

const REASONS = [
  { value: 'agendado',  label: 'Agendado',  color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  { value: 'resolvido', label: 'Resolvido', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { value: 'desistiu',  label: 'Desistiu',  color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
]

export default function CompanyConversations() {
  const { session } = useAuth()
  const instance     = session?.company?.instance
  const historyTable = session?.company?.history_table

  const [convs, setConvs]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState(null)
  const [messages, setMessages]     = useState([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [search, setSearch]         = useState('')
  const [closeModal, setCloseModal] = useState(null) // conversa a fechar
  const [reason, setReason]         = useState('')
  const [closing, setClosing]       = useState(false)
  const bottomRef = useRef(null)
  const selectedRef = useRef(null)

  useEffect(() => { selectedRef.current = selected }, [selected])

  // Carrega conversas ativas
  useEffect(() => {
    if (!instance) return
    setLoading(true)
    supabase.from('conversations')
      .select('*')
      .eq('instancia', instance)
      .eq('status', 'active')
      .order('last_ts', { ascending: false, nullsFirst: false })
      .then(({ data, error }) => {
        if (!error && data) setConvs(data)
        setLoading(false)
      })
  }, [instance])

  // Realtime conversas
  useEffect(() => {
    if (!instance) return
    const ch = supabase.channel(`convs-${instance}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations', filter: `instancia=eq.${instance}` },
        (p) => { if (p.new?.status === 'active') setConvs(prev => [p.new, ...prev]) }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `instancia=eq.${instance}` },
        (p) => {
          if (p.new?.status === 'closed') {
            // Remove da lista e fecha painel se estava selecionada
            setConvs(prev => prev.filter(c => c.id !== p.new.id))
            setSelected(prev => prev?.id === p.new.id ? null : prev)
          } else {
            setConvs(prev => prev.map(c => c.id === p.new.id ? p.new : c))
          }
        }
      )
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [instance])

  // Realtime histórico — nova mensagem atualiza a conversa e adiciona no chat aberto
  useEffect(() => {
    if (!historyTable || !instance) return
    const ch = supabase.channel(`convs-history-${historyTable}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: historyTable },
        async (p) => {
          const row = p.new
          if (!row || isToolMessage(row)) return
          const ts = row.data || row.created_at || null
          const phone = formatPhone(row.session_id)
          const content = parseContent(row.message?.content || '')

          // Upsert na tabela conversations
          await supabase.from('conversations').upsert({
            session_id: row.session_id,
            instancia: instance,
            status: 'active',
            last_message: content.slice(0, 120),
            last_ts: ts,
          }, { onConflict: 'session_id,instancia', ignoreDuplicates: false })

          // Adiciona mensagem no chat se conversa estiver aberta
          if (selectedRef.current?.session_id === row.session_id) {
            setMessages(msgs => [...msgs, {
              id: row.id,
              type: row.message?.type,
              content,
              ts,
            }])
          }
        }
      )
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [historyTable, instance])

  // Carrega mensagens da conversa selecionada
  useEffect(() => {
    if (!selected || !historyTable) return
    setLoadingMsgs(true)
    setMessages([])
    supabase.from(historyTable)
      .select('*')
      .eq('session_id', selected.session_id)
      .order('id', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) {
          setMessages(data.filter(r => !isToolMessage(r)).map(r => ({
            id: r.id,
            type: r.message?.type,
            content: parseContent(r.message?.content || ''),
            ts: r.data || r.created_at || null,
          })))
        }
        setLoadingMsgs(false)
      })
  }, [selected, historyTable])

  useEffect(() => {
    if (!loadingMsgs) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loadingMsgs])

  async function handleClose() {
    if (!reason || !closeModal) return
    setClosing(true)
    await supabase.from('conversations')
      .update({ status: 'closed', reason, closed_at: new Date().toISOString() })
      .eq('id', closeModal.id)
    setClosing(false)
    setCloseModal(null)
    setReason('')
  }

  const filtered = convs.filter(c => formatPhone(c.session_id).includes(search))

  return (
    <div className="contacts-root">
      {/* Lista lateral */}
      <div className="contacts-list">
        <div className="contacts-list-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="contacts-list-title">Conversas ativas</div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', background: '#F1F5F9', borderRadius: 20, padding: '2px 8px' }}>
              {convs.length}
            </span>
          </div>
          <input
            className="contacts-search"
            placeholder="Buscar por telefone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="contacts-list-body">
          {loading && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Carregando...</div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {convs.length === 0 ? 'Nenhuma conversa ativa.' : 'Nenhum resultado.'}
            </div>
          )}
          {filtered.map(c => (
            <div
              key={c.id}
              className={`contact-item ${selected?.id === c.id ? 'selected' : ''}`}
              onClick={() => setSelected(c)}
            >
              <div className="contact-avatar"><User size={14} style={{ opacity: 0.4 }} /></div>
              <div className="contact-info">
                <div className="contact-name">{formatPhone(c.session_id)}</div>
                <div className="contact-preview" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.last_message || 'Ver conversa'}
                </div>
              </div>
              <div className="contact-meta">
                {c.last_ts && <div className="contact-time">{formatContactTime(c.last_ts)}</div>}
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
            <div style={{ fontSize: 14 }}>Selecione uma conversa ativa</div>
          </div>
        ) : (
          <>
            <div className="chat-header">
              <div className="contact-avatar" style={{ width: 38, height: 38 }}>
                <User size={14} style={{ opacity: 0.4 }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--text-primary)' }}>
                  {formatPhone(selected.session_id)}
                </div>
                {!loadingMsgs && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{messages.length} mensagem(ns)</div>
                )}
              </div>
              <button
                className="nx-btn-ghost"
                style={{ fontSize: 12, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6, color: '#DC2626', borderColor: '#FECACA' }}
                onClick={() => { setCloseModal(selected); setReason('') }}
              >
                <CheckCircle2 size={14} /> Finalizar conversa
              </button>
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
                const isImage = isHuman && /^(esta imagem|a imagem|esse documento|este documento|essa imagem|o documento|a foto|essa foto)/i.test(msg.content.trim())
                return (
                  <div key={msg.id}>
                    <div className="msg-label" style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      justifyContent: isHuman ? 'flex-start' : 'flex-end',
                      color: isHuman ? 'var(--text-muted)' : '#2563EB',
                    }}>
                      {isHuman ? <><User size={10} /> Cliente</> : <><Bot size={10} /> IA</>}
                    </div>
                    <div className={`msg-row ${isHuman ? 'ai' : 'client'}`}>
                      <div className="msg-bubble">
                        {isImage && (
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            fontSize: 11, fontWeight: 600, color: '#6B7280',
                            background: '#F3F4F6', border: '1px solid #E5E7EB',
                            borderRadius: 6, padding: '2px 8px', marginBottom: 6,
                          }}>🖼️ Imagem enviada</div>
                        )}
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

            <div style={{ padding: '12px 18px', borderTop: '0.5px solid var(--border)', background: 'var(--bg-surface)', flexShrink: 0 }}>
              <a
                href={`https://wa.me/${formatPhone(selected.session_id)}`}
                target="_blank" rel="noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: '#25D366', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', textDecoration: 'none',
                  boxShadow: '0 1px 4px rgba(37,211,102,0.3)',
                }}
              >
                <PhoneCall size={15} /> Ver conversa no WhatsApp
              </a>
            </div>
          </>
        )}
      </div>

      {/* Modal finalizar */}
      {closeModal && createPortal(
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, backdropFilter: 'blur(4px)', padding: '1.5rem',
        }}>
          <div className="nx-card" style={{ width: '100%', maxWidth: 400 }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Finalizar conversa</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {formatPhone(closeModal.session_id)} — qual foi o resultado?
                </div>
              </div>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: 4, cursor: 'pointer' }}
                onClick={() => setCloseModal(null)}><X size={16} /></button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {REASONS.map(r => (
                <label key={r.value} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                  border: `1.5px solid ${reason === r.value ? r.border : 'var(--border)'}`,
                  background: reason === r.value ? r.bg : 'var(--bg-surface)',
                  transition: 'all 0.15s',
                }}>
                  <input type="radio" style={{ display: 'none' }} value={r.value}
                    checked={reason === r.value} onChange={() => setReason(r.value)} />
                  <div style={{
                    width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                    background: reason === r.value ? r.color : 'var(--border)',
                    transition: 'background 0.15s',
                  }} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: reason === r.value ? r.color : 'var(--text-primary)' }}>
                    {r.label}
                  </div>
                </label>
              ))}
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
              <button className="nx-btn-ghost" style={{ flex: 1 }} onClick={() => setCloseModal(null)}>Cancelar</button>
              <button className="nx-btn-primary" style={{ flex: 1, justifyContent: 'center', opacity: reason ? 1 : 0.5 }}
                onClick={handleClose} disabled={!reason || closing}>
                <CheckCircle2 size={13} /> {closing ? 'Finalizando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  )
}
