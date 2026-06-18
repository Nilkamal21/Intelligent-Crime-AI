import React, { useState } from 'react';
import { alertsService } from '../services/api';
import type { UserSession, Alert } from '../types';

interface AlertsPanelProps {
  session: UserSession;
  alerts: Alert[];
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({
  session,
  alerts,
  setAlerts,
  setUnreadCount
}) => {
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<{
    triggered: boolean;
    mock_fir: { case_id: string; district: string; crime_type: string; suspect: string };
    message: string;
  } | null>(null);
  
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  const showSimulate = session.role === 'Investigator' || session.role === 'Analyst';

  const handleSimulateFIR = async () => {
    setSimulating(true);
    setSimResult(null);
    try {
      const data = await alertsService.simulateNewFir();
      setSimResult(data);
      
      if (data.triggered) {
        // Prepend new alerts
        setAlerts(prev => [...data.new_alerts, ...prev]);
        setUnreadCount(prev => prev + data.new_alerts.length);
      }
    } catch (err) {
      console.error('Failed to simulate FIR:', err);
    } finally {
      setSimulating(false);
    }
  };

  const handleInvestigateSuspect = (moniker: string) => {
    localStorage.setItem('ksp_network_search', moniker);
    window.location.hash = '#network';
    const event = new CustomEvent('ksp-change-tab', { detail: 'network' });
    window.dispatchEvent(event);
  };

  const handleGoToHotspots = () => {
    const event = new CustomEvent('ksp-change-tab', { detail: 'hotspots' });
    window.dispatchEvent(event);
  };

  const filteredAlerts = alerts.filter(a => {
    const matchType = filterType === 'all' || a.type === filterType;
    const matchSeverity = filterSeverity === 'all' || a.severity === filterSeverity;
    return matchType && matchSeverity;
  });

  return (
    <div style={styles.container}>


      {/* Control bar */}
      <div style={styles.controlBar}>
        <h3 style={styles.title}>🚨 Threat Alerts & Early Warning System</h3>
        
        <div style={styles.actionGroup}>
          {showSimulate && (
            <button 
              onClick={handleSimulateFIR} 
              style={styles.simulateBtn} 
              disabled={simulating}
            >
              {simulating ? 'Processing Simulation...' : '⚙️ Simulate New FIR'}
            </button>
          )}
        </div>
      </div>

      <div style={styles.bodyGrid}>
        {/* Main list of alerts */}
        <div style={styles.mainCol}>
          {/* Filters */}
          <div className="glass-panel" style={styles.filterPanel}>
            <span style={styles.filterTitle}>Filter Alerts:</span>
            <div style={styles.selectGroup}>
              <select 
                value={filterSeverity} 
                onChange={(e) => setFilterSeverity(e.target.value)}
                style={styles.select}
              >
                <option value="all">All Severities</option>
                <option value="high">High Severity</option>
                <option value="medium">Medium Severity</option>
              </select>

              <select 
                value={filterType} 
                onChange={(e) => setFilterType(e.target.value)}
                style={styles.select}
              >
                <option value="all">All Categories</option>
                <option value="risk">Suspect Risk Score</option>
                <option value="hotspot">District Hotspot</option>
                <option value="network">Coordinated Network</option>
              </select>
            </div>
            <span style={styles.filterCount}>
              Showing {filteredAlerts.length} of {alerts.length} alerts
            </span>
          </div>

          <div style={styles.alertsList}>
            {filteredAlerts.length === 0 ? (
              <div style={styles.emptyState}>
                <span style={{ fontSize: '48px', marginBottom: '16px' }}>🛡️</span>
                <h4>No warnings currently compiled</h4>
                <p>System status clear. No threat criteria breached under current parameters.</p>
              </div>
            ) : (
              filteredAlerts.map((alert) => (
                <div 
                  key={alert.id} 
                  className="glass-panel" 
                  style={{
                    ...styles.alertCard,
                    borderLeftColor: alert.severity === 'high' ? 'var(--accent-danger)' : 'var(--accent-warning)'
                  }}
                >
                  <div style={styles.alertHeader}>
                    <div style={styles.badgeGroup}>
                      <span style={{
                        ...styles.severityBadge,
                        background: alert.severity === 'high' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        color: alert.severity === 'high' ? 'var(--accent-danger)' : 'var(--accent-warning)',
                        border: alert.severity === 'high' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)'
                      }}>
                        {alert.severity.toUpperCase()}
                      </span>
                      <span style={{
                        ...styles.typeBadge,
                        background: alert.type === 'risk' ? 'rgba(245, 158, 11, 0.1)' : alert.type === 'network' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                        color: alert.type === 'risk' ? 'var(--accent-warning)' : alert.type === 'network' ? 'var(--accent-violet)' : 'var(--accent-blue)',
                        border: alert.type === 'risk' ? '1px solid rgba(245, 158, 11, 0.3)' : alert.type === 'network' ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid rgba(37, 99, 235, 0.3)'
                      }}>
                        {alert.type.toUpperCase()}
                      </span>
                    </div>
                    <span style={styles.alertTime}>
                      {new Date(alert.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <p style={styles.alertMsg}>{alert.message}</p>
                  
                  <div style={styles.alertFooter}>
                    <span style={styles.entityId}>Entity Ref: <code>{alert.related_entity_id}</code></span>
                    
                    {alert.type === 'hotspot' ? (
                      <button onClick={handleGoToHotspots} style={styles.actionBtn}>
                        View Hotspot Map →
                      </button>
                    ) : (
                      <button onClick={() => handleInvestigateSuspect(alert.related_entity_id)} style={styles.actionBtn}>
                        Investigate Suspect →
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right side simulation logs */}
        <div style={styles.sideCol}>
          <div className="glass-panel" style={styles.infoCard}>
            <h4 style={styles.cardTitle}>📜 Early Warning Protocols</h4>
            <p style={styles.cardText}>
              The Early Warning System performs real-time relational analytics across criminal records and banking structures in Karnataka:
            </p>
            <ul style={styles.bulletList}>
              <li><b>Suspect Risk Score threshold:</b> Generates a high-severity warning when an individual's compiled risk index meets or exceeds 0.85.</li>
              <li><b>District Hotspot Escalation:</b> Triggers when a district's case count climbs past the 75th percentile statewide.</li>
              <li><b>Coordinated Networks:</b> Detects when a suspect is linked to active syndicates while showing suspicious transaction flags.</li>
            </ul>
          </div>

          {simResult && (
            <div className="glass-panel" style={{
              ...styles.simCard,
              borderColor: simResult.triggered ? 'var(--accent-danger)' : 'var(--glass-border)',
              boxShadow: simResult.triggered ? 'var(--glow-danger)' : 'none'
            }}>
              <h4 style={styles.cardTitle}>🔬 Live FIR Simulation Results</h4>
              <div style={styles.simField}>
                <span style={styles.simLabel}>New FIR ID</span>
                <span style={styles.simVal}>{simResult.mock_fir.case_id}</span>
              </div>
              <div style={styles.simField}>
                <span style={styles.simLabel}>Mocked Jurisdiction</span>
                <span style={styles.simVal}>{simResult.mock_fir.district}</span>
              </div>
              <div style={styles.simField}>
                <span style={styles.simLabel}>Crime Category</span>
                <span style={styles.simVal}>{simResult.mock_fir.crime_type}</span>
              </div>
              <div style={styles.simField}>
                <span style={styles.simLabel}>Linked Suspect</span>
                <span style={styles.simVal}>{simResult.mock_fir.suspect}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    width: '100%',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  controlBar: {
    height: '74px',
    background: 'rgba(15, 22, 38, 0.4)',
    borderBottom: '1px solid var(--glass-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    flexShrink: 0,
  },
  title: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#ffffff',
  },
  actionGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  simulateBtn: {
    background: 'linear-gradient(135deg, var(--accent-violet) 0%, #7c3aed 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 16px',
    fontSize: '12.5px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 0 10px rgba(139, 92, 246, 0.3)',
    transition: 'all 0.2s ease',
  },
  bodyGrid: {
    flex: 1,
    display: 'flex',
    padding: '24px',
    gap: '24px',
    overflowY: 'auto' as const,
  },
  mainCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  sideCol: {
    width: '320px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    flexShrink: 0,
  },
  filterPanel: {
    padding: '12px 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    background: 'rgba(15, 22, 38, 0.3)',
  },
  filterTitle: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
  },
  selectGroup: {
    display: 'flex',
    gap: '10px',
  },
  select: {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--glass-border)',
    borderRadius: '4px',
    padding: '5px 10px',
    color: 'white',
    fontSize: '12px',
    outline: 'none',
  },
  filterCount: {
    fontSize: '11.5px',
    color: 'var(--text-muted)',
  },
  alertsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  alertCard: {
    borderLeft: '4px solid',
    padding: '16px',
    background: 'rgba(8, 12, 20, 0.4)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    transition: 'all 0.2s ease',
  },
  alertHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeGroup: {
    display: 'flex',
    gap: '8px',
  },
  severityBadge: {
    fontSize: '9px',
    fontWeight: 'bold',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  typeBadge: {
    fontSize: '9px',
    fontWeight: 'bold',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  alertTime: {
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  alertMsg: {
    fontSize: '13.5px',
    color: '#e2e8f0',
    lineHeight: '1.5',
    fontWeight: '500',
  },
  alertFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid rgba(255,255,255,0.03)',
    paddingTop: '10px',
  },
  entityId: {
    fontSize: '11.5px',
    color: 'var(--text-muted)',
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--accent-cyan)',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    padding: 0,
    outline: 'none',
    transition: 'color 0.2s ease',
    ':hover': {
      color: 'white'
    }
  },
  infoCard: {
    padding: '18px',
    background: 'rgba(15, 22, 38, 0.3)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  cardTitle: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--glass-border)',
    paddingBottom: '6px',
  },
  cardText: {
    fontSize: '12.5px',
    color: 'var(--text-secondary)',
    lineHeight: '1.6',
    margin: 0,
  },
  bulletList: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    lineHeight: '1.6',
    paddingLeft: '18px',
    margin: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  simCard: {
    padding: '18px',
    background: 'rgba(239, 68, 68, 0.02)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    border: '1px solid var(--glass-border)',
  },
  simField: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
  },
  simLabel: {
    color: 'var(--text-muted)',
  },
  simVal: {
    color: 'var(--text-primary)',
    fontWeight: 'bold',
  },
  simStatus: {
    marginTop: '8px',
    padding: '8px 12px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
    textAlign: 'center' as const,
  },
  emptyState: {
    padding: '48px',
    textAlign: 'center' as const,
    color: 'var(--text-muted)',
    background: 'rgba(255,255,255,0.01)',
    border: '1px dashed var(--glass-border)',
    borderRadius: '8px',
  },
  toast: {
    position: 'absolute' as const,
    bottom: '24px',
    right: '24px',
    zIndex: 9999,
    width: '320px',
    borderRadius: '6px',
    padding: '16px',
    color: 'white',
    animation: 'slideIn 0.3s ease-out',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  toastHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontWeight: 'bold',
    fontSize: '12px',
  },
  toastCloseBtn: {
    background: 'none',
    border: 'none',
    color: 'white',
    fontSize: '18px',
    lineHeight: '1',
    cursor: 'pointer',
    padding: 0,
    outline: 'none',
  },
  toastBody: {
    fontSize: '12.5px',
    margin: 0,
    lineHeight: '1.4',
  }
};
