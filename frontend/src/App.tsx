import { Routes, Route } from 'react-router-dom'
import { AuthGuard } from '@/components/AuthGuard'
import IndexPage from '@/pages/IndexPage'
import LoginPage from '@/pages/LoginPage'
import CallbackPage from '@/pages/CallbackPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<CallbackPage />} />
      <Route
        path="/*"
        element={
          <AuthGuard>
            <IndexPage />
          </AuthGuard>
        }
      />
    </Routes>
  )
}
