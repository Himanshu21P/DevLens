import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Eye, EyeOff, Mail, Lock, User, Loader2, Check, X, ShieldAlert } from 'lucide-react';

export const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Client-side validation errors
  const [errors, setErrors] = useState({});

  // Password Policy State
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
  });

  // Evaluate password strength in real-time as the user types
  useEffect(() => {
    setPasswordChecks({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
    });
  }, [password]);

  // Calculate overall strength percentage (0-100)
  const getPasswordStrength = () => {
    const passedCount = Object.values(passwordChecks).filter(Boolean).length;
    return (passedCount / 4) * 100;
  };

  // Get color based on strength score
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

  const validateForm = () => {
    const tempErrors = {};
    if (!name) {
      tempErrors.name = 'Name is required.';
    } else if (name.length < 2) {
      tempErrors.name = 'Name must be at least 2 characters.';
    }
    if (!email) {
      tempErrors.email = 'Email address is required.';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      tempErrors.email = 'Please enter a valid email address.';
    }
    
    // Check password policy
    const isPasswordSecure = Object.values(passwordChecks).every(Boolean);
    if (!password) {
      tempErrors.password = 'Password is required.';
    } else if (!isPasswordSecure) {
      tempErrors.password = 'Password does not meet safety requirements.';
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    const result = await register(email, password, name);
    setIsSubmitting(false);

    if (result.success) {
      navigate('/login');
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

      {/* Registration Card */}
      <div className="cyber-card w-full max-w-md p-6 md:p-8 bg-white/85 dark:bg-dark-900/80 backdrop-blur-md animate-slide-up">
        <div className="mb-6">
          <h2 className="text-xl font-bold tracking-tight">Create Account</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Join DevLens to analyze codebases and optimize portfolios.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Field */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <User size={12} />
              Full Name
            </label>
            <input
              type="text"
              placeholder="Alex Developer"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
              }}
              disabled={isSubmitting}
              className={`w-full px-4 py-2.5 rounded-lg border bg-slate-50 dark:bg-dark-950 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all ${
                errors.name 
                  ? 'border-rose-500/55 focus:border-rose-500' 
                  : 'border-slate-200 dark:border-dark-800 focus:border-brand-500 dark:focus:border-brand-500'
              }`}
            />
            {errors.name && (
              <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 block mt-1">
                {errors.name}
              </span>
            )}
          </div>

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
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Lock size={12} />
              Password
            </label>
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

            {errors.password && (
              <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 block mt-1 flex items-center gap-1">
                <ShieldAlert size={12} />
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
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Alternate Action */}
        <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-dark-800 pt-4">
          Already have an account?{' '}
          <Link 
            to="/login" 
            className="text-brand-500 dark:text-brand-400 font-semibold hover:underline"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
