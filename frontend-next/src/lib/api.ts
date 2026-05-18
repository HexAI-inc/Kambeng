import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

export type AuthUser = {
  id: number;
  full_name: string;
  email: string;
  wave_number: string;
  is_email_verified: boolean;
  role: string;
  is_active: boolean;
  created_at: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/backend";

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retried?: boolean;
};

// Track if we're already refreshing to avoid concurrent refresh requests
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: true,
});

// Response interceptor for auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const axiosError = error as AxiosError;
    const originalRequest = axiosError.config as RetryableRequestConfig | undefined;

    // If 401 and not already retried, attempt refresh
    if (axiosError.response?.status === 401 && originalRequest && !originalRequest._retried) {
      originalRequest._retried = true;

      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = (async () => {
          try {
            const refreshResponse = await fetch("/api/auth/refresh", {
              method: "POST",
              credentials: "include",
            });

            if (refreshResponse.ok) {
              isRefreshing = false;
              refreshPromise = null;
              return true;
            }

            // Refresh failed, redirect to login
            if (typeof window !== "undefined") {
              const currentUrl = new URL(window.location.href);
              window.location.href = `/auth/login?next=${encodeURIComponent(currentUrl.pathname)}`;
            }
            return false;
          } catch {
            // Refresh error, redirect to login
            if (typeof window !== "undefined") {
              const currentUrl = new URL(window.location.href);
              window.location.href = `/auth/login?next=${encodeURIComponent(currentUrl.pathname)}`;
            }
            return false;
          }
        })();
      }

      // Wait for refresh to complete
      if (refreshPromise) {
        const refreshed = await refreshPromise;
        if (refreshed) {
          // Retry original request
          return api(originalRequest);
        }
      }
    }

    return Promise.reject(error);
  }
);

export async function loginWithCredentials(username: string, password: string) {
  const response = await fetch(`/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    credentials: "include",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.detail ?? "Failed to authenticate.");
  }
  return response.json();
}

export async function logoutSession() {
  await fetch(`/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

export async function getMyProfile(): Promise<AuthUser> {
  const response = await fetch(`/api/auth/session`, { credentials: "include" });
  if (!response.ok) {
    throw new Error("Not authenticated");
  }
  const data = (await response.json()) as AuthUser;
  return data;
}
