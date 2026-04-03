import axios from 'axios';
import { API_BASE } from '../config';
import { getCookie } from '../utils/cookieUtils';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // Send cookies when making cross-domain requests
});

api.interceptors.request.use((config) => {
  const token = getCookie('csrftoken');
  if (token) {
    config.headers['X-CSRFToken'] = token;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;
