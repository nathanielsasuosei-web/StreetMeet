import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, Button, Card, Muted, inputStyle } from '../../src/components/Ui';
import Avatar from '../../src/components/Avatar';
import { colors } from '../../src/theme';
import { profileApi } from '../../src/lib/api';
import { useAuth } from '../../src/state/AuthContext';

export default function ProfileScreen() {
  const { user, likes, refresh, setUser, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    fullName: user?.fullName ?? '',
    bio: user?.bio ?? '',
    city: user?.city ?? '',
    phone: user?.phone ?? '',
    photoUrl: '',
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const data = await profileApi.update({
        fullName: form.fullName,
        bio: form.bio,
        city: form.city,
        phone: form.phone,
        onboarded: true,
      });
      setUser(data.user);
      setEditing(false);
      await refresh();
      Alert.alert('Saved', 'Your profile is up to date');
    } catch (error: any) {
      Alert.alert('Could not save', error?.message);
    } finally {
      setBusy(false);
    }
  };

  const addPhoto = async () => {
    const url = form.photoUrl.trim();
    if (!url) return;
    try {
      const data = await profileApi.update({ photos: [...(user?.photos ?? []), url].slice(0, 6) });
      setUser(data.user);
      setForm({ ...form, photoUrl: '' });
    } catch (error: any) {
      Alert.alert('Could not add the photo', error?.message);
    }
  };

  const signOut = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
          <Avatar user={user} size={110} />
          <Text style={styles.name}>
            {user?.fullName}
            {user?.age ? `, ${user?.age}` : ''} {user?.isPremium ? '👑' : ''}
          </Text>
          <Muted>{user?.city ?? 'Ghana'} · {likes.remaining} likes left today</Muted>
          {!!user?.bio && <Muted style={{ textAlign: 'center', marginTop: 8 }}>{user.bio}</Muted>}

          {!user?.isPremium && (
            <View style={{ marginTop: 12, width: '80%' }}>
              <Button title="Go Gold - from 20p" onPress={() => router.push('/premium')} icon="👑" />
            </View>
          )}
        </View>

        <Card>
          <View style={styles.rowBetween}>
            <Muted>Photos</Muted>
            <Pressable onPress={() => setEditing(true)}>
              <Text style={{ color: colors.brand2, fontWeight: '700' }}>Edit profile</Text>
            </Pressable>
          </View>
          <ScrollView horizontal style={{ marginTop: 10 }}>
            {(user?.photos ?? []).map((uri) => (
              <Avatar key={uri} user={{ ...user!, avatarUrl: uri }} size={70} />
            ))}
            {(user?.photos?.length ?? 0) === 0 && <Muted>No photos yet - add one below.</Muted>}
          </ScrollView>
        </Card>

        <Card>
          <View style={styles.rowBetween}>
            <Muted>Plan</Muted>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{user?.isPremium ? '👑 Gold' : 'Free'}</Text>
          </View>
          <View style={[styles.rowBetween, { marginTop: 10 }]}>
            <Muted>Daily likes</Muted>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{likes.limit}</Text>
          </View>
          <View style={[styles.rowBetween, { marginTop: 10 }]}>
            <Muted>Mobile money</Muted>
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {user?.phone ? `+${user.phone}` : 'not set'}
            </Text>
          </View>
        </Card>

        {editing && (
          <Card>
            <Text style={styles.label}>Name</Text>
            <TextInput style={inputStyle} value={form.fullName} onChangeText={(v) => setForm({ ...form, fullName: v })} />

            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[inputStyle, { minHeight: 90, textAlignVertical: 'top' }]}
              multiline
              maxLength={500}
              value={form.bio}
              onChangeText={(v) => setForm({ ...form, bio: v })}
            />

            <Text style={styles.label}>City</Text>
            <TextInput style={inputStyle} value={form.city} onChangeText={(v) => setForm({ ...form, city: v })} />

            <Text style={styles.label}>MoMo number</Text>
            <TextInput
              style={inputStyle}
              value={form.phone}
              onChangeText={(v) => setForm({ ...form, phone: v })}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Add a photo by URL</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={[inputStyle, { flex: 1 }]}
                value={form.photoUrl}
                onChangeText={(v) => setForm({ ...form, photoUrl: v })}
                placeholder="https://…"
                placeholderTextColor={colors.muted}
              />
              <Button title="Add" onPress={addPhoto} variant="soft" />
            </View>

            <View style={{ height: 14 }} />
            <Button title={busy ? 'Saving…' : 'Save changes'} onPress={save} disabled={busy} loading={busy} />
          </Card>
        )}

        <View style={{ height: 12 }} />
        <Button title="Log out" variant="danger" onPress={signOut} />
        <View style={{ height: 30 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 12 },
});
