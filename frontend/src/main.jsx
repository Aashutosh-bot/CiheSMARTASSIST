import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Security (I2/AU1): attach the CSRF token to state-changing requests and
// send the user back to the login page when the server says the session is gone.
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  const method = (init.method || "GET").toUpperCase();
  if (url.startsWith("/") && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = document.cookie.split("; ").find(c => c.startsWith("csrf="));
    init = { ...init, headers: { ...(init.headers || {}), "X-CSRF-Token": csrf ? csrf.split("=")[1] : "" } };
  }
  const res = await nativeFetch(input, init);
  const isAuthCall = /^\/api\/(login|admin-login|check-email|set-password|logout)/.test(url);
  if (res.status === 401 && url.startsWith("/api/") && !isAuthCall) {
    ["loggedIn", "role", "studentName", "studentEmail"].forEach(k => localStorage.removeItem(k));
    if (window.location.pathname !== "/") window.location.assign("/");
  }
  return res;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)