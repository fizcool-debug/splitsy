import React, { useState, useEffect } from 'react';
import { Share, PlusSquare, Download, X, Smartphone } from 'lucide-react';
import './InstallPrompt.css';

export const InstallPrompt: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptType, setPromptType] = useState<'android' | 'ios' | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // 1. Check if already running in standalone PWA mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                          (navigator as any).standalone === true;
    
    if (isStandalone) return;

    // 2. Check if user previously dismissed the prompt
    const isDismissed = localStorage.getItem('splitsy_install_dismissed') === 'true';
    if (isDismissed) return;

    // 3. Detect Platform
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent) || window.innerWidth <= 768;

    if (!isMobile) return;

    if (isIOS) {
      // For iOS, show custom instructions since beforeinstallprompt is not supported
      setPromptType('ios');
      // Delay showing it slightly for a smoother entry
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    } else {
      // For Android/Chrome, listen for the native install prompt event
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setPromptType('android');
        setShowPrompt(true);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the browser's native install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the PWA install prompt');
      setShowPrompt(false);
    }
    
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    // Save dismissal preference so they aren't nagged repeatedly
    localStorage.setItem('splitsy_install_dismissed', 'true');
    setShowPrompt(false);
  };

  if (!showPrompt || !promptType) return null;

  return (
    <div className="install-prompt-overlay">
      <div className="install-prompt-card glass-panel animate-slide-up">
        <button className="install-prompt-close" onClick={handleDismiss} aria-label="Dismiss prompt">
          <X size={18} />
        </button>

        <div className="install-prompt-body">
          <div className="install-prompt-icon-wrapper">
            <Smartphone className="text-gradient" size={32} />
          </div>

          <div className="install-prompt-text-block">
            <h4 className="install-prompt-title">Install Splitsy</h4>
            
            {promptType === 'android' ? (
              <p className="install-prompt-desc">
                Install Splitsy on your home screen for fast offline access, native push updates, and a clean full-screen experience.
              </p>
            ) : (
              <div className="install-prompt-ios-steps">
                <p className="install-prompt-desc">Add Splitsy to your home screen for quick offline access:</p>
                <ol className="ios-steps-list">
                  <li>
                    Tap the <strong>Share</strong> button <Share size={15} style={{ verticalAlign: 'middle', display: 'inline', margin: '0 2px' }} /> in Safari's bottom toolbar.
                  </li>
                  <li>
                    Scroll down and tap <strong>Add to Home Screen</strong> <PlusSquare size={15} style={{ verticalAlign: 'middle', display: 'inline', margin: '0 2px' }} />.
                  </li>
                </ol>
              </div>
            )}
          </div>
        </div>

        <div className="install-prompt-actions">
          <button className="btn btn-secondary btn-sm" onClick={handleDismiss}>
            Not Now
          </button>
          {promptType === 'android' ? (
            <button className="btn btn-primary btn-sm btn-icon" onClick={handleInstallClick}>
              <Download size={15} />
              <span>Install App</span>
            </button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={handleDismiss}>
              Got It
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
