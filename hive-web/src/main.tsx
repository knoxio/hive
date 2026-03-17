import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { LoginPage } from './components/LoginPage.tsx'
import { ProfilePage } from './components/ProfilePage.tsx'
import { RequireAuth } from './components/RequireAuth.tsx'
import { SetupGuard } from './components/SetupGuard.tsx'
import { SetupWizard } from './components/SetupWizard.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'
import { UsersPage } from './components/UsersPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <Routes>
            {/* First-run wizard — public, no SetupGuard to avoid redirect loop */}
            <Route path="/setup" element={<SetupWizard />} />

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

            {/* Protected — setup must be complete, then auth required */}
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
                <SetupGuard>
                  <RequireAuth>
                    <App />
                  </RequireAuth>
                </SetupGuard>
              }
            />
          </Routes>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
