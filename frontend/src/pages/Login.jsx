import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Eye, EyeOff, Mail, Lock, Loader2, ArrowRight } from 'lucide-react';

export const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Client-side validation errors
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const tempErrors = {};
    if (!email) {
      tempErrors.email = 'Email address is required.';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      tempErrors.email = 'Please enter a valid email address.';
    }
    if (!password) {
      tempErrors.password = 'Password is required.';
    }
    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    const result = await login(email, password);
    setIsSubmitting(false);

    if (result.success) {
      navigate('/dashboard');
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
        <p className="text-xs font-mono text-slate-500 dark:text-slate-400 uppercase tracking-widest">
          Developer Portfolio Intelligence
        </p>
      </div>

      {/* Login Card */}
      <div className="cyber-card w-full max-w-md p-6 md:p-8 bg-white/85 dark:bg-dark-900/80 backdrop-blur-md animate-slide-up">
        <div className="mb-6">
          <h2 className="text-xl font-bold tracking-tight">Welcome Back</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Sign in to analyze profiles, scores, and resume readiness.
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
                if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
              }}
              disabled={isSubmitting}
              className={`w-full px-4 py-2.5 rounded-lg border bg-slate-50 dark:bg-dark-950 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all ${
                errors.email 
                  ? 'border-rose-500/55 focus:border-rose-500' 
                  : 'border-slate-200 dark:border-dark-800 focus:border-brand-500 dark:focus:border-brand-500'
              }`}
            />
            {errors.email && (
              <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 block mt-1">
                {errors.email}
              </span>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Lock size={12} />
                Password
              </label>
              <Link 
                to="/forgot-password" 
                className="text-xs text-brand-500 dark:text-brand-400 hover:underline"
              >
                Forgot?
              </Link>
            </div>
            
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                }}
                disabled={isSubmitting}
                className={`w-full pl-4 pr-10 py-2.5 rounded-lg border bg-slate-50 dark:bg-dark-950 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all ${
                  errors.password 
                    ? 'border-rose-500/55 focus:border-rose-500' 
                    : 'border-slate-200 dark:border-dark-800 focus:border-brand-500 dark:focus:border-brand-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isSubmitting}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            
            {errors.password && (
              <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 block mt-1">
                {errors.password}
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
                Signing in...
              </>
            ) : (
              <>
                Sign In
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Alternate Action */}
        <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-dark-800 pt-4">
          Don't have an account?{' '}
          <Link 
            to="/register" 
            className="text-brand-500 dark:text-brand-400 font-semibold hover:underline"
          >
            Create one
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
