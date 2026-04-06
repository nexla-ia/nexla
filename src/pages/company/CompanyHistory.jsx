import React, { useState } from 'react'
import { useAuth, mockContacts, mockConversations } from '../../context/AuthContext'
import { Search, MessageSquare, Bot, User, Calendar, HelpCircle } from 'lucide-react'
import './Company.css'

export default function CompanyHistory() {
  const { session } = useAuth()
  const companyId = session?.company?.id
  const contacts = mockContacts[companyId] || []
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  )

  const conversation = selected ? (mockConversations[selected.id] || []) : []

  const statusColor = {
    attended: 'var(--accent-green)',
    waiting: 'var(--accent-amber)',
    help: 'var(--accent-red)',
    scheduled: 'var(--accent-cyan)',
  }

  return (
    <div className="history-root">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: 4 }}>
            Histórico de Conversas
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {contacts.length} conversa(s) registrada(s)
          </div>
        </div>
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
          <div className="nx-card" style={{ overflow: 'hidden' }}>
            {filtered.map((c, i) => (
              <div
                key={c.id}
                onClick={() => setSelected(c)}
                style={{
                  padding: '12px 14px',
                  borderBottom: i < filtered.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none',
                  cursor: 'pointer',
                  background: selected?.id === c.id ? 'rgba(0,201,255,0.06)' : 'transparent',
                  borderLeft: selected?.id === c.id ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '0.5px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)',
                  }}>{c.name.charAt(0)}</div>
                  <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-primary)' }}>{c.name}</div>
                  <div className="dot-pulse" style={{ marginLeft: 'auto', background: statusColor[c.status] }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 36 }}>
                  {(mockConversations[c.id] || []).length} mensagem(ns) · {c.time}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Conversa */}
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
            <div className="nx-card" style={{ overflow: 'hidden' }}>
              <div style={{
                padding: '14px 18px',
                borderBottom: '0.5px solid var(--border)',
                background: 'var(--bg-surface)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.05)', border: '0.5px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)',
                }}>{selected.name.charAt(0)}</div>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--text-primary)' }}>{selected.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selected.phone}</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {conversation.length} mensagem(ns)
                  </span>
                </div>
              </div>

              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 460, overflowY: 'auto' }}>
                {conversation.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    Sem mensagens registradas.
                  </div>
                )}
                {conversation.map(msg => (
                  <div key={msg.id}>
                    <div style={{
                      fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em',
                      color: msg.from === 'ai' ? 'var(--accent-cyan)' : 'var(--text-muted)',
                      textAlign: msg.from === 'client' ? 'right' : 'left',
                      marginBottom: 4, display: 'flex', alignItems: 'center',
                      justifyContent: msg.from === 'client' ? 'flex-end' : 'flex-start', gap: 4,
                    }}>
                      {msg.from === 'ai' ? <><Bot size={10} /> IA</> : <><User size={10} /> Cliente</>}
                    </div>
                    <div className={`msg-row ${msg.from === 'ai' ? 'ai' : 'client'}`}>
                      <div className={`msg-bubble ${msg.type ? `type-${msg.type}` : ''}`}>
                        {msg.type === 'scheduled' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--accent-green)', marginBottom: 4, fontWeight: 500 }}>
                            <Calendar size={11} /> Agendamento confirmado
                          </div>
                        )}
                        {msg.type === 'help' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--accent-amber)', marginBottom: 4, fontWeight: 500 }}>
                            <HelpCircle size={11} /> Pedido de ajuda humana
                          </div>
                        )}
                        {msg.text}
                      </div>
                    </div>
                    <div style={{
                      fontSize: 10, color: 'var(--text-muted)', marginTop: 3,
                      textAlign: msg.from === 'client' ? 'right' : 'left', paddingLeft: 2,
                    }}>{msg.time}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
