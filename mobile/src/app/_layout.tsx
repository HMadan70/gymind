import { useEffect } from "react";
import {
  Stack,
  ThemeProvider as NavigationThemeProvider,
  DarkTheme,
  DefaultTheme,
  type Theme,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { useSession } from "../lib/session";

// Brand 2.0 typography (BRAND_GUIDE.md "Typography"):
// Space Grotesk 600/700 — headings, screen titles, large numerals.
// Manrope 400-800 — body copy, labels, buttons, inputs.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  const { status } = useSession();

  useEffect(() => {
    if ((fontsLoaded || fontError) && status !== "loading") {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError, status]);

  // Hold the splash until the faces are ready AND the stored-token check has
  // resolved, so the very first frame the user sees already reflects the
  // right route guard instead of flashing a screen it's about to redirect
  // away from.
  if ((!fontsLoaded && !fontError) || status === "loading") return null;

  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}

/**
 * The navigation stack itself, plus the bridge between our ThemeContext and
 * React Navigation's own theme.
 *
 * React Navigation paints anything the screens don't cover — scene
 * containers, the band the tab bar sits in, the bottom safe-area inset —
 * using its theme's `colors.background`. With no theme supplied it falls
 * back to the light DefaultTheme (#f2f2f2), which is what showed as a pale
 * strip under the tab bar in dark mode. Feeding it our own background makes
 * that fallback impossible anywhere in the stack.
 *
 * This is a separate component because it has to call useTheme(), which
 * only works inside the ThemeProvider above it.
 */
function RootNavigator() {
  const { colors, mode } = useTheme();
  const { status, verified } = useSession();

  const base = mode === "dark" ? DarkTheme : DefaultTheme;
  const navigationTheme: Theme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.bgBase,
      card: colors.bgCard,
      text: colors.textPrimary,
      border: colors.border,
      primary: colors.teal,
    },
  };

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* A stored token isn't proof of a live session — checkOnboarding
            calls the backend to confirm it before anything else is
            reachable. `(tabs)`/index.tsx owns "/" outright now (the old
            top-level index.tsx that raced it for that path is gone), so
            without this guard a cold launch with a stale token would land
            straight on Home. */}
        <Stack.Protected guard={status === "signedIn" && !verified}>
          <Stack.Screen name="checkOnboarding" />
        </Stack.Protected>

        <Stack.Protected guard={status === "signedIn" && verified}>
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
          {/* Settings lives outside the tab group — still routed at
              /settings, just not in the bottom nav (the design defines
              five tabs). Reached from Home's top-right button. */}
          <Stack.Screen name="settings" />
        </Stack.Protected>

        <Stack.Protected guard={status === "signedOut"}>
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
        </Stack.Protected>
      </Stack>
    </NavigationThemeProvider>
  );
}
