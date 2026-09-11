import React from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../src/theme';

const ICONS: Record<string, string> = {
  index: '🔥',
  status: '⭕',
  matches: '💬',
  premium: '👑',
  profile: '🙋🏾',
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <View style={styles.iconWrap}>
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{ICONS[name] ?? '•'}</Text>
      {focused && <View style={styles.bar} />}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '800' },
        tabBarStyle: {
          backgroundColor: '#0f091c',
          borderTopColor: colors.line,
          height: 62,
          paddingBottom: 6,
        },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Discover',
          headerTitle: 'natthesisa 🔥',
          tabBarIcon: ({ focused }) => <TabIcon name="index" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="status"
        options={{ title: 'Status', tabBarIcon: ({ focused }) => <TabIcon name="status" focused={focused} /> }}
      />
      <Tabs.Screen
        name="matches"
        options={{ title: 'Matches', tabBarIcon: ({ focused }) => <TabIcon name="matches" focused={focused} /> }}
      />
      <Tabs.Screen
        name="premium"
        options={{ title: 'Plans', tabBarIcon: ({ focused }) => <TabIcon name="premium" focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  bar: { width: 22, height: 3, borderRadius: 3, backgroundColor: colors.brand2 },
});
