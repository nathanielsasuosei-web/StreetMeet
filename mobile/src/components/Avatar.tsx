import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import type { Profile } from '../lib/api';

export default function Avatar({ user, size = 48 }: { user?: Profile | null; size?: number }) {
  const uri = user?.avatarUrl || user?.photos?.[0];
  const initials = (user?.fullName ?? '?')
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  if (!uri) {
    return (
      <View
        style={[
          styles.fallback,
          { width: size, height: size, borderRadius: size / 2, fontSize: size / 2.6 },
        ]}
      >
        <Text style={[styles.initials, { fontSize: size / 2.6 }]}>{initials}</Text>
      </View>
    );
  }

  return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: '#fff', fontWeight: '800' },
});
