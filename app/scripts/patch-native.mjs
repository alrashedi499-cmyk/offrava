// Adds what Offrava needs to the generated iOS / Android projects (safe to run again).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------- iOS: permission texts + background location ----------
const plist = join(root, 'ios/App/App/Info.plist');
if (existsSync(plist)) {
  let s = readFileSync(plist, 'utf8');
  const add = {
    NSLocationWhenInUseUsageDescription: 'Offrava shows your pro on the map during a trip, and finds items near you.',
    NSLocationAlwaysAndWhenInUseUsageDescription: 'Pros and drivers only: during a trip, Offrava shares your location with the customer even when the app is in the background. Sharing stops when the trip ends.',
    NSCameraUsageDescription: 'Take photos for listings, proof of delivery, finished jobs and search by photo.',
    NSPhotoLibraryUsageDescription: 'Choose photos for listings, reviews and your profile.',
    NSPhotoLibraryAddUsageDescription: 'Save receipts and photos you choose to keep.',
    NSMicrophoneUsageDescription: 'Record short videos as proof of a finished job.'
  };
  for (const [k, v] of Object.entries(add)) if (!s.includes(`<key>${k}</key>`)) s = s.replace(/<\/dict>\s*<\/plist>\s*$/, `\t<key>${k}</key>\n\t<string>${v}</string>\n</dict>\n</plist>\n`);
  if (!s.includes('<key>UIBackgroundModes</key>')) s = s.replace(/<\/dict>\s*<\/plist>\s*$/, `\t<key>UIBackgroundModes</key>\n\t<array>\n\t\t<string>location</string>\n\t</array>\n</dict>\n</plist>\n`);
  writeFileSync(plist, s); console.log('iOS Info.plist patched');
}

// ---------- Android: permissions + trip notification text ----------
const manifest = join(root, 'android/app/src/main/AndroidManifest.xml');
if (existsSync(manifest)) {
  let s = readFileSync(manifest, 'utf8');
  const perms = ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_LOCATION', 'POST_NOTIFICATIONS', 'CAMERA', 'VIBRATE'];
  for (const p of perms) if (!s.includes(`android.permission.${p}"`)) s = s.replace('</manifest>', `    <uses-permission android:name="android.permission.${p}" />\n</manifest>`);
  writeFileSync(manifest, s); console.log('AndroidManifest patched');
}
const strings = join(root, 'android/app/src/main/res/values/strings.xml');
if (existsSync(strings)) {
  let s = readFileSync(strings, 'utf8');
  if (!s.includes('capacitor_background_geolocation_notification_channel_name'))
    s = s.replace('</resources>', '    <string name="capacitor_background_geolocation_notification_channel_name">Trip location</string>\n</resources>');
  writeFileSync(strings, s); console.log('strings.xml patched');
}
