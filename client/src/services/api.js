import axios from 'axios';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1', withCredentials: true, headers: { 'Content-Type': 'application/json' } });
api.interceptors.response.use(response => response.data.data, error => Promise.reject(error.response?.data?.error || { message: 'Network request failed' }));
