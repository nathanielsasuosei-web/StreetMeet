# natthesisa — mobile app (Expo)

```bash
npm install
cp .env.example .env      # set EXPO_PUBLIC_API_URL
npm start                 # scan the QR with Expo Go
```

Camera + microphone **calls** need a development build (react-native-webrtc is native code):

```bash
npm run prebuild
npm run android
```

Builds:

```bash
npm run build:apk     # preview APK (EAS, no Android Studio needed)
npm run build:aab     # release bundle for Google Play
npm run submit:play   # upload to the Play Store
```

Screens: `app/(tabs)/` → Discover, Status, Matches, Plans, Profile · `app/chat/[matchId]` ·
`app/call` · `app/login` · `app/register`.

Full guide: [../docs/06-MOBILE-EXPO-BUILD.md](../docs/06-MOBILE-EXPO-BUILD.md)
