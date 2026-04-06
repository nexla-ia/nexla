import React, { useState } from 'react'
import { useAuth, mockContacts, mockConversations } from '../../context/AuthContext'
import { MessageSquare, Phone, Bot, Calendar, HelpCircle } from 'lucide-react'
import './Company.css'

export default function CompanyContacts() {
  const { session } = useAuth()
  const companyId = session?.company?.id
  const contacts = mockContacts[companyId] || []
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  )

  const statusColor = {
    attended:  'var(--accent-green)',
    waiting:   'var(--accent-amber)',
    help:      'var(--accent-red)',
    scheduled: 'var(--accent-cyan)',
  }
  const statusLabel = {
    attended:  'Atendido',
    waiting:   'Aguardando',
    help:      'Precisa de ajuda',
    scheduled: 'Agendado',
  }

  const conversation = selected ? (mockConversations[selected.id] || []) : []

  return (
    <div className="contacts-root">
      {/* Lista lateral */}
      <div className="contacts-list">
        <div className="contacts-list-header">
          <div className="contacts-list-title">Contatos WhatsApp</div>
          <input
            className="contacts-search"
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="contacts-list-body">
          {filtered.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Nenhum contato encontrado.
            </div>
          )}
          {filtered.map(c => (
            <div
              key={c.id}
              className={`contact-item ${selected?.id === c.id ? 'selected' : ''}`}
              onClick={() => setSelected(c)}
            >
              <div className="contact-avatar">{c.name.charAt(0)}</div>
              <div className="contact-info">
                <div className="contact-name">{c.name}</div>
                <div className="contact-preview">{c.lastMsg}</div>
              </div>
              <div className="contact-meta">
                <div className="contact-time">{c.time}</div>
                {c.unread > 0 && <div className="contact-unread">{c.unread}</div>}
                <div className="dot-pulse" style={{ background: statusColor[c.status] }} />
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
            <div style={{ fontSize: 14 }}>Selecione um contato para ver a conversa</div>
          </div>
        ) : (
          <>
            <div className="chat-header">
              <div className="contact-avatar" style={{ width: 38, height: 38, fontSize: 15 }}>
                {selected.name.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--text-primary)' }}>{selected.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Phone size={11} />
                  {selected.phone}
                </div>
              </div>
              <span className="nx-badge" style={{
                background: `${statusColor[selected.status]}18`,
                color: statusColor[selected.status],
                border: `0.5px solid ${statusColor[selected.status]}44`,
              }}>
                {statusLabel[selected.status]}
              </span>
            </div>

            <div className="chat-body">
              {conversation.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: '2rem' }}>
                  Nenhuma mensagem registrada.
                </div>
              )}
              {conversation.map(msg => (
                <div key={msg.id}>
                  <div className={`msg-label`} style={{
                    textAlign: msg.from === 'client' ? 'right' : 'left',
                    color: msg.from === 'ai' ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  }}>
                    {msg.from === 'ai' ? '🤖 IA' : '👤 Cliente'}
                  </div>
                  <div className={`msg-row ${msg.from === 'ai' ? 'ai' : 'client'}`}>
                    <div className={`msg-bubble ${msg.type ? `type-${msg.type}` : ''}`}>
                      {msg.type === 'scheduled' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--accent-green)', marginBottom: 4 }}>
                          <Calendar size={11} /> Agendamento confirmado
                        </div>
                      )}
                      {msg.type === 'help' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--accent-amber)', marginBottom: 4 }}>
                          <HelpCircle size={11} /> Pedido de ajuda humana
                        </div>
                      )}
                      {msg.text}
                      {msg.pending && (
                        <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-muted)' }}>⏳</span>
                      )}
                    </div>
                  </div>
                  <div className="msg-time" style={{ textAlign: msg.from === 'client' ? 'right' : 'left' }}>
                    {msg.time}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
