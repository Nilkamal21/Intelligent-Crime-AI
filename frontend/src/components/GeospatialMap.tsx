import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap, GeoJSON } from 'react-leaflet';
import { analyticsService } from '../services/api';
import type { HotspotMarker } from '../types';
import 'leaflet/dist/leaflet.css';

// Fix for Leaflet default icon issues in React builds
import L from 'leaflet';
// @ts-ignore
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Component to dynamically adjust map view when markers update
const MapRecenter: React.FC<{ markers: HotspotMarker[], isFiltered: boolean }> = ({ markers, isFiltered }) => {
  const map = useMap();
  
  // Force Leaflet size recalculation and correct centering on load/tab switch and filter updates
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize(true);
      map.setView([15.3173, 75.7139], 7.2);
    }, 250);
    return () => clearTimeout(timer);
  }, [map, isFiltered, markers]);

  return null;
};

// Custom Marker Cluster Group Component
const MarkerClusterGroup: React.FC<{
  markers: HotspotMarker[];
  selectedCrime: string;
  selectedYear: string | number;
  getMarkerStyle: (cases: number) => any;
  getRadius: (cases: number) => number;
  lowThreshold: number;
  highThreshold: number;
}> = ({ markers, selectedCrime, selectedYear, getMarkerStyle, getRadius, lowThreshold, highThreshold }) => {
  const map = useMap();
  const clusterGroupRef = useRef<any>(null);

  useEffect(() => {
    if (!map) return;

    // Initialize marker cluster group if not exists
    if (!clusterGroupRef.current) {
      clusterGroupRef.current = (L as any).markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        zoomToBoundsOnClick: true,
        maxClusterRadius: 40, // Clusters dense regions like Bengaluru nicely
        iconCreateFunction: (cluster: any) => {
          const childCount = cluster.getChildCount();
          let c = ' marker-cluster-';

          // Calculate total crime cases within this cluster
          let totalCases = 0;
          const childMarkers = cluster.getAllChildMarkers();
          childMarkers.forEach((marker: any) => {
            if (marker.options && marker.options.casesCount) {
              totalCases += marker.options.casesCount;
            }
          });

          // Determine cluster color class dynamically based on total cases and thresholds
          if (totalCases <= lowThreshold) {
            c += 'small';   // Cyan (Low case volume)
          } else if (totalCases <= highThreshold) {
            c += 'medium';  // Orange (Medium case volume)
          } else {
            c += 'large';   // Red (High case volume)
          }

          return new L.DivIcon({
            html: `
              <div style="
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                width: 100%;
                height: 100%;
                color: #ffffff;
                text-shadow: 0 1px 2px rgba(0,0,0,0.8);
                position: relative;
              ">
                <span style="font-size: 11px; font-weight: 800; line-height: 1.1;">
                  ${totalCases.toLocaleString()}
                </span>
                <span style="
                  font-size: 8px;
                  opacity: 0.8;
                  font-weight: 500;
                  margin-top: 1px;
                ">
                  cases
                </span>
                <div style="
                  position: absolute;
                  top: -6px;
                  right: -6px;
                  background: var(--bg-tertiary);
                  border: 1px solid var(--glass-border);
                  border-radius: 50%;
                  width: 16px;
                  height: 16px;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  font-size: 8px;
                  font-weight: bold;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.5);
                  color: var(--accent-cyan);
                " title="Number of active hotspot points in this cluster">
                  ${childCount}
                </div>
              </div>
            `,
            className: 'marker-cluster' + c,
            iconSize: new L.Point(45, 45),
          });
        }
      });
      map.addLayer(clusterGroupRef.current);
    }

    const clusterGroup = clusterGroupRef.current;
    clusterGroup.clearLayers();

    // Populate markers into cluster group
    markers.forEach((m) => {
      const style = getMarkerStyle(m.cases);
      const radius = getRadius(m.cases);

      // Create circle marker
      const circleMarker = L.circleMarker([m.lat, m.lng], {
        ...style,
        radius: radius,
        // @ts-ignore
        casesCount: m.cases
      });

      // Bind tactical info popup
      const popupContent = `
        <div style="font-family: var(--font-primary, sans-serif); color: #0f172a; min-width: 180px; padding: 2px;">
          <h4 style="font-weight: bold; font-size: 13px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px; color: #0f172a;">
            ${m.sub_location && m.sub_location_kn ? `${m.sub_location} (${m.sub_location_kn})` : (m.sub_location || m.district)}
          </h4>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">
            District: ${m.district}
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px;">
            <span style="color: #64748b;">Cases Filed:</span>
            <span style="text-align: right; color: #0f172a; font-weight: bold;">${m.cases.toLocaleString()}</span>
            
            <span style="color: #64748b;">Crime Category:</span>
            <span style="text-align: right; color: #0f172a;">${m.primary_crime}</span>
            
            <span style="color: #64748b;">Risk Index:</span>
            <span style="text-align: right; color: ${m.risk_score >= 0.35 ? '#ef4444' : m.risk_score >= 0.15 ? '#f59e0b' : '#10b981'}; font-weight: bold;">
              ${m.risk_score.toFixed(2)}
            </span>
          </div>
        </div>
      `;

      circleMarker.bindPopup(popupContent);
      clusterGroup.addLayer(circleMarker);
    });

    return () => {
      // Clean up handled in next render or unmount
    };
  }, [map, markers, selectedCrime, selectedYear, lowThreshold, highThreshold]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (clusterGroupRef.current && map) {
        map.removeLayer(clusterGroupRef.current);
        clusterGroupRef.current = null;
      }
    };
  }, [map]);

  return null;
};

