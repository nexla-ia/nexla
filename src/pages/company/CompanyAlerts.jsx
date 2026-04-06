import React, { useState } from 'react'
import { useAuth, mockAlerts } from '../../context/AuthContext'
import { BellRing, Calendar, HelpCircle, Phone, CheckCircle2, Clock } from 'lucide-react'
import './Company.css'

export default function CompanyAlerts() {
  const { session } = useAuth()
  const companyId = session?.company?.id
  const [alerts, setAlerts] = useState(mockAlerts[companyId] || [])
  const [filter, setFilter] = useState('all')

  function resolve(id) {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, resolved: true } : a))
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
            Pedidos de ajuda e avisos de agendamento
          </div>
        </div>
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

      {filtered.length === 0 && (
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
            <div className="alert-title">{alert.contactName}</div>
            <div className="alert-msg">{alert.message}</div>
            <div className="alert-footer">
              <span className={`nx-badge ${alert.type === 'help' ? 'nx-badge-amber' : 'nx-badge-cyan'}`}>
                {alert.type === 'help' ? 'Pedido de ajuda' : 'Agendamento'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={11} /> {alert.time}
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
