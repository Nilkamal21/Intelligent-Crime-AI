import React, { useState, useEffect, useRef } from 'react';
import { Network } from 'vis-network';
import { networkService } from '../services/api';
import type { NetworkGraphData, NetworkNode, NetworkEdge } from '../types';

const parseAiInsight = (text: string) => {
  if (!text) return [];
  return text.split('\n\n').filter(Boolean).map(sec => {
    const cleanSec = sec.replace(/^•\s*/, '').trim();
    const colonIdx = cleanSec.indexOf(':');
    if (colonIdx !== -1) {
      return {
        title: cleanSec.substring(0, colonIdx).trim(),
        content: cleanSec.substring(colonIdx + 1).trim()
      };
    }
    return { title: 'Insight', content: cleanSec };
  });
};

const getBorderColor = (title: string) => {
  const t = title.toUpperCase();
  if (t.includes('TARGET')) return 'var(--accent-blue)';
  if (t.includes('LEGAL')) return 'var(--accent-warning)';
  if (t.includes('MODUS')) return 'var(--accent-cyan)';
  if (t.includes('DISTRICT') || t.includes('CONTEXT')) return 'var(--accent-violet)';
  if (t.includes('TACTICAL') || t.includes('RISK')) return 'var(--accent-danger)';
  return 'var(--glass-border)';
};

const getBgColor = (title: string) => {
  const t = title.toUpperCase();
  if (t.includes('TARGET')) return 'rgba(37, 99, 235, 0.04)';
  if (t.includes('LEGAL')) return 'rgba(245, 158, 11, 0.04)';
  if (t.includes('MODUS')) return 'rgba(6, 182, 212, 0.04)';
  if (t.includes('DISTRICT') || t.includes('CONTEXT')) return 'rgba(139, 92, 246, 0.04)';
  if (t.includes('TACTICAL') || t.includes('RISK')) return 'rgba(239, 68, 68, 0.04)';
  return 'rgba(255, 255, 255, 0.02)';
};

