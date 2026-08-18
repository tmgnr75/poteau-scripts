#!/usr/bin/env node
/*
 * Copies generated Android icon assets into the right resource folders and
 * writes the adaptive-icon XML and colors.xml entries.
 *
 * Idempotent: overwrites mipmap PNGs (cheap), merges colors.xml additively.
 */

const fs = require('fs');
const path = require('path');

const SRC = '/Users/tmgnr/poteau-workspace/assets/alternate_icons/android';
const ANDROID_RES = '/Users/tmgnr/poteau-workspace/poteau-app/android/app/src/main/res';

const ICONS = ['poteau_legacy', 'krank_legacy'];

const DENSITIES = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function copyLegacyAndForeground(key) {
  for (const density of DENSITIES) {
    const mipmapDir = path.join(ANDROID_RES, `mipmap-${density}`);
    ensureDir(mipmapDir);

    // Legacy composite -> mipmap-{density}/{key}.png
    fs.copyFileSync(
      path.join(SRC, key, 'legacy', `${density}.png`),
      path.join(mipmapDir, `${key}.png`)
    );
    // Reuse legacy as round icon (Android masks it; safe).
    fs.copyFileSync(
      path.join(SRC, key, 'legacy', `${density}.png`),
      path.join(mipmapDir, `${key}_round.png`)
    );
    // Adaptive foreground -> mipmap-{density}/{key}_foreground.png
    fs.copyFileSync(
      path.join(SRC, key, 'foreground', `${density}.png`),
      path.join(mipmapDir, `${key}_foreground.png`)
    );
  }
}

function writeAdaptiveXml(key) {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/${key}_background"/>
    <foreground android:drawable="@mipmap/${key}_foreground"/>
</adaptive-icon>
`;
  const dir = path.join(ANDROID_RES, 'mipmap-anydpi-v26');
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, `${key}.xml`), xml);
  fs.writeFileSync(path.join(dir, `${key}_round.xml`), xml);
}

function readBackgroundHex(key) {
  return fs.readFileSync(path.join(SRC, key, 'background.txt'), 'utf8').trim();
}

function patchColorsXml() {
  const valuesDir = path.join(ANDROID_RES, 'values');
  ensureDir(valuesDir);
  const colorsPath = path.join(valuesDir, 'colors.xml');

  let xml;
  if (fs.existsSync(colorsPath)) {
    xml = fs.readFileSync(colorsPath, 'utf8');
  } else {
    xml = `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>\n`;
  }

  for (const key of ICONS) {
    const hex = readBackgroundHex(key);
    const colorName = `${key}_background`;
    const tag = `<color name="${colorName}">${hex}</color>`;

    if (xml.includes(`name="${colorName}"`)) {
      // Replace existing entry (in case hex changed).
      xml = xml.replace(
        new RegExp(`<color name="${colorName}">[^<]*</color>`),
        tag
      );
    } else {
      xml = xml.replace('</resources>', `    ${tag}\n</resources>`);
    }
  }

  fs.writeFileSync(colorsPath, xml);
  console.log('  colors.xml: updated');
}

function main() {
  for (const key of ICONS) {
    console.log(`Installing Android assets for ${key}`);
    copyLegacyAndForeground(key);
    writeAdaptiveXml(key);
  }
  patchColorsXml();
  console.log('Android assets installed');
}

main();
