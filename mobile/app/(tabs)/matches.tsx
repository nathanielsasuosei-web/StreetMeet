import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen, Muted, Card } from '../../src/components/Ui';
import Avatar from '../../src/components/Avatar';
import { colors } from '../../src/theme';
import { matchApi, discoverApi, type MatchSummary, type Profile } from '../../src/lib/api';
import { useAuth } from '../../src/state/AuthContext';

export default function Matches() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [likers, setLikers] = useState<{ premium: boolean; count: number; likers: (Profile & { blurred?: boolean })[] } | null>(null);
  const [tab, setTab] = useState<'matches' | 'likes'>('matches');

  const load = useCallback(async () => {
    try {
      const [matchData, likeData] = await Promise.all([matchApi.list(), discoverApi.likers()]);
      setMatches(matchData.matches ?? []);
      setLikers(likeData);
    } catch (error: any) {
      Alert.alert('Could not load matches', error?.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const renderItem = ({ item }: { item: MatchSummary }) => (
    <Pressable style={styles.item} onPress={() => router.push(`/chat/${item.id}`)}>
      <Avatar user={item.partner} size={54} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.name}>
          {item.partner.fullName}
          {item.partner.age ? `, ${item.partner.age}` : ''} {item.partner.isPremium ? '👑' : ''}
        </Text>
        <Muted numberOfLines={1}>
          {item.lastMessage
            ? `${item.lastMessage.fromMe ? 'You: ' : ''}${item.lastMessage.body ?? '📷 media'}`
            : 'Say hello 👋🏾'}
        </Muted>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );

  return (
    <Screen>
      <View style={styles.tabs}>
        <Pressable onPress={() => setTab('matches')} style={[styles.tab, tab === 'matches' && styles.tabActive]}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Conversations</Text>
        </Pressable>
        <Pressable onPress={() => setTab('likes')} style={[styles.tab, tab === 'likes' && styles.tabActive]}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Likes you ({likers?.count ?? 0})</Text>
        </Pressable>
      </View>

      {tab === 'matches' ? (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 40 }}>💬</Text>
              <Text style={styles.emptyTitle}>No matches yet</Text>
              <Muted style={{ textAlign: 'center' }}>Like a few profiles and they will show up here.</Muted>
            </View>
          }
        />
      ) : (
        <FlatList
          data={likers?.likers ?? []}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          ListHeaderComponent={
            !likers?.premium ? (
              <Card>
                <Muted>
                  🔒 {likers?.count ?? 0} people like you. Go Gold from 20 pesewas to see who they are.
                </Muted>
              </Card>
            ) : null
          }
          renderItem={({ item }) => (
            <Card>
              <View style={{ alignItems: 'center' }}>
                <Avatar user={item.blurred ? { ...item, avatarUrl: null, photos: [] } : item} size={70} />
                <Text style={[styles.name, { marginTop: 8 }]}>
                  {item.fullName}
                  {item.age ? `, ${item.age}` : ''}
                </Text>
                <Muted>{item.city ?? 'Ghana'}</Muted>
                {item.blurred && (
                  <Pressable onPress={() => router.push('/premium')} style={{ marginTop: 8 }}>
                    <Text style={{ color: colors.brand2, fontWeight: '700' }}>Reveal 👑</Text>
                  </Pressable>
                )}
              </View>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.line },
  tabActive: { backgroundColor: 'rgba(124,58,237,0.28)', borderColor: colors.brand },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 10,
  },
  name: { color: colors.text, fontWeight: '700', fontSize: 15 },
  chevron: { color: colors.muted, fontSize: 22 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
});
