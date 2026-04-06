import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ArrowLeft, Plus, X, UserCheck, UserX, RefreshCw } from 'lucide-react'
import './Adm.css'

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function generatePassword(companyName) {
  const base = slugify(companyName).slice(0, 6) || 'nexla'
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  let suffix = ''
  for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)]
  return base + '@' + suffix
}

export default function AdmCompanyDetail() {
  const { id } = useParams()
  const { db, addUser, toggleUserActive } = useAuth()
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'admin' })
  const [err, setErr] = useState('')

  const company = db.companies.find(c => c.id === id)
  if (!company) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Empresa não encontrada.</div>

  const domain = slugify(company.name) + '.com'

  function handleName(name) {
    const email = name ? `${slugify(name)}@${domain}` : ''
    setForm(p => ({ ...p, name, email }))
  }

  function openModal() {
    setForm({ name: '', email: '', password: '', role: 'admin' })
    setErr('')
    setShowModal(true)
  }

  async function handleAddUser() {
    if (!form.name || !form.email || !form.password) { setErr('Preencha todos os campos.'); return }
    setSaving(true)
    await addUser(company.id, form)
    setSaving(false)
    setShowModal(false)
  }

  return (
    <div className="page-enter">
      <div className="page-header">
        <button className="nx-btn-ghost" style={{ marginBottom: 12 }} onClick={() => navigate('/adm/empresas')}>
          <ArrowLeft size={14} /> Voltar
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div className="page-title">{company.name}</div>
            <div className="page-sub" style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
              <span className={`nx-badge ${company.active ? 'nx-badge-green' : 'nx-badge-red'}`}>{company.active ? 'Ativa' : 'Inativa'}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Criada em {new Date(company.created_at).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
          <button className="nx-btn-primary" onClick={openModal}>
            <Plus size={14} /> Novo usuário
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="section-header">
          <div className="section-title">Usuários ({(company.users || []).length})</div>
        </div>
        <div className="nx-card">
          {!(company.users || []).length ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Nenhum usuário cadastrado. Crie o primeiro acesso.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {company.users.map(u => (
                  <tr key={u.id}>
                    <td className="td-name">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: '#EFF6FF', border: '1px solid #BFDBFE',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 600, color: '#2563EB',
                        }}>{u.name.charAt(0)}</div>
                        {u.name}
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.email}</td>
                    <td><span className={`nx-badge ${u.role === 'admin' ? 'nx-badge-cyan' : 'nx-badge-gray'}`}>{u.role === 'admin' ? 'Admin' : 'Viewer'}</span></td>
                    <td><span className={`nx-badge ${u.active ? 'nx-badge-green' : 'nx-badge-red'}`}>{u.active ? 'Ativo' : 'Inativo'}</span></td>
                    <td>
                      <button className={`table-action ${u.active ? 'danger' : ''}`} onClick={() => toggleUserActive(company.id, u.id)}>
                        {u.active ? <><UserX size={12} /> Desativar</> : <><UserCheck size={12} /> Ativar</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && createPortal(
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          backdropFilter: 'blur(4px)', padding: '1.5rem',
        }}>
          <div className="nx-card" style={{ width: '100%', maxWidth: 440 }}>
            {/* Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Novo usuário</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Acesso para <strong style={{ color: 'var(--text-secondary)' }}>{company.name}</strong>
                </div>
              </div>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: 4 }}
                onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>

            {/* Body */}
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Nome</label>
                <input className="nx-input" placeholder="Ex: Alisson"
                  value={form.name} onChange={e => handleName(e.target.value)} autoFocus />
              </div>

              <div>
                <label style={labelStyle}>E-mail</label>
                <input className="nx-input" type="email"
                  placeholder={`usuario@${domain}`}
                  value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>

              <div>
                <label style={labelStyle}>Senha</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="nx-input" placeholder="Digite ou gere uma senha"
                    value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
                  <button type="button" className="nx-btn-ghost" style={{ flexShrink: 0, padding: '0 12px' }}
                    title="Gerar senha" onClick={() => setForm(p => ({ ...p, password: generatePassword(company.name) }))}>
                    <RefreshCw size={13} />
                  </button>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Perfil de acesso</label>
                <select className="nx-select" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                  <option value="admin">Admin — acesso completo</option>
                  <option value="viewer">Viewer — somente leitura</option>
                </select>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)' }}>
              {err && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#DC2626', marginBottom: 12 }}>
                  {err}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="nx-btn-ghost" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancelar</button>
                <button className="nx-btn-primary" style={{ flex: 1, justifyContent: 'center' }}
                  onClick={handleAddUser} disabled={saving}>
                  {saving ? 'Salvando...' : 'Criar acesso'}
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  )
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 500,
  color: 'var(--text-muted)', marginBottom: 5,
  textTransform: 'uppercase', letterSpacing: '0.05em',
}
