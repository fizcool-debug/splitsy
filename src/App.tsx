import { useState } from 'react';
import { useApp } from './context/AppContext';
import { AuthScreen } from './pages/AuthScreen';
import { Dashboard } from './pages/Dashboard';
import { GroupDetails } from './pages/GroupDetails';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { Navigation } from './components/Navigation';
import { InstallPrompt } from './components/InstallPrompt';
import './App.css';

function AppContent() {
  const { user, authLoading, currentGroup } = useApp();
  const [tab, setTab] = useState<'groups' | 'analytics' | 'settings'>('groups');

  if (authLoading) {
    return (
      <div className="app-loading-screen animate-fade">
        <img src="/pwa-192x192.png" className="logo-spinner-img" alt="Splitsy Logo" />
        <p>Loading Splitsy...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <AuthScreen />
        <InstallPrompt />
      </>
    );
  }

  return (
    <div className="app-container">
      <Navigation currentTab={tab} setTab={setTab} />
      
      <div className="main-layout">
        {currentGroup ? (
          <GroupDetails />
        ) : tab === 'groups' ? (
          <Dashboard />
        ) : tab === 'analytics' ? (
          <Analytics />
        ) : (
          <Settings />
        )}
      </div>

      <InstallPrompt />
    </div>
  );
}

function App() {
  return <AppContent />;
}

export default App;
