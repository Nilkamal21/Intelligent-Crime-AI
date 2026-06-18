import React from 'react';

interface SidebarProps {
  currentTab: string;
  onChangeTab: (tab: string) => void;
  operatorUsername: string;
  operatorRole: string;
  onLogout: () => void;
  unreadAlertsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onChangeTab,
  operatorUsername,
  operatorRole,
  onLogout,
  unreadAlertsCount = 0
}) => {
  const isSupervisor = operatorRole === 'Supervisor';

  const menuItems = [
    { id: 'chatbot', label: 'Conversational Intelligence', icon: '💬' },
    { id: 'hotspots', label: 'Crime Hotspots Map', icon: '📍' },
    { id: 'network', label: 'Criminal Network Linkage', icon: '🕸️' },
    { id: 'offenders', label: 'Repeat Offender Registry', icon: '👤' },
    { id: 'trends', label: 'Analytics & Forecasting', icon: '📊' },
    { id: 'alerts', label: 'Alerts & Warnings', icon: '🔔' },
  ];

  if (isSupervisor) {
    menuItems.push({ id: 'audit_logs', label: 'Security Audit Logs', icon: '🛡️' });
  }

  return (
    <div style={styles.sidebar}>
      {/* Sidebar Header */}
      <div style={styles.header}>
        <svg width="32" height="32" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M32 4L12 12V28C12 40.4 20.5 52 32 56C43.5 52 52 40.4 52 28V12L32 4Z" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="2"/>
          <circle cx="32" cy="28" r="10" fill="#1d4ed8" stroke="#93c5fd" strokeWidth="1"/>
          <polygon points="32,22 34,26 38,26 35,28 36,32 32,30 28,32 29,28 26,26 30,26" fill="#fbbf24"/>
        </svg>
        <div style={styles.headerText}>
          <h2 style={styles.headerTitle}>KSP CRIME AI</h2>
          <span style={styles.headerSubtitle}>STATE PORTAL v1.0</span>
        </div>
      </div>

      {/* Operator Status Card */}
      <div style={styles.operatorCard}>
        <div style={styles.operatorAvatar}>
          <span>{operatorUsername.substring(0, 2).toUpperCase()}</span>
          <div style={styles.operatorStatusIndicator} />
        </div>
        <div style={styles.operatorDetails}>
          <div style={styles.operatorName}>{operatorUsername}</div>
          <div style={styles.operatorBadge}>{operatorRole}</div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={styles.nav}>
        {menuItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id)}
              style={{
                ...styles.navLink,
                ...(isActive ? styles.navLinkActive : {}),
              }}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              <span style={styles.navText}>{item.label}</span>
              {item.id === 'alerts' && unreadAlertsCount > 0 && (
                <div style={styles.alertBadge}>
                  {unreadAlertsCount}
                </div>
              )}
              {isActive && <div style={styles.activeIndicator} />}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer logout */}
      <div style={styles.footer}>
        <button onClick={onLogout} style={styles.logoutBtn}>
          <span>🚪</span> Sign Out Security Link
        </button>
      </div>
    </div>
  );
};

const styles = {
  sidebar: {
    width: 'var(--sidebar-width)',
    height: '100vh',
    background: 'rgba(8, 12, 20, 0.9)',
    backdropFilter: 'blur(20px)',
    borderRight: '1px solid var(--glass-border)',
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '24px 16px',
    zIndex: 10,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '28px',
  },
  headerText: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  headerTitle: {
    fontFamily: 'var(--font-header)',
    fontSize: '15px',
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: '0.08em',
  },
  headerSubtitle: {
    fontSize: '9px',
    color: 'var(--accent-cyan)',
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  operatorCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--glass-border)',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '28px',
  },
  operatorAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-violet) 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '13px',
    color: 'white',
    position: 'relative' as const,
  },
  operatorStatusIndicator: {
    width: '9px',
    height: '9px',
    borderRadius: '50%',
    background: 'var(--accent-success)',
    border: '2px solid #080c14',
    position: 'absolute' as const,
    bottom: 0,
    right: 0,
    boxShadow: '0 0 5px var(--accent-success)',
  },
  operatorDetails: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  operatorName: {
    fontSize: '13.5px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    textTransform: 'capitalize' as const,
  },
  operatorBadge: {
    fontSize: '9.5px',
    color: 'var(--accent-cyan)',
    fontFamily: 'monospace',
    fontWeight: '600',
    marginTop: '2px',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    flex: 1,
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    padding: '12px 14px',
    background: 'none',
    border: 'none',
    borderRadius: '6px',
    color: 'var(--text-secondary)',
    fontSize: '13.5px',
    fontWeight: '500',
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'all 0.2s ease',
    position: 'relative' as const,
  },
  navLinkActive: {
    background: 'rgba(37, 99, 235, 0.1)',
    color: 'var(--text-primary)',
    border: '1px solid rgba(37, 99, 235, 0.25)',
  },
  navIcon: {
    fontSize: '16px',
  },
  navText: {
    flex: 1,
  },
  activeIndicator: {
    width: '3px',
    height: '18px',
    backgroundColor: 'var(--accent-cyan)',
    position: 'absolute' as const,
    right: '8px',
    borderRadius: '2px',
    boxShadow: '0 0 8px var(--accent-cyan)',
  },
  footer: {
    borderTop: '1px solid var(--glass-border)',
    paddingTop: '16px',
  },
  logoutBtn: {
    width: '100%',
    background: 'rgba(239, 68, 68, 0.05)',
    border: '1px solid rgba(239, 68, 68, 0.15)',
    borderRadius: '6px',
    padding: '10px',
    color: 'var(--text-secondary)',
    fontSize: '12.5px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s ease',
  },
  alertBadge: {
    background: 'var(--accent-danger)',
    color: 'white',
    fontSize: '10px',
    fontWeight: 'bold',
    borderRadius: '10px',
    padding: '2px 6px',
    marginRight: '6px',
    boxShadow: 'var(--glow-danger)',
    lineHeight: 1,
    display: 'inline-block',
  },
};
