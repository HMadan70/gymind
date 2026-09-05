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

// Multipart photo upload (meal photos, progress photos) - deliberately not
// built on authFetch, since fetch/RN needs to set its own multipart
// boundary in the Content-Type header; authFetch always forces
// application/json whenever a body is present, which would break this.
export async function uploadPhoto<T = any>(path: string, imageUri: string): Promise<T> {
  const token = await AsyncStorage.getItem("token");
  const filename = imageUri.split("/").pop() || "photo.jpg";
  const extensionMatch = /\.(\w+)$/.exec(filename);
  const extension = extensionMatch ? extensionMatch[1].toLowerCase() : "jpg";
  const mimeType = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";

  const formData = new FormData();
  formData.append("file", { uri: imageUri, name: filename, type: mimeType } as any);

  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!response.ok) {
    throw new Error(`Photo upload to ${path} failed: ${response.status}`);
  }
  return response.json();
}
