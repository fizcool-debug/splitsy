import React from 'react';
import { useApp } from '../context/AppContext';
import { Users, PieChart, Settings } from 'lucide-react';
import './Navigation.css';

interface NavigationProps {
  currentTab: 'groups' | 'analytics' | 'settings';
  setTab: (tab: 'groups' | 'analytics' | 'settings') => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentTab, setTab }) => {
  const { user, setCurrentGroupId } = useApp();

  const handleLogoClick = () => {
    setCurrentGroupId(null);
    setTab('groups');
  };

  return (
    <>
      {/* Desktop Sidebar Navigation */}
      <aside className="sidebar glass-panel">
        <div className="sidebar-header" onClick={handleLogoClick}>
          <img src="/pwa-192x192.png" className="sidebar-logo-img" alt="Splitsy Logo" />
          <h2 className="sidebar-title text-gradient">Splitsy</h2>
        </div>

        <nav className="sidebar-menu">
          <button 
            className={`nav-item ${currentTab === 'groups' ? 'active' : ''}`}
            onClick={() => { setCurrentGroupId(null); setTab('groups'); }}
          >
            <Users size={20} />
            <span>Groups</span>
          </button>
          <button 
            className={`nav-item ${currentTab === 'analytics' ? 'active' : ''}`}
            onClick={() => { setCurrentGroupId(null); setTab('analytics'); }}
          >
            <PieChart size={20} />
            <span>Analytics</span>
          </button>
          <button 
            className={`nav-item ${currentTab === 'settings' ? 'active' : ''}`}
            onClick={() => { setCurrentGroupId(null); setTab('settings'); }}
          >
            <Settings size={20} />
            <span>Settings</span>
          </button>
        </nav>

        {user && (
          <div className="sidebar-footer">
            <div className="user-info">
              <div className="user-avatar">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="user-details">
                <p className="user-name">{user.displayName}</p>
                <p className="user-email">{user.email}</p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <div className="mobile-nav glass-panel">
        <button 
          className={`mobile-nav-item ${currentTab === 'groups' ? 'active' : ''}`}
          onClick={() => { setCurrentGroupId(null); setTab('groups'); }}
        >
          <Users size={24} />
          <span>Groups</span>
        </button>
        <button 
          className={`mobile-nav-item ${currentTab === 'analytics' ? 'active' : ''}`}
          onClick={() => { setCurrentGroupId(null); setTab('analytics'); }}
        >
          <PieChart size={24} />
          <span>Analytics</span>
        </button>
        <button 
          className={`mobile-nav-item ${currentTab === 'settings' ? 'active' : ''}`}
          onClick={() => { setCurrentGroupId(null); setTab('settings'); }}
        >
          <Settings size={24} />
          <span>Settings</span>
        </button>

      </div>
    </>
  );
};
