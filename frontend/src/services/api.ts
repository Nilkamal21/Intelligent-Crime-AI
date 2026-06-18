import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to automatically attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('ksp_access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to clear expired tokens and force re-login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('ksp_access_token');
      localStorage.removeItem('ksp_role');
      localStorage.removeItem('ksp_username');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default api;

export const authService = {
  login: async (username: string, password: string) => {
    const response = await api.post('/api/auth/login', { username, password });
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/api/auth/me');
    return response.data;
  },
  getAuditLogs: async () => {
    const response = await api.get('/api/auth/audit-logs');
    return response.data;
  }
};

export const chatService = {
  sendQuery: async (session_id: string, query_text: string, language: string = 'EN') => {
    const response = await api.post('/api/chat/query', { session_id, query_text, language });
    return response.data;
  },
  exportPdfUrl: (session_id: string) => {
    const token = localStorage.getItem('ksp_access_token') || '';
    // Return direct download url appending token as query parameter
    return `${API_BASE_URL}/api/chat/export-pdf/${session_id}?token=${token}`;
  },
  downloadPdf: async (session_id: string) => {
    const response = await api.get(`/api/chat/export-pdf/${session_id}`, {
      responseType: 'blob'
    });
    return response.data;
  }
};

export const networkService = {
  getGraph: async (suspect?: string, syndicate?: string, search_query?: string) => {
    const params: any = {};
    if (suspect) params.suspect_moniker = suspect;
    if (syndicate) params.syndicate_name = syndicate;
    if (search_query) params.search_query = search_query;
    const response = await api.get('/api/network/graph', { params });
    return response.data;
  },
  getSuggestions: async () => {
    const response = await api.get('/api/network/suggestions');
    return response.data;
  }
};

export const analyticsService = {
  getOverview: async (district?: string, year?: number) => {
    const params: any = {};
    if (district) params.district = district;
    if (year) params.year = year;
    const response = await api.get('/api/analytics/overview', { params });
    return response.data;
  },
  getHotspots: async (crime_type?: string, year?: number) => {
    const params: any = {};
    if (crime_type) params.crime_type = crime_type;
    if (year) params.year = year;
    const response = await api.get('/api/analytics/hotspots', { params });
    return response.data;
  },
  getTemporal: async (district?: string) => {
    const params: any = {};
    if (district) params.district = district;
    const response = await api.get('/api/analytics/temporal', { params });
    return response.data;
  },
  getSociological: async (crime_type?: string) => {
    const params: any = {};
    if (crime_type) params.crime_type = crime_type;
    const response = await api.get('/api/analytics/sociological', { params });
    return response.data;
  },
  getRepeatOffenders: async (district?: string, min_recidivism?: number, search?: string, page: number = 1, limit: number = 25) => {
    const params: any = { page, limit };
    if (district) params.district = district;
    if (min_recidivism !== undefined) params.min_recidivism = min_recidivism;
    if (search) params.search = search;
    const response = await api.get('/api/analytics/offenders', { params });
    return response.data;
  }
};

export const forecastingService = {
  predictTrends: async (district: string, crime_type?: string) => {
    const params: any = { district };
    if (crime_type) params.crime_type = crime_type;
    const response = await api.get('/api/forecasting/predict', { params });
    return response.data;
  }
};

export const alertsService = {
  getStandingAlerts: async () => {
    const response = await api.get('/api/alerts/standing');
    return response.data;
  },
  simulateNewFir: async () => {
    const response = await api.post('/api/alerts/simulate');
    return response.data;
  }
};
