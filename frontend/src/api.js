import axios from "axios";
import { ACCESS_TOKEN } from "./constants";

const apiUrl = "/choreo-apis/awbo/backend/rest-api-be2/v1.0";

// const API_URL = 'http://127.0.0.1:8000/';

// const api = axios.create({
//   baseURL: import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL : apiUrl,
// });

// Could also do it like this:
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 60000, // 60 second timeout for AI responses
  headers: {
    'Content-Type': 'application/json',
  },
  validateStatus: status => status < 500, // Resolve only if status < 500
});

// Enhanced request interceptor with better token handling
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(ACCESS_TOKEN);
    
    if (token) {
      // Set auth header - use Bearer prefix consistently
      config.headers.Authorization = `Bearer ${token}`;
      console.log(`Request to ${config.url} is authenticated`);
    } else {
      console.warn(`Request to ${config.url} has no auth token`);
      // For debugging purposes, print any available token
      console.log('Available tokens in localStorage:', 
        Object.keys(localStorage)
          .filter(key => key.includes('token') || key === ACCESS_TOKEN)
          .map(key => `${key}: ${localStorage.getItem(key) ? 'present' : 'missing'}`));
    }
    
    return config;
  },
  (error) => {
    console.error("Request interceptor error:", error);
    return Promise.reject(error);
  }
);

// Enhanced response interceptor with error handling
api.interceptors.response.use(
  (response) => {
    // Log successful responses
    console.log(`[API] Success: ${response.config.url}`, response.status);
    return response;
  },
  (error) => {
    // Handle response errors
    console.error(`[API] Error: ${error.config?.url || 'unknown endpoint'}`);
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`, error.response.data);
      
      // Special handling for authentication errors
      if (error.response.status === 401 || error.response.status === 403) {
        console.error("Authentication error - token may be invalid or expired");
        
        // You could trigger a token refresh here if you have refresh token logic
        // For now, just log the issue for debugging
        const token = localStorage.getItem(ACCESS_TOKEN);
        console.log("Current token status:", token ? "present" : "missing");
      }
    } else if (error.request) {
      console.error("No response received:", error.request);
    } else {
      console.error("Error setting up request:", error.message);
    }
    
    return Promise.reject(error);
  }
);

// Add specific configuration for PUT requests
const originalPut = api.put;
api.put = function(url, data, config = {}) {
  const token = localStorage.getItem(ACCESS_TOKEN);
  
  const putConfig = {
    ...config,
    headers: {
      ...config.headers,
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : undefined
    }
  };
  
  // Use explicit JSON.stringify to ensure proper formatting
  return originalPut(url, data, putConfig);
};

export default api;
