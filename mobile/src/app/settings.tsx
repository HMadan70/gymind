import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../constants/theme";
import { API_URL } from "../constants/api";
import { Card } from "../components/Card";
import { Check } from "lucide-react-native";
import { Button } from "../components/Button";
import { authFetch, clearSession } from "../lib/session";
import { useAsyncGuardMap } from "../lib/asyncGuard";

type Me = { id: number; email: string; username: string };

const THEME_OPTIONS: { value: "dark" | "light"; label: string; hint: string; glyph: string }[] = [
  { value: "dark", label: "Dark", hint: "Default — tuned for gym lighting", glyph: "☾" },
  { value: "light", label: "Light", hint: "Higher contrast in daylight", glyph: "☀" },
];

export default function Settings() {
  const { colors, mode, setMode } = useTheme();
  const insets = useSafeAreaInsets();

  const [me, setMe] = useState<Me | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  // Keyed per value, not a single guard: switching dark->light mid-save is
  // a real, distinct choice that must go through, not get dropped by a
  // guard meant only to stop the *same* row being tapped twice.
  const themeGuard = useAsyncGuardMap<"dark" | "light">();

  const loadAccount = useCallback(async () => {
    try {
      const response = await authFetch(`${API_URL}/users/me`);
      if (response.ok) setMe(await response.json());
    } catch {
      // Account details are non-critical here — the rest of the screen
      // (theme, logout) still works offline.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAccount();
    }, [loadAccount])
  );

  const chooseTheme = async (next: "dark" | "light") => {
    setMode(next);
    setStatusMessage("");
    await themeGuard.run(next, async () => {
      try {
        const response = await authFetch(`${API_URL}/users/preferences`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme_mode: next }),
        });
        if (!response.ok) throw new Error("save failed");
      } catch {
        // The switch still applies for this session; only persistence failed.
        setStatusMessage("Theme changed, but couldn't be saved to your account.");
      }
    });
  };

  // Normally just pops back to Home. Falls back to replacing with the tab
  // group when there's no history to pop — e.g. /settings opened directly
  // as a deep link, where router.back() would be a no-op and strand you.
  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  };

  const logout = async () => {
    await clearSession();
    router.replace("/login");
  };

  return (
    <LinearGradient
      colors={[colors.gradientTop, colors.bgBase, colors.bgBase, colors.gradientBottom]}
      locations={[0, 0.3, 0.7, 1]}
      style={{ flex: 1 }}
    >
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 6 }}>
        {/* Settings is pushed from Home's gear and the whole Stack runs
            headerShown:false, so there's no system back button — this is
            the only way out. Same "‹ <destination>" text link register.tsx
            uses to get back to login. */}
        <Pressable onPress={goBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back to Home">
          <Text style={{ color: colors.textDim, fontSize: 13, marginBottom: 20, fontFamily: fonts.body }}>
            ‹ Home
          </Text>
        </Pressable>

        <Text style={{ color: colors.textDim, fontSize: 12, letterSpacing: 0.72, fontFamily: fonts.bodyBold }}>
          PREFERENCES
        </Text>
        <Text style={{ color: colors.textPrimary, fontSize: 22, fontFamily: fonts.heading }}>Settings</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 14, paddingHorizontal: 20, paddingBottom: 40, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Appearance */}
        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontFamily: fonts.bodyBold }}>Appearance</Text>

          {THEME_OPTIONS.map((option) => {
            const selected = mode === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => chooseTheme(option.value)}
                disabled={themeGuard.isPending(option.value)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  padding: 16,
                  borderRadius: 20,
                  borderWidth: 1.5,
                  borderColor: selected ? colors.teal : colors.border,
                  backgroundColor: selected ? colors.tealSoft : colors.bgCard,
                  opacity: themeGuard.isPending(option.value) ? 0.6 : 1,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 99,
                    backgroundColor: selected ? colors.teal : colors.bgInset,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 16, color: selected ? colors.tealOn : colors.textPrimary }}>
                    {option.glyph}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 15, fontFamily: fonts.bodyBold }}>
                    {option.label}
                  </Text>
                  <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2, fontFamily: fonts.body }}>
                    {option.hint}
                  </Text>
                </View>

                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 99,
                    borderWidth: 1,
                    borderColor: selected ? colors.teal : colors.border,
                    backgroundColor: selected ? colors.teal : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selected && <Check size={13} color={colors.tealOn} />}
                </View>
              </Pressable>
            );
          })}

          {statusMessage !== "" && (
            <Text style={{ color: colors.warning, fontSize: 12, fontFamily: fonts.body }}>{statusMessage}</Text>
          )}
        </View>

        {/* Account */}
        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontFamily: fonts.bodyBold }}>Account</Text>

          <Card shape="secondary" style={{ padding: 18, borderWidth: 1, borderColor: colors.border, gap: 12 }}>
            <View>
              <Text style={{ color: colors.textDim, fontSize: 11, letterSpacing: 0.55, fontFamily: fonts.bodyExtra }}>
                USERNAME
              </Text>
              <Text style={{ color: colors.textPrimary, fontSize: 15, marginTop: 2, fontFamily: fonts.bodyBold }}>
                {me?.username ?? "—"}
              </Text>
            </View>

            <View>
              <Text style={{ color: colors.textDim, fontSize: 11, letterSpacing: 0.55, fontFamily: fonts.bodyExtra }}>
                EMAIL
              </Text>
              <Text style={{ color: colors.textPrimary, fontSize: 15, marginTop: 2, fontFamily: fonts.body }}>
                {me?.email ?? "—"}
              </Text>
            </View>
          </Card>

          <Button label="Log out" onPress={logout} variant="danger" size="lg" />
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
