import React, { useState, useEffect } from 'react';
import { authService } from '../services/api';

interface AuditRecord {
  id: number;
  username: string;
  action: string;
  query_text: string | null;
  timestamp: string;
}

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await authService.getAuditLogs();
      setLogs(data);
    } catch (err: any) {
      console.error('Failed to load audit logs:', err);
      setError(err.response?.data?.detail || 'Forbidden. Access restricted to Supervisor operations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div style={styles.container}>
      {/* Control bar */}
      <div style={styles.controlBar}>
        <h3 style={styles.title}>Compliance & Threat Audit Logs</h3>
        <button onClick={fetchLogs} style={styles.refreshBtn} disabled={loading}>
          {loading ? 'Refreshing...' : '🔄 Sync Audit Trail'}
        </button>
      </div>

      <div style={styles.body}>
        {error ? (
          <div style={styles.errorBox}>
            <span>🚫</span>
            <h4>Access Authorization Failure</h4>
            <p>{error}</p>
          </div>
        ) : (
          <div className="glass-panel" style={styles.tablePanel}>
            <div style={styles.tableHeader}>
              <h4>Immutable Operations Ledger</h4>
              <span style={styles.tableMeta}>Showing last 100 system triggers</span>
            </div>
            
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Log ID</th>
                    <th style={styles.th}>Timestamp</th>
                    <th style={styles.th}>Operator</th>
                    <th style={styles.th}>Action</th>
                    <th style={styles.th}>Query Parameters / Trigger Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={styles.tdEmpty}>
                        {loading ? 'Decrypting audit keys...' : 'No system entries compiled yet.'}
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id}>
                        <td style={styles.tdId}>#00{log.id}</td>
                        <td style={styles.tdTime}>{log.timestamp}</td>
                        <td style={styles.tdUser}>
                          <span style={styles.userBadge}>{log.username}</span>
                        </td>
                        <td style={styles.tdAction}>
                          <span 
                            style={{
                              ...styles.actionBadge,
                              ...(log.action === 'LOGIN' ? styles.actionLogin : {}),
                              ...(log.action === 'VIEW_GRAPH' ? styles.actionGraph : {}),
                              ...(log.action === 'FORECAST_CRIME' ? styles.actionForecast : {})
                            }}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td style={styles.tdQuery}>
                          {log.query_text ? (
                            <code style={styles.code}>{log.query_text}</code>
                          ) : (
                            <span style={styles.noneLabel}>None</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
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
  },
  controlBar: {
    height: '74px',
    background: 'rgba(15, 22, 38, 0.4)',
    borderBottom: '1px solid var(--glass-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
  },
  title: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#ffffff',
  },
  refreshBtn: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--glass-border)',
    borderRadius: '4px',
    padding: '8px 16px',
    color: 'var(--text-primary)',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  body: {
    flex: 1,
    padding: '24px',
    overflowY: 'auto' as const,
  },
  errorBox: {
    margin: '40px auto',
    maxWidth: '450px',
    textAlign: 'center' as const,
    background: 'rgba(239, 68, 68, 0.05)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    padding: '28px',
    borderRadius: '8px',
    color: 'var(--text-secondary)',
  },
  tablePanel: {
    padding: '24px',
    maxHeight: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  tableHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  tableMeta: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontFamily: 'monospace',
  },
  tableWrapper: {
    overflowY: 'auto' as const,
    flex: 1,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '13px',
    textAlign: 'left' as const,
  },
  th: {
    borderBottom: '1px solid var(--glass-border)',
    padding: '12px',
    color: 'var(--text-muted)',
    fontWeight: 'bold',
    position: 'sticky' as const,
    top: 0,
    background: 'var(--bg-secondary)',
    zIndex: 1,
  },
  tdEmpty: {
    textAlign: 'center' as const,
    padding: '40px',
    color: 'var(--text-muted)',
  },
  tdId: {
    padding: '12px',
    fontFamily: 'monospace',
    color: 'var(--text-muted)',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
  },
  tdTime: {
    padding: '12px',
    color: 'var(--text-secondary)',
    fontFamily: 'monospace',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
  },
  tdUser: {
    padding: '12px',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
  },
  userBadge: {
    background: 'var(--bg-tertiary)',
    padding: '3px 8px',
    borderRadius: '4px',
    color: 'var(--text-primary)',
    fontWeight: 'bold',
    fontSize: '11.5px',
  },
  tdAction: {
    padding: '12px',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
  },
  actionBadge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 'bold',
    fontFamily: 'monospace',
    background: 'rgba(6, 182, 212, 0.15)',
    color: 'var(--accent-cyan)',
    border: '1px solid rgba(6, 182, 212, 0.25)',
  },
  actionLogin: {
    background: 'rgba(16, 185, 129, 0.15)',
    color: 'var(--accent-success)',
    border: '1px solid rgba(16, 185, 129, 0.25)',
  },
  actionGraph: {
    background: 'rgba(139, 92, 246, 0.15)',
    color: 'var(--accent-violet)',
    border: '1px solid rgba(139, 92, 246, 0.25)',
  },
  actionForecast: {
    background: 'rgba(245, 158, 11, 0.15)',
    color: 'var(--accent-warning)',
    border: '1px solid rgba(245, 158, 11, 0.25)',
  },
  tdQuery: {
    padding: '12px',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
  },
  code: {
    fontFamily: 'monospace',
    color: 'var(--text-primary)',
    background: 'rgba(0,0,0,0.2)',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11.5px',
    display: 'inline-block',
    maxWidth: '450px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  noneLabel: {
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  }
};
