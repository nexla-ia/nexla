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
  const hhmm = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (date.toDateString() === now.toDateString()) return hhmm
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
  { value: 'agendado',     label: 'Agendado',     color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  { value: 'resolvido',    label: 'Resolvido',    color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { value: 'encaminhado',  label: 'Encaminhado',  color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  { value: 'desistiu',     label: 'Desistiu',     color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
]

export default function CompanyConversations() {
  const { session } = useAuth()
  const instance     = session?.company?.instance
  const historyTable = session?.company?.history_table

  const [contacts, setContacts]     = useState([])   // todos do histórico
  const [closed, setClosed]         = useState(new Set()) // session_ids encerrados
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [search, setSearch]         = useState('')
  const [selected, setSelected]     = useState(null)
  const [messages, setMessages]     = useState([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [closeModal, setCloseModal] = useState(null)
  const [reason, setReason]         = useState('')
  const [closing, setClosing]       = useState(false)
  const [toast, setToast]           = useState(null)
  const bottomRef = useRef(null)
  const selectedRef = useRef(null)

  useEffect(() => { selectedRef.current = selected }, [selected])

  // Carrega contatos do histórico (igual ao CompanyHistory)
  useEffect(() => {
    if (!historyTable) return
    supabase.rpc('ensure_table_setup', { p_table: historyTable })
    setLoadingContacts(true)
    supabase.from(historyTable).select('*').order('id', { ascending: false })
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

  // Carrega sessões encerradas
  useEffect(() => {
    if (!instance) return
    supabase.from('conversations').select('session_id').eq('instancia', instance)
      .then(({ data }) => {
        if (data) setClosed(new Set(data.map(r => r.session_id)))
      })
  }, [instance])

  // Realtime histórico — nova mensagem adiciona contato no topo
  useEffect(() => {
    if (!historyTable) return
    const ch = supabase.channel(`convs-hist-${historyTable}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: historyTable },
        (p) => {
          const row = p.new
          if (!row || isToolMessage(row)) return
          const ts = row.data || row.created_at || null

          // Se sessão estava encerrada e chegou nova mensagem, reativa
          setClosed(prev => {
            if (prev.has(row.session_id)) {
              supabase.from('conversations').delete().eq('session_id', row.session_id).eq('instancia', instance)
              const next = new Set(prev)
              next.delete(row.session_id)
              return next
            }
            return prev
          })

          setContacts(prev => {
            const exists = prev.find(c => c.session_id === row.session_id)
            if (exists) {
              return [{ ...exists, lastTs: ts }, ...prev.filter(c => c.session_id !== row.session_id)]
            }
            return [{ session_id: row.session_id, phone: formatPhone(row.session_id), lastTs: ts }, ...prev]
          })

          if (selectedRef.current?.session_id === row.session_id) {
            setMessages(msgs => [...msgs, {
              id: row.id,
              type: row.message?.type,
              content: parseContent(row.message?.content || ''),
              ts,
            }])
          }
        }
      )
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [historyTable])

  // Realtime enceramentos — quando uma sessão é encerrada (manual ou cron), remove da tela
  useEffect(() => {
    if (!instance) return
    const ch = supabase.channel(`convs-closed-${instance}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations', filter: `instancia=eq.${instance}` },
        (p) => {
          if (!p.new) return
          setClosed(prev => new Set([...prev, p.new.session_id]))
          // Se a conversa encerrada estava aberta, fecha o painel
          setSelected(prev => prev?.session_id === p.new.session_id ? null : prev)
        }
      )
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [instance])

  // Carrega mensagens da conversa selecionada
  useEffect(() => {
    if (!selected || !historyTable) return
    setLoadingMsgs(true)
    setMessages([])
    supabase.from(historyTable).select('*')
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
    const { error } = await supabase.from('conversations').insert({
      session_id: closeModal.session_id,
      instancia: instance,
      reason,
      closed_at: new Date().toISOString(),
    })
    setClosing(false)
    if (error) return
    // Atualiza UI imediatamente sem depender do Realtime
    const closedId = closeModal.session_id
    setClosed(prev => new Set([...prev, closedId]))
    if (selected?.session_id === closedId) setSelected(null)
    setCloseModal(null)
    setReason('')
    const label = REASONS.find(r => r.value === reason)?.label || reason
    setToast({ message: `Conversa finalizada — ${label}`, color: REASONS.find(r => r.value === reason)?.color || '#16A34A' })
    setTimeout(() => setToast(null), 3500)
  }

  // Conversas ativas = contatos do histórico que NÃO estão na lista de encerrados
  const active = contacts.filter(c => !closed.has(c.session_id))
  const filtered = active.filter(c => c.phone.includes(search))

  return (
    <div className="contacts-root">
      <div className="contacts-list">
        <div className="contacts-list-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="contacts-list-title">Conversas ativas</div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', background: '#F1F5F9', borderRadius: 20, padding: '2px 8px' }}>
              {active.length}
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
          {loadingContacts && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Carregando...</div>
          )}
          {!loadingContacts && filtered.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {active.length === 0 ? 'Nenhuma conversa ativa.' : 'Nenhum resultado.'}
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
                <div className="contact-preview">Ver conversa</div>
              </div>
              <div className="contact-meta">
                {c.lastTs && <div className="contact-time">{formatContactTime(c.lastTs)}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

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
                <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--text-primary)' }}>{selected.phone}</div>
                {!loadingMsgs && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{messages.length} mensagem(ns)</div>
                )}
              </div>
              <button
                className="nx-btn-ghost"
                style={{ fontSize: 12, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
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
                <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: '2rem' }}>Sem mensagens.</div>
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
                href={`https://wa.me/${selected.phone}`}
                target="_blank" rel="noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: '#25D366', color: '#fff', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600,
                  textDecoration: 'none', boxShadow: '0 1px 4px rgba(37,211,102,0.3)',
                }}
              >
                <PhoneCall size={15} /> Ver conversa no WhatsApp
              </a>
            </div>
          </>
        )}
      </div>

      {toast && createPortal(
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 10000,
          background: '#fff', border: `1.5px solid ${toast.color}`,
          borderRadius: 10, padding: '12px 20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 13, fontWeight: 600, color: toast.color,
          animation: 'slide-in-right 0.2s ease',
        }}>
          <CheckCircle2 size={16} />
          {toast.message}
        </div>
      , document.body)}

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
                  {closeModal.phone} — qual foi o resultado?
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
