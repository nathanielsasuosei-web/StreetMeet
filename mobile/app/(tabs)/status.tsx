import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useFocusEffect } from 'expo-router';
import { Screen, Button, Card, Muted, inputStyle } from '../../src/components/Ui';
import Avatar from '../../src/components/Avatar';
import { colors } from '../../src/theme';
import { statusApi } from '../../src/lib/api';

type StatusItem = {
  id: string;
  caption?: string | null;
  mediaUrl?: string | null;
  mediaType?: string;
  background?: string;
  createdAt: string;
  expiresAt: string;
  viewCount: number;
  seenByMe: boolean;
};

type Group = { user: any; isMine: boolean; unseen: boolean; items: StatusItem[] };

const BACKGROUNDS = ['#7c3aed', '#ec4899', '#f59e0b', '#0ea5e9', '#10b981', '#ef4444'];

/** Video player for video statuses (expo-video). */
function StatusVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.play();
  });
  return <VideoView player={player} style={styles.stageMedia} nativeControls contentFit="contain" />;
}

export default function StatusScreen() {
  const [feed, setFeed] = useState<Group[]>([]);
  const [openGroup, setOpenGroup] = useState<Group | null>(null);
  const [index, setIndex] = useState(0);
  const [composer, setComposer] = useState(false);
  const [caption, setCaption] = useState('');
  const [background, setBackground] = useState(BACKGROUNDS[0]);

  const load = useCallback(async () => {
    try {
      const data = await statusApi.feed();
      setFeed(data.feed ?? []);
    } catch (error: any) {
      Alert.alert('Could not load statuses', error?.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const post = async () => {
    if (!caption.trim()) return;
    try {
      await statusApi.createText({ caption: caption.trim(), background });
      setComposer(false);
      setCaption('');
      load();
    } catch (error: any) {
      Alert.alert('Could not post', error?.message);
    }
  };

  const pickMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to post a status');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const form = new FormData();
    form.append('caption', caption);
    form.append('media', {
      uri: asset.uri,
      name: asset.fileName ?? `status.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
      type: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
    } as any);

    try {
      await statusApi.create(form);
      setComposer(false);
      setCaption('');
      load();
      Alert.alert('Posted', 'Your status disappears in 24 hours');
    } catch (error: any) {
      Alert.alert('Upload failed', error?.message);
    }
  };

  const mine = feed.find((group) => group.isMine);
  const others = feed.filter((group) => !group.isMine);
  const current = openGroup?.items[index];

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Status</Text>
        <Button title="Post" variant="soft" onPress={() => setComposer(true)} icon="＋" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
        <Pressable style={styles.ring} onPress={() => setComposer(true)}>
          <View style={styles.addRing}>
            <Text style={{ fontSize: 26 }}>＋</Text>
          </View>
          <Muted style={{ fontSize: 11 }}>Add</Muted>
        </Pressable>

        {mine && (
          <Pressable
            style={styles.ring}
            onPress={() => {
              setOpenGroup(mine);
              setIndex(0);
            }}
          >
            <View style={styles.ringSeen}>
              <Avatar user={mine.user} size={58} />
            </View>
            <Muted style={{ fontSize: 11 }}>You</Muted>
          </Pressable>
        )}

        {others.map((group) => (
          <Pressable
            key={group.user.id}
            style={styles.ring}
            onPress={() => {
              setOpenGroup(group);
              setIndex(0);
            }}
          >
            <View style={group.unseen ? styles.ringUnseen : styles.ringSeen}>
              <Avatar user={group.user} size={58} />
            </View>
            <Muted style={{ fontSize: 11 }} numberOfLines={1}>
              {group.user.fullName.split(' ')[0]}
            </Muted>
          </Pressable>
        ))}
      </ScrollView>

      {others.map((group) => (
        <Card key={group.user.id}>
          <Pressable
            style={{ flexDirection: 'row', alignItems: 'center' }}
            onPress={() => {
              setOpenGroup(group);
              setIndex(0);
            }}
          >
            <Avatar user={group.user} size={46} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.name}>{group.user.fullName}</Text>
              <Muted numberOfLines={1}>{group.items.at(-1)?.caption ?? 'New status'}</Muted>
            </View>
          </Pressable>
        </Card>
      ))}

      {!others.length && <Muted>No statuses yet. Post one and yours will show first.</Muted>}

      {/* Viewer */}
      <Modal visible={Boolean(openGroup && current)} animationType="fade" onRequestClose={() => setOpenGroup(null)}>
        <View style={styles.viewer}>
          <View style={styles.bars}>
            {(openGroup?.items ?? []).map((item, i) => (
              <View key={item.id} style={[styles.bar, i <= index && { backgroundColor: '#fff' }]} />
            ))}
          </View>

          <View style={styles.viewerHeader}>
            <Avatar user={openGroup?.user} size={36} />
            <Text style={styles.name}>{openGroup?.isMine ? 'You' : openGroup?.user.fullName}</Text>
            <Pressable onPress={() => setOpenGroup(null)} style={{ marginLeft: 'auto' }}>
              <Text style={{ color: colors.text, fontSize: 22 }}>✕</Text>
            </Pressable>
          </View>

          <Pressable
            style={styles.stage}
            onPress={() => {
              if (index < (openGroup?.items.length ?? 1) - 1) setIndex(index + 1);
              else setOpenGroup(null);
            }}
          >
            {current?.mediaType === 'IMAGE' && current.mediaUrl ? (
              <Image source={{ uri: current.mediaUrl }} style={styles.stageMedia} />
            ) : current?.mediaType === 'VIDEO' && current.mediaUrl ? (
              <StatusVideo uri={current.mediaUrl} />
            ) : (
              <View style={[styles.stage, { backgroundColor: current?.background ?? colors.brand }]}>
                <Text style={styles.caption}>{current?.caption}</Text>
              </View>
            )}
            {current?.mediaType === 'TEXT' && <Text style={styles.caption}>{current.caption}</Text>}
          </Pressable>

          <Text style={styles.views}>👁️ {current?.viewCount ?? 0} views</Text>
        </View>
      </Modal>

      {/* Composer */}
      <Modal visible={composer} animationType="slide" onRequestClose={() => setComposer(false)}>
        <Screen>
          <Text style={styles.heading}>Post a status</Text>

          <Text style={styles.label}>What is on your mind?</Text>
          <TextInput
            style={[inputStyle, { minHeight: 100, textAlignVertical: 'top' }]}
            multiline
            maxLength={300}
            value={caption}
            onChangeText={setCaption}
            placeholder="Sunset at Labadi hits different today 🌅"
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>Background</Text>
          <View style={styles.swatches}>
            {BACKGROUNDS.map((color) => (
              <Pressable
                key={color}
                onPress={() => setBackground(color)}
                style={[
                  styles.swatch,
                  { backgroundColor: color, borderWidth: background === color ? 3 : 0 },
                ]}
              />
            ))}
          </View>

          <View style={{ height: 18 }} />
          <Button title="Share status" onPress={post} disabled={!caption.trim()} />
          <View style={{ height: 10 }} />
          <Button title="Add a photo or video" variant="soft" onPress={pickMedia} icon="🖼" />
          <View style={{ height: 10 }} />
          <Button title="Cancel" variant="ghost" onPress={() => setComposer(false)} />
        </Screen>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  heading: { color: colors.text, fontSize: 22, fontWeight: '800' },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 14 },
  name: { color: colors.text, fontWeight: '700' },
  ring: { alignItems: 'center', marginRight: 14, width: 70 },
  ringUnseen: {
    width: 64, height: 64, borderRadius: 32, padding: 3,
    borderWidth: 2, borderColor: colors.brand2, alignItems: 'center', justifyContent: 'center',
  },
  ringSeen: {
    width: 64, height: 64, borderRadius: 32, padding: 3,
    borderWidth: 2, borderColor: colors.surface2, alignItems: 'center', justifyContent: 'center',
  },
  addRing: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center',
  },
  viewer: { flex: 1, backgroundColor: '#05020c' },
  bars: { flexDirection: 'row', gap: 4, padding: 12 },
  bar: { flex: 1, height: 3, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  viewerHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 8 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  stageMedia: { width: '100%', height: '80%', borderRadius: 16 },
  caption: { color: '#fff', fontSize: 24, fontWeight: '700', textAlign: 'center' },
  views: { color: colors.muted, textAlign: 'center', paddingBottom: 30 },
  swatches: { flexDirection: 'row', gap: 10, marginTop: 8 },
  swatch: { width: 34, height: 34, borderRadius: 17, borderColor: '#fff' },
});
