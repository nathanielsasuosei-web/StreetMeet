import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { useRouter } from 'expo-router';
import { useCall } from '../src/state/CallContext';
import Avatar from '../src/components/Avatar';
import { colors } from '../src/theme';

/** Full-screen call UI. Navigated to automatically when a call starts. */
export default function CallScreen() {
  const router = useRouter();
  const call = useCall();

  const minutes = Math.floor(call.seconds / 60);
  const secs = String(call.seconds % 60).padStart(2, '0');
  const label = call.status === 'calling' ? 'Calling…' : call.remoteStream ? `${minutes}:${secs}` : 'Connecting…';

  const leave = () => {
    call.endCall();
    router.back();
  };

  return (
    <View style={styles.root}>
      {call.type === 'VIDEO' && call.remoteStream ? (
        <RTCView streamURL={call.remoteStream.toURL()} style={styles.remote} objectFit="cover" />
      ) : (
        <View style={styles.placeholder}>
          <Avatar user={call.partner} size={110} />
          <Text style={styles.name}>{call.partner?.fullName}</Text>
          <Text style={styles.status}>{label}</Text>
        </View>
      )}

      {call.type === 'VIDEO' && call.localStream && (
        <RTCView streamURL={call.localStream.toURL()} style={styles.local} objectFit="cover" mirror />
      )}

      <View style={styles.controls}>
        <Pressable
          style={[styles.btn, call.muted && styles.btnOff]}
          onPress={call.toggleMute}
        >
          <Text style={styles.btnText}>{call.muted ? '🔇' : '🎤'}</Text>
        </Pressable>

        <Pressable style={[styles.btn, styles.hangup]} onPress={leave}>
          <Text style={styles.btnText}>📵</Text>
        </Pressable>

        {call.type === 'VIDEO' && (
          <Pressable style={[styles.btn, call.cameraOff && styles.btnOff]} onPress={call.toggleCamera}>
            <Text style={styles.btnText}>{call.cameraOff ? '🚫' : '🎥'}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08040f', justifyContent: 'flex-end' },
  remote: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  placeholder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 8 },
  name: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 12 },
  status: { color: colors.muted },
  local: {
    position: 'absolute',
    right: 16,
    top: 70,
    width: 108,
    height: 152,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
  },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 22, paddingBottom: 46 },
  btn: {
    width: 62, height: 62, borderRadius: 31,
    backgroundColor: colors.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  btnOff: { backgroundColor: 'rgba(255,255,255,0.18)' },
  hangup: { backgroundColor: colors.danger },
  btnText: { fontSize: 22 },
});