export const NetworkMap: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [graphData, setGraphData] = useState<NetworkGraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<{ suspects: string[], suspect_ids: string[], syndicates: string[], cases: string[] }>({
    suspects: [],
    suspect_ids: [],
    syndicates: [],
    cases: []
  });
  const [expandedSuspects, setExpandedSuspects] = useState<Set<string>>(new Set());
  const [selectedAccount, setSelectedAccount] = useState<NetworkNode | null>(null);
  const [showFlagsList, setShowFlagsList] = useState(false);
  const [flagsHovered, setFlagsHovered] = useState(false);
  const [hoveredFlaggedIdx, setHoveredFlaggedIdx] = useState<number | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);

  // Fetch search suggestions on mount and check for cross-dashboard redirections
  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        const data = await networkService.getSuggestions();
        setSuggestions(data);
      } catch (err) {
        console.error('Failed to load search suggestions:', err);
      }
    };
    loadSuggestions();

    const savedSearch = localStorage.getItem('ksp_network_search');
    if (savedSearch) {
      setSearchQuery(savedSearch);
      fetchGraph(undefined, undefined, savedSearch);
      localStorage.removeItem('ksp_network_search');
    }
  }, []);

  const fetchGraph = async (suspect?: string, syndicate?: string, query?: string) => {
    setLoading(true);
    try {
      const data = await networkService.getGraph(suspect || undefined, syndicate || undefined, query || undefined);
      setGraphData(data);
      setExpandedSuspects(new Set()); // Reset on new graph load
      setSelectedAccount(null);
      setShowFlagsList(false);
    } catch (err) {
      console.error('Failed to fetch network graph:', err);
    } finally {
      setLoading(false);
    }
  };

  // Compute filtered nodes and edges for both rendering and telemetry
  let filteredNodes: NetworkNode[] = [];
  let filteredEdges: NetworkEdge[] = [];

  if (graphData) {
    const visibleNodeIds = new Set<string>();

    // Suspects, syndicates, and sub_locations are always visible
    graphData.nodes.forEach(n => {
      if (n.type !== 'bank_account' && n.type !== 'crime_incident') {
        visibleNodeIds.add(n.id);
      }
    });

    // Bank accounts and crime incidents are shown if connected to at least one expanded suspect
    graphData.nodes.forEach(n => {
      if (n.type === 'bank_account' || n.type === 'crime_incident') {
        const connectedEdges = graphData.edges.filter(e => 
          e.source === n.id || e.target === n.id
        );
        
        const connectedSuspectIds = connectedEdges.map(e => {
          const otherId = e.source === n.id ? e.target : e.source;
          const otherNode = graphData.nodes.find(node => node.id === otherId);
          return otherNode?.type === 'suspect' ? otherId : null;
        }).filter(Boolean) as string[];

        if (connectedSuspectIds.length === 0) {
          // Fallback: show if not connected to any suspect in the graph
          visibleNodeIds.add(n.id);
        } else {
          // Show if any connected suspect is in the expanded set
          const isAnySuspectExpanded = connectedSuspectIds.some(sid => expandedSuspects.has(sid));
          if (isAnySuspectExpanded) {
            visibleNodeIds.add(n.id);
          }
        }
      }
    });

    filteredNodes = graphData.nodes.filter(n => visibleNodeIds.has(n.id));
    filteredEdges = graphData.edges.filter(e => 
      visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
    );
  }

  // Dynamic calculations for Relational Telemetry matching the active visual topology
  const visibleOffendersCount = graphData ? filteredNodes.filter(n => n.type === 'suspect').length : 0;
  const visibleCasesCount = graphData ? filteredNodes.filter(n => n.type === 'crime_incident').length : 0;
  const visibleAccountsCount = graphData ? filteredNodes.filter(n => n.type === 'bank_account').length : 0;
  const visibleFlagsCount = graphData ? (
    filteredNodes.filter(n => n.type === 'bank_account' && (n.status === 'Flagged' || n.status === 'Frozen')).length +
    filteredEdges.filter(e => e.is_suspicious).length
  ) : 0;

  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    // Transform API graph data into Vis.js format
    const visNodes = filteredNodes.map(n => {
      // Define colors & shapes based on node type
      let color = { background: '#2563eb', border: '#1d4ed8', highlight: { background: '#60a5fa', border: '#3b82f6' } }; // Suspect (Blue)
      let shape = 'dot';
      let font = { color: '#ffffff', size: 12 };

      if (n.type === 'syndicate') {
        color = { background: '#8b5cf6', border: '#7c3aed', highlight: { background: '#c084fc', border: '#a855f7' } }; // Syndicate (Purple)
        shape = 'diamond';
      } else if (n.type === 'sub_location') {
        color = { background: '#14b8a6', border: '#0d9488', highlight: { background: '#2dd4bf', border: '#14b8a6' } }; // Sub Location (Teal)
        shape = 'triangle';
      } else if (n.type === 'crime_incident') {
        color = { background: '#475569', border: '#334155', highlight: { background: '#94a3b8', border: '#64748b' } }; // Case (Slate)
        shape = 'square';
      } else if (n.type === 'bank_account') {
        // Red border for flagged accounts, green for active
        const isFlagged = n.status === 'Flagged' || n.status === 'Frozen';
        color = isFlagged 
          ? { background: '#ef4444', border: '#b91c1c', highlight: { background: '#f87171', border: '#ef4444' } } 
          : { background: '#10b981', border: '#059669', highlight: { background: '#34d399', border: '#10b981' } };
        shape = 'ellipse';
        font = { color: '#f8fafc', size: 10 };
      }

      // Generate clean plain-text tooltips for policeman readability
      let titleText = '';
      if (n.type === 'suspect') {
        const isExpanded = expandedSuspects.has(n.id);
        titleText = `--- SUSPECT PROFILE ---
Moniker: ${n.label}
Suspect ID: ${n.id}
Syndicate: ${n.syndicate || 'None'}
Recidivism: ${n.recidivism || 0} priors${n.risk_score !== undefined ? `\nRisk Score: ${n.risk_score.toFixed(2)}` : ''}

Double-click to ${isExpanded ? 'collapse' : 'expand'} accounts & cases`;
      } else if (n.type === 'bank_account') {
        titleText = `--- BANK ACCOUNT ---
Owner: ${n.label.split('\n')[0]}
Account No: ${n.id}
Balance: ₹${n.balance?.toLocaleString()}
Status: ${n.status}`;
      } else if (n.type === 'crime_incident') {
        titleText = `--- CRIME INCIDENT (FIR) ---
Case ID: ${n.id}
FIR Number: ${(n as any).fir_number || 'N/A'}
Legal Class: ${n.crime_type || 'N/A'}
IPC Sections: ${n.legal_sections || 'N/A'}
Judicial Convictions: ${n.convictions || 0}
Peak Hours: ${n.peak_hour !== undefined ? `${String(n.peak_hour).padStart(2, '0')}:00` : 'N/A'} (${n.incident_time_block || 'N/A'})
Day Profile: ${n.day_profile || 'N/A'}
Sub-Location: ${n.sub_location || 'N/A'}`;
      } else if (n.type === 'sub_location') {
        titleText = `--- SUB-LOCATION ---
Location Name: ${n.id}
Active Risk Score: ${n.risk_score !== undefined ? n.risk_score.toFixed(2) : '0.00'}`;
      } else if (n.type === 'syndicate') {
        titleText = `--- SYNDICATE INFO ---
Syndicate Name: ${n.id}
Risk Score: ${n.risk_score !== undefined ? n.risk_score.toFixed(2) : '0.00'}`;
      }

      return {
        id: n.id,
        label: n.label,
        shape: shape,
        size: n.size,
        color: color,
        font: font,
        title: titleText, // Tooltip content as clean plain-text string
        borderWidth: 2,
        shadow: { enabled: true, color: 'rgba(0,0,0,0.5)', size: 5, x: 2, y: 2 }
      };
    });

    const visEdges = filteredEdges.map((e, idx) => {
      let color = '#cbd5e1'; // Default link (Bright Slate-gray)
      let width = 2.5;
      let arrows = undefined;
      let label = e.label || e.type.toUpperCase().replace('_', ' ');

      if (e.type === 'accused_in') {
        color = '#ef4444'; // Accused In (Bright Red)
        arrows = 'to';
        width = 4.0;
      } else if (e.type === 'owns_account') {
        color = '#10b981'; // Account ownership (Bright Green)
        width = 3.0;
      } else if (e.type === 'operated_in') {
        color = '#06b6d4'; // Operated In (Vibrant Cyan)
        width = 3.0;
      } else if (e.type === 'member_of') {
        color = '#a855f7'; // Member Of (Vibrant Purple)
        width = 4.0;
      } else if (e.type === 'transaction') {
        // Highlighting suspicious financial transactions
        color = e.is_suspicious ? '#ef4444' : '#10b981';
        width = e.is_suspicious ? 5.0 : 3.0;
        arrows = 'to';
        label = `₹${e.amount?.toLocaleString()} ${e.is_suspicious ? '⚠️' : ''}`;
      } else if (e.type === 'located_in') {
        color = '#06b6d4'; // Location of case (Vibrant Cyan)
        width = 2.5;
      }

      // Generate clean plain-text tooltips for edges
      let edgeTitleText = '';
      if (e.type === 'transaction') {
        edgeTitleText = `--- FINANCIAL TRANSACTION ---
Amount: ₹${e.amount?.toLocaleString()}
Suspicious: ${e.is_suspicious ? 'YES ⚠️' : 'NO'}
Txn ID: ${e.txn_id || 'N/A'}
Reference: ${e.case_id || 'N/A'}`;
      } else {
        edgeTitleText = `--- CONNECTION ---
Link Type: ${e.type.toUpperCase().replace('_', ' ')}
Reference: ${e.case_id || 'N/A'}`;
      }

      return {
        id: `edge-${idx}`,
        from: e.source,
        to: e.target,
        label: label, // Show labels by default
        title: edgeTitleText, // Tooltip content as clean plain-text string
        color: { color: color, highlight: '#38bdf8', hover: '#38bdf8' },
        width: width,
        arrows: arrows,
        font: { size: 10, color: '#cbd5e1', strokeWidth: 3, strokeColor: '#05080e', align: 'top' },
        smooth: { enabled: true, type: 'curvedCW', roundness: 0.15 }
      };
    });

    // Create the network
    const data = { nodes: visNodes, edges: visEdges };
    
    const options = {
      physics: {
        solver: 'barnesHut',
        barnesHut: {
          gravitationalConstant: -6000,
          centralGravity: 0.02,
          springLength: 200,
          springConstant: 0.04,
          damping: 0.09,
          avoidOverlap: 1
        },
        stabilization: { iterations: 150 }
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        navigationButtons: true,
        keyboard: true
      }
    };

    const network = new Network(containerRef.current, data, options);
    networkRef.current = network;

    // Click listener to select bank account nodes
    network.on('click', (params) => {
      if (params.nodes && params.nodes.length > 0) {
        const clickedNodeId = params.nodes[0];
        const clickedNode = graphData.nodes.find(n => n.id === clickedNodeId);
        if (clickedNode && clickedNode.type === 'bank_account') {
          setSelectedAccount(clickedNode);
          setShowFlagsList(false);
        } else {
          setSelectedAccount(null);
        }
      } else {
        setSelectedAccount(null);
      }
    });

    // Double-click/click listener to expand/collapse suspect leaf nodes
    network.on('doubleClick', (params) => {
      if (params.nodes && params.nodes.length > 0) {
        const clickedNodeId = params.nodes[0];
        // Find if the clicked node is a suspect
        const clickedNode = graphData.nodes.find(n => n.id === clickedNodeId);
        if (clickedNode && clickedNode.type === 'suspect') {
          setExpandedSuspects(prev => {
            const next = new Set(prev);
            if (next.has(clickedNodeId)) {
              next.delete(clickedNodeId);
            } else {
              next.add(clickedNodeId);
            }
            return next;
          });
        }
      }
    });

    // Event listeners for hoverEdge/blurEdge are removed as edge labels are visible by default.

    // Clean up on component unmount
    return () => {
      network.destroy();
    };
  }, [graphData, expandedSuspects, filteredNodes, filteredEdges, setSelectedAccount, setShowFlagsList]);

  const handleReset = () => {
    setSearchQuery('');
    setGraphData(null);
    setExpandedSuspects(new Set());
    setSelectedAccount(null);
    setShowFlagsList(false);
  };

  // Helper to find account holder/owner name from the graph
  const getAccountOwnerName = (accountId: string) => {
    if (!graphData) return 'Unknown Suspect';
    const ownerEdge = graphData.edges.find(e => e.target === accountId && e.type === 'owns_account');
    return ownerEdge ? ownerEdge.source : 'Unknown Suspect';
  };

  // Helper to filter and sort transactions involving this bank account
  const getAccountTransactions = (accountId: string) => {
    if (!graphData) return [];
    const txEdges = graphData.edges.filter(e => e.type === 'transaction' && (e.source === accountId || e.target === accountId));
    // Sort suspicious transactions first
    return txEdges.sort((a, b) => (b.is_suspicious ? 1 : 0) - (a.is_suspicious ? 1 : 0));
  };

  // Helper to generate a stable mock date based on transaction ID
  const getTxDate = (txnId?: string) => {
    if (!txnId) return '2026-06-12';
    const hash = txnId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const day = 10 + (hash % 18);
    return `2026-06-${day}`;
  };

  // Helper to determine why an account is flagged
  const getWhyFlagged = (account: NetworkNode) => {
    const accTransactions = getAccountTransactions(account.id);
    const hasSuspiciousTx = accTransactions.some(tx => tx.is_suspicious);

    if (account.status === 'Frozen') {
      return 'Account frozen due to suspected syndicate funds flow and high-volume transfers.';
    }
    if (account.status === 'Flagged') {
      if (hasSuspiciousTx) {
        return 'Flagged due to direct association with syndicate accounts via suspicious Hawala transfers.';
      }
      return 'Flagged due to unusual transaction frequency and rapid structural cash movements.';
    }
    if (hasSuspiciousTx) {
      return 'Relational warning: Connected to known suspect accounts via flagged financial channels.';
    }
    return 'Standard active account. Currently under observation for relational linkage.';
  };

  return (
    <div style={styles.container}>
      {/* Search Filter Panel */}
      <div style={styles.controlBar}>
        <h3 style={styles.title}>Relational Link Analysis Matrix</h3>
        
        <div style={styles.filterGroup}>
          <input
            list="suspect-suggestions"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                fetchGraph(undefined, undefined, searchQuery);
              }
            }}
            placeholder="Enter Suspect ID, Name, or Case Number to map network"
            style={styles.searchInput}
          />
          <datalist id="suspect-suggestions">
            {suggestions.suspects.map(name => <option key={name} value={name} />)}
            {suggestions.suspect_ids.map(id => <option key={id} value={id} />)}
            {suggestions.syndicates.map(synd => <option key={synd} value={synd} />)}
            {suggestions.cases.map(c => <option key={c} value={c} />)}
          </datalist>

          <button onClick={() => fetchGraph(undefined, undefined, searchQuery)} style={styles.searchBtn}>
            🔍 Link Entities
          </button>

          <button onClick={handleReset} style={styles.resetBtn}>
            Reset Graph
          </button>
        </div>
      </div>

      {/* Main Graph Grid */}
      <div style={styles.mainGrid}>
        {/* Network Diagram View */}
        <div style={styles.graphWrapper}>
          {loading && <div style={styles.loader}>Assembling network links...</div>}
          {!graphData && !loading ? (
            <div style={styles.placeholderContainer}>
              <div style={styles.placeholderIcon}>🔍</div>
              <h4 style={{ color: 'white', marginBottom: '8px' }}>Relational Link Analysis</h4>
              <p style={{ maxWidth: '500px', margin: '0 auto 16px auto', color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.5' }}>
                Enter a Suspect ID, Suspect Name, or Case Number in the search bar above to map their relationship network (including 1st and 2nd-degree connections).
              </p>
            </div>
          ) : (
            <>
              <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#05080e' }} />
              <div style={styles.instructionLegend}>
                <span>💡 <i>Double-click any blue Suspect node to expand or collapse their associated bank accounts and crime incidents.</i></span>
              </div>
            </>
          )}
        </div>

        {/* Criminology Summary Panel */}
        {graphData && (
          <div className="glass-panel" style={styles.summaryPanel}>
            {selectedAccount ? (
              <div style={styles.dossierContainer}>
                <div style={styles.dossierHeader}>
                  <button 
                    onClick={() => setSelectedAccount(null)} 
                    style={styles.dossierCloseBtn}
                  >
                    ← Back to Telemetry
                  </button>
                  <h4 style={styles.dossierTitle}>🏦 Account Dossier</h4>
                </div>

                <div style={styles.dossierBody}>
                  <div style={styles.dossierField}>
                    <span style={styles.dossierLabel}>Account Holder</span>
                    <span style={styles.dossierVal}>{getAccountOwnerName(selectedAccount.id)}</span>
                  </div>

                  <div style={styles.dossierField}>
                    <span style={styles.dossierLabel}>Account Number</span>
                    <span style={styles.dossierCode}>{selectedAccount.id}</span>
                  </div>

                  <div style={styles.dossierField}>
                    <span style={styles.dossierLabel}>Balance</span>
                    <span style={styles.dossierBalance}>₹{selectedAccount.balance?.toLocaleString() || '0'}</span>
                  </div>

                  <div style={styles.dossierField}>
                    <span style={styles.dossierLabel}>Status</span>
                    <span style={{
                      ...styles.dossierStatus,
                      color: selectedAccount.status === 'Active' ? 'var(--accent-success)' : 'var(--accent-danger)',
                      borderColor: selectedAccount.status === 'Active' ? 'var(--accent-success)' : 'var(--accent-danger)',
                    }}>
                      {selectedAccount.status || 'Active'}
                    </span>
                  </div>

                  <div style={styles.dossierField}>
                    <span style={styles.dossierLabel}>Risk Indicator</span>
                    <p style={styles.dossierText}>{getWhyFlagged(selectedAccount)}</p>
                  </div>

                  <div style={{ marginTop: '16px' }}>
                    <span style={styles.dossierLabel}>Transaction Ledger</span>
                    {getAccountTransactions(selectedAccount.id).length === 0 ? (
                      <div style={styles.dossierEmptyTxs}>
                        No active transactions recorded in network diagram
                      </div>
                    ) : (
                      <div style={styles.dossierTxsList}>
                        {getAccountTransactions(selectedAccount.id).slice(0, 3).map((tx, idx) => {
                          const isSender = tx.source === selectedAccount.id;
                          const partnerAcc = isSender ? tx.target : tx.source;
                          const labelText = tx.label || '';
                          const reasonMatch = labelText.match(/\((.*?)\)/);
                          const reason = reasonMatch ? reasonMatch[1] : (tx.is_suspicious ? 'Flagged Transfer' : 'Transfer');
                          
                          return (
                            <div 
                              key={idx} 
                              style={{
                                ...styles.dossierTxCard,
                                borderLeftColor: tx.is_suspicious ? 'var(--accent-danger)' : 'var(--accent-success)',
                              }}
                            >
                              <div style={styles.dossierTxHeader}>
                                <span style={{
                                  fontSize: '12px',
                                  fontWeight: 'bold',
                                  color: tx.is_suspicious ? 'var(--accent-danger)' : 'var(--accent-success)'
                                }}>
                                  {isSender ? 'Outgoing' : 'Incoming'} • ₹{tx.amount?.toLocaleString()}
                                </span>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                  {getTxDate(tx.txn_id)}
                                </span>
                              </div>
                              <div style={styles.dossierTxBody}>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                                  {isSender ? `To: ${partnerAcc}` : `From: ${partnerAcc}`}
                                </div>
                                <div style={{ fontSize: '10.5px', color: tx.is_suspicious ? 'var(--accent-danger)' : 'var(--text-muted)' }}>
                                  Reason: {reason}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : showFlagsList ? (
              <div style={styles.dossierContainer}>
                <div style={styles.dossierHeader}>
                  <button 
                    onClick={() => setShowFlagsList(false)} 
                    style={styles.dossierCloseBtn}
                  >
                    ← Back to Telemetry
                  </button>
                  <h4 style={styles.dossierTitle}>⚠️ Hawala Risk Registry</h4>
                </div>

                <div style={styles.dossierBody}>
                  <p style={{ ...styles.dossierText, marginBottom: '16px' }}>
                    Listing all bank accounts currently flagged or frozen on the active linkage topology.
                  </p>
                  
                  {filteredNodes.filter(n => n.type === 'bank_account' && (n.status === 'Flagged' || n.status === 'Frozen')).length === 0 ? (
                    <div style={styles.dossierEmptyTxs}>
                      No flagged or frozen bank accounts detected in current search view.
                    </div>
                  ) : (
                    <div style={styles.dossierTxsList}>
                      {filteredNodes.filter(n => n.type === 'bank_account' && (n.status === 'Flagged' || n.status === 'Frozen')).map((acc, idx) => (
                        <div 
                          key={idx}
                          onMouseEnter={() => setHoveredFlaggedIdx(idx)}
                          onMouseLeave={() => setHoveredFlaggedIdx(null)}
                          onClick={() => {
                            setSelectedAccount(acc);
                            setShowFlagsList(false);
                          }}
                          style={{
                            ...styles.flaggedAccCard,
                            borderColor: hoveredFlaggedIdx === idx ? 'var(--accent-cyan)' : 'var(--glass-border)',
                            background: hoveredFlaggedIdx === idx ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                              {getAccountOwnerName(acc.id)}
                            </span>
                            <span style={{
                              fontSize: '9px',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              border: '1px solid var(--accent-danger)',
                              color: 'var(--accent-danger)',
                              background: 'rgba(239, 68, 68, 0.05)'
                            }}>
                              {acc.status}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            No: {acc.id}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                            <span>Balance: ₹{acc.balance?.toLocaleString()}</span>
                            <span style={{ color: 'var(--accent-cyan)' }}>View Dossier →</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <h4 style={styles.summaryTitle}>Relational Telemetry</h4>
                <div style={styles.metricGrid}>
                  <div style={styles.metricCard}>
                    <span style={styles.metricVal}>{visibleOffendersCount}</span>
                    <span style={styles.metricLbl}>Offenders</span>
                  </div>
                  <div style={styles.metricCard}>
                    <span style={styles.metricVal}>{visibleCasesCount}</span>
                    <span style={styles.metricLbl}>Cases Match</span>
                  </div>
                  <div style={styles.metricCard}>
                    <span style={styles.metricVal}>{visibleAccountsCount}</span>
                    <span style={styles.metricLbl}>Accounts</span>
                  </div>
                  <div 
                    style={{ 
                      ...styles.metricCard, 
                      cursor: 'pointer',
                      borderColor: flagsHovered ? 'var(--accent-danger)' : 'var(--glass-border)',
                      boxShadow: flagsHovered ? 'var(--glow-danger)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={() => setFlagsHovered(true)}
                    onMouseLeave={() => setFlagsHovered(false)}
                    onClick={() => {
                      setShowFlagsList(true);
                      setSelectedAccount(null);
                    }}
                    title="Click to view all flagged accounts"
                  >
                    <span style={{...styles.metricVal, color: visibleFlagsCount > 0 ? 'var(--accent-danger)' : 'var(--accent-success)'}}>
                      {visibleFlagsCount}
                    </span>
                    <span style={styles.metricLbl}>Hawala Flags</span>
                  </div>
                </div>

                {/* AI Case Insights Panel */}
                {graphData.ai_insight && (
                  <div style={styles.aiInsightSection}>
                    <h5 style={styles.aiInsightHeader}>🛡️ AI Case Insights</h5>
                    <div style={styles.aiInsightList}>
                      {parseAiInsight(graphData.ai_insight).map((item, idx) => (
                        <div 
                          key={idx} 
                          style={{
                            ...styles.aiInsightItem,
                            borderLeftColor: getBorderColor(item.title),
                            backgroundColor: getBgColor(item.title)
                          }}
                        >
                          <span style={{
                            ...styles.aiInsightItemTitle,
                            color: getBorderColor(item.title)
                          }}>
                            {item.title}
                          </span>
                          <p style={styles.aiInsightItemText}>{item.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Visual Node Legend */}
                <div style={styles.legendSection}>
                  <h5 style={styles.legendTitle}>Node Classification</h5>
                  <div style={styles.legendGrid}>
                    <div style={styles.legendItem}>
                      <span style={{...styles.legendDot, background: '#2563eb'}}/> 
                      Suspect Node
                    </div>
                    <div style={styles.legendItem}>
                      <span style={{...styles.legendDot, background: '#8b5cf6', borderRadius: '0', transform: 'rotate(45deg)'}}/> 
                      Syndicate Center Node
                    </div>
                    <div style={styles.legendItem}>
                      <span style={{...styles.legendDot, background: '#14b8a6', borderRadius: '0', borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '10px solid #14b8a6', width: '0', height: '0', backgroundColor: 'transparent'}}/> 
                      Sub-Location Node
                    </div>
                    <div style={styles.legendItem}>
                      <span style={{...styles.legendDot, background: '#475569', borderRadius: '0'}}/> 
                      Crime Incident Node
                    </div>
                    <div style={styles.legendItem}>
                      <span style={{...styles.legendDot, background: '#10b981'}}/> 
                      Active Bank Account
                    </div>
                    <div style={styles.legendItem}>
                      <span style={{...styles.legendDot, background: '#ef4444'}}/> 
                      Flagged/Hawala Account
                    </div>
                  </div>
                </div>
              </>
            )}
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
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  searchInput: {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--glass-border)',
    borderRadius: '4px',
    padding: '7px 14px',
    color: 'white',
    fontSize: '12.5px',
    outline: 'none',
    width: '380px',
    transition: 'border-color 0.2s ease',
  },
  searchBtn: {
    background: 'linear-gradient(135deg, var(--accent-blue) 0%, #1d4ed8 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '7px 14px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  resetBtn: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--glass-border)',
    borderRadius: '4px',
    padding: '7px 14px',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    cursor: 'pointer',
  },
  mainGrid: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  graphWrapper: {
    flex: 1,
    height: '100%',
    position: 'relative' as const,
  },
  loader: {
    position: 'absolute' as const,
    top: '12px',
    left: '12px',
    background: 'var(--glass-bg)',
    backdropFilter: 'blur(8px)',
    border: '1px solid var(--accent-cyan)',
    padding: '8px 16px',
    borderRadius: '4px',
    color: 'var(--accent-cyan)',
    fontSize: '11px',
    fontFamily: 'monospace',
    zIndex: 10,
    boxShadow: 'var(--glow-cyan)',
  },
  instructionLegend: {
    position: 'absolute' as const,
    bottom: '12px',
    left: '12px',
    background: 'rgba(5, 8, 14, 0.85)',
    border: '1px solid var(--glass-border)',
    padding: '8px 16px',
    borderRadius: '4px',
    color: 'var(--text-secondary)',
    fontSize: '11.5px',
    zIndex: 10,
  },
  summaryPanel: {
    width: '320px',
    height: '100%',
    borderLeft: '1px solid var(--glass-border)',
    background: 'rgba(8, 12, 20, 0.6)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
    overflowY: 'auto' as const,
  },
  summaryTitle: {
    fontSize: '14px',
    textTransform: 'uppercase' as const,
    color: 'var(--text-primary)',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--glass-border)',
    paddingBottom: '8px',
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  metricCard: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--glass-border)',
    padding: '12px',
    borderRadius: '6px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '4px',
  },
  metricVal: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: 'var(--accent-cyan)',
    fontFamily: 'var(--font-header)',
  },
  metricLbl: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    fontWeight: 'bold',
  },
  aiInsightSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  aiInsightHeader: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--glass-border)',
    paddingBottom: '8px',
  },
  aiInsightList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  aiInsightItem: {
    borderLeft: '4px solid var(--glass-border)',
    borderRadius: '0 6px 6px 0',
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    transition: 'all 0.2s ease',
  },
  aiInsightItemTitle: {
    fontSize: '11px',
    fontWeight: '800',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  aiInsightItemText: {
    fontSize: '12.5px',
    color: '#e2e8f0',
    lineHeight: '1.5',
    margin: 0,
  },
  legendSection: {
    marginTop: '12px',
  },
  legendTitle: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.03em',
    marginBottom: '12px',
  },
  legendGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  placeholderContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '100%',
    background: '#05080e',
    color: '#ffffff',
    textAlign: 'center' as const,
    padding: '24px',
    border: '1px solid var(--glass-border)',
    borderRadius: '8px',
  },
  placeholderIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  dossierContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    height: '100%',
  },
  dossierHeader: {
    borderBottom: '1px solid var(--glass-border)',
    paddingBottom: '12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  dossierCloseBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--accent-cyan)',
    fontSize: '12px',
    cursor: 'pointer',
    textAlign: 'left' as const,
    padding: 0,
    outline: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontWeight: 'bold',
  },
  dossierTitle: {
    fontSize: '15px',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
    margin: 0,
    textTransform: 'uppercase' as const,
  },
  dossierBody: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '14px',
  },
  dossierField: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  dossierLabel: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    fontWeight: 'bold',
    letterSpacing: '0.05em',
  },
  dossierVal: {
    fontSize: '13.5px',
    color: 'var(--text-primary)',
    fontWeight: '600',
  },
  dossierCode: {
    fontSize: '12.5px',
    color: 'var(--accent-cyan)',
    fontFamily: 'monospace',
  },
  dossierBalance: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
  },
  dossierStatus: {
    alignSelf: 'flex-start',
    fontSize: '11px',
    fontWeight: 'bold',
    padding: '3px 8px',
    borderRadius: '4px',
    border: '1px solid',
    background: 'rgba(255, 255, 255, 0.02)',
  },
  dossierText: {
    fontSize: '12.5px',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
    margin: 0,
  },
  dossierEmptyTxs: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    padding: '16px',
    textAlign: 'center' as const,
    background: 'rgba(255,255,255,0.01)',
    border: '1px dashed var(--glass-border)',
    borderRadius: '6px',
  },
  dossierTxsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  dossierTxCard: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--glass-border)',
    borderLeft: '4px solid',
    borderRadius: '0 6px 6px 0',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  dossierTxHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dossierTxBody: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  flaggedAccCard: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--glass-border)',
    borderRadius: '6px',
    padding: '12px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column' as const,
    transition: 'all 0.2s ease',
    outline: 'none',
  }
};
