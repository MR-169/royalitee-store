const API_BASE = 'https://anteater-alienate-cylinder.ngrok-free.dev.ngrok-free.app/api';

const RoyalApi = {
  getToken() {
    return localStorage.getItem('royalitee_token');
  },
  getUser() {
    const raw = localStorage.getItem('royalitee_user');
    return raw ? JSON.parse(raw) : null;
  },
  setSession(token, user) {
    localStorage.setItem('royalitee_token', token);
    localStorage.setItem('royalitee_user', JSON.stringify(user));
  },
  clearSession() {
    localStorage.removeItem('royalitee_token');
    localStorage.removeItem('royalitee_user');
  },

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(options.headers || {})
    };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  async getProducts(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return await this.request(`/products${qs ? `?${qs}` : ''}`);
  }
};
