import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Spinner } from '../ui/Primitives'

// Require auth + optionally a specific role
export function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, loading, role } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner page />

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (roles && !roles.includes(role)) {
    return <Navigate to="/app" replace />
  }

  return children
}

// Redirect logged-in users away from auth pages
export function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) return <Spinner page />
  if (isAuthenticated) return <Navigate to="/app" replace />

  return children
}
