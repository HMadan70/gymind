// src/constants/api.ts
// Single source of truth for the backend base URL.
//
// This exists because the URL used to be declared separately in five
// files, which let a find/replace strip the "http://" scheme from every
// copy at once - fetch() then rejected before any network call, and the
// generic error handling hid it. One constant means one place to change
// when the host/port moves, and one place to get the scheme right.
//
// The scheme is required - a bare "host:port" string is not a valid URL and
// fetch() will throw on it. Configure this value per environment; never put a
// private server address in the client bundle or source tree.
const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "");

if (!configuredUrl) {
  throw new Error("EXPO_PUBLIC_API_URL must be configured for this build");
}

export const API_URL = configuredUrl;
