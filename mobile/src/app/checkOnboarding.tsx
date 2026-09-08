import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../constants/theme";
import { API_URL } from "../constants/api";
import { Button } from "../components/Button";
import { authFetch, markVerified } from "../lib/session";

export default function CheckOnboarding() {
  const { colors } = useTheme();
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      setFailed(false);
      try {
        const response = await authFetch(`${API_URL}/users/onboarding-check`);
        if (cancelled) return;

        if (response.status === 401) {
          // authFetch already cleared the bad token; the root layout's
          // guard reacts to that and bounces to Login on its own.
          return;
        }

        if (response.ok) {
          markVerified();
          router.replace("/(tabs)");
          return;
        }

        if (response.status === 403) {
          // Valid token, no profile yet.
          markVerified();
          router.replace("/onboarding");
          return;
        }

        // Any other status is unexpected — surface it as unreachable rather
        // than guessing at a destination.
        setFailed(true);
      } catch {
        // Network failure, CORS rejection, etc. — without this the promise
        // rejects unhandled and the user is stranded here indefinitely.
        if (!cancelled) setFailed(true);
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [attempt, router]);

  if (failed) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.bgBase,
          paddingHorizontal: 32,
          gap: 16,
        }}
      >
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontFamily: fonts.bodyBold, textAlign: "center" }}>
          {"Couldn't reach the server"}
        </Text>
        <Text style={{ color: colors.textDim, fontSize: 13, fontFamily: fonts.body, textAlign: "center" }}>
          Check your connection and try again.
        </Text>
        <Button label="Retry" onPress={() => setAttempt((n) => n + 1)} variant="primary" size="lg" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bgBase }}>
      <Text style={{ color: colors.textPrimary }}>Checking your account...</Text>
    </View>
  );
}
