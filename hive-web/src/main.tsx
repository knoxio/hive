import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { LoginPage } from './components/LoginPage.tsx'
import { RequireAuth } from './components/RequireAuth.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          {/* Public — no auth required */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected — redirect to /login when no token */}
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
    </BrowserRouter>
  </StrictMode>,
)
