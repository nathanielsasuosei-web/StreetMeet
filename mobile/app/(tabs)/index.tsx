import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Image, PanResponder, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, Button, Muted } from '../../src/components/Ui';
import { colors } from '../../src/theme';
import { discoverApi, type Profile } from '../../src/lib/api';
import { useAuth } from '../../src/state/AuthContext';

const { width } = Dimensions.get('window');
const CARD_WIDTH = Math.min(width - 32, 380);

export default function Discover() {
  const { likes, setUser } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const position = useRef(new Animated.ValueXY()).current;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await discoverApi.feed(20);
      setProfiles(data.profiles ?? []);
    } catch (error: any) {
      Alert.alert('Could not load profiles', error?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const swipe = async (direction: 'left' | 'right' | 'up') => {
    const profile = profiles[0];
    if (!profile) return;

    Animated.timing(position, {
      toValue: { x: direction === 'left' ? -500 : direction === 'right' ? 500 : 0, y: direction === 'up' ? -700 : 30 },
      duration: 220,
      useNativeDriver: true,
    }).start(async () => {
      position.setValue({ x: 0, y: 0 });
      setProfiles((current) => current.slice(1));

      if (direction === 'left') {
        discoverApi.pass(profile.id).catch(() => {});
        return;
      }
      try {
        const data = await discoverApi.like(profile.id, direction === 'up');
        if (data.matched) {
          Alert.alert("It's a match 💜", `You and ${profile.fullName} liked each other`, [
            { text: 'Keep swiping', style: 'cancel' },
            { text: 'Say hi', onPress: () => router.push(`/chat/${data.matchId}`) },
          ]);
        }
      } catch (error: any) {
        Alert.alert('Out of likes', error?.message ?? 'Try again tomorrow or upgrade');
        setProfiles((current) => [profile, ...current]);
      }
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_event, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dx > 120) swipe('right');
        else if (gesture.dx < -120) swipe('left');
        else if (gesture.dy < -120) swipe('up');
        else Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
      },
    })
  ).current;

  const rotate = position.x.interpolate({
    inputRange: [-300, 0, 300],
    outputRange: ['-12deg', '0deg', '12deg'],
  });

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.brand2} style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  const top = profiles[0];

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Discover</Text>
        <Muted>{likes.remaining} likes left</Muted>
      </View>

      {!top ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 46 }}>🫶🏾</Text>
          <Text style={styles.emptyTitle}>That is everyone for now</Text>
          <Muted style={{ textAlign: 'center' }}>
            Widen your distance in Profile, or come back later - new people join every day.
          </Muted>
          <View style={{ marginTop: 16, width: '70%' }}>
            <Button title="Refresh deck" onPress={load} variant="soft" icon="⚡" />
          </View>
        </View>
      ) : (
        <>
          <View style={styles.deck}>
            <Animated.View
              {...panResponder.panHandlers}
              style={[
                styles.card,
                { transform: [...position.getTranslateTransform(), { rotate }] },
              ]}
            >
              <Image source={{ uri: top.photos?.[0] ?? top.avatarUrl }} style={styles.photo} />
              <View style={styles.overlay}>
                <Text style={styles.name}>
                  {top.fullName}
                  {top.age ? `, ${top.age}` : ''} {top.verified ? '✅' : ''}
                </Text>
                <Muted>📍 {top.city ?? 'Ghana'}{top.distanceKm != null ? ` · ${top.distanceKm} km` : ''}</Muted>
                {!!top.bio && <Text style={styles.bio} numberOfLines={3}>{top.bio}</Text>}
                <View style={styles.chips}>
                  {(top.interests ?? []).slice(0, 3).map((interest) => (
                    <Text key={interest} style={styles.chip}>{interest}</Text>
                  ))}
                </View>
              </View>
            </Animated.View>
          </View>

          <View style={styles.actions}>
            <Button title="✕" variant="ghost" onPress={() => swipe('left')} />
            <Button title="⭐" variant="soft" onPress={() => swipe('up')} />
            <Button title="💜" onPress={() => swipe('right')} />
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  heading: { color: colors.text, fontSize: 22, fontWeight: '800' },
  deck: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    width: CARD_WIDTH,
    height: '92%',
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  photo: { width: '100%', height: '100%' },
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 18, backgroundColor: 'rgba(6,3,14,0.75)' },
  name: { color: '#fff', fontSize: 24, fontWeight: '800' },
  bio: { color: 'rgba(255,255,255,0.85)', marginTop: 6 },
  chips: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  chip: { color: '#e9d5ff', backgroundColor: 'rgba(124,58,237,0.35)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  actions: { flexDirection: 'row', justifyContent: 'space-evenly', paddingVertical: 14, gap: 10 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
});
