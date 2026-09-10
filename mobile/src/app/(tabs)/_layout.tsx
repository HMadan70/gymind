import { View, Text, Pressable } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../context/ThemeContext";
import { fonts, shapeTokens } from "../../constants/theme";

// Glyphs from the design source's `iconChars` map. Kept as text rather
// than an icon font so the bar has no new dependency.
//
// Each carries U+FE0E (variation selector-15) to force *text* presentation.
// Without it the platform renders ⚡ and friends as colour emoji, which
// ignore the `color` style — so the active tab's teal tint applied to the
// label but not the icon.
const TEXT_PRESENTATION = "︎";
const TAB_ICONS: Record<string, string> = {
  index: "⌂" + TEXT_PRESENTATION,
  coach: "✦" + TEXT_PRESENTATION,
  workout: "⚡" + TEXT_PRESENTATION,
  nutrition: "◍" + TEXT_PRESENTATION,
  progress: "▲" + TEXT_PRESENTATION,
};

// Expo Router 57 vendors React Navigation inside its own build output, so
// `@react-navigation/bottom-tabs` isn't resolvable as a public import here.
// Only the handful of fields this bar actually reads are typed.
type TabRoute = { key: string; name: string };

type TabBarProps = {
  state: { index: number; routes: TabRoute[] };
  descriptors: Record<
    string,
    { options: { title?: string; tabBarAccessibilityLabel?: string } }
  >;
  navigation: {
    emit: (event: {
      type: "tabPress";
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

/**
 * Brand 2.0 nav bar, per Gymind UI.dc.html: a floating bar inset from the
 * screen edges, carrying the hero cut-corner shape, with the active tab
 * marked by the brand's diamond motif rather than a filled pill.
 *
 * It is rendered as a normal (non-absolute) tab bar so React Navigation
 * still reserves its height and screen content can never slide underneath
 * it — the floating look comes from the outer padding, not from taking the
 * bar out of the layout.
 */
function BrandTabBar({ state, descriptors, navigation }: TabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: 8,
        // Covers the bottom safe-area inset too, so the home-indicator
        // strip is painted by us rather than left to the navigator.
        paddingBottom: Math.max(insets.bottom, 12) + 10,
        // Was transparent, which let React Navigation's light default
        // background show through as a pale band under the bar. The pill
        // below still floats — it just floats over our own background.
        backgroundColor: colors.bgBase,
      }}
    >
      <View
        style={{
          height: 64,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.navBg,
          borderWidth: 1,
          borderColor: colors.border,
          ...shapeTokens.heroCard,
          // Matches the design's `0 12px 30px -10px rgba(0,0,0,0.35)`.
          shadowColor: "#000000",
          shadowOpacity: 0.35,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 12 },
          elevation: 12,
        }}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const label =
            typeof options.title === "string" ? options.title : route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={onPress}
              style={{
                flex: 1,
                height: "100%",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                // Bias the icon/label up so the active diamond below them
                // has clear space and never sits on the label.
                paddingBottom: 14,
              }}
            >
              <Text style={{ fontSize: 16, color: isFocused ? colors.teal : colors.textDim }}>
                {TAB_ICONS[route.name] ?? "•"}
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: fonts.bodyBold,
                  color: isFocused ? colors.teal : colors.textDim,
                }}
              >
                {label}
              </Text>

              {/* Active marker: the brand's rotated-square diamond, sitting
                  just inside the bar's lower edge under the current tab. */}
              {isFocused && (
                <View
                  style={{
                    position: "absolute",
                    bottom: 6,
                    width: 9,
                    height: 9,
                    borderRadius: 2,
                    backgroundColor: colors.teal,
                    transform: [{ rotate: "45deg" }],
                    shadowColor: colors.teal,
                    shadowOpacity: 0.9,
                    shadowRadius: 6,
                    shadowOffset: { width: 0, height: 0 },
                  }}
                />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bgBase } }}
      tabBar={(props) => <BrandTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="coach" options={{ title: "Coach" }} />
      <Tabs.Screen name="workout" options={{ title: "Workout" }} />
      <Tabs.Screen name="nutrition" options={{ title: "Nutrition" }} />
      <Tabs.Screen name="progress" options={{ title: "Progress" }} />
    </Tabs>
  );
}
