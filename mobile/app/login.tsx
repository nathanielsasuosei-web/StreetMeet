import React, { useState } from 'react';
import { Link, Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { useAuth } from '../src/state/AuthContext';
import { Button, Card, inputStyle } from '../src/components/Ui';
import { colors } from '../src/theme';

export default function Login() {
  const { login, user } = useAuth();
  const [email, setEmail] = useState('demo@natthesisa.app');
  const [password, setPassword] = useState('natthesisa');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Redirect href="/(tabs)" />;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await login({ email: email.trim(), password });
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.message ?? 'Could not log in');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap} style={{ backgroundColor: colors.bg }}>
      <Text style={styles.logo}>❤ natthesisa</Text>

      <Card>
        <Text style={styles.title}>Welcome back</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={inputStyle}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput style={inputStyle} value={password} onChangeText={setPassword} secureTextEntry />

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={{ height: 10 }} />
        <Button title={busy ? 'Logging in…' : 'Log in'} onPress={submit} disabled={busy} loading={busy} />

        <View style={{ height: 16 }} />
        <Link href="/register" asChild>
          <Pressable>
            <Text style={styles.link}>New here? Create an account</Text>
          </Pressable>
        </Link>
      </Card>

      <Text style={styles.demo}>Demo: demo@natthesisa.app / natthesisa</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingTop: 70, justifyContent: 'center', flexGrow: 1 },
  logo: { color: colors.brand2, fontWeight: '800', fontSize: 26, marginBottom: 22, textAlign: 'center' },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 16 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 10 },
  error: { color: '#fca5a5', marginTop: 10 },
  link: { color: colors.brand2, textAlign: 'center', fontWeight: '700' },
  demo: { color: colors.muted, textAlign: 'center', marginTop: 18, fontSize: 12 },
});
