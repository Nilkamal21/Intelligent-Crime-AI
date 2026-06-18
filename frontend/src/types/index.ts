export interface UserSession {
  username: string;
  role: 'Investigator' | 'Analyst' | 'Supervisor' | 'Policymaker';
  access_token: string;
}

export interface ChatMessage {
  sender: 'User' | 'Agent';
  text: string;
  timestamp: string;
  language: 'EN' | 'KN';
  evidence_trail?: EvidenceItem[];
}

export interface EvidenceItem {
  type: 'aggregate_stats' | 'suspect_profile' | 'fir_record';
  source: string;
  details: any;
}

export interface NetworkNode {
  id: string;
  label: string;
  type: 'suspect' | 'syndicate' | 'district' | 'crime_incident' | 'bank_account' | 'sub_location';
  size: number;
  // Node type specifics
  recidivism?: number;
  syndicate?: string;
  district?: string;
  year?: number;
  crime_type?: string;
  balance?: number;
  status?: 'Active' | 'Flagged' | 'Frozen';
  sub_location?: string;
  // Additional upgrade properties
  legal_sections?: string;
  convictions?: number;
  cases_reported?: number;
  incident_time_block?: string;
  peak_hour?: number;
  day_profile?: string;
  risk_score?: number;
}

export interface NetworkEdge {
  source: string;
  target: string;
  label: string;
  type: string;
  amount?: number;
  is_suspicious?: boolean;
  txn_id?: string;
  case_id?: string;
}

export interface NetworkGraphData {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  summary: {
    total_nodes: number;
    total_edges: number;
    suspects_count: number;
    cases_count: number;
    accounts_count: number;
    suspicious_tx_count: number;
  };
  ai_insight?: string;
}

export interface HotspotMarker {
  district: string;
  sub_location?: string;
  sub_location_kn?: string;
  lat: number;
  lng: number;
  cases: number;
  risk_score: number;
  primary_crime: string;
}

export interface ForecastRecord {
  year: number;
  cases: number;
  risk_score: number;
  type: 'Historical' | 'Forecasted';
}

export interface EarlyWarningAlert {
  severity: 'CRITICAL' | 'WARNING';
  indicator: string;
  message: string;
  recommended_action: string;
}

export interface ForecastResponse {
  district: string;
  crime_type: string;
  historical: ForecastRecord[];
  forecast: ForecastRecord[];
  early_warnings: EarlyWarningAlert[];
  statistics: {
    historical_mean: number;
    historical_std_dev: number;
    warning_threshold: number;
    r_squared: number;
  };
}

export interface Alert {
  id: string;
  type: 'risk' | 'hotspot' | 'network';
  severity: 'high' | 'medium';
  message: string;
  related_entity_id: string;
  timestamp: string;
}
