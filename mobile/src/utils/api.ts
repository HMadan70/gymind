// src/utils/api.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../constants/api";

// Thin wrapper around fetch() that attaches the stored JWT and parses JSON.
// Existing screens (workout.tsx, login/register) build this by hand inline
// per call - this helper is only used by the newer screens (Home,
// Nutrition, Progress) to avoid repeating the same six lines everywhere;
// it doesn't change any existing call site.
export async function authFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await AsyncStorage.getItem("token");
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} failed: ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}
