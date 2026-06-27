import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ProtectedRoute, PublicRoute } from './components/RouteGuard.jsx';
import { Loader2 } from 'lucide-react';

const Login = React.lazy(() => import('./pages/Login.jsx'));
const Register = React.lazy(() => import('./pages/Register.jsx'));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword.jsx'));
const ResetPassword = React.lazy(() => import('./pages/ResetPassword.jsx'));
const Profile = React.lazy(() => import('./pages/Profile.jsx'));
const OauthCallback = React.lazy(() => import('./pages/OauthCallback.jsx'));
const Dashboard = React.lazy(() => import('./pages/Dashboard.jsx'));

// Simple Landing Page routing redirect
function LandingRedirect() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-brand-500" size={36} />
      </div>
    );
  }
  
  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <React.Suspense fallback={
          <div className="min-h-screen bg-slate-50 dark:bg-dark-950 flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-brand-500" size={36} />
          </div>
        }>
          <Routes>
            {/* Public Authentication routes (guarded) */}
            <Route element={<PublicRoute />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
            </Route>

            {/* Secure Private routes (guarded) */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/profile" element={<Profile />} />
            </Route>

            {/* GitHub OAuth Callback Handler */}
            <Route path="/oauth/callback" element={<OauthCallback />} />

            {/* Landing redirect */}
            <Route path="/" element={<LandingRedirect />} />
            
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </React.Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
