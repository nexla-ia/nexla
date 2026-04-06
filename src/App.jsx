import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import AdmLayout from './pages/adm/AdmLayout'
import AdmDashboard from './pages/adm/AdmDashboard'
import AdmCompanies from './pages/adm/AdmCompanies'
import AdmCompanyDetail from './pages/adm/AdmCompanyDetail'
import CompanyLayout from './pages/company/CompanyLayout'
import CompanyContacts from './pages/company/CompanyContacts'
import CompanyHistory from './pages/company/CompanyHistory'
import CompanyAlerts from './pages/company/CompanyAlerts'

function PrivateAdm({ children }) {
  const { session } = useAuth()
  if (!session) return <Navigate to="/login" replace />
  if (session.role !== 'adm') return <Navigate to="/painel" replace />
  return children
}

function PrivateCompany({ children }) {
  const { session } = useAuth()
  if (!session) return <Navigate to="/login" replace />
  if (session.role !== 'company') return <Navigate to="/adm" replace />
  return children
}

function RootRedirect() {
  const { session } = useAuth()
  if (!session) return <Navigate to="/login" replace />
  return session.role === 'adm' ? <Navigate to="/adm" replace /> : <Navigate to="/painel" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />

          <Route path="/adm" element={<PrivateAdm><AdmLayout /></PrivateAdm>}>
            <Route index element={<AdmDashboard />} />
            <Route path="empresas" element={<AdmCompanies />} />
            <Route path="empresas/:id" element={<AdmCompanyDetail />} />
          </Route>

          <Route path="/painel" element={<PrivateCompany><CompanyLayout /></PrivateCompany>}>
            <Route index element={<CompanyContacts />} />
            <Route path="historico" element={<CompanyHistory />} />
            <Route path="alertas" element={<CompanyAlerts />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
