import { useState, useEffect } from 'react';
import { RoleSelector } from './components/RoleSelector';
import { Sidebar } from './components/Sidebar';
import { ChatBot } from './components/ChatBot';
import { GeospatialMap } from './components/GeospatialMap';
import { NetworkMap } from './components/NetworkMap';
import { AnalyticsBoard } from './components/AnalyticsBoard';
import { AuditLogs } from './components/AuditLogs';
import { OffenderRegistry } from './components/OffenderRegistry';
import { AlertsPanel } from './components/AlertsPanel';
import { alertsService } from './services/api';
import type { UserSession, ChatMessage, Alert } from './types';

function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('chatbot');

  // Hoisted chatbot state to preserve history across tab switches
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatSessionId] = useState(() => `sess-${Math.random().toString(36).substr(2, 9)}`);

  // Hoisted alerts state
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Fetch standing alerts on session load/login
  useEffect(() => {
    if (!session) return;
    const fetchStandingAlerts = async () => {
      try {
        const data = await alertsService.getStandingAlerts();
        setAlerts(data.alerts || []);
        setUnreadCount(data.alerts?.length || 0);
      } catch (err) {
        console.error('Failed to load standing alerts:', err);
      }
    };
    fetchStandingAlerts();
  }, [session]);

  // Clear unread count when user clicks alerts tab
  useEffect(() => {
    if (currentTab === 'alerts') {
      setUnreadCount(0);
    }
  }, [currentTab]);

  useEffect(() => {
    const handleTabChange = (e: Event) => {
      const targetTab = (e as CustomEvent).detail;
      if (targetTab) {
        setCurrentTab(targetTab);
      }
    };
    window.addEventListener('ksp-change-tab', handleTabChange);
    return () => {
      window.removeEventListener('ksp-change-tab', handleTabChange);
    };
  }, []);

  useEffect(() => {
    // Attempt auto-login from local storage on initial render
    const token = localStorage.getItem('ksp_access_token');
    const role = localStorage.getItem('ksp_role');
    const username = localStorage.getItem('ksp_username');

    if (token && role && username) {
      setSession({
        username,
        role: role as any,
        access_token: token
      });
    }
  }, []);

  const handleLoginSuccess = (username: string, role: string, token: string) => {
    setSession({
      username,
      role: role as any,
      access_token: token
    });
    // Set default tab to chatbot on login
    setCurrentTab('chatbot');
  };

  const handleLogout = () => {
    // Clear storage
    localStorage.removeItem('ksp_access_token');
    localStorage.removeItem('ksp_role');
    localStorage.removeItem('ksp_username');
    setSession(null);
    // Reset chatbot state on logout
    setChatMessages([]);
  };

  // Track visited tabs to lazy-mount components on first visit and preserve state thereafter
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['chatbot']));

  useEffect(() => {
    setVisitedTabs(prev => {
      if (prev.has(currentTab)) return prev;
      const next = new Set(prev);
      next.add(currentTab);
      return next;
    });
  }, [currentTab]);

  if (!session) {
    return <RoleSelector onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onChangeTab={setCurrentTab}
        operatorUsername={session.username}
        operatorRole={session.role}
        onLogout={handleLogout}
        unreadAlertsCount={unreadCount}
      />

      {/* Main Panel Viewport */}
      <main className="main-content">
        {visitedTabs.has('chatbot') && (
          <div style={{ display: currentTab === 'chatbot' ? 'flex' : 'none', flex: 1, flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
            <ChatBot 
              session={session} 
              messages={chatMessages}
              setMessages={setChatMessages}
              sessionId={chatSessionId}
            />
          </div>
        )}
        {visitedTabs.has('hotspots') && (
          <div style={{ display: currentTab === 'hotspots' ? 'flex' : 'none', flex: 1, flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
            <GeospatialMap />
          </div>
        )}
        {visitedTabs.has('network') && (
          <div style={{ display: currentTab === 'network' ? 'flex' : 'none', flex: 1, flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
            <NetworkMap />
          </div>
        )}
        {visitedTabs.has('trends') && (
          <div style={{ display: currentTab === 'trends' ? 'flex' : 'none', flex: 1, flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
            <AnalyticsBoard />
          </div>
        )}
        {visitedTabs.has('offenders') && (
          <div style={{ display: currentTab === 'offenders' ? 'flex' : 'none', flex: 1, flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
            <OffenderRegistry />
          </div>
        )}
        {visitedTabs.has('audit_logs') && (
          <div style={{ display: currentTab === 'audit_logs' ? 'flex' : 'none', flex: 1, flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
            <AuditLogs />
          </div>
        )}
        {visitedTabs.has('alerts') && (
          <div style={{ display: currentTab === 'alerts' ? 'flex' : 'none', flex: 1, flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
            <AlertsPanel 
              session={session}
              alerts={alerts}
              setAlerts={setAlerts}
              setUnreadCount={setUnreadCount}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
