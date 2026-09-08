import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './contexts/ToastContext'
import AppLayout from './components/AppLayout'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import Library from './pages/Library'
import LessonDetail from './pages/LessonDetail'
import SubjectView from './pages/SubjectView'
import FolderView from './pages/FolderView'
import SearchPage from './pages/SearchPage'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login"  element={<AuthPage />} />
              <Route path="/" element={<AppLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard"      element={<Dashboard />} />
                <Route path="library"        element={<Library />} />
                <Route path="lesson/:id"     element={<LessonDetail />} />
                <Route path="folder/:id"     element={<FolderView />} />
                <Route path="subject/:id"    element={<SubjectView />} />
                <Route path="search"         element={<SearchPage />} />
                <Route path="settings"       element={<Settings />} />
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
