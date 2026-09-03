// src/constants/api.ts
// Single source of truth for the backend base URL.
//
// This exists because the URL used to be declared separately in five
// files, which let a find/replace strip the "http://" scheme from every
// copy at once - fetch() then rejected before any network call, and the
// generic error handling hid it. One constant means one place to change
// when the host/port moves, and one place to get the scheme right.
//
// Host/port per PROJECT_STATUS.md Section 6: the backend container maps
// host port 8001 -> container port 8000, so 8001 is correct from any
// device on the LAN. The scheme is required - a bare "host:port" string
// is not a valid URL and fetch() will throw on it.
export const API_URL = "http://192.168.0.241:8001";
