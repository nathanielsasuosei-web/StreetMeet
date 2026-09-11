import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useCall } from '../state/CallContext';
import Avatar from './Avatar';
import { useAuth } from '../state/AuthContext';
import { colors } from '../theme';

/**
 * Listens for the "ringing" state and shows the incoming-call sheet.
 * Rendered once, at the root of the app.
 */
export default function IncomingCall() {
  const call = useCall();
  const router = useRouter();
  const { user } = useAuth();

  const ringing = call.status === 'ringing';
  const onCall = call.status === 'calling' || call.status === 'active';

  // Auto-open the call screen when the current user starts a call
  useEffect(() => {
    if (onCall && router) {
      router.push('/call');
    }
  }, [onCall, router, user?.id]);

  return (
    <Modal visible={ringing} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Avatar user={call.partner} size={96} />
          <Text style={styles.name}>{call.partner?.fullName}</Text>
          <Text style={styles.label}>
            Incoming {call.type === 'VIDEO' ? 'video' : 'voice'} call…
          </Text>

          <View style={styles.row}>
            <Pressable style={[styles.btn, styles.decline]} onPress={call.rejectCall}>
              <Text style={styles.icon}>📵</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.accept]}
              onPress={async () => {
                await call.acceptCall();
                router.push('/call');
              }}
            >
              <Text style={styles.icon}>📞</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,2,12,0.92)', alignItems: 'center', justifyContent: 'center' },
  panel: {
    width: '86%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 26,
    padding: 26,
    alignItems: 'center',
  },
  name: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 12 },
  label: { color: colors.muted, marginTop: 4 },
  row: { flexDirection: 'row', gap: 22, marginTop: 22 },
  btn: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
  accept: { backgroundColor: colors.ok },
  decline: { backgroundColor: colors.danger },
  icon: { fontSize: 24 },
});
