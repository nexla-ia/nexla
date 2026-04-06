import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ArrowLeft, Plus, X, UserCheck, UserX } from 'lucide-react'
import './Adm.css'

export default function AdmCompanyDetail() {
  const { id } = useParams()
  const { db, addUser, toggleUserActive } = useAuth()
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'viewer' })
  const [err, setErr] = useState('')

  const company = db.companies.find(c => c.id === id)
  if (!company) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Empresa não encontrada.</div>

  function handleAddUser() {
    if (!form.name || !form.email || !form.password) { setErr('Preencha todos os campos.'); return }
    addUser(company.id, form)
    setForm({ name: '', email: '', password: '', role: 'viewer' })
    setErr('')
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
              <span className={`nx-badge nx-badge-${company.plan === 'Business' ? 'violet' : company.plan === 'Pro' ? 'cyan' : 'gray'}`}>{company.plan}</span>
              <span className={`nx-badge ${company.active ? 'nx-badge-green' : 'nx-badge-red'}`}>{company.active ? 'Ativa' : 'Inativa'}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Criada em {company.createdAt}</span>
            </div>
          </div>
          <button className="nx-btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={14} /> Novo usuário
          </button>
        </div>
      </div>

      <div className="page-body">
        <div style={{ marginBottom: '0.5rem' }}>
          <div className="section-header">
            <div className="section-title">Usuários ({company.users.length})</div>
          </div>
          <div className="nx-card">
            {company.users.length === 0 ? (
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
                            background: 'rgba(0,201,255,0.08)',
                            border: '0.5px solid rgba(0,201,255,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 500, color: 'var(--accent-cyan)',
                          }}>{u.name.charAt(0)}</div>
                          {u.name}
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}>{u.email}</td>
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
      </div>

      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          backdropFilter: 'blur(4px)',
        }}>
          <div className="nx-card" style={{ width: 420, padding: '1.75rem', position: 'relative' }}>
            <button style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: 'var(--text-muted)' }}
              onClick={() => { setShowModal(false); setErr('') }}><X size={16} /></button>

            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Novo usuário</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: '1.25rem' }}>Acesso para: <strong style={{ color: 'var(--text-secondary)' }}>{company.name}</strong></div>

            {['name', 'email', 'password'].map(field => (
              <div key={field} style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  {field === 'name' ? 'Nome completo' : field === 'email' ? 'E-mail' : 'Senha inicial'}
                </label>
                <input className="nx-input" type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                  placeholder={field === 'name' ? 'João da Silva' : field === 'email' ? 'joao@empresa.com' : '••••••••'}
                  value={form[field]} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} />
              </div>
            ))}

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Perfil de acesso</label>
              <select className="nx-select" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                <option value="admin">Admin — acesso completo</option>
                <option value="viewer">Viewer — somente leitura</option>
              </select>
            </div>

            {err && <div className="login-error" style={{ marginBottom: '1rem', background: 'rgba(255,77,106,0.08)', border: '0.5px solid rgba(255,77,106,0.3)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 12, color: 'var(--accent-red)' }}>{err}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="nx-btn-ghost" style={{ flex: 1 }} onClick={() => { setShowModal(false); setErr('') }}>Cancelar</button>
              <button className="nx-btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleAddUser}>Criar acesso</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
