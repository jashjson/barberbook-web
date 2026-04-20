import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute, PublicRoute } from './components/layout/ProtectedRoute'

import { LoginPage, RegisterPage } from './pages/auth/AuthPages'
import { CustomerHome, CustomerBook, CustomerHistory, CustomerProfile } from './pages/customer/CustomerPages'
import { BarberQueue, BarberSchedule, BarberEarnings, BarberProfile } from './pages/barber/BarberPages'
import { OwnerDashboard, OwnerBookings, OwnerStaff, OwnerShop, OwnerProfile } from './pages/owner/OwnerPages'

// Route sets per role — avoids conditional fragment rendering bug in React Router v6
function CustomerRoutes() {
  return (
    <Routes>
      <Route path="/"        element={<CustomerHome />} />
      <Route path="/book"    element={<CustomerBook />} />
      <Route path="/history" element={<CustomerHistory />} />
      <Route path="/profile" element={<CustomerProfile />} />
      <Route path="*"        element={<Navigate to="/app" replace />} />
    </Routes>
  )
}

function BarberRoutes() {
  return (
    <Routes>
      <Route path="/"         element={<BarberQueue />} />
      <Route path="/schedule" element={<BarberSchedule />} />
      <Route path="/earnings" element={<BarberEarnings />} />
      <Route path="/profile"  element={<BarberProfile />} />
      <Route path="*"         element={<Navigate to="/app" replace />} />
    </Routes>
  )
}

function OwnerRoutes() {
  return (
    <Routes>
      <Route path="/"          element={<OwnerDashboard />} />
      <Route path="/bookings"  element={<OwnerBookings />} />
      <Route path="/staff"     element={<OwnerStaff />} />
      <Route path="/shop"      element={<OwnerShop />} />
      <Route path="/profile"   element={<OwnerProfile />} />
      <Route path="*"          element={<Navigate to="/app" replace />} />
    </Routes>
  )
}

function AppPages() {
  const { role } = useAuth()

  const roleRoutes = {
    customer: <CustomerRoutes />,
    barber:   <BarberRoutes />,
    owner:    <OwnerRoutes />,
  }

  return (
    <AppLayout>
      {roleRoutes[role] || <Navigate to="/login" replace />}
    </AppLayout>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/app/*"    element={<ProtectedRoute><AppPages /></ProtectedRoute>} />
      <Route path="/"         element={<Navigate to="/login" replace />} />
      <Route path="*"         element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
