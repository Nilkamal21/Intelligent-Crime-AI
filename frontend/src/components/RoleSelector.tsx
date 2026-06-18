import React, { useState } from 'react';
import { authService } from '../services/api';

interface RoleSelectorProps {
  onLoginSuccess: (username: string, role: string, token: string) => void;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('investigator');
  const [password, setPassword] = useState('ksp123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleQuickSelect = (roleName: string) => {
    setUsername(roleName.toLowerCase());
    setPassword('ksp123');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await authService.login(username, password);
      // Save token to localStorage
      localStorage.setItem('ksp_access_token', data.access_token);
      localStorage.setItem('ksp_role', data.role);
      localStorage.setItem('ksp_username', data.username);
      
      onLoginSuccess(data.username, data.role, data.access_token);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.loginContainer}>
      <div style={styles.glowOverlay} />
      <div className="glass-panel" style={styles.loginCard}>
        {/* KSP Badge Crest (SVG graphic) */}
        <div style={styles.logoContainer}>
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M32 4L12 12V28C12 40.4 20.5 52 32 56C43.5 52 52 40.4 52 28V12L32 4Z" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="2"/>
            <path d="M32 12V48" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round"/>
            <circle cx="32" cy="28" r="12" fill="#1d4ed8" stroke="#93c5fd" strokeWidth="2"/>
            <polygon points="32,20 35,26 41,26 36,30 38,36 32,32 26,36 28,30 23,26 29,26" fill="#fbbf24"/>
          </svg>
          <h1 style={styles.title}>KARNATAKA STATE POLICE</h1>
          <p style={styles.subtitle}>Crime AI & Analytics Platform</p>
        </div>

        <div style={styles.terminalIndicator}>
          <div style={styles.statusDot} />
          <span>TACTICAL DIVISION ACCESS PORTAL</span>
        </div>

        {error && <div style={styles.errorBanner}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Operator ID (Username)</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={styles.input}
              placeholder="Enter operator username..."
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Access Code (Password)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="Enter security access code..."
              required
            />
          </div>

          <button type="submit" className="btn-primary" style={styles.submitBtn} disabled={loading}>
            {loading ? 'AUTHORISING CREDENTIALS...' : 'ESTABLISH SECURE LINK'}
          </button>
        </form>

        <div style={styles.quickAccessSection}>
          <p style={styles.quickTitle}>Quick Access Operator Profiles:</p>
          <div style={styles.quickGrid}>
            <button type="button" onClick={() => handleQuickSelect('Investigator')} style={styles.quickBtn}>
              Investigator <span style={styles.roleLabel}>(Field Agent)</span>
            </button>
            <button type="button" onClick={() => handleQuickSelect('Analyst')} style={styles.quickBtn}>
              Analyst <span style={styles.roleLabel}>(Data Modeler)</span>
            </button>
            <button type="button" onClick={() => handleQuickSelect('Supervisor')} style={styles.quickBtn}>
              Supervisor <span style={styles.roleLabel}>(Auditor/Admin)</span>
            </button>
            <button type="button" onClick={() => handleQuickSelect('Policymaker')} style={styles.quickBtn}>
              Policymaker <span style={styles.roleLabel}>(General/HQ)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  loginContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100vw',
    height: '100vh',
    background: '#040810',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  glowOverlay: {
    position: 'absolute' as const,
    width: '600px',
    height: '600px',
    background: 'radial-gradient(circle, rgba(37,99,235,0.15) 0%, rgba(0,0,0,0) 70%)',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 1,
    pointerEvents: 'none' as const,
  },
  loginCard: {
    width: '450px',
    padding: '40px',
    zIndex: 2,
    display: 'flex',
    flexDirection: 'column' as const,
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
  },
  logoContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    marginBottom: '28px',
  },
  title: {
    fontFamily: 'var(--font-header)',
    fontSize: '18px',
    fontWeight: '800',
    color: '#ffffff',
    marginTop: '16px',
    letterSpacing: '0.05em',
  },
  subtitle: {
    fontFamily: 'var(--font-primary)',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    marginTop: '4px',
  },
  terminalIndicator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    background: 'rgba(37, 99, 235, 0.08)',
    border: '1px solid rgba(37, 99, 235, 0.2)',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '11px',
    fontFamily: 'monospace',
    color: 'var(--accent-cyan)',
    marginBottom: '24px',
    letterSpacing: '0.05em',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-cyan)',
    boxShadow: '0 0 8px var(--accent-cyan)',
  },
  errorBanner: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: 'var(--accent-danger)',
    padding: '10px',
    borderRadius: '6px',
    fontSize: '12.5px',
    marginBottom: '20px',
    textAlign: 'center' as const,
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '18px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  label: {
    fontSize: '11.5px',
    textTransform: 'uppercase' as const,
    color: 'var(--text-secondary)',
    letterSpacing: '0.05em',
    fontWeight: '500',
  },
  input: {
    background: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid var(--glass-border)',
    borderRadius: '6px',
    padding: '12px 14px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    fontFamily: 'var(--font-primary)',
    transition: 'all 0.2s ease',
    outline: 'none',
    width: '100%',
  },
  submitBtn: {
    width: '100%',
    padding: '12px',
    justifyContent: 'center',
    fontSize: '13px',
    letterSpacing: '0.05em',
    marginTop: '8px',
  },
  quickAccessSection: {
    marginTop: '32px',
    borderTop: '1px dashed var(--glass-border)',
    paddingTop: '20px',
  },
  quickTitle: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    marginBottom: '10px',
    letterSpacing: '0.03em',
  },
  quickGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
  quickBtn: {
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--glass-border)',
    borderRadius: '6px',
    padding: '8px 10px',
    color: 'var(--text-secondary)',
    fontSize: '11.5px',
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'all 0.2s ease',
  },
  roleLabel: {
    fontSize: '9.5px',
    color: 'var(--text-muted)',
    display: 'block',
  }
};
