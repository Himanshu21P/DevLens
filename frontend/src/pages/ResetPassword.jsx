import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import { Eye, EyeOff, Lock, Loader2, CheckCircle, ArrowLeft, Check, X, ShieldAlert } from 'lucide-react';

export const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReset, setIsReset] = useState(false);
  
  // Validation and API errors
  const [error, setError] = useState('');

  // Password Policy State (Real-time checks)
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
  });

  useEffect(() => {
    setPasswordChecks({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
    });
  }, [password]);

  const getPasswordStrength = () => {
    const passedCount = Object.values(passwordChecks).filter(Boolean).length;
    return (passedCount / 4) * 100;
  };

  const getStrengthColorClass = () => {
    const score = getPasswordStrength();
    if (score === 0) return 'bg-slate-200 dark:bg-dark-800';
    if (score <= 25) return 'bg-rose-500';
    if (score <= 75) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const getStrengthText = () => {
    const score = getPasswordStrength();
    if (score === 0) return 'Very Weak';
    if (score <= 25) return 'Weak';
    if (score <= 75) return 'Moderate';
    return 'Strong & Secure';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('A valid reset token is required. Please check your recovery link.');
      return;
    }

    // Verify password policy
    const isPasswordSecure = Object.values(passwordChecks).every(Boolean);
    if (!password) {
      setError('Password is required.');
      return;
    } else if (!isPasswordSecure) {
      setError('Password does not meet safety requirements.');
      return;
    }

    setIsSubmitting(true);

    try {
      await api.post('/api/v1/auth/reset-password', { token, password });
      setIsReset(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password. The link may have expired.');
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

      {/* Reset Password Card */}
      <div className="cyber-card w-full max-w-md p-6 md:p-8 bg-white/85 dark:bg-dark-900/80 backdrop-blur-md animate-slide-up">
        {!isReset ? (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-bold tracking-tight">Set New Password</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Enter your new password to regain access to your account.
              </p>
            </div>

            {!token && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-mono flex items-center gap-2">
                <ShieldAlert size={14} className="flex-shrink-0" />
                <span>Error: No reset token detected in the URL.</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Password Field */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Lock size={12} />
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError('');
                    }}
                    disabled={isSubmitting || !token}
                    className={`w-full pl-4 pr-10 py-2.5 rounded-lg border bg-slate-50 dark:bg-dark-950 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all ${
                      error 
                        ? 'border-rose-500/55 focus:border-rose-500' 
                        : 'border-slate-200 dark:border-dark-800 focus:border-brand-500 dark:focus:border-brand-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isSubmitting || !token}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* PASSWORD STRENGTH UI */}
                {password.length > 0 && (
                  <div className="mt-3 space-y-2 p-3 rounded-lg bg-slate-100/50 dark:bg-dark-950/50 border border-slate-200/50 dark:border-dark-800/30">
                    <div className="flex justify-between items-center text-[11px] font-medium">
                      <span className="text-slate-500 dark:text-slate-400">Password Strength:</span>
                      <span className={`font-semibold ${
                        getPasswordStrength() <= 25 
                          ? 'text-rose-500' 
                          : getPasswordStrength() <= 75 
                          ? 'text-amber-500' 
                          : 'text-emerald-500'
                      }`}>
                        {getStrengthText()}
                      </span>
                    </div>
                    
                    {/* Visual Progress Bar */}
                    <div className="w-full h-1 bg-slate-200 dark:bg-dark-850 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-350 ${getStrengthColorClass()}`}
                        style={{ width: `${getPasswordStrength()}%` }}
                      />
                    </div>

                    {/* Real-time Checklist */}
                    <ul className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px] font-mono mt-2">
                      <li className="flex items-center gap-1">
                        {passwordChecks.length ? (
                          <Check className="text-emerald-500" size={10} strokeWidth={3} />
                        ) : (
                          <X className="text-rose-400" size={10} strokeWidth={3} />
                        )}
                        <span className={passwordChecks.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                          Min 8 Chars
                        </span>
                      </li>
                      <li className="flex items-center gap-1">
                        {passwordChecks.uppercase ? (
                          <Check className="text-emerald-500" size={10} strokeWidth={3} />
                        ) : (
                          <X className="text-rose-400" size={10} strokeWidth={3} />
                        )}
                        <span className={passwordChecks.uppercase ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                          1 Uppercase
                        </span>
                      </li>
                      <li className="flex items-center gap-1">
                        {passwordChecks.lowercase ? (
                          <Check className="text-emerald-500" size={10} strokeWidth={3} />
                        ) : (
                          <X className="text-rose-400" size={10} strokeWidth={3} />
                        )}
                        <span className={passwordChecks.lowercase ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                          1 Lowercase
                        </span>
                      </li>
                      <li className="flex items-center gap-1">
                        {passwordChecks.number ? (
                          <Check className="text-emerald-500" size={10} strokeWidth={3} />
                        ) : (
                          <X className="text-rose-400" size={10} strokeWidth={3} />
                        )}
                        <span className={passwordChecks.number ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                          1 Number
                        </span>
                      </li>
                    </ul>
                  </div>
                )}

                {error && (
                  <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 block mt-1 flex items-center gap-1">
                    <ShieldAlert size={12} className="flex-shrink-0" />
                    {error}
                  </span>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !token}
                className="w-full mt-6 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:bg-brand-500/50 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:shadow-[0_0_15px_rgba(79,86,241,0.35)] shadow-md"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Updating password...
                  </>
                ) : (
                  'Reset Password'
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
            
            <h3 className="text-lg font-bold tracking-tight">Password Reset Complete</h3>
            
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
              Your password has been successfully updated. You can now sign in with your new credentials.
            </p>

            <Link
              to="/login"
              className="w-full mt-6 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:shadow-[0_0_15px_rgba(79,86,241,0.35)] shadow-md"
            >
              Sign In Now
            </Link>
          </div>
        )}

        {!isReset && (
          <div className="mt-6 text-center border-t border-slate-100 dark:border-dark-800 pt-4">
            <Link 
              to="/login" 
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
            >
              <ArrowLeft size={12} />
              Cancel and Return
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
