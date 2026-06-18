import React, { useState, useEffect } from 'react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  LineChart, Line, BarChart, Bar 
} from 'recharts';
import { analyticsService, forecastingService } from '../services/api';
import type { ForecastResponse } from '../types';

export const AnalyticsBoard: React.FC = () => {
  const [district, setDistrict] = useState('Statewide');
  const [year, setYear] = useState<number | ''>('');
  
  // Dashboard states
  const [overview, setOverview] = useState<any>(null);
  const [sociological, setSociological] = useState<any>(null);
  
  // Forecasting states
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [selectedForecastCrime, setSelectedForecastCrime] = useState<string>('');
  const [loadingForecast, setLoadingForecast] = useState(false);

  const districts = ['Bengaluru Urban', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi', 'Ballari',
    'Shivamogga', 'Tumakuru', 'Udupi', 'Davanagere', 'Raichur', 'Bidar',
    'Kalaburagi', 'Chikkamagaluru', 'Hassan', 'Mandya', 'Kolar', 'Gadag', 'Haveri',
    'Bagalkot', 'Chitradurga', 'Kodagu', 'Yadgir', 'Vijayapura', 'Ramanagara'];
  
  const crimeTypes = ['Murder', 'Rape', 'Kidnapping', 'Theft', 'Robbery', 'Assault', 'Burglary', 'Cybercrime', 'Dowry Deaths', 'Fraud'];
  const years = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

  const fetchOverviewData = async () => {
    try {
      const oData = await analyticsService.getOverview(district || undefined, year || undefined);
      setOverview(oData);
    } catch (err) {
      console.error('Failed to fetch overview metrics:', err);
    }
  };

  const fetchSociologicalData = async () => {
    try {
      const sData = await analyticsService.getSociological();
      setSociological(sData);
    } catch (err) {
      console.error('Failed to fetch sociological correlations:', err);
    }
  };

  const handleRunForecast = async () => {
    setLoadingForecast(true);
    try {
      const fData = await forecastingService.predictTrends(
        district,
        selectedForecastCrime || undefined
      );
      setForecast(fData);
    } catch (err) {
      console.error('Failed to run forecast model:', err);
    } finally {
      setLoadingForecast(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, [district, year]);

  useEffect(() => {
    fetchSociologicalData();
    handleRunForecast(); // Run default forecast
  }, [district]);

  // Combine historical and forecasted data for a single Recharts line path
  const getForecastChartData = () => {
    if (!forecast) return [];
    
    const combined = [];
    // Add historical
    for (const h of forecast.historical) {
      combined.push({
        year: h.year.toString(),
        Historical: h.cases,
        Forecasted: null,
        risk_score: h.risk_score
      });
    }
    
    // Connect forecast to the last historical element for a smooth line connection
    const lastHist = forecast.historical[forecast.historical.length - 1];
    if (lastHist) {
      combined.push({
        year: lastHist.year.toString(),
        Historical: lastHist.cases,
        Forecasted: lastHist.cases,
        risk_score: lastHist.risk_score
      });
    }
    
    // Add forecast
    for (const f of forecast.forecast) {
      combined.push({
        year: f.year.toString(),
        Historical: null,
        Forecasted: f.cases,
        risk_score: f.risk_score
      });
    }
    return combined;
  };

  return (
    <div style={styles.container}>
      {/* Control panel bar */}
      <div style={styles.controlBar}>
        <h3 style={styles.title}>Predictive Analytics & Intelligence Center</h3>
        <div style={styles.filterGroup}>
          <div style={styles.selectWrapper}>
            <label style={styles.label}>District Jurisdiction</label>
            <select value={district} onChange={(e) => setDistrict(e.target.value)} style={styles.select}>
              <option value="Statewide">Statewide (All Jurisdictions)</option>
              {districts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div style={styles.selectWrapper}>
            <label style={styles.label}>Audit Year</label>
            <select value={year} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : '')} style={styles.select}>
              <option value="">All Years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={styles.scrollGrid}>
        {/* Metric cards */}
        {overview && (
          <div style={styles.statsRow}>
            <div className="glass-panel" style={styles.statCard}>
              <span style={styles.statTitle}>Total Cases Filed</span>
              <span style={styles.statVal}>{overview.summary.total_cases.toLocaleString()}</span>
              <span style={styles.statSub}>Official SCRB database records</span>
            </div>
            <div className="glass-panel" style={styles.statCard}>
              <span style={styles.statTitle}>Chargesheet Ratio</span>
              <span style={styles.statVal}>
                {((overview.summary.total_chargesheeted / (overview.summary.total_cases || 1)) * 100).toFixed(1)}%
              </span>
              <span style={styles.statSub}>{overview.summary.total_chargesheeted.toLocaleString()} files processed</span>
            </div>
            <div className="glass-panel" style={styles.statCard}>
              <span style={styles.statTitle}>Judicial Conviction Success</span>
              <span style={styles.statVal}>
                {((overview.summary.total_convictions / (overview.summary.total_chargesheeted || 1)) * 100).toFixed(1)}%
              </span>
              <span style={styles.statSub}>{overview.summary.total_convictions.toLocaleString()} convictions secured</span>
            </div>
            <div className="glass-panel" style={styles.statCard}>
              <span style={styles.statTitle}>Jurisdictional Risk index</span>
              <span style={styles.statVal}>{overview.summary.avg_risk_score.toFixed(3)}</span>
              <span style={styles.statSub}>Average index (0.00 - 1.00)</span>
            </div>
          </div>
        )}

        <div style={styles.chartsGrid}>
          {/* Left Column: Historical Trends */}
          <div style={styles.chartCol}>
            {/* Timeline Line Chart */}
            <div className="glass-panel" style={styles.chartPanel}>
              <h4 style={styles.panelTitle}>Historical Crime Timeline (2014-2025)</h4>
              {overview && (
                <div style={{ height: '240px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height={240} minWidth={0}>
                    <LineChart data={overview.yearly_trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="Year" stroke="var(--text-muted)" fontSize={11} />
                      <YAxis stroke="var(--text-muted)" fontSize={11} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid var(--glass-border)', borderRadius: '6px' }} />
                      <Legend verticalAlign="top" height={36} iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                      <Line type="monotone" dataKey="Cases_Reported" name="Cases Reported" stroke="var(--accent-cyan)" strokeWidth={2.5} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="Convictions" name="Convictions" stroke="var(--accent-success)" strokeWidth={1.5} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Crime Distribution Bar Chart */}
            <div className="glass-panel" style={styles.chartPanel}>
              <h4 style={styles.panelTitle}>Crime Category Distribution</h4>
              {overview && (
                <div style={{ height: '240px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height={240} minWidth={0}>
                    <BarChart data={overview.crime_types} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="Crime_Type" stroke="var(--text-muted)" fontSize={9} interval={0} tickFormatter={(value) => value.substring(0, 10)} />
                      <YAxis stroke="var(--text-muted)" fontSize={11} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid var(--glass-border)' }} />
                      <Bar dataKey="Cases_Reported" name="Cases Reported" fill="rgba(37, 99, 235, 0.65)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Sociological Correlation Panel */}
            <div className="glass-panel" style={styles.chartPanel}>
              <h4 style={styles.panelTitle}>Socio-Demographic Correlations Matrix</h4>
              {sociological && (
                <div>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Sociological Indicator</th>
                        <th style={styles.th}>Correlation with Crime Rate</th>
                        <th style={styles.th}>Threat Level Impact</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={styles.td}>Urbanization Index (Tech/Density)</td>
                        <td style={{...styles.td, color: 'var(--accent-cyan)'}}>{sociological.correlations.urbanization}</td>
                        <td style={styles.td}><span className="badge badge-flagged">Strong Positive</span></td>
                      </tr>
                      <tr>
                        <td style={styles.td}>Regional Migration Index</td>
                        <td style={{...styles.td, color: 'var(--accent-cyan)'}}>{sociological.correlations.migration}</td>
                        <td style={styles.td}><span className="badge badge-flagged">Strong Positive</span></td>
                      </tr>
                      <tr>
                        <td style={styles.td}>Economic Stress Index (Poverty/Inflation)</td>
                        <td style={{...styles.td, color: 'var(--accent-warning)'}}>{sociological.correlations.economic_stress}</td>
                        <td style={styles.td}><span className="badge badge-flagged">Moderate Positive</span></td>
                      </tr>
                      <tr>
                        <td style={styles.td}>Literacy & Higher Education Rate</td>
                        <td style={{...styles.td, color: 'var(--accent-success)'}}>{sociological.correlations.literacy}</td>
                        <td style={styles.td}><span className="badge badge-active">Inverse Correlation</span></td>
                      </tr>
                    </tbody>
                  </table>
                  <div style={styles.sociologicalDisclaimer}>
                    <p>💡 <b>Criminological Insight:</b> {sociological.insights[0]}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Forecasting & Warnings */}
          <div style={styles.chartCol}>
            {/* Forecasting Config Panel */}
            <div className="glass-panel" style={{...styles.chartPanel, ...styles.forecastingConfig}}>
              <h4 style={styles.panelTitle}>AI Trend Forecasting Core</h4>
              <div style={styles.forecastingForm}>
                <div style={styles.selectWrapper}>
                  <label style={styles.label}>Forecast Target Offense</label>
                  <select 
                    value={selectedForecastCrime} 
                    onChange={(e) => setSelectedForecastCrime(e.target.value)}
                    style={styles.select}
                  >
                    <option value="">All Crimes Aggregated</option>
                    {crimeTypes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button 
                  onClick={handleRunForecast} 
                  className="btn-primary" 
                  style={styles.runForecastBtn}
                  disabled={loadingForecast}
                >
                  {loadingForecast ? 'FITTING MODEL...' : 'RUN FORECAST ENGINE'}
                </button>
              </div>
            </div>

            {/* Forecast Area Chart */}
            <div className="glass-panel" style={styles.chartPanel}>
              <h4 style={styles.panelTitle}>
                Regression Projection: {forecast?.crime_type} (2024-2026)
              </h4>
              {forecast && (
                <div style={{ height: '480px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height={480} minWidth={0}>
                    <AreaChart data={getForecastChartData()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorHist" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--accent-blue)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorFore" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--accent-violet)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--accent-violet)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="year" stroke="var(--text-muted)" fontSize={11} />
                      <YAxis stroke="var(--text-muted)" fontSize={11} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid var(--glass-border)' }} />
                      <Legend verticalAlign="top" height={36} iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                      <Area type="monotone" dataKey="Historical" name="Historical Cases" stroke="var(--accent-blue)" strokeWidth={2} fillOpacity={1} fill="url(#colorHist)" />
                      <Area type="monotone" dataKey="Forecasted" name="Projected cases" stroke="var(--accent-violet)" strokeDasharray="5 5" strokeWidth={2} fillOpacity={1} fill="url(#colorFore)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
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
    gap: '16px',
  },
  selectWrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '3px',
  },
  label: {
    fontSize: '9px',
    textTransform: 'uppercase' as const,
    color: 'var(--text-muted)',
    fontWeight: 'bold',
    letterSpacing: '0.05em',
  },
  select: {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--glass-border)',
    borderRadius: '4px',
    padding: '6px 12px',
    color: 'white',
    fontSize: '12.5px',
    outline: 'none',
    cursor: 'pointer',
  },
  scrollGrid: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '20px',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '20px',
  },
  statCard: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  statTitle: {
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    color: 'var(--text-muted)',
    fontWeight: 'bold',
    letterSpacing: '0.05em',
  },
  statVal: {
    fontSize: '26px',
    fontWeight: 'bold',
    color: 'white',
    fontFamily: 'var(--font-header)',
  },
  statSub: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
  },
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
  },
  chartCol: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
    minWidth: 0,
  },
  chartPanel: {
    padding: '24px',
    minWidth: 0,
    overflow: 'hidden',
  },
  panelTitle: {
    fontSize: '13.5px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginBottom: '18px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.03em',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '13px',
    textAlign: 'left' as const,
  },
  th: {
    borderBottom: '1px solid var(--glass-border)',
    padding: '10px 12px',
    color: 'var(--text-muted)',
    fontWeight: 'bold',
  },
  td: {
    borderBottom: '1px solid rgba(255,255,255,0.03)',
    padding: '12px',
    color: 'var(--text-secondary)',
  },
  sociologicalDisclaimer: {
    background: 'rgba(37,99,235,0.05)',
    border: '1px solid rgba(37,99,235,0.15)',
    padding: '12px',
    borderRadius: '6px',
    fontSize: '12px',
    marginTop: '16px',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
  },
  forecastingConfig: {
    background: 'rgba(139,92,246,0.08)',
    border: '1px solid rgba(139,92,246,0.25)',
  },
  forecastingForm: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '16px',
  },
  runForecastBtn: {
    padding: '10px 20px',
    fontSize: '12px',
    background: 'linear-gradient(135deg, var(--accent-violet) 0%, #6d28d9 100%)',
    boxShadow: '0 0 15px rgba(139,92,246,0.3)',
  },
  alertsContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  alertCard: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--glass-border)',
    padding: '16px',
    borderRadius: '6px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  alertHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  alertSeverity: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '9.5px',
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  alertIndicator: {
    fontSize: '12.5px',
    fontWeight: '600',
    color: 'white',
  },
  alertMsg: {
    fontSize: '12.5px',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
  },
  alertRec: {
    background: 'rgba(0,0,0,0.2)',
    padding: '10px',
    borderRadius: '4px',
    fontSize: '11.5px',
    color: 'var(--accent-cyan)',
    border: '1px dashed var(--glass-border)',
  },
  noAlerts: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '36px',
    color: 'var(--text-muted)',
    fontSize: '12.5px',
    textAlign: 'center' as const,
  }
};
