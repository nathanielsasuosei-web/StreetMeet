import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen, Button, Card, Muted, inputStyle } from '../../src/components/Ui';
import { colors, NETWORKS, type NetworkId } from '../../src/theme';
import { paymentApi, type Plan } from '../../src/lib/api';
import { useAuth } from '../../src/state/AuthContext';

export default function Premium() {
  const { user, refresh } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [provider, setProvider] = useState('mock');
  const [selected, setSelected] = useState<Plan | null>(null);
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [network, setNetwork] = useState<NetworkId>('mtn');
  const [stage, setStage] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const [reference, setReference] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<string | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await paymentApi.plans();
      setPlans(data.plans ?? []);
      setProvider(data.provider ?? 'mock');
    } catch (error: any) {
      Alert.alert('Could not load plans', error?.message);
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      if (poll.current) clearInterval(poll.current);
    };
  }, [load]);

  const pay = async () => {
    if (!selected) return;
    setStage('pending');
    try {
      const data = await paymentApi.initiate({ planCode: selected.code, phone, network });
      setReference(data.reference);
      setInstructions(data.instructions ?? null);

      let attempts = 0;
      poll.current = setInterval(async () => {
        attempts += 1;
        try {
          const status = await paymentApi.check(data.reference);
          if (status.status === 'SUCCESS') {
            if (poll.current) clearInterval(poll.current);
            setStage('success');
            await refresh();
          }
          if (status.status === 'FAILED' || attempts > 40) {
            if (poll.current) clearInterval(poll.current);
            setStage('failed');
          }
        } catch {
          /* keep polling */
        }
      }, 3000);
    } catch (error: any) {
      setStage('failed');
      Alert.alert('Payment failed', error?.message);
    }
  };

  const close = () => {
    if (poll.current) clearInterval(poll.current);
    setStage('idle');
    setSelected(null);
    setReference(null);
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>natthesisa plans</Text>
        <Muted>Pay with MTN MoMo, Vodafone Cash or AirtelTigo Money. No card needed.</Muted>

        {user?.isPremium && (
          <Card>
            <Muted>
              👑 You are premium until{' '}
              <Text style={{ color: colors.text }}>
                {new Date(user.premiumUntil!).toLocaleDateString()}
              </Text>
            </Muted>
          </Card>
        )}

        {plans.map((plan) => (
          <Card key={plan.id}>
            <View style={styles.planHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.planName}>
                  {plan.name} {plan.popular ? '⭐' : ''}
                </Text>
                <Muted>{plan.tagline}</Muted>
              </View>
              <View>
                <Text style={styles.price}>GH¢{(plan.pricePesewas / 100).toFixed(2)}</Text>
                <Muted style={{ textAlign: 'right' }}>{plan.durationDays}d</Muted>
              </View>
            </View>

            {plan.features.map((feature) => (
              <Text key={feature} style={styles.feature}>✓ {feature}</Text>
            ))}

            <View style={{ marginTop: 12 }}>
              <Button title={`Get ${plan.name}`} onPress={() => setSelected(plan)} variant={plan.popular ? 'primary' : 'soft'} />
            </View>
          </Card>
        ))}

        <Muted style={{ marginTop: 6 }}>
          Payments are processed by {provider === 'mock' ? 'the sandbox provider (no real money)' : provider}.
        </Muted>
      </ScrollView>

      <Modal visible={Boolean(selected)} animationType="slide" onRequestClose={close}>
        <Screen>
          <Text style={styles.heading}>{selected?.name}</Text>
          <Muted>GH¢{((selected?.pricePesewas ?? 0) / 100).toFixed(2)} · {selected?.durationDays} day(s)</Muted>

          {stage === 'idle' && (
            <>
              <Text style={styles.label}>Mobile money number</Text>
              <TextInput
                style={inputStyle}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="0241234567"
                placeholderTextColor={colors.muted}
              />

              <Text style={styles.label}>Network</Text>
              <View style={styles.networks}>
                {NETWORKS.map((option) => (
                  <Pressable
                    key={option.id}
                    style={[styles.network, network === option.id && styles.networkActive]}
                    onPress={() => setNetwork(option.id)}
                  >
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={{ height: 18 }} />
              <Button
                title={`Pay GH¢${((selected?.pricePesewas ?? 0) / 100).toFixed(2)}`}
                onPress={pay}
                disabled={phone.length < 9}
              />
              <View style={{ height: 10 }} />
              <Button title="Cancel" variant="ghost" onPress={close} />
            </>
          )}

          {stage === 'pending' && (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={{ fontSize: 46 }}>📲</Text>
              <Text style={styles.heading}>Waiting for approval</Text>
              <Muted style={{ textAlign: 'center' }}>
                {instructions ?? 'Approve the prompt on your phone with your MoMo PIN.'}
              </Muted>
              <Muted style={{ marginTop: 10, fontSize: 11 }}>{reference}</Muted>
              <View style={{ height: 18 }} />
              <Button title="Cancel" variant="ghost" onPress={close} />
            </View>
          )}

          {stage === 'success' && (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={{ fontSize: 46 }}>🎉</Text>
              <Text style={styles.heading}>Payment confirmed</Text>
              <Muted>{selected?.name} is active on your account.</Muted>
              <View style={{ height: 18 }} />
              <Button title="Start swiping" onPress={close} />
            </View>
          )}

          {stage === 'failed' && (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={{ fontSize: 46 }}>😕</Text>
              <Text style={styles.heading}>Not completed</Text>
              <Muted style={{ textAlign: 'center' }}>
                We could not confirm the payment. Check your MoMo balance and try again.
              </Muted>
              <View style={{ height: 18 }} />
              <Button title="Try again" onPress={() => setStage('idle')} />
              <View style={{ height: 10 }} />
              <Button title="Close" variant="ghost" onPress={close} />
            </View>
          )}
        </Screen>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 14 },
  planHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  planName: { color: colors.text, fontSize: 18, fontWeight: '800' },
  price: { color: colors.accent, fontSize: 20, fontWeight: '800', textAlign: 'right' },
  feature: { color: colors.muted, marginTop: 6 },
  networks: { flexDirection: 'row', gap: 8 },
  network: {
    flex: 1, padding: 11, borderRadius: 12,
    borderWidth: 1, borderColor: colors.line,
    backgroundColor: colors.surface2, alignItems: 'center',
  },
  networkActive: { borderColor: colors.brand, backgroundColor: 'rgba(124,58,237,0.25)' },
});
