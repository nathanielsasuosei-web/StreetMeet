import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Ui';
import Avatar from '../../src/components/Avatar';
import { colors } from '../../src/theme';
import { chatApi, matchApi, type Message, type Profile } from '../../src/lib/api';
import { useAuth } from '../../src/state/AuthContext';
import { useCall } from '../../src/state/CallContext';
import { getSocket } from '../../src/lib/socket';

export default function ChatScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { user } = useAuth();
  const call = useCall();

  const [partner, setPartner] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);

  const socket = useMemo(() => getSocket(), []);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    if (!matchId) return;
    (async () => {
      const [{ match }, thread] = await Promise.all([matchApi.get(matchId), chatApi.messages(matchId)]);
      setPartner(match.partner);
      setMessages(thread.messages ?? []);
      chatApi.seen(matchId).catch(() => {});
    })().catch(() => {});
  }, [matchId]);

  useEffect(() => {
    if (!socket || !matchId) return;
    socket.emit('chat:join', { matchId });

    const onMessage = (message: Message) => {
      if ((message as any).matchId !== matchId) return;
      setMessages((current) => [...current, { ...message, fromMe: message.senderId === user?.id }]);
      chatApi.seen(matchId).catch(() => {});
    };
    const onTyping = ({ userId }: { userId: string }) => {
      if (userId !== user?.id) setTyping(true);
    };
    const onStopTyping = () => setTyping(false);

    socket.on('message:new', onMessage);
    socket.on('chat:typing', onTyping);
    socket.on('chat:stopTyping', onStopTyping);

    return () => {
      socket.emit('chat:leave', { matchId });
      socket.off('message:new', onMessage);
      socket.off('chat:typing', onTyping);
      socket.off('chat:stopTyping', onStopTyping);
    };
  }, [socket, matchId, user?.id]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    socket?.emit('chat:stopTyping', { matchId });
    try {
      const data = await chatApi.send(matchId!, body);
      setMessages((current) => [...current, { ...data.message, fromMe: true }]);
    } catch {
      setMessages((current) => [
        ...current,
        { id: `tmp-${Date.now()}`, body, senderId: user?.id ?? '', fromMe: true, createdAt: new Date().toISOString(), mediaType: 'TEXT' },
      ]);
    }
  };

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Avatar user={partner} size={40} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.name}>{partner?.fullName}</Text>
            <Text style={styles.sub}>{typing ? 'typing…' : partner?.city ?? 'natthesisa'}</Text>
          </View>
          <Pressable style={styles.callBtn} onPress={() => partner && call.startCall({ matchId: matchId!, partner, type: 'AUDIO' })}>
            <Text style={{ fontSize: 18 }}>📞</Text>
          </Pressable>
          <Pressable style={styles.callBtn} onPress={() => partner && call.startCall({ matchId: matchId!, partner, type: 'VIDEO' })}>
            <Text style={{ fontSize: 18 }}>🎥</Text>
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 14, gap: 8 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.fromMe ? styles.mine : styles.theirs]}>
              {item.mediaType === 'IMAGE' && item.mediaUrl ? (
                <Image source={{ uri: item.mediaUrl }} style={styles.media} />
              ) : (
                <Text style={styles.bubbleText}>{item.body}</Text>
              )}
              <Text style={styles.time}>
                {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {item.fromMe ? (item.seenAt ? ' · seen' : ' · sent') : ''}
              </Text>
            </View>
          )}
        />

        <View style={styles.composer}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Write a message…"
            placeholderTextColor={colors.muted}
            value={draft}
            onChangeText={(value) => {
              setDraft(value);
              socket?.emit('chat:typing', { matchId });
            }}
          />
          <Pressable style={styles.send} onPress={send}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  name: { color: colors.text, fontWeight: '800', fontSize: 16 },
  sub: { color: colors.muted, fontSize: 12 },
  callBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface2, marginLeft: 8,
  },
  bubble: { maxWidth: '80%', padding: 10, borderRadius: 16, marginBottom: 4 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.brand },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface2 },
  bubbleText: { color: '#fff' },
  time: { color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  media: { width: 220, height: 220, borderRadius: 12 },
  composer: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.line },
  input: {
    backgroundColor: 'rgba(9,5,18,0.6)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.text,
  },
  send: {
    backgroundColor: colors.brand2,
    paddingHorizontal: 18,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
