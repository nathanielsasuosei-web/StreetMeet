import React, { useState } from 'react';
import { Link, router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../src/state/AuthContext';
import { Button, Card, inputStyle } from '../src/components/Ui';
import { colors } from '../src/theme';

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    gender: 'FEMALE',
    birthDate: '',
    city: 'Accra',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await register({ ...form, birthDate: form.birthDate || undefined });
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.message ?? 'Could not create the account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap} style={{ backgroundColor: colors.bg }}>
      <Text style={styles.logo}>❤ natthesisa</Text>

      <Card>
        <Text style={styles.title}>Create your profile</Text>

        {[
          ['fullName', 'Full name', 'Ama Serwaa'],
          ['email', 'Email', 'you@example.com'],
          ['phone', 'MoMo number', '0241234567'],
          ['password', 'Password', 'At least 8 characters'],
          ['city', 'City', 'Accra'],
        ].map(([key, label, placeholder]) => (
          <View key={key}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
              style={inputStyle}
              value={(form as any)[key]}
              onChangeText={(value) => setForm({ ...form, [key]: value })}
              placeholder={placeholder}
              placeholderTextColor={colors.muted}
              autoCapitalize={key === 'email' ? 'none' : 'words'}
              secureTextEntry={key === 'password'}
              keyboardType={key === 'email' ? 'email-address' : key === 'phone' ? 'phone-pad' : 'default'}
            />
          </View>
        ))}

        <Text style={styles.label}>I am</Text>
        <View style={styles.row}>
          {['FEMALE', 'MALE', 'OTHER'].map((option) => (
            <Button
              key={option}
              title={option === 'FEMALE' ? 'Woman' : option === 'MALE' ? 'Man' : 'Other'}
              variant={form.gender === option ? 'primary' : 'ghost'}
              onPress={() => setForm({ ...form, gender: option })}
            />
          ))}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={{ height: 12 }} />
        <Button title={busy ? 'Creating…' : 'Create account'} onPress={submit} disabled={busy} loading={busy} />

        <View style={{ height: 14 }} />
        <Link href="/login" style={{ color: colors.brand2, textAlign: 'center', fontWeight: '700' }}>
          Already a member? Log in
        </Link>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingTop: 60 },
  logo: { color: colors.brand2, fontWeight: '800', fontSize: 26, marginBottom: 22, textAlign: 'center' },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 12 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 10 },
  error: { color: '#fca5a5', marginTop: 10 },
  row: { flexDirection: 'row', gap: 8 },
});
