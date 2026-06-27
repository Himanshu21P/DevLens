import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';
import { 
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';
import { 
  Search, Star, GitBranch, Users, BookOpen, MapPin, Briefcase, Link as LinkIcon, 
  Twitter, AlertTriangle, CheckCircle, RefreshCw, Sun, Moon, LogOut, User as UserIcon, 
  Loader2, Calendar, Cpu, Layers, Activity, Award, Copy, Trash2, Compass, 
  HelpCircle, Lightbulb, TrendingUp, ChevronRight, Info
} from 'lucide-react';
import { exportToJson, exportToMarkdown, downloadPdfFile } from '../utils/exportUtils.js';

// Animated Score counter for premium feel
const AnimatedScore = ({ score }) => {
  const [displayScore, setDisplayScore] = useState(0);
  
  useEffect(() => {
    const end = parseInt(score) || 0;
    
    // Immediate render in test environments to avoid JSDOM timer flakiness
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
      setDisplayScore(end);
      return;
    }

    let start = 0;
    if (start === end) {
      setDisplayScore(end);
      return;
    }
    const duration = 800; // ms
    const stepTime = Math.max(Math.floor(duration / end), 8);
    const timer = setInterval(() => {
      start += 1;
      setDisplayScore(start);
      if (start >= end) {
        setDisplayScore(end);
        clearInterval(timer);
      }
    }, stepTime);
    return () => clearInterval(timer);
  }, [score]);

  return <span>{displayScore}</span>;
};

