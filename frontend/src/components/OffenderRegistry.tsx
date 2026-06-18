import React, { useState, useEffect } from 'react';
import { analyticsService, networkService } from '../services/api';

interface Offender {
  suspect_id: string;
  moniker: string;
  recidivism_count: number;
  syndicate: string;
  associated_cases: string[];
  districts: string[];
  crime_types: string[];
  max_risk_score: number;
  total_incidents: number;
  has_bank_profile: boolean;
  bank_account: string | null;
  bank_status: string | null;
}

export const OffenderRegistry: React.FC = () => {
  const [district, setDistrict] = useState('Statewide');
  const [searchQuery, setSearchQuery] = useState('');
  const [minRecidivism, setMinRecidivism] = useState<number>(5); // Default to 5 instead of 0
  
  // Suggestions State (Search dossier suggestion)
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestedList, setSuggestedList] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Pagination State (Requirement 4)
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [offenders, setOffenders] = useState<Offender[]>([]);
  const [topThree, setTopThree] = useState<Offender[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOffender, setSelectedOffender] = useState<Offender | null>(null);

  const districts = [
    'Statewide', 'Bengaluru Urban', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi', 'Ballari',
    'Shivamogga', 'Tumakuru', 'Udupi', 'Davanagere', 'Raichur', 'Bidar',
    'Kalaburagi', 'Chikkamagaluru', 'Hassan', 'Mandya', 'Kolar', 'Gadag', 'Haveri',
    'Bagalkot', 'Chitradurga', 'Kodagu', 'Yadgir', 'Vijayapura', 'Ramanagara'
  ];

  // Fetch offenders matching active filters and page slice
  const fetchOffenders = async (targetPage: number) => {
    setLoading(true);
    try {
      // 1. Fetch main table paginated results (Requirement 4)
      const data = await analyticsService.getRepeatOffenders(
        district === 'Statewide' ? undefined : district,
        minRecidivism || undefined,
        searchQuery || undefined,
        targetPage,
        limit
      );
      setOffenders(data.offenders || []);
      setTotalPages(data.pages || 1);
      setTotalCount(data.total || 0);

      // 2. Fetch overall top 3 matching current filters to sync Cards (Requirement 6)
      const topData = await analyticsService.getRepeatOffenders(
        district === 'Statewide' ? undefined : district,
        minRecidivism || undefined,
        searchQuery || undefined,
        1, // always page 1
        3  // top 3
      );
      setTopThree(topData.offenders || []);
    } catch (err) {
      console.error('Failed to fetch repeat offenders:', err);
    } finally {
      setLoading(false);
    }
  };

  // Re-query and reset pagination to page 1 whenever filters change (Requirement 4)
  useEffect(() => {
    setPage(1);
    fetchOffenders(1);
  }, [district, minRecidivism, searchQuery]);

  // Fetch search suggestions on mount
  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        const data = await networkService.getSuggestions();
        const combined = [
          ...(data.suspects || []),
          ...(data.suspect_ids || []),
          ...(data.syndicates || [])
        ];
        // Dedup list
        setSuggestions(Array.from(new Set(combined)));
      } catch (err) {
        console.error('Failed to load search suggestions:', err);
      }
    };
    loadSuggestions();
  }, []);

  // Update filtered suggestedList as user types
  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query || query.length < 1) {
      setSuggestedList([]);
      setShowSuggestions(false);
      return;
    }
    const filtered = suggestions.filter(item => 
      item.toLowerCase().includes(query) && item.toLowerCase() !== query
    );
    setSuggestedList(filtered.slice(0, 8));
    setShowSuggestions(filtered.length > 0);
  }, [searchQuery, suggestions]);

  const handleSelectSuggestion = (val: string) => {
    setSearchQuery(val);
    setShowSuggestions(false);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      fetchOffenders(newPage);
    }
  };

  const handleInvestigateNetwork = (moniker: string) => {
    localStorage.setItem('ksp_network_search', moniker);
    window.location.hash = '#network';
    const event = new CustomEvent('ksp-change-tab', { detail: 'network' });
    window.dispatchEvent(event);
  };

  const getRiskColor = (score: number) => {
    if (score >= 0.7) return 'var(--accent-danger)';
    if (score >= 0.4) return 'var(--accent-warning)';
    return 'var(--accent-success)';
  };

  const getBankBadgeStyle = (status: string | null) => {
    if (!status) return { bg: 'rgba(100, 116, 139, 0.1)', color: 'var(--text-muted)', border: '1px solid rgba(100, 116, 139, 0.2)' };
    if (status === 'Frozen') return { bg: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', border: '1px solid rgba(239, 68, 68, 0.3)' };
    if (status === 'Flagged') return { bg: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-warning)', border: '1px solid rgba(245, 158, 11, 0.3)' };
    return { bg: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-success)', border: '1px solid rgba(16, 185, 129, 0.3)' };
  };

  return (
    <div style={styles.container}>
      {/* Control bar */}
      <div style={styles.controlBar}>
        <div style={styles.titleSection}>
          <h3 style={styles.title}>Statewide Repeat Offender Registry</h3>
          <p style={styles.subtitle}>Prioritizing chronic suspects and network node syndicates</p>
        </div>
        
        <div style={styles.filters}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>District Jurisdiction</label>
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              style={styles.select}
            >
              {districts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Min Prior Offenses</label>
            <input
              type="number"
              min="0"
              value={minRecidivism}
              onChange={(e) => setMinRecidivism(parseInt(e.target.value) || 0)}
              style={styles.inputNum}
            />
          </div>

          <div style={{ ...styles.filterGroup, position: 'relative' }}>
            <label style={styles.filterLabel}>Search Dossier</label>
            <input
              type="text"
              placeholder="Search suspect, ID, syndicate..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowSuggestions(suggestedList.length > 0)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 250)}
              style={styles.search}
            />
            {showSuggestions && suggestedList.length > 0 && (
              <div style={styles.suggestionsDropdown}>
                {suggestedList.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectSuggestion(item)}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    style={{
                      ...styles.suggestionItem,
                      ...(hoveredIndex === idx ? styles.suggestionItemHovered : {})
                    }}
                  >
                    🔍 {item}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => fetchOffenders(page)} style={styles.refreshBtn} disabled={loading}>
            {loading ? 'Syncing...' : '🔄 Sync'}
          </button>
        </div>
      </div>

      {/* Leaderboard Cards (Requirement 6) */}
      <div style={styles.leaderboardSection}>
        <h4 style={styles.sectionHeader}>🚨 High-Priority Recidivist Dossiers</h4>
        <div style={styles.leaderboardGrid}>
          {topThree.length === 0 ? (
            <div style={styles.emptyLeaderboard}>
              No chronic offender profiles match the search parameters.
            </div>
          ) : (
            topThree.map((off, index) => {
              const rankColors = [
                'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(8, 12, 20, 0.9) 100%)',
                'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(8, 12, 20, 0.9) 100%)',
                'linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(8, 12, 20, 0.9) 100%)'
              ];
              const borderGlows = [
                '1px solid rgba(239, 68, 68, 0.3)',
                '1px solid rgba(139, 92, 246, 0.3)',
                '1px solid rgba(37, 99, 235, 0.3)'
              ];
              return (
                <div 
                  key={off.suspect_id} 
                  style={{
                    ...styles.leaderboardCard,
                    background: rankColors[index] || styles.leaderboardCard.background,
                    border: borderGlows[index] || styles.leaderboardCard.border
                  }}
                >
                  <div style={styles.cardRankBadge}>Rank #{index + 1}</div>
                  <div style={styles.cardHeader}>
                    <div style={styles.avatar}>
                      {off.moniker.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 style={styles.suspectName}>{off.moniker}</h4>
                      <span style={styles.suspectId}>{off.suspect_id}</span>
                    </div>
                  </div>

                  <div style={styles.statsRow}>
                    <div style={styles.statBox}>
                      <span style={styles.statVal}>{off.recidivism_count}</span>
                      <span style={styles.statLabel}>Prior Offenses</span>
                    </div>
                    <div style={styles.statBox}>
                      <span style={styles.statVal}>{off.total_incidents}</span>
                      <span style={styles.statLabel}>Linked Cases</span>
                    </div>
                    <div style={styles.statBox}>
                      <span style={{ ...styles.statVal, color: getRiskColor(off.max_risk_score) }}>
                        {off.max_risk_score.toFixed(2)}
                      </span>
                      <span style={styles.statLabel}>Risk Index</span>
                    </div>
                  </div>

                  <div style={styles.detailsList}>
                    <div style={styles.detailsItem}>
                      <span style={styles.detailsLabel}>Syndicate:</span>
                      <span style={styles.detailsVal}>{off.syndicate && off.syndicate !== 'None' ? off.syndicate : 'Independent'}</span>
                    </div>
                    <div style={styles.detailsItem}>
                      <span style={styles.detailsLabel}>Operations:</span>
                      <span style={styles.detailsVal} title={off.districts.join(', ')}>
                        {off.districts.slice(0, 2).join(', ')}
                        {off.districts.length > 2 ? '...' : ''}
                      </span>
                    </div>
                  </div>

                  <div style={styles.cardActions}>
                    <button 
                      onClick={() => setSelectedOffender(off)} 
                      style={styles.actionBtnSecondary}
                    >
                      📄 Open Dossier
                    </button>
                    <button 
                      onClick={() => handleInvestigateNetwork(off.moniker)} 
                      style={styles.actionBtnPrimary}
                    >
                      🕸️ Map Network
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="glass-panel" style={styles.tablePanel}>
        <div style={styles.tableHeader}>
          <h4>Complete Recidivist Index</h4>
          <span style={styles.tableMeta}>
            Showing page {page} of {totalPages} ({totalCount} tracked suspect profiles)
          </span>
        </div>
        
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Suspect ID</th>
                <th style={styles.th}>Name / Moniker</th>
                <th style={styles.th}>Syndicate</th>
                <th style={styles.th}>Priors</th>
                <th style={styles.th}>Incidents</th>
                <th style={styles.th}>Max Risk Score</th>
                <th style={styles.th}>Financial Linkage</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {offenders.length === 0 ? (
                <tr>
                  <td colSpan={8} style={styles.tdEmpty}>
                    No repeat offenders found.
                  </td>
                </tr>
              ) : (
                offenders.map((off) => {
                  const bankStyle = getBankBadgeStyle(off.bank_status);
                  return (
                    <tr key={off.suspect_id} style={styles.tr}>
                      <td style={styles.tdId}>{off.suspect_id}</td>
                      <td style={styles.tdName}>{off.moniker}</td>
                      <td style={styles.tdSyndicate}>
                        <span style={styles.syndicateTag}>
                          {off.syndicate && off.syndicate !== 'None' ? off.syndicate : 'Independent'}
                        </span>
                      </td>
                      <td style={styles.tdPriors}>
                        <span style={styles.priorsBadge}>{off.recidivism_count}</span>
                      </td>
                      <td style={styles.tdCases}>{off.total_incidents}</td>
                      <td style={styles.tdRisk}>
                        <span style={{ color: getRiskColor(off.max_risk_score), fontWeight: 'bold' }}>
                          {off.max_risk_score.toFixed(2)}
                        </span>
                      </td>
                      <td style={styles.tdBank}>
                        <span 
                          style={{
                            ...styles.bankBadge,
                            backgroundColor: bankStyle.bg,
                            color: bankStyle.color,
                            border: bankStyle.border
                          }}
                        >
                          {off.bank_status ? `Linked: ${off.bank_status}` : 'Unlinked'}
                        </span>
                      </td>
                      <td style={styles.tdActions}>
                        <button 
                          onClick={() => setSelectedOffender(off)} 
                          style={styles.tableActionBtn}
                          title="Open Dossier"
                        >
                          📄
                        </button>
                        <button 
                          onClick={() => handleInvestigateNetwork(off.moniker)} 
                          style={styles.tableActionBtn}
                          title="View Network Linkage"
                        >
                          🕸️
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Server-side Pagination Row (Requirement 4) */}
        {totalPages > 1 && (
          <div style={styles.paginationRow}>
            <button 
              onClick={() => handlePageChange(page - 1)} 
              disabled={page <= 1}
              style={{
                ...styles.pageBtn,
                ...(page <= 1 ? styles.pageBtnDisabled : {})
              }}
            >
              ◀ Prev
            </button>
            
            <span style={styles.pageLabel}>
              Page <strong style={{ color: 'var(--accent-cyan)' }}>{page}</strong> of <strong>{totalPages}</strong> (Total: {totalCount})
            </span>
            
            <button 
              onClick={() => handlePageChange(page + 1)} 
              disabled={page >= totalPages}
              style={{
                ...styles.pageBtn,
                ...(page >= totalPages ? styles.pageBtnDisabled : {})
              }}
            >
              Next ▶
            </button>
          </div>
        )}
      </div>

      {/* Dossier Modal */}
      {selectedOffender && (
        <div style={styles.modalOverlay} onClick={() => setSelectedOffender(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h4 style={styles.modalTitle}>CRIMINAL PROFILE DOSSIER</h4>
              <button style={styles.closeBtn} onClick={() => setSelectedOffender(null)}>✕</button>
            </div>
            
            <div style={styles.modalBody}>
              <div style={styles.modalDossierCard}>
                <div style={styles.dossierHeader}>
                  <div style={styles.largeAvatar}>
                    {selectedOffender.moniker.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 style={styles.dossierTitle}>{selectedOffender.moniker}</h2>
                    <p style={styles.dossierSubtitle}>System ID: {selectedOffender.suspect_id}</p>
                    <span style={styles.dossierSyndTag}>
                      Syndicate: {selectedOffender.syndicate || 'Independent Node'}
                    </span>
                  </div>
                </div>

                <div style={styles.dossierDivider} />

                <div style={styles.dossierStatsGrid}>
                  <div style={styles.dossierStat}>
                    <span style={styles.dossierStatVal}>{selectedOffender.recidivism_count}</span>
                    <span style={styles.dossierStatLabel}>Historical Priors</span>
                  </div>
                  <div style={styles.dossierStat}>
                    <span style={styles.dossierStatVal}>{selectedOffender.total_incidents}</span>
                    <span style={styles.dossierStatLabel}>Active Incidents</span>
                  </div>
                  <div style={styles.dossierStat}>
                    <span style={{ ...styles.dossierStatVal, color: getRiskColor(selectedOffender.max_risk_score) }}>
                      {selectedOffender.max_risk_score.toFixed(2)}
                    </span>
                    <span style={styles.dossierStatLabel}>Peak Risk Index</span>
                  </div>
                </div>

                <div style={styles.dossierSection}>
                  <h5 style={styles.dossierSecTitle}>Jurisdictional & Crime Profiles</h5>
                  <div style={styles.dossierMetaGrid}>
                    <div>
                      <span style={styles.metaLabel}>Districts of Activity</span>
                      <div style={styles.badgeRow}>
                        {selectedOffender.districts.map(d => (
                          <span key={d} style={styles.metaBadge}>{d}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span style={styles.metaLabel}>Linked Crime Categories</span>
                      <div style={styles.badgeRow}>
                        {selectedOffender.crime_types.map(c => (
                          <span key={c} style={{ ...styles.metaBadge, backgroundColor: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-cyan)' }}>{c}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={styles.dossierSection}>
                  <h5 style={styles.dossierSecTitle}>Linked Incident Cases</h5>
                  <div style={styles.casesList}>
                    {selectedOffender.associated_cases.map(c => (
                      <span key={c} style={styles.caseCode}>{c}</span>
                    ))}
                  </div>
                </div>

                <div style={styles.dossierSection}>
                  <h5 style={styles.dossierSecTitle}>Financial Intelligence Integration</h5>
                  {selectedOffender.has_bank_profile ? (
                    <div style={styles.bankPanel}>
                      <div style={styles.bankPanelRow}>
                        <span>Account Number:</span>
                        <code style={styles.bankCode}>{selectedOffender.bank_account}</code>
                      </div>
                      <div style={styles.bankPanelRow}>
                        <span>Account Registry Status:</span>
                        <span 
                          style={{
                            fontWeight: 'bold',
                            color: selectedOffender.bank_status === 'Frozen' ? 'var(--accent-danger)' :
                                   selectedOffender.bank_status === 'Flagged' ? 'var(--accent-warning)' : 'var(--accent-success)'
                          }}
                        >
                          {selectedOffender.bank_status}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div style={styles.noBankPanel}>
                      ⚠️ No financial assets or bank account linkages registered in the database for this suspect moniker.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button 
                onClick={() => setSelectedOffender(null)} 
                style={styles.modalCloseBtn}
              >
                Close Dossier
              </button>
              <button 
                onClick={() => {
                  handleInvestigateNetwork(selectedOffender.moniker);
                  setSelectedOffender(null);
                }} 
                style={styles.modalActionBtn}
              >
                Launch Network Linkage Graph 🕸️
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
    height: '100%',
    overflowY: 'auto' as const,
  },
  controlBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'rgba(15, 22, 38, 0.5)',
    border: '1px solid var(--glass-border)',
    borderRadius: '12px',
    padding: '16px 24px',
    flexWrap: 'wrap' as const,
    gap: '16px',
  },
  titleSection: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  title: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  filters: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap' as const,
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  filterLabel: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontWeight: '600',
    textTransform: 'uppercase' as const,
  },
  select: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--glass-border)',
    borderRadius: '6px',
    padding: '8px 12px',
    color: '#ffffff',
    fontSize: '13px',
    minWidth: '150px',
  },
  inputNum: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--glass-border)',
    borderRadius: '6px',
    padding: '8px 12px',
    color: '#ffffff',
    fontSize: '13px',
    width: '80px',
    textAlign: 'center' as const,
  },
  search: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--glass-border)',
    borderRadius: '6px',
    padding: '8px 12px',
    color: '#ffffff',
    fontSize: '13px',
    minWidth: '220px',
  },
  refreshBtn: {
    background: 'rgba(37, 99, 235, 0.2)',
    border: '1px solid rgba(37, 99, 235, 0.4)',
    color: '#ffffff',
    borderRadius: '6px',
    padding: '9px 16px',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  leaderboardSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '14px',
  },
  sectionHeader: {
    fontSize: '15px',
    color: 'var(--accent-cyan)',
    fontWeight: '700',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  leaderboardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '20px',
  },
  emptyLeaderboard: {
    gridColumn: '1 / -1',
    background: 'rgba(15, 22, 38, 0.3)',
    border: '1px dashed var(--glass-border)',
    borderRadius: '12px',
    padding: '30px',
    textAlign: 'center' as const,
    color: 'var(--text-secondary)',
  },
  leaderboardCard: {
    background: 'rgba(15, 22, 38, 0.6)',
    border: '1px solid var(--glass-border)',
    borderRadius: '12px',
    padding: '20px',
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  cardRankBadge: {
    position: 'absolute' as const,
    top: '12px',
    right: '12px',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid var(--glass-border)',
    borderRadius: '20px',
    padding: '2px 10px',
    fontSize: '10.5px',
    fontWeight: '700',
    color: 'var(--text-secondary)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  avatar: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: 'bold',
    color: 'white',
  },
  suspectName: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#ffffff',
  },
  suspectId: {
    fontSize: '11px',
    color: 'var(--accent-cyan)',
    fontFamily: 'monospace',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
    background: 'rgba(8, 12, 20, 0.4)',
    borderRadius: '8px',
    padding: '10px',
    border: '1px solid rgba(255, 255, 255, 0.03)',
  },
  statBox: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
  },
  statVal: {
    fontSize: '18px',
    fontWeight: '800',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: '9px',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase' as const,
    marginTop: '2px',
  },
  detailsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    fontSize: '12.5px',
  },
  detailsItem: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  detailsLabel: {
    color: 'var(--text-muted)',
  },
  detailsVal: {
    color: 'var(--text-primary)',
    fontWeight: '600',
  },
  cardActions: {
    display: 'flex',
    gap: '10px',
    marginTop: 'auto',
  },
  actionBtnPrimary: {
    flex: 1,
    background: 'rgba(37, 99, 235, 0.2)',
    border: '1px solid rgba(37, 99, 235, 0.5)',
    color: '#ffffff',
    borderRadius: '6px',
    padding: '8px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  actionBtnSecondary: {
    flex: 1,
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--glass-border)',
    color: 'var(--text-secondary)',
    borderRadius: '6px',
    padding: '8px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  tablePanel: {
    background: 'rgba(15, 22, 38, 0.4)',
    border: '1px solid var(--glass-border)',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  tableHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tableMeta: {
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  tableWrapper: {
    width: '100%',
    overflowX: 'auto' as const,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    textAlign: 'left' as const,
  },
  th: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--glass-border)',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase' as const,
  },
  tr: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
    transition: 'background 0.2s ease',
  },
  tdId: {
    padding: '14px 16px',
    fontSize: '13px',
    fontFamily: 'monospace',
    color: 'var(--accent-cyan)',
  },
  tdName: {
    padding: '14px 16px',
    fontSize: '13.5px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  tdSyndicate: {
    padding: '14px 16px',
    fontSize: '13px',
  },
  syndicateTag: {
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '11px',
  },
  tdPriors: {
    padding: '14px 16px',
  },
  priorsBadge: {
    background: 'rgba(239, 68, 68, 0.15)',
    color: 'var(--accent-danger)',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '700',
  },
  tdCases: {
    padding: '14px 16px',
    fontSize: '13px',
    fontWeight: '600',
  },
  tdRisk: {
    padding: '14px 16px',
    fontSize: '13px',
  },
  tdBank: {
    padding: '14px 16px',
  },
  bankBadge: {
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
  },
  tdActions: {
    padding: '14px 16px',
    display: 'flex',
    gap: '6px',
  },
  tableActionBtn: {
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--glass-border)',
    color: '#ffffff',
    borderRadius: '4px',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'all 0.2s ease',
  },
  tdEmpty: {
    padding: '40px',
    textAlign: 'center' as const,
    color: 'var(--text-secondary)',
    fontSize: '13.5px',
  },
  paginationRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    marginTop: '16px',
    borderTop: '1px solid var(--glass-border)',
    paddingTop: '16px',
  },
  pageLabel: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  pageBtn: {
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--glass-border)',
    borderRadius: '6px',
    padding: '6px 14px',
    color: '#ffffff',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  pageBtnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  modalOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(8, 12, 20, 0.85)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  modalContent: {
    width: '90%',
    maxWidth: '540px',
    background: 'rgba(15, 22, 38, 0.95)',
    border: '1px solid var(--glass-border)',
    borderRadius: '16px',
    boxShadow: 'var(--glow-blue)',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden' as const,
  },
  modalHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--glass-border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--accent-cyan)',
    letterSpacing: '0.08em',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '16px',
    cursor: 'pointer',
  },
  modalBody: {
    padding: '20px',
    overflowY: 'auto' as const,
    maxHeight: '70vh',
  },
  modalDossierCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  dossierHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  largeAvatar: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-violet) 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: '800',
    color: 'white',
    boxShadow: '0 0 15px rgba(37, 99, 235, 0.3)',
  },
  dossierTitle: {
    fontSize: '22px',
    fontWeight: '800',
    color: '#ffffff',
  },
  dossierSubtitle: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontFamily: 'monospace',
  },
  dossierSyndTag: {
    display: 'inline-block',
    background: 'rgba(6, 182, 212, 0.1)',
    color: 'var(--accent-cyan)',
    border: '1px solid rgba(6, 182, 212, 0.3)',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '11px',
    marginTop: '6px',
    fontWeight: '600',
  },
  dossierDivider: {
    height: '1px',
    background: 'var(--glass-border)',
  },
  dossierStatsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    background: 'rgba(8, 12, 20, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    padding: '12px',
  },
  dossierStat: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
  },
  dossierStatVal: {
    fontSize: '22px',
    fontWeight: '800',
  },
  dossierStatLabel: {
    fontSize: '9.5px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    marginTop: '4px',
  },
  dossierSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  dossierSecTitle: {
    fontSize: '12px',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    borderLeft: '2px solid var(--accent-cyan)',
    paddingLeft: '8px',
  },
  dossierMetaGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  metaLabel: {
    fontSize: '10.5px',
    color: 'var(--text-muted)',
    marginBottom: '6px',
    display: 'block',
  },
  badgeRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '6px',
  },
  metaBadge: {
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--glass-border)',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '11px',
    color: 'var(--text-secondary)',
  },
  casesList: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px',
  },
  caseCode: {
    fontFamily: 'monospace',
    background: 'rgba(139, 92, 246, 0.1)',
    color: 'var(--accent-violet)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '11px',
    fontWeight: '600',
  },
  bankPanel: {
    background: 'rgba(8, 12, 20, 0.5)',
    border: '1px solid var(--glass-border)',
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    fontSize: '13px',
  },
  bankPanelRow: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  bankCode: {
    fontFamily: 'monospace',
    color: 'var(--accent-cyan)',
    fontWeight: '600',
  },
  noBankPanel: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    background: 'rgba(245, 158, 11, 0.03)',
    border: '1px dashed rgba(245, 158, 11, 0.2)',
    padding: '12px',
    borderRadius: '8px',
  },
  modalFooter: {
    padding: '16px 20px',
    borderTop: '1px solid var(--glass-border)',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  modalCloseBtn: {
    background: 'none',
    border: '1px solid var(--glass-border)',
    color: 'var(--text-secondary)',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  modalActionBtn: {
    background: 'linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-violet) 100%)',
    border: 'none',
    color: '#ffffff',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 0 10px rgba(37, 99, 235, 0.2)',
  },
  suggestionsDropdown: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    width: '100%',
    background: 'rgba(15, 22, 38, 0.98)',
    border: '1px solid var(--glass-border)',
    borderRadius: '6px',
    marginTop: '4px',
    maxHeight: '220px',
    overflowY: 'auto' as const,
    zIndex: 100,
    boxShadow: 'var(--glow-blue)',
  },
  suggestionItem: {
    padding: '8px 12px',
    fontSize: '12.5px',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
    textAlign: 'left' as const,
  },
  suggestionItemHovered: {
    background: 'rgba(37, 99, 235, 0.15)',
    color: 'var(--accent-cyan)',
  },
};
