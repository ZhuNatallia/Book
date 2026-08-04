import { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';
import { supabase } from '../lib/supabase';
import { ChefHat, Mail, Lock, Eye, EyeOff, ArrowLeft, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

type AuthMode = 'login' | 'signup' | 'forgot';

interface AuthScreenProps {
  initialMode?: AuthMode;
}

export function AuthScreen({ initialMode = 'login' }: AuthScreenProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const getRedirectUrl = () => {
    const origin = window.location.origin;
    return `${origin}/`;
  };

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setError(null);
    setSocialLoading(provider);
    try {
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getRedirectUrl(),
          skipBrowserRedirect: true,
        },
      });
      if (oauthError) {
        setError(oauthError.message);
      } else if (data?.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      setError(t('authErrorGeneric'));
    } finally {
      setSocialLoading(null);
    }
  };

  const handleGoogleSignIn = () => handleOAuth('google');
  const handleAppleSignIn = () => handleOAuth('apple');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim() || !password.trim()) {
      setError(t('authErrorGeneric'));
      return;
    }

    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) {
          if (signUpError.message.includes('already')) {
            setError(t('authErrorExists'));
          } else {
            setError(signUpError.message);
          }
        } else {
          setSuccess(t('authResetSent'));
          setMode('login');
        }
      } else if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          if (signInError.message.includes('Invalid') || signInError.message.includes('invalid')) {
            setError(t('authErrorInvalid'));
          } else {
            setError(signInError.message);
          }
        }
      } else if (mode === 'forgot') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
        if (resetError) {
          setError(resetError.message);
        } else {
          setSuccess(t('authResetSent'));
        }
      }
    } catch {
      setError(t('authErrorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const inputCls = `w-full pl-11 pr-4 py-3.5 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all ${theme.inputPlaceholder}`;

  return (
    <div className={`min-h-screen flex flex-col ${theme.bgPrimary}`}>
      <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-md mx-auto w-full py-12">
        {/* Logo */}
        <div className={`w-16 h-16 bg-gradient-to-br ${theme.headerLogoGradient} rounded-2xl flex items-center justify-center shadow-lg mb-6`}>
          <ChefHat className="w-9 h-9 text-white" />
        </div>

        <h1 className={`text-2xl font-bold ${theme.textPrimary} mb-1`}>
          {mode === 'forgot' ? t('authForgotTitle') : t('authWelcome')}
        </h1>
        <p className={`${theme.textSecondary} text-sm mb-8 text-center`}>
          {mode === 'forgot' ? t('authForgotDesc') : t('authWelcomeDesc')}
        </p>

        {/* Mode tabs */}
        {mode !== 'forgot' && (
          <div className={`flex w-full mb-6 ${theme.bgCard} rounded-xl p-1 border ${theme.border}`}>
            <button
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'login'
                  ? `${theme.accentGradient} text-white shadow-sm`
                  : theme.textSecondary
              }`}
            >
              {t('authLogin')}
            </button>
            <button
              onClick={() => { setMode('signup'); setError(null); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'signup'
                  ? `${theme.accentGradient} text-white shadow-sm`
                  : theme.textSecondary
              }`}
            >
              {t('authSignUp')}
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="relative">
            <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${theme.textSecondary}`} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('authEmail')}
              className={inputCls}
              disabled={loading}
            />
          </div>

          {mode !== 'forgot' && (
            <div className="relative">
              <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${theme.textSecondary}`} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('authPassword')}
                className={`${inputCls} pr-11`}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          )}

          {mode === 'login' && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => { setMode('forgot'); setError(null); setSuccess(null); }}
                className={`text-sm ${theme.textAccent} hover:underline`}
              >
                {t('authForgot')}
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-600 text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3.5 ${theme.accentGradient} ${theme.accentHover} text-white rounded-xl font-semibold shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2`}
          >
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            {mode === 'login' ? t('authSignInBtn') : mode === 'signup' ? t('authSignUpBtn') : t('authSendReset')}
          </button>
        </form>

        {/* Social buttons */}
        {mode !== 'forgot' && (
          <>
            <div className="flex items-center gap-3 w-full my-6">
              <div className={`flex-1 h-px ${theme.border} bg-gray-200`} />
              <span className={`text-xs ${theme.textSecondary}`}>{t('authOr')}</span>
              <div className={`flex-1 h-px ${theme.border} bg-gray-200`} />
            </div>

            <div className="w-full space-y-3">
              <button
                onClick={handleGoogleSignIn}
                disabled={loading || socialLoading === 'google'}
                className={`w-full py-3 ${theme.bgCard} ${theme.textPrimary} border ${theme.border} rounded-xl font-medium hover:bg-gray-50 disabled:opacity-60 transition-all flex items-center justify-center gap-3`}
              >
                {socialLoading === 'google' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                {t('authGoogle')}
              </button>
              <button
                onClick={handleAppleSignIn}
                disabled={loading || socialLoading === 'apple'}
                className={`w-full py-3 ${theme.bgCard} ${theme.textPrimary} border ${theme.border} rounded-xl font-medium hover:bg-gray-50 disabled:opacity-60 transition-all flex items-center justify-center gap-3`}
              >
                {socialLoading === 'apple' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.46 15.25 3.08 8.49 9.32 8.23c1.36.07 2.27.75 3.04.85 1.04-.22 1.94-.85 3.02-.85 1.35.07 2.36.62 3.02 1.66-2.75 1.65-2.64 5.84.65 7.39-.46 1.04-.86 1.48-1.7 2.25zM12.03 8.13c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                  </svg>
                )}
                {t('authApple')}
              </button>
            </div>
          </>
        )}

        {/* Back to login from forgot */}
        {mode === 'forgot' && (
          <button
            onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
            className={`mt-6 flex items-center gap-2 text-sm ${theme.textSecondary} hover:${theme.textPrimary} transition-colors`}
          >
            <ArrowLeft className="w-4 h-4" />
            {t('authBackToLogin')}
          </button>
        )}

        {/* Switch login/signup */}
        {mode !== 'forgot' && (
          <p className={`mt-6 text-sm ${theme.textSecondary} text-center`}>
            {mode === 'login' ? t('authNoAccount') : t('authHaveAccount')}{' '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}
              className={`${theme.textAccent} font-medium hover:underline`}
            >
              {mode === 'login' ? t('authSignUpBtn') : t('authSignInBtn')}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
