import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { mockContacts, mockAlerts } from '../../context/AuthContext'
import { Building2, Users, MessageSquare, AlertTriangle } from 'lucide-react'
import './Adm.css'

export default function AdmDashboard() {
  const { db } = useAuth()
  const navigate = useNavigate()

  const totalUsers    = db.companies.reduce((a, c) => a + (c.users?.length || 0), 0)
  const totalContacts = Object.values(mockContacts).flat().length
  const totalAlerts   = Object.values(mockAlerts).flat().filter(a => !a.resolved).length

  const stats = [
    { label: 'Empresas ativas',    value: db.companies.filter(c => c.active).length, detail: `${db.companies.length} total`,        icon: Building2,     color: 'var(--accent-cyan)' },
    { label: 'Usuários',           value: totalUsers,   detail: 'em todas as empresas',                                              icon: Users,         color: 'var(--accent-violet)' },
    { label: 'Contatos WhatsApp',  value: totalContacts, detail: 'ativos no sistema',                                               icon: MessageSquare, color: 'var(--accent-green)' },
    { label: 'Alertas pendentes',  value: totalAlerts,  detail: 'aguardando ação',                                                  icon: AlertTriangle, color: 'var(--accent-amber)' },
  ]

  return (
    <div className="page-enter">
      <div className="page-header">
        <div className="page-title">Dashboard</div>
        <div className="page-sub">Visão geral de todas as empresas</div>
      </div>

      <div className="page-body">
        <div className="stats-grid">
          {stats.map(s => (
            <div key={s.label} className="stat-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div className="stat-label">{s.label}</div>
                <s.icon size={16} style={{ color: s.color, opacity: 0.7 }} />
              </div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-detail">{s.detail}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: '1.75rem' }}>
          <div className="section-header">
            <div className="section-title">Empresas</div>
            <button className="nx-btn-primary" onClick={() => navigate('/adm/empresas')}>
              <Building2 size={14} /> Gerenciar
            </button>
          </div>
          <div className="nx-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Plano</th>
                  <th>Usuários</th>
                  <th>Contatos</th>
                  <th>Alertas</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {db.companies.map(c => {
                  const contacts = (mockContacts[c.id] || []).length
                  const alerts   = (mockAlerts[c.id] || []).filter(a => !a.resolved).length
                  return (
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/adm/empresas/${c.id}`)}>
                      <td className="td-name">{c.name}</td>
                      <td><span className={`nx-badge nx-badge-${c.plan === 'Business' ? 'violet' : c.plan === 'Pro' ? 'cyan' : 'gray'}`}>{c.plan}</span></td>
                      <td>{(c.users?.length || 0)}</td>
                      <td>{contacts}</td>
                      <td>{alerts > 0 ? <span className="nx-badge nx-badge-amber">{alerts}</span> : '—'}</td>
                      <td><span className={`nx-badge ${c.active ? 'nx-badge-green' : 'nx-badge-red'}`}>{c.active ? 'Ativa' : 'Inativa'}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
