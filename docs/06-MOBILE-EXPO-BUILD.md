# Building the Android / iOS app

The Expo app lives in `mobile/`. It talks to the same API as the website.

---

## 1. Point it at your API

```bash
mobile$ cp .env.example .env
```

```env
# local
EXPO_PUBLIC_API_URL=http://localhost:5000

# on a real phone, use your computer's LAN IP (not localhost)
EXPO_PUBLIC_API_URL=http://192.168.1.24:5000

# production (after deploy)
EXPO_PUBLIC_API_URL=https://natthesisa-api.onrender.com
```

> A phone cannot reach your computer's `localhost`. Find your LAN IP with
> `ipconfig` (Windows) or `ip a` (macOS/Linux) and use that.

---

## 2. Run it during development

```bash
mobile$ npm install
mobile$ npm start
```

A QR code appears:

- **Android** → open the **Expo Go** app → *Scan QR code*
- **iOS** → open the **Camera** app → tap the Expo notification

Everything works in Expo Go **except calls** (react-native-webrtc is native code).

---

## 3. Development build (needed for calls)

```bash
mobile$ npm run prebuild       # generates the android/ and ios/ folders
mobile$ npm run android        # compiles and installs on a phone/emulator
```

First build takes 10–20 minutes; later ones are fast.

---

## 4. Build an APK you can send to anyone

No Android Studio needed — EAS builds in the cloud:

```bash
mobile$ npm install -g eas-cli
mobile$ eas login
mobile$ eas build --configure      # creates eas.json (already in the repo)
mobile$ npm run build:apk          # → preview APK, ~15-20 min
```

EAS prints a download link. Install it on any Android phone
(Settings → allow "Install unknown apps" for the browser/Files app).

---

## 5. Release on Google Play

1. **Create the app** in the [Play Console](https://play.google.com/console) ($25 one-time).
   Complete the app details, content rating, data-safety form and target audience.
2. **Build the AAB** (Play Store format):

   ```bash
   mobile$ npm run build:aab        # eas build --profile production --platform android
   ```

3. **Upload** it: either drag the AAB into the Play Console, or

   ```bash
   mobile$ npm run submit:play      # requires google-play-service-account.json
   ```

4. **Fill in the store listing**: title `natthesisa — Dating, Chat & Calls`, short and full
   description, screenshots (phone + 7" tablet), 512×512 icon, privacy policy URL.
5. **Dating apps must declare**: a safety policy, user-reporting mechanism (✅ block + report
   are built in) and a way to contact support.
6. Submit for review → usually approved in 1–3 days.

---

## 6. Release on the App Store

1. Apple Developer account ($99/year) → create an App ID `com.natthesisa.app`.
2. `eas build --platform ios --profile production`
3. `eas submit --platform ios --latest`
4. In [App Store Connect](https://appstoreconnect.apple.com): fill in the listing, add the
   privacy policy, answer the age-rating questionnaire (dating apps are 17+), submit.
5. Apple requires an account-deletion path — add it in Settings (the API already has
   `DELETE /api/auth/me`).

---

## 7. Over-the-air updates

JS-only changes (screens, copy, bug fixes) skip the store review:

```bash
mobile$ eas update --branch production --message "Fix chat scroll"
```

Anything that touches native code (new native module, permissions, app icon) needs a
new build.

---

## 8. App identity checklist before release

- [ ] `app.json`: `name`, `slug`, `package` / `bundleIdentifier`, `version`, `icon`
- [ ] Splash screen and adaptive icon replaced with natthesisa branding
- [ ] `EXPO_PUBLIC_API_URL` points to the **production** API
- [ ] Deep-link scheme `natthesisa://` wired (already in `app.json`)
- [ ] Privacy policy + terms URLs live on your website
- [ ] Account deletion available inside the app
