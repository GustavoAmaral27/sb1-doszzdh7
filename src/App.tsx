import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { isConfigured } from './lib/supabase'
import AppLayout from './components/app/AppLayout'
import Login from './pages/auth/Login'
import MfaChallenge from './pages/auth/MfaChallenge'
import ResetPassword from './pages/auth/ResetPassword'
import Dashboard from './pages/app/Dashboard'
import Assessor from './pages/app/Assessor'
import Accounts from './pages/app/Accounts'
import Transactions from './pages/app/Transactions'
import Budgets from './pages/app/Budgets'
import Security from './pages/app/Security'

export default function App() {
  const { session, loading, needsMfa } = useAuth()

  if (!isConfigured) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl bg-white p-6 text-sm text-slate-600 shadow">
          <h1 className="mb-2 text-lg font-semibold text-slate-900">Configuração necessária</h1>
          Defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no arquivo <code>.env</code> (veja o README).
        </div>
      </div>
    )
  }

  if (loading) return <div className="grid min-h-screen place-items-center text-slate-400">Carregando…</div>

  return (
    <Routes>
      <Route path="/redefinir-senha" element={session ? <ResetPassword /> : <Navigate to="/" />} />
      {!session ? (
        <Route path="*" element={<Login />} />
      ) : needsMfa ? (
        <Route path="*" element={<MfaChallenge />} />
      ) : (
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="assessor" element={<Assessor />} />
          <Route path="transacoes" element={<Transactions />} />
          <Route path="contas" element={<Accounts />} />
          <Route path="orcamentos" element={<Budgets />} />
          <Route path="seguranca" element={<Security />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      )}
    </Routes>
  )
}
