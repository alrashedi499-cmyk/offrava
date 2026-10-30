# Offrava app (iPhone & Android)

The app is the Offrava website packaged with **Capacitor 8**, plus native pieces:
background location for live trips, camera, haptics, Android back button, status bar.

- `scripts/prepare-www.mjs` copies the website (one folder up) into `www/` — never secrets or the `supabase/` folder.
- `scripts/patch-native.mjs` adds permission texts (iOS) and permissions (Android) after the native projects are generated.
- `assets/` holds the icon and splash; `@capacitor/assets` makes every size.
- The native projects (`ios/`, `android/`) are generated fresh in the cloud by `.github/workflows/build-app.yml`.

## Live updates (no store review for screen changes)
- `@capgo/capacitor-updater` (self-hosted, manual mode). Nothing is sent to any outside service.
- On every push, `.github/workflows/live-update.yml` runs `scripts/live-bundle.mjs` → `live/live.json` + a zip of the screens on GitHub Pages.
- The app (`native.js`) checks `live.json` when opened, downloads a newer bundle (SHA-256 checked), and switches the next time it goes
  to the background (never during a live trip or while typing). A bundle that doesn't start rolls back automatically.
- When the app gets a new native piece (permission/plugin), raise `offravaNative` in `package.json` and ship a store update —
  older apps then keep their current screens until updated.

## Still needed (owner)
1. Apple Developer Program ($99/yr) → App Store Connect app record `com.offrava.app`, signing certificate + App Store Connect API key (added as GitHub secrets).
2. Google Play Console ($25) → upload key (keystore) added as GitHub secrets.
3. Firebase project → `google-services.json` + `GoogleService-Info.plist` + APNs key, for native push notifications.
