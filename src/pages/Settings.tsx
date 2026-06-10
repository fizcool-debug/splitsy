import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { User, DollarSign, Database, ShieldAlert, Palette, LogOut } from 'lucide-react';
import './Settings.css';

const CURRENCIES = [
  { symbol: '₹', label: 'INR - Indian Rupee (₹)' },
  { symbol: '$', label: 'USD - US Dollar ($)' },
  { symbol: '€', label: 'EUR - Euro (€)' },
  { symbol: '£', label: 'GBP - British Pound (£)' },
  { symbol: '¥', label: 'JPY/CNY - Yen/Yuan (¥)' },
  { symbol: 'Custom', label: 'Custom Currency Symbol...' }
];

export const Settings: React.FC = () => {
  const { user, currency, setCurrency, theme, setTheme, signOut } = useApp();
  
  const isPreset = CURRENCIES.some((c) => c.symbol === currency);
  const [currencySelection, setCurrencySelection] = useState(isPreset ? currency : 'Custom');
  const [customSymbol, setCustomSymbol] = useState(isPreset ? '' : currency);

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setCurrencySelection(val);
    if (val !== 'Custom') {
      setCurrency(val);
    } else {
      setCurrency(customSymbol || '₹');
    }
  };

  const handleCustomSymbolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.substring(0, 3); // Max 3 chars
    setCustomSymbol(val);
    setCurrency(val || '₹');
  };

  const handleClearData = () => {
    if (window.confirm('WARNING: This will delete all offline groups, expenses, and local users. Are you sure you want to start fresh?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="settings-container animate-fade">
      <header className="settings-header">
        <h1 className="welcome-text">Preferences</h1>
        <p className="subtitle-text">Manage your account profile and app currency settings</p>
      </header>

      <div className="settings-sections-list animate-slide-up">
        {/* User Profile Card */}
        <section className="settings-card glass-panel">
          <div className="settings-card-title-row">
            <User size={18} className="icon-muted" />
            <h3 className="settings-card-title">User Account</h3>
          </div>
          
          {user && (
            <div className="user-profile-wrapper">
              <div className="user-profile-summary">
                <div className="profile-large-avatar">
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="profile-details-summary">
                  <h4>{user.displayName}</h4>
                  {user.username && (
                    <p className="profile-username">@{user.username}</p>
                  )}
                  <p>{user.email}</p>
                  <span className="user-type-badge">
                    {user.email.endsWith('@splitsy.local') ? 'Guest Profile (Offline)' : 'Cloud User'}
                  </span>
                </div>
              </div>

              <div className="settings-option-item logout-option-item">
                <div className="option-info">
                  <span className="option-label-text">Sign Out</span>
                  <p className="option-description">Log out of your current account. You will need to log back in to access synced groups.</p>
                </div>
                <div className="option-control">
                  <button 
                    type="button" 
                    className="btn btn-logout-settings"
                    onClick={signOut}
                  >
                    <LogOut size={16} />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Currency Card */}
        <section className="settings-card glass-panel">
          <div className="settings-card-title-row">
            <DollarSign size={18} className="icon-muted" />
            <h3 className="settings-card-title">System Currency</h3>
          </div>
          
          <div className="settings-option-item">
            <div className="option-info">
              <label htmlFor="currency-select-input" className="option-label">Default Currency Symbol</label>
              <p className="option-description">This symbol is displayed next to all balances, splits, and calculations.</p>
            </div>
            
            <div className="option-control">
              <select
                id="currency-select-input"
                value={currencySelection}
                onChange={handleCurrencyChange}
                className="currency-select"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.symbol} value={c.symbol}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {currencySelection === 'Custom' && (
            <div className="settings-option-item sub-option animate-slide-up">
              <div className="option-info">
                <label htmlFor="custom-symbol-input" className="option-label">Custom Symbol (max 3 characters)</label>
              </div>
              <div className="option-control">
                <input
                  id="custom-symbol-input"
                  type="text"
                  placeholder="e.g. Kr, R$, Rs"
                  value={customSymbol}
                  onChange={handleCustomSymbolChange}
                  className="custom-symbol-input"
                />
              </div>
            </div>
          )}
        </section>

        {/* Theme Card */}
        <section className="settings-card glass-panel">
          <div className="settings-card-title-row">
            <Palette size={18} className="icon-muted" />
            <h3 className="settings-card-title">App Theme</h3>
          </div>
          
          <div className="settings-option-item">
            <div className="option-info">
              <label htmlFor="theme-select-input" className="option-label">Theme Mode</label>
              <p className="option-description">Switch between dark mode and light mode interface.</p>
            </div>
            
            <div className="option-control">
              <select
                id="theme-select-input"
                value={theme}
                onChange={(e) => setTheme(e.target.value as 'dark' | 'light' | 'system')}
                className="currency-select"
              >
                <option value="system">Follow System Theme</option>
                <option value="dark">Dark Theme</option>
                <option value="light">Light Theme</option>
              </select>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="settings-card danger-card glass-panel">
          <div className="settings-card-title-row text-danger">
            <ShieldAlert size={18} />
            <h3 className="settings-card-title">Danger Zone</h3>
          </div>
          
          <div className="settings-option-item">
            <div className="option-info">
              <span className="option-label-text">Reset Local Application Data</span>
              <p className="option-description">Completely wipe all locally cached groups, expenses, and logs on this browser. This action is permanent.</p>
            </div>
            <div className="option-control">
              <button 
                type="button" 
                className="btn btn-danger btn-sm"
                onClick={handleClearData}
              >
                <Database size={14} />
                <span>Reset Database</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
