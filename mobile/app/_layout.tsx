import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { AuthProvider } from '../src/state/AuthContext';
import { CallProvider } from '../src/state/CallContext';
import IncomingCall from '../src/components/IncomingCall';

export default function RootLayout() {
  return (
    <AuthProvider>
      <CallProvider>
        <View style={{ flex: 1, backgroundColor: '#0d0718' }}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: '#0d0718' },
              headerTintColor: '#f6f4ff',
              headerTitleStyle: { fontWeight: '700' },
              contentStyle: { backgroundColor: '#0d0718' },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ title: 'Log in' }} />
            <Stack.Screen name="register" options={{ title: 'Create account' }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="chat/[matchId]" options={{ title: 'Chat' }} />
            <Stack.Screen name="call" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
          </Stack>
          <IncomingCall />
        </View>
      </CallProvider>
    </AuthProvider>
  );
}
