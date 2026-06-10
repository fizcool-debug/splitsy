import React, { useState, useCallback } from 'react';
import { authService } from '../services/backendSelector';
import { Mail, Lock, User, AtSign, AlertCircle, ArrowRight, CheckCircle } from 'lucide-react';
import './AuthScreen.css';

const isLocalProvider = import.meta.env.VITE_BACKEND_PROVIDER !== 'firebase';

// Username validation: lowercase letters, numbers, underscores, 3-20 chars
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export const AuthScreen: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showOfflinePrompt, setShowOfflinePrompt] = useState(false);
  const [offlineName, setOfflineName] = useState('Guest');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Username availability state
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameTimer, setUsernameTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleUsernameChange = useCallback((val: string) => {
    const lower = val.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(lower);

    if (usernameTimer) clearTimeout(usernameTimer);

    if (!lower || lower.length < 3) {
      setUsernameStatus(lower.length > 0 && lower.length < 3 ? 'invalid' : 'idle');
      return;
    }

    if (!USERNAME_REGEX.test(lower)) {
      setUsernameStatus('invalid');
      return;
    }

    setUsernameStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const available = await authService.checkUsernameAvailable?.(lower) ?? true;
        setUsernameStatus(available ? 'available' : 'taken');
      } catch {
        setUsernameStatus('idle');
      }
    }, 500);
    setUsernameTimer(timer);
  }, [usernameTimer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (isSignUp && !displayName)) {
      setError('Please fill in all required fields.');
      return;
    }

    if (isSignUp && username && usernameStatus !== 'available') {
      if (usernameStatus === 'taken') {
        setError(`Username "@${username}" is already taken.`);
        return;
      }
      if (usernameStatus === 'invalid' || (username.length > 0 && username.length < 3)) {
        setError('Username must be 3–20 characters: lowercase letters, numbers, or underscores only.');
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        await authService.signUp(email, password, displayName, username || undefined);
      } else {
        await authService.signIn(email, password);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleOfflineStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offlineName.trim()) return;
    setLoading(true);
    setError('');

    try {
      // Auto-generate dummy credentials for guest mode
      const randomId = Math.random().toString(36).substring(2, 7);
      const guestEmail = `guest_${randomId}@splitsy.local`;
      const guestPassword = `local_guest_pass_${randomId}`;

      await authService.signUp(guestEmail, guestPassword, offlineName.trim());
    } catch (err: any) {
      console.error(err);
      setError('Failed to start guest mode.');
    } finally {
      setLoading(false);
    }
  };

  const getUsernameStatusDisplay = () => {
    if (!isSignUp || !username || usernameStatus === 'idle') return null;
    if (usernameStatus === 'checking') {
      return <span className="username-status checking">Checking availability...</span>;
    }
    if (usernameStatus === 'available') {
      return <span className="username-status available"><CheckCircle size={13} /> @{username} is available</span>;
    }
    if (usernameStatus === 'taken') {
      return <span className="username-status taken"><AlertCircle size={13} /> @{username} is already taken</span>;
    }
    if (usernameStatus === 'invalid') {
      return <span className="username-status invalid">3–20 characters: letters, numbers, underscores only</span>;
    }
    return null;
  };

  return (
    <div className="auth-container animate-fade">
      <div className="auth-box glass-panel">
        <div className="auth-header">
          <div className="auth-logo">S</div>
          <h1 className="auth-title text-gradient">Splitsy</h1>
          <p className="auth-subtitle">Split expenses, not friendships</p>
        </div>

        {error && (
          <div className="auth-error-box animate-fade">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Offline Guest Name Entry View */}
        {showOfflinePrompt ? (
          <form onSubmit={handleOfflineStart} className="auth-form animate-slide-up">
            <div className="input-group">
              <label htmlFor="offline-name-input">Enter Your Name</label>
              <div className="input-wrapper">
                <User className="input-icon" size={18} />
                <input
                  id="offline-name-input"
                  type="text"
                  placeholder="e.g. Alex, Sam"
                  value={offlineName}
                  onChange={(e) => setOfflineName(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-auth" disabled={loading}>
              {loading ? (
                <span className="spinner"></span>
              ) : (
                <>
                  <span>Start Offline</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-auth"
              onClick={() => setShowOfflinePrompt(false)}
              disabled={loading}
            >
              Back to Credentials
            </button>
          </form>
        ) : (
          /* Standard Login/Signup View */
          <>
            <form onSubmit={handleSubmit} className="auth-form">
              {isSignUp && (
                <div className="input-group">
                  <label htmlFor="signup-name-input">Full Name</label>
                  <div className="input-wrapper">
                    <User className="input-icon" size={18} />
                    <input
                      id="signup-name-input"
                      type="text"
                      placeholder="John Doe"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      disabled={loading}
                      required
                    />
                  </div>
                </div>
              )}

              {isSignUp && (
                <div className="input-group">
                  <label htmlFor="signup-username-input">
                    Username <span className="label-optional">(used to add you to groups)</span>
                  </label>
                  <div className="input-wrapper">
                    <AtSign className="input-icon" size={18} />
                    <input
                      id="signup-username-input"
                      type="text"
                      placeholder="e.g. alex_smith"
                      value={username}
                      onChange={(e) => handleUsernameChange(e.target.value)}
                      disabled={loading}
                      autoComplete="username"
                      maxLength={20}
                    />
                  </div>
                  {getUsernameStatusDisplay()}
                </div>
              )}

              <div className="input-group">
                <label htmlFor="signup-email-input">Email Address</label>
                <div className="input-wrapper">
                  <Mail className="input-icon" size={18} />
                  <input
                    id="signup-email-input"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="signup-pwd-input">Password</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={18} />
                  <input
                    id="signup-pwd-input"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-auth" disabled={loading}>
                {loading ? (
                  <span className="spinner"></span>
                ) : (
                  <>
                    <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="auth-footer">
              <button
                type="button"
                className="btn-toggle-mode"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError('');
                  setUsername('');
                  setUsernameStatus('idle');
                }}
                disabled={loading}
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>

              {/* Show Guest Mode option only if running local backend provider */}
              {isLocalProvider && (
                <div className="offline-divider-section">
                  <span className="divider-text">or</span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-offline"
                    onClick={() => {
                      setShowOfflinePrompt(true);
                      setError('');
                    }}
                    disabled={loading}
                  >
                    Run Offline (Guest Mode)
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
