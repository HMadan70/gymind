import { Tabs } from "expo-router/js-tabs";
import { TabBar } from "../../components/brand/TabBar";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="workout" options={{ title: "Workout" }} />
      <Tabs.Screen name="nutrition" options={{ title: "Nutrition" }} />
      <Tabs.Screen name="progress" options={{ title: "Progress" }} />
      <Tabs.Screen name="coach" options={{ title: "Coach" }} />
      {/* Settings is off the floating 5-tab nav per Brand 2.0 (design has no
          Settings tab) — reached via a header icon on Home instead. See
          PROJECT_STATUS.md Section 17 / Phase 3.5 assumption note. */}
      <Tabs.Screen name="settings" options={{ title: "Settings", href: null }} />
    </Tabs>
  );
}
