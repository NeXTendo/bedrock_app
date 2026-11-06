import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import DepartmentLayout from './components/layout/DepartmentLayout'
import Dashboard from './pages/department/Dashboard'
import ReportList from './pages/department/ReportList'
import ReportDetail from './pages/department/ReportDetail'
import MapView from './pages/department/Map'
import TeamSettings from './pages/department/TeamSettings'
import { Loader2 } from 'lucide-react'

/**
 * RootRedirect — used only for the "/" and wildcard "*" routes.
 *
 * Logic:
 *   1. While auth is loading → full-screen spinner (avoids flash of login)
 *   2. Logged in + has dept → fetch dept code → navigate to /dept/{code}/dashboard
 *   3. Logged in but no dept (citizen) → /login
 *   4. Not logged in → /login
 */
/** Redirects unknown dept sub-routes to the department dashboard (absolute path). */
function DeptFallback() {
  const { deptCode } = useParams<{ deptCode: string }>();
  return <Navigate to={`/dept/${deptCode}/dashboard`} replace />;
}

function RootRedirect() {
  const { session, profile, isLoading } = useAuth()
  const navigate = useNavigate()
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (isLoading) return

    if (!session || !profile) {
      navigate('/login', { replace: true })
      setDone(true)
      return
    }

    if (!profile.department_id) {
      // Citizen – no department access
      navigate('/login', { replace: true })
      setDone(true)
      return
    }

    // Fetch the dept code and redirect
    supabase
      .from('departments')
      .select('code')
      .eq('id', profile.department_id)
      .single()
      .then(({ data }) => {
        if (data?.code) {
          navigate(`/dept/${data.code.toLowerCase()}/dashboard`, { replace: true })
        } else {
          navigate('/login', { replace: true })
        }
        setDone(true)
      })
  }, [isLoading, session, profile, navigate])

  // Show spinner while auth resolves or dept lookup is in-flight
  if (isLoading || !done) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-50">
        <Loader2 size={40} className="animate-spin text-blue-500" />
        <p className="text-sm font-medium text-slate-500">Loading platform…</p>
      </div>
    )
  }

  return null
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            {/* Root: smart auth-aware redirect */}
            <Route path="/" element={<RootRedirect />} />

            {/* Public: login */}
            <Route path="/login" element={<Login />} />

            {/* Protected: department workspace */}
            <Route path="/dept/:deptCode" element={<DepartmentLayout />}>
              {/* /dept/roads → /dept/roads/dashboard */}
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="reports" element={<ReportList />} />
              <Route path="reports/:id" element={<ReportDetail />} />
              <Route path="map" element={<MapView />} />
              <Route path="team" element={<TeamSettings />} />
              {/* Unknown sub-path → department dashboard (absolute) */}
              <Route path="*" element={<DeptFallback />} />
            </Route>

            {/* Catch-all: smart redirect */}
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App
