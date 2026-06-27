import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';
import { Mail, Loader2, ArrowLeft, Send, CheckCircle } from 'lucide-react';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Email address is required.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await api.post('/api/v1/auth/forgot-password', { email });
      setIsSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-dark-950 dark:text-slate-100 bg-grid-pattern dark:bg-grid-pattern-dark flex flex-col justify-center items-center px-6 py-12 transition-colors duration-300">
      
      {/* Branding Header */}
      <div className="mb-8 text-center flex flex-col items-center">
        <Link to="/" className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center text-white font-bold font-mono text-lg shadow-md">
            DL
          </div>
          <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-brand-400 via-cyber-blue to-cyber-purple bg-clip-text text-transparent">
            DevLens
          </span>
        </Link>
      </div>

      {/* Forgot Password Card */}
      <div className="cyber-card w-full max-w-md p-6 md:p-8 bg-white/85 dark:bg-dark-900/80 backdrop-blur-md animate-slide-up">
        {!isSent ? (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-bold tracking-tight">Recover Password</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Enter your email address and we will generate a secure reset link.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Field */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Mail size={12} />
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="developer@devlens.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError('');
                  }}
                  disabled={isSubmitting}
                  className={`w-full px-4 py-2.5 rounded-lg border bg-slate-50 dark:bg-dark-950 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all ${
                    error 
                      ? 'border-rose-500/55 focus:border-rose-500' 
                      : 'border-slate-200 dark:border-dark-800 focus:border-brand-500 dark:focus:border-brand-500'
                  }`}
                />
                {error && (
                  <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 block mt-1">
                    {error}
                  </span>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-6 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:bg-brand-500/50 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:shadow-[0_0_15px_rgba(79,86,241,0.35)] shadow-md"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Generating link...
                  </>
                ) : (
                  <>
                    Send Recovery Link
                    <Send size={14} />
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          /* Success Screen */
          <div className="text-center space-y-4 py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle size={24} />
            </div>
            
            <h3 className="text-lg font-bold tracking-tight">Recovery Request Handled</h3>
            
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              If that email is registered in our system, a password recovery link has been generated.
            </p>

            <div className="p-3 rounded-lg bg-brand-500/5 border border-brand-500/10 text-[11px] font-mono text-brand-600 dark:text-brand-400 leading-normal">
              <strong>Mock Development Mode:</strong><br />
              We have bypassed sending an actual email. The secure reset URL has been logged directly to the <strong>backend server console</strong>.
            </div>
          </div>
        )}

        {/* Return to Login Link */}
        <div className="mt-6 text-center border-t border-slate-100 dark:border-dark-800 pt-4">
          <Link 
            to="/login" 
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
          >
            <ArrowLeft size={12} />
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
