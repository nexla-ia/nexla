import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Plus, Building2, ChevronRight, X } from 'lucide-react'
import './Adm.css'

export default function AdmCompanies() {
  const { db, addCompany, toggleCompanyActive } = useAuth()
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', plan: 'Starter' })

  function handleAdd() {
    if (!form.name.trim()) return
    addCompany(form)
    setForm({ name: '', plan: 'Starter' })
    setShowModal(false)
  }

  return (
    <div className="page-enter">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="page-title">Empresas</div>
          <div className="page-sub">{db.companies.length} empresa(s) cadastrada(s)</div>
        </div>
        <button className="nx-btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={15} /> Nova empresa
        </button>
      </div>

      <div className="page-body">
        <div className="nx-card" style={{ overflow: 'hidden' }}>
          {db.companies.map((c, i) => (
            <div key={c.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 16px',
              borderBottom: i < db.companies.length - 1 ? '0.5px solid var(--border)' : 'none',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
              onClick={() => navigate(`/adm/empresas/${c.id}`)}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'rgba(0,201,255,0.08)',
                border: '0.5px solid rgba(0,201,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Building2 size={16} style={{ color: 'var(--accent-cyan)' }} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 14 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {c.users.length} usuário(s) · Criada em {c.createdAt}
                </div>
              </div>

              <span className={`nx-badge nx-badge-${c.plan === 'Business' ? 'violet' : c.plan === 'Pro' ? 'cyan' : 'gray'}`}>{c.plan}</span>
              <span className={`nx-badge ${c.active ? 'nx-badge-green' : 'nx-badge-red'}`}>{c.active ? 'Ativa' : 'Inativa'}</span>

              <button className="table-action" style={{ flexShrink: 0 }}
                onClick={e => { e.stopPropagation(); toggleCompanyActive(c.id) }}>
                {c.active ? 'Desativar' : 'Ativar'}
              </button>

              <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          backdropFilter: 'blur(4px)',
        }}>
          <div className="nx-card" style={{ width: 400, padding: '1.75rem', position: 'relative' }}>
            <button style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: 'var(--text-muted)' }}
              onClick={() => setShowModal(false)}><X size={16} /></button>

            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Nova empresa</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 1.5 + 'rem' }}>Preencha os dados para cadastrar</div>

            <div style={{ marginBottom: '1rem' }}>
              <label className="login-label" style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Nome da empresa</label>
              <input className="nx-input" placeholder="Ex: Clínica Saúde Total" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Plano</label>
              <select className="nx-select" value={form.plan} onChange={e => setForm(p => ({ ...p, plan: e.target.value }))}>
                <option value="Starter">Starter</option>
                <option value="Pro">Pro</option>
                <option value="Business">Business</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="nx-btn-ghost" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="nx-btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleAdd}>Cadastrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
