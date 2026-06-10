import React, { useState } from 'react';
import { authService } from '../services/backendSelector';
import { Mail, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';
import './AuthScreen.css';

const isLocalProvider = import.meta.env.VITE_BACKEND_PROVIDER !== 'firebase';

export const AuthScreen: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showOfflinePrompt, setShowOfflinePrompt] = useState(false);
  const [offlineName, setOfflineName] = useState('Guest');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (isSignUp && !displayName)) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        await authService.signUp(email, password, displayName);
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
