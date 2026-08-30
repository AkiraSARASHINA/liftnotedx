import { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import InputPage from './pages/Input';
import CalendarPage from './pages/Calendar';
import ChartsPage from './pages/Charts';
import SettingsPage from './pages/Settings';
import { initSyncManager } from './lib/syncManager';
import { addStatusListener, cancelCurrentSync } from './lib/googleDriveSync';
import './App.css';

function App() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    localStorage.removeItem('app_theme');
    document.documentElement.setAttribute('data-theme', 'dark');

    // Initialize synchronization manager
    initSyncManager().catch(err => {
      console.error('Failed to initialize sync manager:', err);
    });

    // Subscribe to synchronization status
    const unsubscribe = addStatusListener((status, message) => {
      if (status === 'syncing') {
        setIsSyncing(true);
        setSyncMessage(message || 'クラウドと同期中...');
      } else {
        setIsSyncing(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<InputPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/charts" element={<ChartsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Layout>
      </Router>

      {isSyncing && (
        <div className="sync-loading-overlay">
          <div className="sync-loading-card">
            <div className="sync-spinner"></div>
            <div className="sync-loading-title">クラウド同期中</div>
            <div className="sync-loading-message">{syncMessage}</div>
            <button className="btn-cancel-sync" onClick={cancelCurrentSync}>
              同期をキャンセル
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
