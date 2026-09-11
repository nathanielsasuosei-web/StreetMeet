import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../src/theme';

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={styles.container}>
        <Text style={styles.emoji}>💔</Text>
        <Text style={styles.title}>This screen does not exist</Text>
        <Link href="/" style={styles.link}>
          Back to natthesisa
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: colors.bg },
  emoji: { fontSize: 46 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', marginVertical: 10 },
  link: { color: colors.brand2, fontWeight: '700' },
});
