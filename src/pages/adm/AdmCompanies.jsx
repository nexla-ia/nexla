import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Plus, Building2, ChevronRight, X, RefreshCw, Users, Database } from 'lucide-react'
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

const emptyUser = { name: '', email: '', password: '' }

export default function AdmCompanies() {
  const { db, addCompany, addUser, toggleCompanyActive } = useAuth()
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    contactsTable: '',
    historyTable: '',
    numAccess: 1,
    users: [{ ...emptyUser }],
  })

  function handleCompanyName(name) {
    const slug = slugify(name)
    const domain = slug ? `${slug}.com` : ''
    setForm(prev => ({
      ...prev,
      name,
      users: prev.users.map(u => ({
        ...u,
        email: u.name ? `${slugify(u.name)}@${domain}` : (domain ? `acesso@${domain}` : u.email),
      })),
    }))
  }

  function handleNumAccess(val) {
    const n = Math.max(1, Math.min(10, Number(val)))
    const slug = slugify(form.name)
    const domain = slug ? `${slug}.com` : ''
    setForm(prev => {
      const current = prev.users
      let users
      if (n > current.length) {
        users = [...current, ...Array(n - current.length).fill(null).map(() => ({ ...emptyUser }))]
      } else {
        users = current.slice(0, n)
      }
      return { ...prev, numAccess: n, users }
    })
  }

  function handleUserName(idx, name) {
    const slug = slugify(form.name)
    const domain = slug ? `${slug}.com` : ''
    setForm(prev => {
      const users = [...prev.users]
      users[idx] = {
        ...users[idx],
        name,
        email: name && domain ? `${slugify(name)}@${domain}` : users[idx].email,
      }
      return { ...prev, users }
    })
  }

  function handleUserField(idx, field, value) {
    setForm(prev => {
      const users = [...prev.users]
      users[idx] = { ...users[idx], [field]: value }
      return { ...prev, users }
    })
  }

  function genPassword(idx) {
    handleUserField(idx, 'password', generatePassword(form.name || 'nexla'))
  }

  async function handleSave() {
    if (!form.name.trim()) return
    if (!form.contactsTable.trim() || !form.historyTable.trim()) return
    if (form.users.some(u => !u.name || !u.email || !u.password)) return
    setSaving(true)
    const company = await addCompany({
      name: form.name,
      contactsTable: form.contactsTable,
      historyTable: form.historyTable,
    })
    if (company) {
      for (const u of form.users) {
        await addUser(company.id, { name: u.name, email: u.email, password: u.password, role: 'admin' })
      }
    }
    setSaving(false)
    setShowModal(false)
    setForm({ name: '', contactsTable: '', historyTable: '', numAccess: 1, users: [{ ...emptyUser }] })
  }

  function closeModal() {
    setShowModal(false)
    setForm({ name: '', contactsTable: '', historyTable: '', numAccess: 1, users: [{ ...emptyUser }] })
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
          {db.companies.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Nenhuma empresa cadastrada ainda.
            </div>
          ) : db.companies.map((c, i) => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px',
              borderBottom: i < db.companies.length - 1 ? '1px solid var(--border)' : 'none',
              cursor: 'pointer', transition: 'background 0.12s',
            }}
              onClick={() => navigate(`/adm/empresas/${c.id}`)}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: '#EFF6FF', border: '1px solid #BFDBFE',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Building2 size={16} style={{ color: '#2563EB' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 14 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {(c.users || []).length} acesso(s) · Criada em {new Date(c.created_at).toLocaleDateString('pt-BR')}
                </div>
              </div>
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
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          backdropFilter: 'blur(4px)', padding: '1.5rem',
        }}>
          <div className="nx-card" style={{ width: '100%', maxWidth: 580, maxHeight: 'calc(100vh - 3rem)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

            {/* Header */}
            <div style={{ padding: '1.5rem 1.75rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>Nova empresa</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Preencha os dados para cadastrar</div>
              </div>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: 4 }} onClick={closeModal}>
                <X size={16} />
              </button>
            </div>

            {/* Body scrollável */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Nome da empresa */}
              <div>
                <label style={labelStyle}>Nome da empresa</label>
                <input className="nx-input" placeholder="Ex: Clínica Saúde Total"
                  value={form.name} onChange={e => handleCompanyName(e.target.value)} autoFocus />
                {form.name && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                    Domínio gerado: <strong style={{ color: '#2563EB' }}>{slugify(form.name)}.com</strong>
                  </div>
                )}
              </div>

              {/* Tabelas n8n */}
              <div style={{ background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                  <Database size={13} style={{ color: '#2563EB' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Tabelas n8n</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Tabela de contatos</label>
                    <input className="nx-input" placeholder="Ex: contatos_clinica"
                      value={form.contactsTable} onChange={e => setForm(p => ({ ...p, contactsTable: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Tabela de histórico IA</label>
                    <input className="nx-input" placeholder="Ex: historico_clinica"
                      value={form.historyTable} onChange={e => setForm(p => ({ ...p, historyTable: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Número de acessos */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                  <Users size={13} style={{ color: '#2563EB' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Acessos</span>
                  <input type="number" min={1} max={10} value={form.numAccess}
                    onChange={e => handleNumAccess(e.target.value)}
                    style={{ width: 52, marginLeft: 4, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: '#fff', color: 'var(--text-primary)', outline: 'none', textAlign: 'center' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {form.users.map((u, idx) => (
                    <div key={idx} style={{ background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                        Acesso {idx + 1}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                        <div>
                          <label style={labelStyle}>Nome</label>
                          <input className="nx-input" placeholder="Ex: Alisson"
                            value={u.name} onChange={e => handleUserName(idx, e.target.value)} />
                        </div>
                        <div>
                          <label style={labelStyle}>E-mail</label>
                          <input className="nx-input" type="email" placeholder="auto-gerado"
                            value={u.email} onChange={e => handleUserField(idx, 'email', e.target.value)} />
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>Senha</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input className="nx-input" placeholder="Digite ou gere uma senha"
                            value={u.password} onChange={e => handleUserField(idx, 'password', e.target.value)} />
                          <button type="button" className="nx-btn-ghost" style={{ flexShrink: 0, padding: '0 12px' }}
                            title="Gerar senha" onClick={() => genPassword(idx)}>
                            <RefreshCw size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '1rem 1.75rem', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexShrink: 0 }}>
              <button className="nx-btn-ghost" style={{ flex: 1 }} onClick={closeModal}>Cancelar</button>
              <button className="nx-btn-primary" style={{ flex: 2, justifyContent: 'center' }}
                onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : 'Cadastrar empresa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 500,
  color: 'var(--text-muted)', marginBottom: 5,
  textTransform: 'uppercase', letterSpacing: '0.05em',
}
