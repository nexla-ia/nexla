import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import './LoginPage.css'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('empresa')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ email: '', password: '' })

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.email || !form.password) { setError('Preencha todos os campos.'); return }
    setLoading(true)
    const result = await login(form.email, form.password, tab)
    setLoading(false)
    if (result.ok) {
      navigate(tab === 'adm' ? '/adm' : '/painel')
    } else {
      setError(result.error)
    }
  }

  return (
    <div className="login-root">
      <div className="login-grid-bg" />
      <div className="login-glow login-glow-1" />
      <div className="login-glow login-glow-2" />

      <div className="login-left">
        <h1 className="login-headline">
          Central de controle<br />
          <span className="login-headline-accent">inteligente</span>
        </h1>
        <p className="login-sub">
          Gerencie agentes de IA, conversas do WhatsApp e alertas em tempo real — tudo em um painel unificado.
        </p>

        <ul className="login-features">
          <li><span className="feat-dot" style={{ background: 'var(--accent-cyan)' }} />Monitoramento de contatos em tempo real</li>
          <li><span className="feat-dot" style={{ background: 'var(--accent-violet)' }} />Histórico completo de conversas da IA</li>
          <li><span className="feat-dot" style={{ background: 'var(--accent-green)' }} />Alertas de agendamento e pedidos de ajuda</li>
          <li><span className="feat-dot" style={{ background: 'var(--accent-amber)' }} />Multi-empresa com isolamento total de dados</li>
        </ul>
      </div>

      <div className="login-divider" />

      <div className="login-right">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-card-header">
            <h2 className="login-card-title">Acesso ao painel</h2>
            <p className="login-card-sub">Entre com suas credenciais</p>
          </div>

          <div className="login-tabs">
            <button type="button" className={`login-tab ${tab === 'empresa' ? 'active' : ''}`} onClick={() => { setTab('empresa'); setError('') }}>
              Acesso Empresa
            </button>
            <button type="button" className={`login-tab ${tab === 'adm' ? 'active' : ''}`} onClick={() => { setTab('adm'); setError('') }}>
              ADM Global
            </button>
          </div>

          {tab === 'adm' && (
            <div className="adm-notice">
              <span className="adm-dot" />
              Acesso administrativo global — todas as empresas
            </div>
          )}

          <div className="login-field">
            <label className="login-label">E-mail</label>
            <input className="nx-input" type="email" name="email" placeholder={tab === 'adm' ? 'admin@nexla.ai' : 'usuario@empresa.com'} value={form.email} onChange={handleChange} autoComplete="email" />
          </div>

          <div className="login-field">
            <label className="login-label">Senha</label>
            <div className="login-input-wrap">
              <input className="nx-input" type={showPass ? 'text' : 'password'} name="password" placeholder="••••••••" value={form.password} onChange={handleChange} style={{ paddingRight: 40 }} autoComplete="current-password" />
              <button type="button" className="login-eye" onClick={() => setShowPass(v => !v)}>
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {tab === 'empresa' && (
            <div className="login-forgot"><a href="#">Esqueceu a senha?</a></div>
          )}

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? <><Loader2 size={15} className="spin" /> Verificando...</> : tab === 'adm' ? 'Acesso administrativo' : 'Entrar no painel'}
          </button>

          <div className="login-footer">NEXLA v2.0 · Plataforma exclusiva · Acesso restrito</div>
        </form>
      </div>
    </div>
  )
}
