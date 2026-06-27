import axios from 'axios';

// Create a configured Axios instance
const api = axios.create({
  baseURL: '', // Empty because Vite proxy maps /api to localhost:5000
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Crucial for sending secure HttpOnly cookies (refresh tokens)
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor to handle transparent Token Refreshing (RTR)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and it's not a login or registration attempt, and hasn't been retried yet
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/api/v1/auth/login') &&
      !originalRequest.url.includes('/api/v1/auth/register') &&
      !originalRequest.url.includes('/api/v1/auth/refresh')
    ) {
      if (isRefreshing) {
        // Queue the request while token is refreshing
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to rotate tokens via refresh endpoint
        const response = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
        const { accessToken } = response.data.data;

        // Set the new token on the default headers and the failed request
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;

        // Emit new token to waiting requests in the queue
        processQueue(null, accessToken);
        isRefreshing = false;

        // Retry original request
        return api(originalRequest);
      } catch (refreshError) {
        // Rotation failed (token revoked or expired). Clear queue and reject
        processQueue(refreshError, null);
        isRefreshing = false;
        
        // Dispatch a custom event to notify AuthContext to log out the user
        window.dispatchEvent(new Event('auth:session_expired'));
        
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Attaches the access token to the default request authorization headers.
 */
export const setAuthHeader = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

export default api;
