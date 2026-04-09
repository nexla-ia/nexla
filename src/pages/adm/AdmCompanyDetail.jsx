import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Plus, X, UserCheck, UserX, RefreshCw, Pencil, Settings } from 'lucide-react'
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
  const { db, addUser, updateUser, toggleUserActive } = useAuth()
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [editModal, setEditModal] = useState(null) // usuário sendo editado
  const [companyModal, setCompanyModal] = useState(false)
  const [companyForm, setCompanyForm] = useState({})
  const [companyErr, setCompanyErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'admin' })
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '', role: 'admin' })
  const [err, setErr] = useState('')
  const [editErr, setEditErr] = useState('')

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

  function openCompanyEdit() {
    setCompanyForm({
      name: company.name || '',
      instance: company.instance || '',
      apiInstancia: company.api_instancia || '',
      historyTable: company.history_table || '',
      contactsTable: company.contacts_table || '',
    })
    setCompanyErr('')
    setCompanyModal(true)
  }

  async function handleSaveCompany() {
    if (!companyForm.name?.trim()) { setCompanyErr('Nome é obrigatório.'); return }
    if (companyForm.instance?.trim() && !companyForm.apiInstancia?.trim()) {
      setCompanyErr('API Instância é obrigatória quando a instância está preenchida.'); return
    }
    setSaving(true)
    const { error } = await supabase.from('companies').update({
      name: companyForm.name,
      instance: companyForm.instance || null,
      api_instancia: companyForm.apiInstancia || null,
      history_table: companyForm.historyTable || null,
      contacts_table: companyForm.contactsTable || null,
    }).eq('id', company.id)
    setSaving(false)
    if (error) { setCompanyErr('Erro ao salvar: ' + error.message); return }
    setCompanyModal(false)
    window.location.reload()
  }

  function openEdit(user) {
    setEditForm({ name: user.name, email: user.email, password: '', role: user.role })
    setEditErr('')
    setEditModal(user)
  }

  async function handleEditUser() {
    if (!editForm.name || !editForm.email) { setEditErr('Nome e e-mail são obrigatórios.'); return }
    setSaving(true)
    const result = await updateUser(editModal.id, editForm)
    setSaving(false)
    if (!result?.ok) { setEditErr(result?.error || 'Erro ao salvar alterações.'); return }
    setEditModal(null)
  }

  async function handleAddUser() {
    if (!form.name || !form.email || !form.password) { setErr('Preencha todos os campos.'); return }
    setSaving(true)
    const result = await addUser(company.id, form)
    setSaving(false)
    if (!result?.ok) {
      setErr(result?.error || 'Erro ao criar acesso. Verifique se a função create_user existe no Supabase.')
      return
    }
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
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="nx-btn-ghost" onClick={openCompanyEdit}>
              <Settings size={14} /> Editar empresa
            </button>
            <button className="nx-btn-primary" onClick={openModal}>
              <Plus size={14} /> Novo usuário
            </button>
          </div>
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
                    <td style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button className="table-action" onClick={() => openEdit(u)}>
                        <Pencil size={12} /> Editar
                      </button>
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

      {editModal && createPortal(
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          backdropFilter: 'blur(4px)', padding: '1.5rem',
        }}>
          <div className="nx-card" style={{ width: '100%', maxWidth: 440 }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Editar usuário</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{editModal.name}</div>
              </div>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: 4 }}
                onClick={() => setEditModal(null)}><X size={16} /></button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Nome</label>
                <input className="nx-input" value={editForm.name}
                  onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} autoFocus />
              </div>
              <div>
                <label style={labelStyle}>E-mail</label>
                <input className="nx-input" type="email" value={editForm.email}
                  onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Nova senha <span style={{ fontWeight: 400, textTransform: 'none' }}>(deixe em branco para não alterar)</span></label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="nx-input" placeholder="Nova senha..."
                    value={editForm.password} onChange={e => setEditForm(p => ({ ...p, password: e.target.value }))} />
                  <button type="button" className="nx-btn-ghost" style={{ flexShrink: 0, padding: '0 12px' }}
                    title="Gerar senha" onClick={() => setEditForm(p => ({ ...p, password: generatePassword(company.name) }))}>
                    <RefreshCw size={13} />
                  </button>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Perfil de acesso</label>
                <select className="nx-select" value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}>
                  <option value="admin">Admin — acesso completo</option>
                  <option value="viewer">Viewer — somente leitura</option>
                </select>
              </div>
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)' }}>
              {editErr && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#DC2626', marginBottom: 12 }}>
                  {editErr}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="nx-btn-ghost" style={{ flex: 1 }} onClick={() => setEditModal(null)}>Cancelar</button>
                <button className="nx-btn-primary" style={{ flex: 1, justifyContent: 'center' }}
                  onClick={handleEditUser} disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

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

      {companyModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)', padding: '1.5rem' }}>
          <div className="nx-card" style={{ width: '100%', maxWidth: 480 }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Editar empresa</div>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setCompanyModal(false)}><X size={16} /></button>
            </div>
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nome da empresa</label>
                <input className="nx-input" value={companyForm.name} onChange={e => setCompanyForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Instância WhatsApp</label>
                  <input className="nx-input" placeholder="Ex: clinica-saude" value={companyForm.instance} onChange={e => setCompanyForm(p => ({ ...p, instance: e.target.value.trim() }))} />
                </div>
                <div>
                  <label style={labelStyle}>API Instância <span style={{ color: '#DC2626' }}>*</span></label>
                  <input className="nx-input" placeholder="Token/chave da API" value={companyForm.apiInstancia} onChange={e => setCompanyForm(p => ({ ...p, apiInstancia: e.target.value.trim() }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Tabela de histórico IA</label>
                  <input className="nx-input" placeholder="Ex: n8n_chat_histories_..." value={companyForm.historyTable} onChange={e => setCompanyForm(p => ({ ...p, historyTable: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Tabela de contatos</label>
                  <input className="nx-input" placeholder="Ex: contatos_clinica" value={companyForm.contactsTable} onChange={e => setCompanyForm(p => ({ ...p, contactsTable: e.target.value }))} />
                </div>
              </div>
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)' }}>
              {companyErr && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#DC2626', marginBottom: 12 }}>{companyErr}</div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="nx-btn-ghost" style={{ flex: 1 }} onClick={() => setCompanyModal(false)}>Cancelar</button>
                <button className="nx-btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSaveCompany} disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar'}
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