export const GeospatialMap: React.FC = () => {
  const [markers, setMarkers] = useState<HotspotMarker[]>([]);
  const [selectedCrime, setSelectedCrime] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [geoJsonData, setGeoJsonData] = useState<any>(null);

  const crimeTypes = ['Murder', 'Rape', 'Kidnapping', 'Theft', 'Robbery', 'Assault', 'Burglary', 'Cybercrime', 'Dowry Deaths', 'Fraud'];
  const years = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

  // Load Karnataka border GeoJSON
  useEffect(() => {
    fetch('/karnataka.geojson')
      .then((res) => res.json())
      .then((data) => setGeoJsonData(data))
      .catch((err) => console.error('Failed to load karnataka.geojson overlay:', err));
  }, []);

  const fetchHotspots = async () => {
    setLoading(true);
    try {
      const data = await analyticsService.getHotspots(
        selectedCrime || undefined,
        selectedYear || undefined
      );
      setMarkers(data.hotspots || []);
    } catch (err) {
      console.error('Failed to fetch hotspots:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHotspots();
  }, [selectedCrime, selectedYear]);

  // Dynamic Relative Thresholds Calculation for Severity Color Coding
  // 1. Thresholds for Cluster Markers (Total Cases in the cluster)
  const districtTotals = markers.reduce((acc: any, m) => {
    acc[m.district] = (acc[m.district] || 0) + m.cases;
    return acc;
  }, {});
  const caseValues = Object.values(districtTotals) as number[];
  const maxCases = caseValues.length > 0 ? Math.max(...caseValues) : 100;
  const minCases = caseValues.length > 0 ? Math.min(...caseValues) : 0;
  const clusterLowThreshold = minCases + (maxCases - minCases) * 0.33;
  const clusterHighThreshold = minCases + (maxCases - minCases) * 0.66;

  // 2. Thresholds for Individual Markers (Hotspot Case Volume)
  const markerCases = markers.map(m => m.cases);
  const maxMarkerCases = markerCases.length > 0 ? Math.max(...markerCases) : 20;
  const minMarkerCases = markerCases.length > 0 ? Math.min(...markerCases) : 0;
  const markerLowThreshold = minMarkerCases + (maxMarkerCases - minMarkerCases) * 0.33;
  const markerHighThreshold = minMarkerCases + (maxMarkerCases - minMarkerCases) * 0.66;

  // Dynamic marker styling based on relative case volume
  const getMarkerStyle = (cases: number) => {
    let color = 'var(--accent-success)'; // Low (Green)
    if (cases > markerHighThreshold) {
      color = 'var(--accent-danger)'; // High (Red)
    } else if (cases > markerLowThreshold) {
      color = 'var(--accent-warning)'; // Medium (Orange)
    }

    return {
      fillColor: color,
      color: color,
      fillOpacity: 0.45,
      weight: 1.5,
      radius: 12
    };
  };

  const getRadius = (cases: number) => {
    // Math log-scale to keep circles readable
    return Math.max(6, Math.min(30, Math.sqrt(cases) * 1.5));
  };

  return (
    <div style={styles.container}>
      {/* Control panel bar */}
      <div style={styles.controlBar}>
        <h3 style={styles.title}>Geospatial Hotspot Operations</h3>
        
        <div style={styles.filterGroup}>
          <div style={styles.selectWrapper}>
            <label style={styles.label}>Crime Category</label>
            <select 
              value={selectedCrime} 
              onChange={(e) => setSelectedCrime(e.target.value)}
              style={styles.select}
            >
              <option value="">All Crime Categories</option>
              {crimeTypes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={styles.selectWrapper}>
            <label style={styles.label}>Audit Year</label>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : '')}
              style={styles.select}
            >
              <option value="">All Timeline (2014-2025)</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          
          <button onClick={fetchHotspots} style={styles.refreshBtn}>
            🔄 Sync Map
          </button>
        </div>
      </div>

      {/* Map display */}
      <div style={styles.mapWrapper}>
        {loading && <div style={styles.mapLoader}>Synchronizing telemetry...</div>}
        <MapContainer 
          center={[15.3173, 75.7139]} 
          zoom={7.2} 
          minZoom={6.8}
          maxZoom={10}
          maxBounds={[[11.3, 73.8], [18.7, 78.8]]}
          maxBoundsViscosity={1.0}
          style={{ height: '100%', width: '100%', background: '#0b0f19' }}
        >
          {/* Dark-themed tactical base maps */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {/* Karnataka Border GeoJSON Outline Overlay */}
          {geoJsonData && (
            <GeoJSON 
              data={geoJsonData} 
              style={{
                color: 'var(--accent-cyan)', // Tactical cyan border
                weight: 1.2,
                fillColor: 'transparent',
                fillOpacity: 0,
                opacity: 0.35
              }}
            />
          )}

          {/* Marker Cluster Layer */}
          <MarkerClusterGroup 
            markers={markers}
            selectedCrime={selectedCrime}
            selectedYear={selectedYear}
            getMarkerStyle={getMarkerStyle}
            getRadius={getRadius}
            lowThreshold={clusterLowThreshold}
            highThreshold={clusterHighThreshold}
          />
          
          <MapRecenter markers={markers} isFiltered={!!selectedCrime || !!selectedYear} />
        </MapContainer>

        {/* Map Legend */}
        <div style={styles.legend}>
          <div style={styles.legendTitle}>Operations Legend</div>
          
          <div style={styles.legendRow}>
            <span style={{ ...styles.legendIndicator, background: 'rgba(239, 68, 68, 0.45)', border: '1.5px solid var(--accent-danger)', boxShadow: 'var(--glow-danger)' }}></span>
            <span style={styles.legendText}>High Volume (Top 33%)</span>
          </div>
          <div style={styles.legendRow}>
            <span style={{ ...styles.legendIndicator, background: 'rgba(245, 158, 11, 0.45)', border: '1.5px solid var(--accent-warning)', boxShadow: 'var(--glow-warning)' }}></span>
            <span style={styles.legendText}>Medium Volume (Mid 33%)</span>
          </div>
          <div style={styles.legendRow}>
            <span style={{ ...styles.legendIndicator, background: 'rgba(6, 182, 212, 0.45)', border: '1.5px solid var(--accent-cyan)', boxShadow: 'var(--glow-cyan)' }}></span>
            <span style={styles.legendText}>Low Volume (Bottom 33%)</span>
          </div>
          
          <div style={{ ...styles.legendRow, marginTop: '8px', borderTop: '1px solid var(--glass-border)', paddingTop: '8px' }}>
            <div style={styles.legendClusterSample}>
              <span style={{ fontSize: '9px', fontWeight: '800' }}>471</span>
              <span style={{ fontSize: '6px', opacity: 0.8, marginTop: '1px' }}>cases</span>
              <div style={styles.legendClusterBadge}>18</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginLeft: '4px' }}>
              <span style={{ ...styles.legendText, fontWeight: 'bold', color: 'white' }}>Cluster Node</span>
              <span style={{ fontSize: '8px', color: 'var(--text-secondary)' }}>Center: Summed Cases</span>
              <span style={{ fontSize: '8px', color: 'var(--text-secondary)' }}>Badge: Hotspots Grouped</span>
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
  refreshBtn: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--glass-border)',
    borderRadius: '4px',
    padding: '7px 14px',
    color: 'var(--text-primary)',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    marginTop: '12px',
  },
  mapWrapper: {
    flex: 1,
    position: 'relative' as const,
  },
  mapLoader: {
    position: 'absolute' as const,
    top: '12px',
    right: '12px',
    background: 'var(--glass-bg)',
    backdropFilter: 'blur(8px)',
    border: '1px solid var(--accent-cyan)',
    padding: '8px 16px',
    borderRadius: '4px',
    color: 'var(--accent-cyan)',
    fontSize: '11px',
    fontFamily: 'monospace',
    zIndex: 1000,
    boxShadow: 'var(--glow-cyan)',
  },
  legend: {
    position: 'absolute' as const,
    bottom: '24px',
    left: '24px',
    background: 'var(--glass-bg)',
    backdropFilter: 'blur(12px)',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--border-radius-sm)',
    padding: '12px 16px',
    color: 'var(--text-primary)',
    zIndex: 1000,
    boxShadow: '0 8px 32px 0 var(--glass-shadow)',
    width: '240px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  legendTitle: {
    fontSize: '11px',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    color: 'var(--accent-cyan)',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--glass-border)',
    paddingBottom: '4px',
    marginBottom: '2px',
  },
  legendRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  legendIndicator: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  legendText: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
  },
  legendClusterSample: {
    position: 'relative' as const,
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    background: 'rgba(245, 158, 11, 0.25)',
    border: '1px solid rgba(245, 158, 11, 0.8)',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    color: 'white',
    boxShadow: '0 0 8px rgba(245, 158, 11, 0.4)',
    lineHeight: 1.1,
  },
  legendClusterBadge: {
    position: 'absolute' as const,
    top: '-4px',
    right: '-4px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--glass-border)',
    borderRadius: '50%',
    width: '14px',
    height: '14px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: '7px',
    fontWeight: 'bold',
    color: 'var(--accent-cyan)',
  }
};
