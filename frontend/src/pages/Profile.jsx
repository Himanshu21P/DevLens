import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';
import { 
  GitBranch, Users, BookOpen, MapPin, Briefcase, Link as LinkIcon, 
  Twitter, AlertTriangle, ShieldAlert, ArrowLeft, Loader2, LogOut, Moon, Sun, User as UserIcon
} from 'lucide-react';

export const Profile = () => {
  const { user, checkAuth, logout, showToast } = useAuth();
  const [theme, setTheme] = useState('dark');
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [showUnlinkModal, setShowUnlinkModal] = useState(false);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Redirect to GitHub OAuth Authorization page
  const handleConnectGithub = () => {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
    const redirectUri = encodeURIComponent(import.meta.env.VITE_GITHUB_REDIRECT_URI);
    const scope = 'read:user,user:email';
    
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;
  };

  // Triggers the unlink API endpoint
  const handleUnlinkGithub = async () => {
    setIsUnlinking(true);
    setShowUnlinkModal(false);
    try {
      await api.post('/api/v1/auth/github/unlink');
      
      // Re-fetch profile to update local user state (clears githubUsername, etc.)
      await checkAuth();
      showToast('GitHub account unlinked successfully.', 'success');
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to unlink account.';
      showToast(errMsg, 'error');
    } finally {
      setIsUnlinking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-dark-950 dark:text-slate-100 bg-grid-pattern dark:bg-grid-pattern-dark flex flex-col justify-between transition-colors duration-300">
      
      {/* Navigation Header */}
      <header className="border-b border-slate-200 dark:border-dark-800 glass sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link 
            to="/dashboard" 
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-900 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-dark-800"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-white font-bold font-mono">
              DL
            </div>
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-brand-400 to-cyber-blue bg-clip-text text-transparent">
              DevLens
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-dark-900 dark:hover:bg-dark-800 border border-slate-200 dark:border-dark-800 transition-colors"
          >
            {theme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-700" />}
          </button>
          <button 
            onClick={logout}
            className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors flex items-center gap-1.5 text-xs font-bold"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Settings Container */}
      <main className="max-w-4xl w-full mx-auto px-6 py-12 flex-grow space-y-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Profile Settings</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your account credentials, connections, and portfolio metadata.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Left Column: Local Account Profile Card */}
          <div className="md:col-span-1 space-y-6">
            <div className="cyber-card p-6 bg-white dark:bg-dark-900">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1.5">
                <UserIcon size={14} />
                Account Info
              </h2>
              
              <div className="flex flex-col items-center text-center pb-6 border-b border-slate-100 dark:border-dark-800">
                <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-500 flex items-center justify-center font-bold text-2xl shadow-sm mb-3">
                  {user?.name ? user.name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
                </div>
                <h3 className="font-bold text-base tracking-tight">{user?.name || 'Developer'}</h3>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{user?.email}</span>
              </div>

              <div className="pt-4 space-y-3.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400">Auth Method:</span>
                  <span className="font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-dark-950 border border-slate-200 dark:border-dark-800">
                    {user?.githubUsername ? 'Hybrid (OAuth)' : 'Credentials'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400">Account Role:</span>
                  <span className="font-semibold uppercase font-mono text-[10px] tracking-wider px-2 py-0.5 rounded-md bg-brand-500/10 border border-brand-500/20 text-brand-500">
                    User
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: GitHub Connection Card */}
          <div className="md:col-span-2 space-y-6">
            {user?.githubUsername ? (
              
              /* CASE 1: GITHUB CONNECTED (Preview Portfolio Card) */
              <div className="cyber-card p-6 md:p-8 bg-white dark:bg-dark-900 space-y-6">
                <div className="flex justify-between items-start border-b border-slate-100 dark:border-dark-800 pb-4">
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <BookOpen size={14} />
                      Connected GitHub Profile
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Your public developer portfolio metadata is currently synchronized.
                    </p>
                  </div>

                  <button
                    onClick={() => setShowUnlinkModal(true)}
                    disabled={isUnlinking}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-500 hover:text-white bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 hover:border-transparent transition-all"
                  >
                    {isUnlinking ? <Loader2 className="animate-spin" size={14} /> : 'Disconnect'}
                  </button>
                </div>

                {/* Rich Profile Preview Panel */}
                <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start text-center sm:text-left">
                  {/* Large Avatar */}
                  <img 
                    src={user.avatarUrl} 
                    alt={`${user.githubUsername} avatar`}
                    className="w-20 h-20 rounded-2xl border border-slate-200 dark:border-dark-800 shadow-md object-cover flex-shrink-0"
                  />

                  <div className="space-y-3 flex-grow">
                    <div>
                      <h3 className="text-xl font-black tracking-tight">{user.name}</h3>
                      <a 
                        href={`https://github.com/${user.githubUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-mono text-brand-500 dark:text-brand-400 hover:underline inline-block mt-0.5"
                      >
                        @{user.githubUsername}
                      </a>
                    </div>

                    {user.githubBio ? (
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed italic max-w-md bg-slate-50 dark:bg-dark-950 p-3 rounded-lg border border-slate-200/40 dark:border-dark-800/40">
                        "{user.githubBio}"
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No public bio available.</p>
                    )}

                    {/* Metadata Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-500 dark:text-slate-400 pt-2">
                      {user.githubCompany && (
                        <div className="flex items-center justify-center sm:justify-start gap-1.5 text-[11px]" title="Company">
                          <Briefcase size={13} className="text-slate-400 flex-shrink-0" />
                          <span className="truncate">{user.githubCompany}</span>
                        </div>
                      )}
                      {user.githubLocation && (
                        <div className="flex items-center justify-center sm:justify-start gap-1.5 text-[11px]" title="Location">
                          <MapPin size={13} className="text-slate-400 flex-shrink-0" />
                          <span className="truncate">{user.githubLocation}</span>
                        </div>
                      )}
                      {user.githubBlog && (
                        <div className="flex items-center justify-center sm:justify-start gap-1.5 text-[11px]" title="Website">
                          <LinkIcon size={13} className="text-slate-400 flex-shrink-0" />
                          <a href={user.githubBlog.startsWith('http') ? user.githubBlog : `https://${user.githubBlog}`} target="_blank" rel="noopener noreferrer" className="hover:text-brand-500 truncate">
                            {user.githubBlog.replace(/https?:\/\/(www\.)?/, '')}
                          </a>
                        </div>
                      )}
                      {user.githubTwitter && (
                        <div className="flex items-center justify-center sm:justify-start gap-1.5 text-[11px]" title="Twitter">
                          <Twitter size={13} className="text-slate-400 flex-shrink-0" />
                          <a href={`https://twitter.com/${user.githubTwitter}`} target="_blank" rel="noopener noreferrer" className="hover:text-brand-500 truncate">
                            @{user.githubTwitter}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Git Statistics Grid */}
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-dark-800">
                  <div className="p-4 rounded-xl bg-slate-100/50 dark:bg-dark-950/50 border border-slate-200/50 dark:border-dark-800/50 text-center">
                    <div className="flex justify-center text-brand-500 mb-1">
                      <BookOpen size={16} />
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Repositories</span>
                    <div className="text-lg font-black tracking-tight mt-1">{user.githubReposCount}</div>
                  </div>
                  
                  <div className="p-4 rounded-xl bg-slate-100/50 dark:bg-dark-950/50 border border-slate-200/50 dark:border-dark-800/50 text-center">
                    <div className="flex justify-center text-cyber-blue mb-1">
                      <Users size={16} />
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Followers</span>
                    <div className="text-lg font-black tracking-tight mt-1">{user.githubFollowers}</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-100/50 dark:bg-dark-950/50 border border-slate-200/50 dark:border-dark-800/50 text-center">
                    <div className="flex justify-center text-cyber-purple mb-1">
                      <GitBranch size={16} />
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Following</span>
                    <div className="text-lg font-black tracking-tight mt-1">{user.githubFollowing}</div>
                  </div>
                </div>
              </div>
            ) : (
              
              /* CASE 2: GITHUB DISCONNECTED (Empty Connect State) */
              <div className="cyber-card p-6 md:p-8 bg-white dark:bg-dark-900 text-center space-y-6">
                <div className="max-w-sm mx-auto space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-500 flex items-center justify-center mx-auto shadow-sm">
                    <GitBranch size={26} />
                  </div>
                  
                  <div className="space-y-1.5">
                    <h3 className="text-lg font-bold tracking-tight">Connect your GitHub Portfolio</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      Link your GitHub account to unleash the full power of DevLens. Connect to calculate your 
                      original Developer Score, compile strengths, and generate an AI-powered Resume Readiness Analysis.
                    </p>
                  </div>
                  
                  <button
                    onClick={handleConnectGithub}
                    className="px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-all hover:shadow-[0_0_15px_rgba(79,86,241,0.35)] shadow-sm inline-flex items-center gap-1.5"
                  >
                    <GitBranch size={14} />
                    Connect GitHub Account
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 dark:border-dark-800 py-6 text-center text-xs text-slate-500 dark:text-slate-500">
        DevLens &copy; 2026. Profile Settings Dashboard.
      </footer>

      {/* CONFIRMATION UNLINK DIALOG MODAL */}
      {showUnlinkModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-dark-950/80 backdrop-blur-sm animate-fade-in">
          <div className="cyber-card w-full max-w-md p-6 bg-white dark:bg-dark-900 border-rose-500/30 dark:border-rose-500/30 space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Disconnect GitHub Account?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Are you sure you want to disconnect your GitHub profile? This will immediately clear your 
                  Developer Score, AI Roadmaps, and synchronized portfolio metadata from your DevLens profile.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-dark-800 pt-4">
              <button
                onClick={() => setShowUnlinkModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors bg-slate-50 hover:bg-slate-100 dark:bg-dark-950 dark:hover:bg-dark-800 border border-slate-200 dark:border-dark-800"
              >
                Cancel
              </button>
              <button
                onClick={handleUnlinkGithub}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 transition-all hover:shadow-[0_0_10px_rgba(244,63,94,0.3)]"
              >
                Confirm Disconnect
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Profile;
