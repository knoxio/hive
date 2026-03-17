import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { LoginPage } from './components/LoginPage.tsx'
import { ProfilePage } from './components/ProfilePage.tsx'
import { RequireAuth } from './components/RequireAuth.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'
import { UsersPage } from './components/UsersPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <Routes>
            {/* Public — no auth required */}
            <Route path="/login" element={<LoginPage />} />

            {/* Admin-only — protected + role check enforced server-side */}
            <Route
              path="/admin/users"
              element={
                <RequireAuth>
                  <UsersPage />
                </RequireAuth>
              }
            />

            {/* Protected — redirect to /login when no token */}
            <Route
              path="/profile"
              element={
                <RequireAuth>
                  <ProfilePage />
                </RequireAuth>
              }
            />
            <Route
              path="/*"
              element={
                <RequireAuth>
                  <App />
                </RequireAuth>
              }
            />
          </Routes>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
