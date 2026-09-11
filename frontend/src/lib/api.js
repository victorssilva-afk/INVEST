import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;
export const WS_URL = `${BACKEND_URL.replace(/^http/, "ws")}/api/ws/monitor`;

const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("invest_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers["X-Public-Base"] = window.location.origin;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.startsWith("/login")) {
      localStorage.removeItem("invest_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export function apiError(err, fallback = "Ocorreu um erro. Tente novamente.") {
  const d = err?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => e.msg || JSON.stringify(e)).join(" ");
  return fallback;
}

export default api;
