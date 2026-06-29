import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthGuard } from '@/components/AuthGuard'
import { AppShell } from '@/components/shell/AppShell'
import LoginPage from '@/pages/LoginPage'
import AuthErrorPage from '@/pages/AuthErrorPage'
import CallbackPage from '@/pages/CallbackPage'
import ImportPage from '@/pages/ImportPage'
import LogPage from '@/pages/LogPage'
import ProfilePage from '@/pages/ProfilePage'
import AdminPage from '@/pages/AdminPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/error" element={<AuthErrorPage />} />
      <Route path="/auth/callback" element={<CallbackPage />} />
      <Route
        element={
          <AuthGuard>
            <AppShell />
          </AuthGuard>
        }
      >
        <Route index element={<Navigate to="/import" replace />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/log" element={<LogPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/import" replace />} />
      </Route>
    </Routes>
  )
}
