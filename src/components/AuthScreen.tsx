import { useState, type FormEvent } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Language } from '../data/content';

interface AuthScreenProps {
  onGuest: () => void;
}

type Mode = 'signin' | 'signup' | 'forgot';

export default function AuthScreen({ onGuest }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [language, setLanguage] = useState<Language>('en');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function resetMessages() {
    setMessage('');
    setError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMessages();

    if (!isSupabaseConfigured || !supabase) {
      setError('Account sign-in is not configured in this build. You can continue as a guest.');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (mode !== 'forgot' && password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }

    if (mode === 'signup' && !name.trim()) {
      setError('Please enter your name.');
      return;
    }

    if (mode === 'signup') {
      const numericAge = Number(age);
      if (!age.trim() || !Number.isFinite(numericAge) || numericAge < 5 || numericAge > 120) {
        setError('Please enter a valid age between 5 and 120.');
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              name: name.trim(),
              age: Number.parseInt(age, 10),
              language,
            },
          },
        });

        if (signUpError) {
          setError(signUpError.message);
          return;
        }

        setMessage(
          data.session
            ? 'Account created successfully. Your profile is saved.'
            : 'Account created. Check your email to confirm your account. Your profile will be ready when you sign in.',
        );
        return;
      }

      if (mode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (signInError) {
          setError(signInError.message);
          return;
        }

        setMessage('Signed in successfully.');
        return;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail);
      if (resetError) {
        setError(resetError.message);
        return;
      }

      setMessage('Password reset instructions have been sent to your email.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <section className="auth-brand">
          <div className="auth-mark">ॐ</div>
          <p className="auth-eyebrow">PATH OF DHARMA</p>
          <h1>Walk the path.<br />One day at a time.</h1>
          <p className="auth-description">
            A 142-day journey through knowledge, philosophy, reflection, and practice.
          </p>
          <div className="auth-stats">
            <div><strong>142</strong><span>Days</span></div>
            <div><strong>7</strong><span>Levels</span></div>
            <div><strong>∞</strong><span>Learning</span></div>
          </div>
        </section>

        <section className="auth-card">
          <div className="auth-card-header">
            <span className="auth-card-kicker">
              {mode === 'forgot' ? 'ACCOUNT RECOVERY' : mode === 'signup' ? 'BEGIN YOUR JOURNEY' : 'WELCOME BACK'}
            </span>
            <h2>
              {mode === 'forgot' ? 'Reset your password' : mode === 'signup' ? 'Create your account' : 'Continue your journey'}
            </h2>
            <p>
              {mode === 'forgot'
                ? "Enter your email and we'll send you a reset link."
                : mode === 'signup'
                  ? 'Save your progress and continue across devices.'
                  : 'Sign in to access your saved progress.'}
            </p>
          </div>

          {!isSupabaseConfigured && (
            <div className="auth-message auth-error">
              Cloud authentication is not configured. Guest mode is available.
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <>
                <label className="auth-field">
                  <span>Name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                  />
                </label>

                <label className="auth-field">
                  <span>Age</span>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="Your age"
                    autoComplete="bday-year"
                  />
                </label>

                <label className="auth-field">
                  <span>Language</span>
                  <select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
                    <option value="en">English</option>
                    <option value="hi">हिन्दी</option>
                    <option value="mr">मराठी</option>
                  </select>
                </label>
              </>
            )}

            <label className="auth-field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>

            {mode !== 'forgot' && (
              <label className="auth-field">
                <div className="field-label-row">
                  <span>Password</span>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => { resetMessages(); setMode('forgot'); }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="password-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>
            )}

            {error && <div className="auth-message auth-error" role="alert">{error}</div>}
            {message && <div className="auth-message auth-success" role="status">{message}</div>}

            <button type="submit" className="auth-primary" disabled={loading || !isSupabaseConfigured}>
              {loading ? 'Please wait...' : mode === 'forgot' ? 'Send reset link' : mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <div className="auth-divider"><span>or</span></div>
          <button type="button" className="auth-guest" onClick={onGuest}>Continue as guest</button>

          <div className="auth-switch">
            {mode === 'forgot' ? (
              <button type="button" onClick={() => { resetMessages(); setMode('signin'); }}>← Back to sign in</button>
            ) : mode === 'signin' ? (
              <>Don't have an account? <button type="button" onClick={() => { resetMessages(); setMode('signup'); }}>Create one</button></>
            ) : (
              <>Already have an account? <button type="button" onClick={() => { resetMessages(); setMode('signin'); }}>Sign in</button></>
            )}
          </div>

          <p className="auth-privacy">
            Your account is used to save your Dharma Quest progress across devices.
          </p>
        </section>
      </div>
    </main>
  );
}
