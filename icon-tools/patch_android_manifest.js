#!/usr/bin/env node
/*
 * Injects activity-alias entries for the alternate icons into AndroidManifest.xml.
 * Idempotent: skips aliases already present.
 *
 * The default MainActivity stays enabled. Aliases start disabled — flutter_dynamic_icon_plus
 * flips them at runtime via PackageManager.
 */

const fs = require('fs');
const path = require('path');

const MANIFEST = '/Users/tmgnr/poteau-workspace/poteau-app/android/app/src/main/AndroidManifest.xml';

const ALIASES = [
  { name: '.PoteauLegacyAlias', icon: '@mipmap/poteau_legacy', round: '@mipmap/poteau_legacy_round' },
  { name: '.KrankLegacyAlias',  icon: '@mipmap/krank_legacy',  round: '@mipmap/krank_legacy_round'  },
];

function aliasBlock({ name, icon, round }) {
  return `        <activity-alias
            android:name="${name}"
            android:enabled="false"
            android:exported="true"
            android:icon="${icon}"
            android:roundIcon="${round}"
            android:label="Poteau"
            android:targetActivity=".MainActivity">
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity-alias>`;
}

function main() {
  let xml = fs.readFileSync(MANIFEST, 'utf8');

  // Find the closing </application> tag to insert before it.
  const closeTag = '</application>';
  const closeIdx = xml.indexOf(closeTag);
  if (closeIdx === -1) {
    console.error('Could not find </application> in manifest');
    process.exit(1);
  }

  // READ_MEDIA_IMAGES / READ_MEDIA_VIDEO: FlutterFlow re-adds these on every
  // export, but Play policy (enforced 2026-07-23) rejects apps that declare
  // them when they only need one-time media access via image_picker (which
  // routes through the Android 13+ Photo Picker with no permission needed).
  // Strip both uses-permission entries if present.
  let mediaPermsStripped = 0;
  const mediaPermRe = /\s*<uses-permission\s+android:name="android\.permission\.(READ_MEDIA_IMAGES|READ_MEDIA_VIDEO)"\s*\/>/g;
  const beforeStrip = xml;
  xml = xml.replace(mediaPermRe, '');
  // Also strip the "Specific media permissions for Android 13 and higher" comment
  // that flutter_launcher_icons doesn't touch but FF re-adds alongside.
  xml = xml.replace(/\s*<!-- Specific media permissions for Android 13 and higher -->/g, '');
  if (xml !== beforeStrip) {
    mediaPermsStripped = (beforeStrip.match(mediaPermRe) || []).length;
  }

  // Portrait lock: flutter_launcher_icons rewrites the MainActivity block on
  // every run and drops android:screenOrientation="portrait". Re-inject it if
  // missing so users can never rotate the app on Android.
  let orientationReapplied = 0;
  const mainActivityMatch = xml.match(/<activity([^>]*?android:name="\.MainActivity"[^>]*?)>/s);
  if (mainActivityMatch && !mainActivityMatch[1].includes('android:screenOrientation=')) {
    const originalTag = mainActivityMatch[0];
    // Insert the attribute just before the closing '>'. Match indentation of
    // sibling attributes (12 spaces) for readable output.
    const patched = originalTag.replace(
      /(\n\s+android:hardwareAccelerated="[^"]*")/,
      `$1\n            android:screenOrientation="portrait"`
    );
    if (patched !== originalTag) {
      xml = xml.replace(originalTag, patched);
      orientationReapplied = 1;
    }
  }

  // Android 11+ package visibility for the WhatsApp share button. Without a
  // <queries> block, canLaunchUrl('whatsapp://') returns false even when
  // WhatsApp is installed, so the share silently degrades to the browser
  // fallback. FF does not emit this, so re-inject it on every export.
  let queriesAdded = 0;
  if (!xml.includes('<queries>')) {
    const appTagIdx = xml.indexOf('<application');
    if (appTagIdx === -1) {
      console.error('Could not find <application> in manifest');
      process.exit(1);
    }
    const queriesBlock =
      `    <!-- Android 11+ package visibility. Without this, canLaunchUrl() returns\n` +
      `         false for whatsapp:// even when WhatsApp is installed, and the share\n` +
      `         button silently falls back to the browser. -->\n` +
      `    <queries>\n` +
      `        <package android:name="com.whatsapp"/>\n` +
      `        <package android:name="com.whatsapp.w4b"/>\n` +
      `        <intent>\n` +
      `            <action android:name="android.intent.action.VIEW"/>\n` +
      `            <data android:scheme="https"/>\n` +
      `        </intent>\n` +
      `    </queries>\n`;
    xml = xml.slice(0, appTagIdx) + queriesBlock + xml.slice(appTagIdx);
    queriesAdded = 1;
  }

  const blocks = [];
  let added = 0;
  let skipped = 0;
  let fixed = 0;
  for (const alias of ALIASES) {
    if (xml.includes(`android:name="${alias.name}"`)) {
      // Alias already exists, but `flutter_launcher_icons` rewrites the
      // `android:icon` attribute on every <activity-alias> to point at the
      // default `@mipmap/launcher_icon`. Detect that and reset to our value.
      const aliasMatch = xml.match(
        new RegExp(`(<activity-alias[^>]*?android:name="${alias.name.replace('.', '\\.')}"[^>]*?android:icon=")([^"]+)("[^>]*?>)`, 's')
      );
      if (aliasMatch && aliasMatch[2] !== alias.icon) {
        xml = xml.replace(aliasMatch[0], `${aliasMatch[1]}${alias.icon}${aliasMatch[3]}`);
        fixed++;
      } else {
        skipped++;
      }
      continue;
    }
    blocks.push(aliasBlock(alias));
    added++;
  }
  if (added > 0) {
    // closeIdx may have shifted if `fixed > 0` mutated xml above — recompute.
    const recomputedCloseIdx = xml.indexOf(closeTag);
    const insertion = '\n\n' + blocks.join('\n\n') + '\n\n    ';
    xml = xml.slice(0, recomputedCloseIdx) + insertion + xml.slice(recomputedCloseIdx);
  }

  if (added > 0 || fixed > 0 || orientationReapplied > 0 || mediaPermsStripped > 0 || queriesAdded > 0) {
    fs.writeFileSync(MANIFEST, xml);
  }

  const summary = [];
  if (added > 0) summary.push(`added ${added}`);
  if (fixed > 0) summary.push(`fixed ${fixed} alias icon refs (rewritten by flutter_launcher_icons)`);
  if (orientationReapplied > 0) summary.push(`re-applied portrait lock (stripped by flutter_launcher_icons)`);
  if (mediaPermsStripped > 0) summary.push(`stripped ${mediaPermsStripped} READ_MEDIA_* permission(s) (Play policy)`);
  if (queriesAdded > 0) summary.push(`added <queries> block (WhatsApp package visibility)`);
  if (skipped > 0) summary.push(`skipped ${skipped}`);
  console.log(`AndroidManifest.xml: ${summary.length ? summary.join(', ') : 'no changes'}`);
}

main();
