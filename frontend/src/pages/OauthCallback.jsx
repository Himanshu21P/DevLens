import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api, { setAuthHeader } from '../services/api.js';
import { Loader2 } from 'lucide-react';

export const OauthCallback = () => {
  const { user, checkAuth, showToast } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const effectRan = useRef(false); // Prevents React 18 double-execution in StrictMode

  useEffect(() => {
    // Prevent duplicate calls in StrictMode
    if (effectRan.current) return;
    effectRan.current = true;

    const code = searchParams.get('code');
    if (!code) {
      showToast('OAuth authorization code is missing.', 'error');
      navigate('/login');
      return;
    }

    const handleOAuth = async () => {
      try {
        if (user) {
          // 1. Linking Mode: User is logged in, link their GitHub
          await api.post('/api/v1/auth/github/link', { code });
          
          // Re-fetch user profile to update context state with new GitHub metadata
          await checkAuth();
          
          showToast('GitHub account successfully linked!', 'success');
          navigate('/profile');
        } else {
          // 2. Authentication Mode: Guest login, authenticate with GitHub
          const response = await api.post('/api/v1/auth/github/callback', { code });
          const { accessToken, user: userData } = response.data.data;

          // Set client auth header and trigger silent re-verification to populate context
          setAuthHeader(accessToken);
          await checkAuth();

          showToast(`Welcome to DevLens, ${userData.name}!`, 'success');
          navigate('/dashboard');
        }
      } catch (err) {
        const errMsg = err.response?.data?.message || 'GitHub authorization failed.';
        showToast(errMsg, 'error');
        navigate(user ? '/profile' : '/login');
      }
    };

    handleOAuth();
  }, [searchParams, user, navigate, checkAuth, showToast]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-dark-950 dark:text-slate-100 bg-grid-pattern dark:bg-grid-pattern-dark flex flex-col justify-center items-center px-6 py-12 transition-colors duration-300">
      <div className="cyber-card w-full max-w-sm p-8 bg-white/85 dark:bg-dark-900/80 backdrop-blur-md flex flex-col items-center gap-6 text-center animate-slide-up">
        <Loader2 className="animate-spin text-brand-500" size={36} />
        <div className="space-y-1">
          <h2 className="text-lg font-bold tracking-tight">
            {user ? 'Connecting GitHub' : 'Authenticating with GitHub'}
          </h2>
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Syncing your developer portfolio...
          </p>
        </div>
      </div>
    </div>
  );
};

export default OauthCallback;