export const Dashboard = () => {
  const { user, logout, showToast } = useAuth();
  const [theme, setTheme] = useState('dark');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [savedReports, setSavedReports] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isSavedInDb, setIsSavedInDb] = useState(false);
  const [comparisonData, setComparisonData] = useState(null);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  
  // Interactive Tab State for Interview Prep
  const [activePrepTab, setActivePrepTab] = useState('questions');

  // Load theme and saved reports on mount
  useEffect(() => {
    // Sync theme with document class
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    if (user) {
      fetchSavedReports();
    }
  }, [theme, user]);

  // Load comparison data whenever analysisResult changes and user is logged in
  useEffect(() => {
    if (user && analysisResult?.targetGithubUsername) {
      fetchComparisonData(analysisResult.targetGithubUsername);
    } else {
      setComparisonData(null);
    }
  }, [analysisResult, user]);

  const fetchComparisonData = async (targetUsername) => {
    setLoadingComparison(true);
    try {
      const res = await api.get(`/api/v1/analytics/report/compare/${targetUsername}`);
      setComparisonData(res?.data?.data || null);
    } catch (err) {
      console.error('Failed to fetch comparison history', err);
      setComparisonData(null);
    } finally {
      setLoadingComparison(false);
    }
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleExportJson = () => {
    if (!analysisResult) return;
    exportToJson(analysisResult);
    showToast('Report exported as JSON.', 'success');
  };

  const handleExportMarkdown = () => {
    if (!analysisResult) return;
    exportToMarkdown(analysisResult);
    showToast('Report exported as Markdown.', 'success');
  };

  const handleExportPdf = async () => {
    if (!analysisResult) return;
    setExportingPdf(true);
    try {
      let res;
      if (isSavedInDb && analysisResult.id) {
        res = await api.get(`/api/v1/analytics/report/${analysisResult.id}/export/pdf`, {
          responseType: 'blob',
        });
      } else {
        res = await api.post('/api/v1/analytics/export/pdf', analysisResult, {
          responseType: 'blob',
        });
      }
      downloadPdfFile(res.data, analysisResult.targetGithubUsername);
      showToast('Report exported as PDF.', 'success');
    } catch (err) {
      console.error('Failed to export PDF', err);
      showToast('Failed to export PDF report.', 'error');
    } finally {
      setExportingPdf(false);
    }
  };

  // Fetch saved reports from the backend
  const fetchSavedReports = async () => {
    setLoadingSaved(true);
    try {
      const res = await api.get('/api/v1/analytics/report/saved');
      const data = res?.data?.data;
      setSavedReports(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch saved reports', err);
    } finally {
      setLoadingSaved(false);
    }
  };

  // Triggers fresh profile collection & AI generation
  const handleAnalyze = async (searchName) => {
    const target = (searchName || username).trim();
    if (!target) {
      showToast('Please enter a GitHub username.', 'error');
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysisResult(null);
    setIsSavedInDb(false);

    try {
      const response = await api.get(`/api/v1/analytics/analyze/${target}`);
      if (response.data?.data?.result) {
        setAnalysisResult(response.data.data.result);
        setUsername(target);
      } else {
        throw new Error('Malformed API response.');
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to complete profile analysis.';
      setError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Saves the current analysis report to database
  const handleSaveReport = async () => {
    if (!analysisResult) return;
    setSaving(true);
    try {
      await api.post('/api/v1/analytics/report/save', analysisResult);
      setIsSavedInDb(true);
      showToast('Analysis report successfully saved to library.', 'success');
      fetchSavedReports(); // Refresh sidebar list
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to save report.';
      showToast(errMsg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Deletes a saved report
  const handleDeleteReport = async (reportId, e) => {
    e.stopPropagation(); // Stop trigger load report click
    if (!window.confirm('Are you sure you want to delete this saved report?')) return;
    
    try {
      await api.delete(`/api/v1/analytics/report/${reportId}`);
      showToast('Report deleted successfully.', 'success');
      // If we are currently displaying the deleted report, clear it
      if (analysisResult && savedReports.find(r => r.id === reportId)?.targetGithubUsername === analysisResult.targetGithubUsername) {
        setAnalysisResult(null);
        setIsSavedInDb(false);
      }
      fetchSavedReports();
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to delete report.';
      showToast(errMsg, 'error');
    }
  };

  // Helper to load a previously saved report
  const handleLoadSavedReport = (report) => {
    // Reconstruct the nested structure back into the UI-ready analysisResult envelope
    setAnalysisResult(report);
    setUsername(report.targetGithubUsername);
    setIsSavedInDb(true);
    setError(null);
    showToast(`Loaded saved report for @${report.targetGithubUsername}`, 'success');
  };

  // Helper to copy bullet points to clipboard
  const handleCopyBullet = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Copied bullet point to clipboard.', 'success');
  };

  // Prepare data for Radar Chart
  const getRadarData = () => {
    if (!analysisResult?.scoreBreakdown?.categories) return [];
    const cats = analysisResult.scoreBreakdown.categories;
    return [
      { subject: 'Repo Quality', value: cats.repositoryQuality?.score || 0 },
      { subject: 'Documentation', value: cats.documentationQuality?.score || 0 },
      { subject: 'Diversity', value: cats.technologyDiversity?.score || 0 },
      { subject: 'Activity', value: cats.projectActivity?.score || 0 },
      { subject: 'Open Source', value: cats.openSourceEngagement?.score || 0 },
      { subject: 'Portfolio', value: cats.portfolioReadiness?.score || 0 },
    ];
  };

  // Color mapping for score values
  const getScoreColorClass = (score) => {
    if (score >= 80) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    if (score >= 50) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
  };

  const getScoreProgressClass = (score) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-dark-950 dark:text-slate-100 bg-grid-pattern dark:bg-grid-pattern-dark flex flex-col justify-between transition-colors duration-300">
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-brand-500 text-white px-4 py-2 rounded-lg text-xs font-bold z-50 focus:ring-2 focus:ring-brand-500 focus:outline-none"
      >
        Skip to Main Content
      </a>
      
      {/* Navigation Header */}
      <header className="border-b border-slate-200 dark:border-dark-800 glass sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-white font-bold font-mono">
            DL
          </div>
          <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-brand-400 to-cyber-blue bg-clip-text text-transparent">
            DevLens
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          {user && (
            <Link 
              to="/profile" 
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-dark-900 dark:hover:bg-dark-800 border border-slate-200 dark:border-dark-800 transition-colors"
              title="View Profile Settings"
            >
              <UserIcon size={14} className="text-brand-500" />
              <span className="text-xs font-semibold font-mono text-slate-600 dark:text-slate-300">
                {user.githubUsername ? `@${user.githubUsername}` : user.name || user.email}
              </span>
            </Link>
          )}

          <button 
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-dark-900 dark:hover:bg-dark-800 border border-slate-200 dark:border-dark-800 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-700" />}
          </button>

          <button 
            onClick={logout}
            className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors flex items-center gap-1.5 text-xs font-bold"
            title="Log Out"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Grid Container for Dashboard & Saved Sidebar */}
      <div className="flex-grow flex flex-col lg:flex-row w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 gap-8">
        
        {/* LEFT COLUMN: Controls & Library */}
        <aside className="w-full lg:w-80 flex-shrink-0 space-y-6">
          
          {/* Profile Search Panel */}
          <div className="cyber-card p-6 bg-white dark:bg-dark-900 space-y-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Search size={14} />
                Analyze Developer
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Enter a GitHub username to compile deterministic scores and AI-powered recommendations.
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="relative">
                <input 
                  type="text"
                  placeholder="e.g. torvalds"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  disabled={loading}
                  className="w-full pl-3 pr-8 py-2 text-sm rounded-lg bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-slate-800 dark:text-slate-100 transition-all font-mono"
                  aria-label="GitHub Username"
                />
              </div>

              <button
                onClick={() => handleAnalyze()}
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:bg-brand-500/40 text-white text-xs font-bold transition-all hover:shadow-[0_0_15px_rgba(79,86,241,0.3)] flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Cpu size={14} />
                    <span>Analyze Profile</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Saved Reports Library (Visible if authenticated) */}
          {user && (
            <div className="cyber-card p-6 bg-white dark:bg-dark-900 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-dark-800 pb-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Award size={14} />
                  Saved Reports ({savedReports.length})
                </h2>
                {loadingSaved && <Loader2 className="animate-spin text-slate-400" size={12} />}
              </div>

              {savedReports.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-4">
                  No saved reports yet. Run an analysis and save it to build your library.
                </p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1" data-testid="saved-reports-list">
                  {savedReports.map((report) => (
                    <div
                      key={report.id}
                      onClick={() => handleLoadSavedReport(report)}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleLoadSavedReport(report)}
                      tabIndex="0"
                      role="button"
                      className={`w-full p-2.5 rounded-lg text-left border text-xs flex justify-between items-center transition-all focus:ring-2 focus:ring-brand-500 focus:outline-none cursor-pointer ${
                        analysisResult?.targetGithubUsername === report.targetGithubUsername
                          ? 'bg-brand-500/10 border-brand-500/30 text-brand-500'
                          : 'bg-slate-50 dark:bg-dark-950 border-slate-200 dark:border-dark-800 hover:border-brand-500/40'
                      }`}
                      aria-label={`Load saved report for @${report.targetGithubUsername}`}
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="font-mono font-bold truncate">@{report.targetGithubUsername}</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">
                          Score: {report.developerScore} | {new Date(report.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteReport(report.id, e)}
                        className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 transition-colors focus:ring-2 focus:ring-rose-500 focus:outline-none"
                        title="Delete Saved Report"
                        aria-label={`Delete saved report for @${report.targetGithubUsername}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>

        {/* RIGHT COLUMN: Results Display Panel */}
        <main id="main-content" className="flex-grow min-w-0" tabIndex="-1">

          {/* CASE 1: LOADING SKELETON STATE */}
          {loading && (
            <div className="space-y-6 animate-pulse" data-testid="loading-skeleton">
              <div className="cyber-card p-6 bg-white dark:bg-dark-900 h-28 flex flex-col justify-between">
                <div className="h-4 bg-slate-200 dark:bg-dark-800 rounded w-1/3"></div>
                <div className="h-3 bg-slate-200 dark:bg-dark-800 rounded w-2/3"></div>
                <div className="h-3 bg-slate-200 dark:bg-dark-800 rounded w-1/2"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="cyber-card p-6 bg-white dark:bg-dark-900 h-80 space-y-4">
                  <div className="h-4 bg-slate-200 dark:bg-dark-800 rounded w-1/4"></div>
                  <div className="h-24 bg-slate-200 dark:bg-dark-800 rounded"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-200 dark:bg-dark-800 rounded"></div>
                    <div className="h-3 bg-slate-200 dark:bg-dark-800 rounded w-5/6"></div>
                  </div>
                </div>
                <div className="cyber-card p-6 bg-white dark:bg-dark-900 h-80 space-y-4">
                  <div className="h-4 bg-slate-200 dark:bg-dark-800 rounded w-1/4"></div>
                  <div className="h-2 bg-slate-200 dark:bg-dark-800 rounded"></div>
                  <div className="h-2 bg-slate-200 dark:bg-dark-800 rounded w-3/4"></div>
                  <div className="h-2 bg-slate-200 dark:bg-dark-800 rounded w-5/6"></div>
                </div>
              </div>
            </div>
          )}

          {/* CASE 2: ERROR STATE */}
          {error && !loading && (
            <div className="cyber-card p-6 md:p-8 bg-white dark:bg-dark-900 border-rose-500/20 text-center space-y-4 animate-fade-in">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto shadow-sm">
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-bold text-base tracking-tight text-rose-500">Analysis Failed</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
                  {error}
                </p>
              </div>
              <button
                onClick={() => handleAnalyze()}
                className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-700 border border-slate-200 dark:border-dark-800 text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <RefreshCw size={12} />
                <span>Retry Analysis</span>
              </button>
            </div>
          )}

          {/* CASE 3: EMPTY/WELCOME STATE */}
          {!analysisResult && !loading && !error && (
            <div className="cyber-card p-8 md:p-12 bg-white dark:bg-dark-900 text-center space-y-6 animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-500 flex items-center justify-center mx-auto shadow-sm">
                <Compass size={32} />
              </div>
              
              <div className="space-y-2 max-w-md mx-auto">
                <h2 className="text-xl font-black tracking-tight leading-none">
                  No Active Analysis Loaded
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Search a developer above to pull live metadata from GitHub, run our deterministic algorithms, 
                  and generate a deep qualitative review powered by Gemini AI.
                </p>
              </div>

              {/* Quick links to try out */}
              <div className="pt-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
                  Or test with verified profiles:
                </span>
                <div className="flex justify-center gap-2">
                  {['octocat', 'torvalds'].map(name => (
                    <button
                      key={name}
                      onClick={() => handleAnalyze(name)}
                      className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-dark-950 dark:hover:bg-dark-800 border border-slate-200 dark:border-dark-800 text-xs font-mono font-bold transition-all cursor-pointer"
                    >
                      @{name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* CASE 4: ANALYSIS RESULTS VIEW */}
          {analysisResult && !loading && !error && (
            <div className="space-y-8 animate-slide-up">

              {/* Top Banner: Overall Score & Title */}
              <div className="cyber-card p-6 bg-white dark:bg-dark-900 flex flex-col md:flex-row justify-between items-center gap-6 border-l-4 border-l-brand-500">
                <div className="space-y-1 text-center md:text-left">
                  <span className="text-[10px] font-black uppercase tracking-wider text-brand-500 bg-brand-500/10 border border-brand-500/20 px-2.5 py-0.5 rounded-full">
                    Developer Audit Profile
                  </span>
                  <h1 className="text-2xl font-black tracking-tight mt-1.5">
                    Analysis for @{analysisResult.targetGithubUsername}
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Deterministic analytics fused with qualitative LLM feedback.
                  </p>
                </div>

                <div className="flex items-center gap-4 flex-wrap justify-center md:justify-end">
                  {user && (
                    <button
                      onClick={handleSaveReport}
                      disabled={saving || isSavedInDb}
                      className={`px-4 py-2 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all focus:ring-2 focus:ring-brand-500 focus:outline-none cursor-pointer ${
                        isSavedInDb
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 cursor-not-allowed'
                          : 'bg-brand-500 hover:bg-brand-600 disabled:bg-brand-500/40 text-white border-transparent hover:shadow-[0_0_10px_rgba(79,86,241,0.25)]'
                      }`}
                      aria-label={isSavedInDb ? 'Report saved' : 'Save analysis report to library'}
                    >
                      {saving ? (
                        <Loader2 className="animate-spin" size={13} />
                      ) : isSavedInDb ? (
                        <CheckCircle size={13} />
                      ) : (
                        <Calendar size={13} />
                      )}
                      <span>{isSavedInDb ? 'Saved' : 'Save Report'}</span>
                    </button>
                  )}

                  {/* Document Exports Button Group */}
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 p-1 rounded-lg">
                    <button
                      onClick={handleExportJson}
                      className="px-2.5 py-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-dark-900 text-[10px] font-bold text-slate-600 dark:text-slate-300 transition-colors focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      title="Export as JSON"
                      aria-label="Export report as JSON"
                    >
                      JSON
                    </button>
                    <button
                      onClick={handleExportMarkdown}
                      className="px-2.5 py-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-dark-900 text-[10px] font-bold text-slate-600 dark:text-slate-300 transition-colors focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      title="Export as Markdown"
                      aria-label="Export report as Markdown"
                    >
                      MD
                    </button>
                    <button
                      onClick={handleExportPdf}
                      disabled={exportingPdf}
                      className="px-2.5 py-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-dark-900 text-[10px] font-bold text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-1 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      title="Export as PDF"
                      aria-label="Export report as PDF"
                    >
                      {exportingPdf ? <Loader2 className="animate-spin" size={11} /> : null}
                      PDF
                    </button>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 p-3 rounded-xl shadow-inner">
                    <div className="text-right">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block leading-none">
                        Developer Score
                      </span>
                      <span className="text-2xl font-black font-mono tracking-tight text-brand-500 dark:text-brand-400 mt-1 inline-block leading-none">
                        <AnimatedScore score={analysisResult.developerScore} />
                      </span>
                    </div>
                    <div className={`w-9 h-9 rounded-lg border flex items-center justify-center font-extrabold text-sm ${getScoreColorClass(analysisResult.developerScore)}`}>
                      {analysisResult.developerScore >= 80 ? 'A' : analysisResult.developerScore >= 50 ? 'B' : 'C'}
                    </div>
                  </div>
                </div>
              </div>

              {/* CASE: Historical Progress Progression (Authenticated Only) */}
              {user && comparisonData && comparisonData.timeline?.length > 1 && (
                <div className="cyber-card p-6 bg-white dark:bg-dark-900 space-y-6">
                  <div className="border-b border-slate-100 dark:border-dark-800 pb-3 flex justify-between items-center flex-wrap gap-2">
                    <div>
                      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <TrendingUp size={14} className="text-brand-500" />
                        Historical Progression Timeline
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Tracking score updates, regressions, and resolved improvement guidelines.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">
                        Overall delta:
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                        comparisonData.deltas.overallScoreDelta >= 0
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-rose-500/10 text-rose-500'
                      }`}>
                        {comparisonData.deltas.overallScoreDelta >= 0 ? '+' : ''}
                        {comparisonData.deltas.overallScoreDelta} pts
                      </span>
                    </div>
                  </div>

                  {/* Summary progress indices */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3 bg-slate-50 dark:bg-dark-950 rounded-xl border border-slate-200/40 dark:border-dark-800/40 text-xs">
                      <span className="text-slate-400 font-bold block mb-1">BIGGEST IMPROVEMENT</span>
                      {comparisonData.biggestImprovement ? (
                        <span className="text-emerald-500 font-bold capitalize flex items-center gap-1">
                          {comparisonData.biggestImprovement.replace(/([A-Z])/g, ' $1').trim()}
                          <span className="font-mono text-[10px]">
                            (+{comparisonData.deltas.categoryDeltas[comparisonData.biggestImprovement]} pts)
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">No score changes yet</span>
                      )}
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-dark-950 rounded-xl border border-slate-200/40 dark:border-dark-800/40 text-xs">
                      <span className="text-slate-400 font-bold block mb-1">AREAS REGRESSED</span>
                      {comparisonData.areasRegressed?.length > 0 ? (
                        <span className="text-rose-500 font-bold capitalize flex flex-wrap gap-1">
                          {comparisonData.areasRegressed.map((cat, idx) => (
                            <span key={cat}>
                              {cat.replace(/([A-Z])/g, ' $1').trim()}
                              <span className="font-mono text-[10px] ml-0.5">
                                ({comparisonData.deltas.categoryDeltas[cat]} pts)
                              </span>
                              {idx < comparisonData.areasRegressed.length - 1 ? ',' : ''}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-emerald-500 font-bold flex items-center gap-1">
                          <CheckCircle size={11} /> None detected
                        </span>
                      )}
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-dark-950 rounded-xl border border-slate-200/40 dark:border-dark-800/40 text-xs">
                      <span className="text-slate-400 font-bold block mb-1">AUDITS SAVED</span>
                      <span className="text-slate-800 dark:text-slate-200 font-black font-mono">
                        {comparisonData.timeline.length} runs recorded
                      </span>
                    </div>
                  </div>

                  {/* Resolved Suggestions */}
                  {comparisonData.resolvedSuggestions?.length > 0 && (
                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                        <CheckCircle size={12} />
                        Resolved Portfolio Suggestions ({comparisonData.resolvedSuggestions.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {comparisonData.resolvedSuggestions.map((sug, idx) => (
                          <span 
                            key={idx} 
                            className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded text-[10px] font-semibold"
                          >
                            {sug}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Progression Line Chart */}
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={comparisonData.timeline.map(t => ({
                          ...t,
                          date: new Date(t.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                          'Dev Score': t.developerScore
                        }))}
                        margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                      >
                        <XAxis 
                          dataKey="date" 
                          stroke="#94a3b8" 
                          fontSize={9} 
                          tickLine={false} 
                        />
                        <YAxis 
                          domain={[0, 100]} 
                          stroke="#94a3b8" 
                          fontSize={9} 
                          tickLine={false} 
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                            borderColor: theme === 'dark' ? '#334155' : '#cbd5e1',
                            color: theme === 'dark' ? '#f8fafc' : '#0f172a',
                            borderRadius: '8px',
                            fontSize: '11px'
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="Dev Score" 
                          stroke="#4f46e5" 
                          strokeWidth={2.5} 
                          activeDot={{ r: 6 }} 
                          dot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Two Column Layout: Deterministic vs AI Insights */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* COLUMN A: Deterministic Scores & Metrics (Left 5 cols) */}
                <div className="lg:col-span-5 space-y-6">
                  
                  {/* Category Breakdown list */}
                  <div className="cyber-card p-6 bg-white dark:bg-dark-900 space-y-4">
                    <div className="border-b border-slate-100 dark:border-dark-800 pb-2 flex justify-between items-center">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Layers size={13} className="text-slate-400" />
                        Deterministic Scores
                      </h2>
                      <span className="text-[10px] text-slate-400 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 px-2 py-0.5 rounded font-bold">
                        Algorithm v{analysisResult.scoreBreakdown.scoringVersion || '1.0.0'}
                      </span>
                    </div>

                    <div className="space-y-4">
                      {Object.entries(analysisResult.scoreBreakdown.categories).map(([key, cat]) => (
                        <div key={key} className="space-y-1.5">
                          <div className="flex justify-between items-end text-xs">
                            <span className="font-semibold capitalize text-slate-700 dark:text-slate-300">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </span>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                              {cat.score}/100
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-dark-950 rounded-full overflow-hidden border border-slate-200/40 dark:border-dark-800/40">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 ${getScoreProgressClass(cat.score)}`}
                              style={{ width: `${cat.score}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-dark-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Info size={12} className="text-slate-400" />
                        Confidence Score:
                      </span>
                      <span className="font-bold text-brand-500 font-mono">
                        {analysisResult.scoreBreakdown.confidenceScore}%
                      </span>
                    </div>
                  </div>

                  {/* Category Radar Chart */}
                  <div className="cyber-card p-6 bg-white dark:bg-dark-900 flex flex-col justify-center items-center">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 self-start mb-4 flex items-center gap-1">
                      <Activity size={12} />
                      Capability Radar
                    </h3>
                    <div className="w-full h-56 flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={getRadarData()}>
                          <PolarGrid stroke="#475569" strokeDasharray="3 3" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 8 }} />
                          <Radar
                            name="Developer Capabilities"
                            dataKey="value"
                            stroke="#4f46e5"
                            fill="#4f46e5"
                            fillOpacity={0.3}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Technology Languages */}
                  <div className="cyber-card p-6 bg-white dark:bg-dark-900 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <BookOpen size={13} />
                      Languages Breakdown
                    </h3>
                    <div className="space-y-3">
                      {Object.entries(analysisResult.languageData || {}).slice(0, 5).map(([lang, percentage]) => (
                        <div key={lang} className="space-y-1">
                          <div className="flex justify-between items-center text-xs font-mono">
                            <span className="font-semibold text-slate-600 dark:text-slate-400">{lang}</span>
                            <span className="font-bold">{percentage}%</span>
                          </div>
                          <div className="w-full h-1 bg-slate-100 dark:bg-dark-950 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-cyber-blue rounded-full" 
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* COLUMN B: AI-Powered Insights (Right 7 cols) */}
                <div className="lg:col-span-7 space-y-6">
                  
                  {/* AI Section Header banner */}
                  <div className="flex items-center gap-2 px-1">
                    <Cpu className="text-brand-500 animate-pulse-slow" size={16} />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      AI-Powered Qualitative Insights
                    </h2>
                    <span className="text-[9px] font-black tracking-wider uppercase px-2 py-0.5 rounded bg-brand-500/10 text-brand-500 border border-brand-500/20">
                      Gemini Verified
                    </span>
                  </div>

                  {/* AI Summary Card */}
                  <div className="cyber-card p-6 bg-white dark:bg-dark-900 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Lightbulb size={14} className="text-brand-500" />
                      Executive Summary
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {analysisResult.aiSummary}
                    </p>
                  </div>

                  {/* Strengths & Weaknesses Stack */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Strengths Card */}
                    <div className="cyber-card p-6 bg-white dark:bg-dark-900 border-t-2 border-t-emerald-500 space-y-3.5">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                        <CheckCircle size={14} />
                        Core Strengths
                      </h3>
                      <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                        {analysisResult.strengths.map((st, i) => (
                          <li key={i} className="flex gap-2 items-start">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></span>
                            <span className="leading-normal">{st}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Weaknesses Card */}
                    <div className="cyber-card p-6 bg-white dark:bg-dark-900 border-t-2 border-t-rose-500 space-y-3.5">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
                        <AlertTriangle size={14} />
                        Needs Development
                      </h3>
                      <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                        {analysisResult.weaknesses.map((wk, i) => (
                          <li key={i} className="flex gap-2 items-start">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 flex-shrink-0"></span>
                            <span className="leading-normal">{wk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Resume Readiness Star Card */}
                  <div className="cyber-card p-6 bg-white dark:bg-dark-900 space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-dark-800 pb-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Award size={14} className="text-brand-500" />
                        Resume Readiness Rating
                      </h3>
                      <div className="flex items-center gap-1" aria-label={`Readiness score: ${analysisResult.resumeReadinessStars} out of 5 stars`}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star 
                            key={star}
                            size={16}
                            className={
                              star <= analysisResult.resumeReadinessStars 
                                ? 'fill-amber-400 text-amber-400' 
                                : 'text-slate-300 dark:text-dark-800'
                            }
                          />
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Marketability & Career Insights:
                        </span>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed italic bg-slate-50 dark:bg-dark-950 p-3 rounded-lg border border-slate-200/40 dark:border-dark-800/40">
                          "{analysisResult.resumeBreakdown.careerInsights}"
                        </p>
                      </div>

                      <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Impactful Bullet-Points for your Resume:
                        </span>
                        <div className="space-y-2.5">
                          {analysisResult.resumeBreakdown.bulletPoints.map((bullet, i) => (
                            <div 
                              key={i} 
                              className="group p-3 rounded-lg bg-slate-50 dark:bg-dark-950 border border-slate-200/30 dark:border-dark-800/30 flex justify-between items-start gap-3 hover:border-brand-500/30 transition-all"
                            >
                              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                                {bullet}
                              </p>
                              <button
                                onClick={() => handleCopyBullet(bullet)}
                                className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded hover:bg-slate-200 dark:hover:bg-dark-800 text-slate-400 hover:text-slate-200 transition-all flex-shrink-0 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                                title="Copy Bullet Point"
                                aria-label="Copy resume bullet point to clipboard"
                              >
                                <Copy size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Interview Preparation (Tabbed Interactive Panel) */}
                  <div className="cyber-card p-6 bg-white dark:bg-dark-900 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <HelpCircle size={14} className="text-brand-500" />
                      Interview Preparation Pack
                    </h3>

                    {/* Tabs navigation */}
                    <div className="flex border-b border-slate-100 dark:border-dark-800 text-xs font-semibold">
                      <button
                        onClick={() => setActivePrepTab('questions')}
                        className={`px-4 py-2.5 border-b-2 transition-all cursor-pointer ${
                          activePrepTab === 'questions'
                            ? 'border-brand-500 text-brand-500'
                            : 'border-transparent text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        Likely Questions
                      </button>
                      <button
                        onClick={() => setActivePrepTab('talkingPoints')}
                        className={`px-4 py-2.5 border-b-2 transition-all cursor-pointer ${
                          activePrepTab === 'talkingPoints'
                            ? 'border-brand-500 text-brand-500'
                            : 'border-transparent text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        Talking Points
                      </button>
                      <button
                        onClick={() => setActivePrepTab('concepts')}
                        className={`px-4 py-2.5 border-b-2 transition-all cursor-pointer ${
                          activePrepTab === 'concepts'
                            ? 'border-brand-500 text-brand-500'
                            : 'border-transparent text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        Concepts to Review
                      </button>
                    </div>

                    {/* Tab contents */}
                    <div className="pt-2 animate-fade-in">
                      {activePrepTab === 'questions' && (
                        <div className="space-y-3.5">
                          {analysisResult.interviewPrep.likelyQuestions.map((q, i) => (
                            <div key={i} className="flex gap-3 items-start">
                              <span className="w-5 h-5 rounded-md bg-brand-500/10 text-brand-500 font-black text-[10px] flex items-center justify-center flex-shrink-0 border border-brand-500/20 mt-0.5">
                                Q
                              </span>
                              <p className="text-xs text-slate-700 dark:text-slate-300 leading-normal font-semibold">
                                {q}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {activePrepTab === 'talkingPoints' && (
                        <ul className="space-y-3.5 text-xs text-slate-600 dark:text-slate-300">
                          {analysisResult.interviewPrep.talkingPoints.map((tp, i) => (
                            <li key={i} className="flex gap-2.5 items-start">
                              <Lightbulb size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                              <span className="leading-normal">{tp}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {activePrepTab === 'concepts' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {analysisResult.interviewPrep.conceptsToReview.map((c, i) => (
                            <div 
                              key={i} 
                              className="p-3 rounded-lg bg-slate-50 dark:bg-dark-950 border border-slate-200/40 dark:border-dark-800/40 flex items-center gap-2 text-xs"
                            >
                              <Compass size={13} className="text-brand-500" />
                              <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{c}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Learning Roadmap Timeline */}
                  <div className="cyber-card p-6 bg-white dark:bg-dark-900 space-y-6">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <TrendingUp size={14} className="text-brand-500" />
                        AI Learning Roadmap
                      </h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                        A customized milestone syllabus addressing your weakest scoring factors.
                      </p>
                    </div>

                    {/* Timeline vertical list */}
                    <div className="relative pl-6 border-l-2 border-slate-100 dark:border-dark-800 space-y-8 ml-3 pt-2">
                      {analysisResult.learningRoadmap.milestones.map((milestone, i) => (
                        <div key={i} className="relative">
                          
                          {/* Timeline dot */}
                          <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-brand-500 border-2 border-white dark:border-dark-900 flex items-center justify-center shadow-sm">
                            <span className="text-[7px] font-black text-white">{i + 1}</span>
                          </div>

                          <div className="space-y-3">
                            {/* Milestone Header */}
                            <div className="flex flex-wrap items-center gap-2.5">
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 font-mono tracking-tight">
                                {milestone.phase}
                              </span>
                              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                                milestone.priority === 'High' 
                                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' 
                                  : milestone.priority === 'Medium'
                                  ? 'bg-purple-500/10 border-purple-500/20 text-purple-500'
                                  : 'bg-cyber-blue/10 border-cyber-blue/20 text-cyber-blue'
                              }`}>
                                {milestone.priority} Priority
                              </span>
                              <span className="text-[10px] font-semibold bg-slate-100 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                                Time: {milestone.estimatedTime}
                              </span>
                              <span className="text-[10px] font-black text-emerald-500">
                                +{milestone.expectedScoreImprovement} Points
                              </span>
                            </div>

                            {/* Milestone Title */}
                            <h4 className="text-sm font-black tracking-tight text-slate-800 dark:text-slate-100">
                              {milestone.topic}
                            </h4>

                            {/* Action Steps */}
                            <div className="space-y-2">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                                Actionable Syllabus:
                              </span>
                              <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                                {milestone.actionableSteps.map((step, idx) => (
                                  <li key={idx} className="flex gap-2 items-start">
                                    <ChevronRight size={12} className="text-brand-500 mt-1 flex-shrink-0" />
                                    <span className="leading-normal">{step}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* Suggested Resources */}
                            <div className="space-y-1.5 pt-1">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                                Study Resources:
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {milestone.suggestedResources.map((res, idx) => (
                                  <span 
                                    key={idx} 
                                    className="px-2 py-1 rounded text-[10px] bg-slate-100 dark:bg-dark-950 border border-slate-200/50 dark:border-dark-800/50 text-slate-600 dark:text-slate-400 font-medium"
                                  >
                                    {res}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

              {/* SECTION C: Analysis Performance & Metadata (Extensible Footer) */}
              <div className="cyber-card p-6 bg-white dark:bg-dark-900 border-t border-slate-100 dark:border-dark-800 text-[11px] text-slate-400 space-y-4">
                <div className="flex items-center gap-1.5 border-b border-slate-100 dark:border-dark-800 pb-2">
                  <Cpu size={14} className="text-slate-400" />
                  <span className="font-bold uppercase tracking-wider">Analysis Diagnostics & Performance Metadata</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
                  <div>
                    <span className="text-slate-500 block uppercase text-[9px] leading-none mb-1">
                      AI Provider
                    </span>
                    <span className="font-bold text-slate-700 dark:text-slate-300 capitalize">
                      {analysisResult.scoreBreakdown.aiMetadata?.insightSource === 'fallback' 
                        ? 'Fallback Engine' 
                        : analysisResult.scoreBreakdown.aiMetadata?.provider || 'Gemini'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase text-[9px] leading-none mb-1">
                      LLM Model
                    </span>
                    <span className="font-bold text-slate-700 dark:text-slate-300 truncate block">
                      {analysisResult.scoreBreakdown.aiMetadata?.model || 'gemini-1.5-flash'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase text-[9px] leading-none mb-1">
                      Prompt Version
                    </span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      v{analysisResult.scoreBreakdown.aiMetadata?.promptVersion || '1.0.0'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase text-[9px] leading-none mb-1">
                      Generation Time
                    </span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {analysisResult.scoreBreakdown.aiMetadata?.responseTimeMs || 0}ms
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase text-[9px] leading-none mb-1">
                      Retry Attempts
                    </span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {analysisResult.scoreBreakdown.aiMetadata?.retryCount || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase text-[9px] leading-none mb-1">
                      Source Mode
                    </span>
                    <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                      analysisResult.scoreBreakdown.aiMetadata?.fallbackStatus 
                        ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' 
                        : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                    }`}>
                      {analysisResult.scoreBreakdown.aiMetadata?.fallbackStatus ? 'Fallback' : 'Gemini AI'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase text-[9px] leading-none mb-1">
                      Cache Status
                    </span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {analysisResult.scoreBreakdown.aiMetadata?.cached ? 'CACHE HIT' : 'CACHE MISS'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase text-[9px] leading-none mb-1">
                      Snapshot Hash
                    </span>
                    <span 
                      className="font-bold text-slate-700 dark:text-slate-300 truncate block hover:text-brand-500 cursor-help"
                      title={analysisResult.rawMetadataCache?.analyticsHash || 'None'}
                    >
                      {analysisResult.rawMetadataCache?.analyticsHash?.slice(0, 8) || 'N/A'}...
                    </span>
                  </div>
                </div>
              </div>

            </div>
          )}

        </main>

      </div>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 dark:border-dark-800 py-6 text-center text-xs text-slate-400 dark:text-slate-500 mt-12">
        DevLens &copy; 2026. Premium AI Insights Core. All rights reserved.
      </footer>

    </div>
  );
};

export default Dashboard;
