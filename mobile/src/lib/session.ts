// src/lib/session.ts
//
// Single source of truth for whether the app has a session, shared between
// the root layout's route guard (_layout.tsx) and any screen that needs to
// sign in/out or make an authenticated request. Built on useSyncExternalStore
// rather than React Context so it can be read and written from plain
// functions (login, logout, authFetch) without a Provider in the tree.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

const TOKEN_KEY = "token";

type Status = "loading" | "signedOut" | "signedIn";

// `verified` tracks whether the current token has actually been confirmed
// against the backend this launch (via checkOnboarding's
// GET /users/onboarding-check) — a token surviving in storage is not proof
// it's still valid. It resets on every sign-in and sign-out, so a fresh
// launch or a fresh login always re-validates before the root layout will
// admit the user past checkOnboarding.
type SessionState = { status: Status; verified: boolean };

let state: SessionState = { status: "loading", verified: false };
const listeners = new Set<() => void>();

function setState(next: SessionState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

// Resolves the stored token once at module init so the root layout's very
// first render already knows whether to wait on "loading". Guarded to skip
// during SSR (Expo Router's web render pass runs this module in a Node
// environment with no `window`, where AsyncStorage's underlying storage
// isn't available) — it only needs to run once the app is actually mounted
// in a browser/native runtime.
if (typeof window !== "undefined") {
  AsyncStorage.getItem(TOKEN_KEY).then((token) => {
    setState({ status: token ? "signedIn" : "signedOut", verified: false });
  });
}

export function useSession() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export async function signIn(token: string) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
  setState({ status: "signedIn", verified: false });
}

export async function clearSession() {
  await AsyncStorage.removeItem(TOKEN_KEY);
  setState({ status: "signedOut", verified: false });
}

// Called once checkOnboarding gets a definitive answer (200 or 403) from the
// backend, i.e. the token itself is good regardless of profile completeness.
export function markVerified() {
  setState({ status: "signedIn", verified: true });
}

// fetch() with the stored token attached. On a 401 (invalid/expired/
// deleted-account token) it clears the session so the root layout's guard
// bounces the user to Login — callers don't need their own 401 handling.
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const response = await fetch(input, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) {
    await clearSession();
  }
  return response;
}
