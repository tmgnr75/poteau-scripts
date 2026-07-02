#!/usr/bin/env node
/*
 * Generates the full export pack for Poteau alternate app icons from 1024x1024 masters.
 *
 * Inputs (in app-icons-2026/):
 *   {key}_master_1024.png         composited master (logo on background, opaque) — used for iOS
 *   {key}_logo_1024.png           logo only on transparent background — also used for iOS marketing
 *   {key}_logo_1024_android.png   logo at smaller bbox (~58%) on transparent — used for Android adaptive
 *                                 (the smaller bbox compensates for launcher mask cropping)
 *
 * Outputs (in assets/alternate_icons/):
 *   ios/{IosName}/AppIcon-{IosName}{...}.png   8 sizes per alternate
 *   android/{key}/foreground/{density}.png     5 densities (transparent bg, padded for adaptive safe zone)
 *   android/{key}/legacy/{density}.png         5 densities (composited, opaque)
 *   android/{key}/background.txt               background hex
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE_DIR = '/Users/tmgnr/poteau-workspace/app-icons-2026';
const OUT_DIR = '/Users/tmgnr/poteau-workspace/assets/alternate_icons';

const ICONS = [
  {
    key: 'poteau_legacy',
    iosName: 'PoteauLegacy',
    backgroundHex: '#0036D6',
  },
  {
    key: 'krank_legacy',
    iosName: 'KrankLegacy',
    backgroundHex: '#0096FF',
  },
];

// iOS sizes: filename suffix -> pixel dimension
// Naming follows Apple's CFBundleAlternateIcons convention.
const IOS_SIZES = [
  { suffix: '@2x',     px: 120 },
  { suffix: '@3x',     px: 180 },
  { suffix: '-29@2x',  px: 58  },
  { suffix: '-29@3x',  px: 87  },
  { suffix: '-40@2x',  px: 80  },
  { suffix: '-40@3x',  px: 120 },
  { suffix: '-20@2x',  px: 40  },
  { suffix: '-20@3x',  px: 60  },
  // iPad app icons (required by App Store validation to avoid ITMS-90892).
  // Naming MUST follow Apple's canonical <size>x<size>@<scale>x pattern
  // (NOT the -<pt>@2x convention used for iPhone alternate icons). App Store
  // validator only recognizes explicit dimension-in-name for iPad sizes.
  { suffix: '76x76@2x',     px: 152 }, // iPad app icon (76pt @2x)
  { suffix: '83.5x83.5@2x', px: 167 }, // iPad Pro app icon (83.5pt @2x)
];

// Android adaptive foreground sizes (logo on transparent, designed for 108dp canvas with 72dp safe zone).
// Source logo gets scaled to occupy ~66% of the canvas (72/108) so it survives launcher mask cropping.
const ANDROID_FG_SIZES = [
  { density: 'mdpi',    px: 108 },
  { density: 'hdpi',    px: 162 },
  { density: 'xhdpi',   px: 216 },
  { density: 'xxhdpi',  px: 324 },
  { density: 'xxxhdpi', px: 432 },
];

// Android legacy fallback (pre-Android 8): composited square icon.
const ANDROID_LEGACY_SIZES = [
  { density: 'mdpi',    px: 48  },
  { density: 'hdpi',    px: 72  },
  { density: 'xhdpi',   px: 96  },
  { density: 'xxhdpi',  px: 144 },
  { density: 'xxxhdpi', px: 192 },
];

function hexToRgb(hex) {
  const m = hex.replace('#', '');
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16),
  };
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function validateInput(filepath) {
  const meta = await sharp(filepath).metadata();
  if (meta.width !== 1024 || meta.height !== 1024) {
    throw new Error(`${filepath} is ${meta.width}x${meta.height}, expected 1024x1024`);
  }
}

async function generateIosSizes(icon) {
  const masterPath = path.join(SOURCE_DIR, `${icon.key}_master_1024.png`);
  const outDir = path.join(OUT_DIR, 'ios', icon.iosName);
  ensureDir(outDir);

  const bg = hexToRgb(icon.backgroundHex);

  for (const { suffix, px } of IOS_SIZES) {
    const filename = `AppIcon-${icon.iosName}${suffix}.png`;
    await sharp(masterPath)
      .resize(px, px, { kernel: sharp.kernel.lanczos3 })
      // Flatten any alpha onto the background color: iOS rejects icons with transparency.
      .flatten({ background: bg })
      .png({ compressionLevel: 9 })
      .toFile(path.join(outDir, filename));
  }
  console.log(`  iOS: ${IOS_SIZES.length} files in ${outDir}`);
}

// Android uses a separately-sized logo (smaller bbox, ~58%) so that after
// adaptive icon launcher cropping the logo isn't too small. The designer
// pre-sized it for the 108dp canvas — we copy the source 1024 directly to
// each density without further safe-zone scaling.
function androidLogoPath(icon) {
  return path.join(SOURCE_DIR, `${icon.key}_logo_1024_android.png`);
}

async function generateAndroidForeground(icon) {
  const logoPath = androidLogoPath(icon);
  const outDir = path.join(OUT_DIR, 'android', icon.key, 'foreground');
  ensureDir(outDir);

  for (const { density, px } of ANDROID_FG_SIZES) {
    await sharp(logoPath)
      .resize(px, px, { kernel: sharp.kernel.lanczos3, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(path.join(outDir, `${density}.png`));
  }
  console.log(`  Android foreground: ${ANDROID_FG_SIZES.length} files in ${outDir}`);
}

async function generateAndroidLegacy(icon) {
  // Composite the Android-sized logo onto the background hex for the
  // pre-Android-8 fallback. This keeps the legacy icon visually consistent
  // with the adaptive icon on modern devices.
  const logoPath = androidLogoPath(icon);
  const outDir = path.join(OUT_DIR, 'android', icon.key, 'legacy');
  ensureDir(outDir);

  const bg = hexToRgb(icon.backgroundHex);

  for (const { density, px } of ANDROID_LEGACY_SIZES) {
    await sharp(logoPath)
      .resize(px, px, { kernel: sharp.kernel.lanczos3 })
      .flatten({ background: bg })
      .png({ compressionLevel: 9 })
      .toFile(path.join(outDir, `${density}.png`));
  }
  console.log(`  Android legacy: ${ANDROID_LEGACY_SIZES.length} files in ${outDir}`);
}

async function writeBackgroundReference(icon) {
  const dir = path.join(OUT_DIR, 'android', icon.key);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, 'background.txt'), `${icon.backgroundHex}\n`);
}

async function main() {
  ensureDir(OUT_DIR);

  for (const icon of ICONS) {
    console.log(`\n${icon.key} (${icon.iosName})`);
    await validateInput(path.join(SOURCE_DIR, `${icon.key}_master_1024.png`));
    await validateInput(path.join(SOURCE_DIR, `${icon.key}_logo_1024.png`));
    await validateInput(path.join(SOURCE_DIR, `${icon.key}_logo_1024_android.png`));
    await generateIosSizes(icon);
    await generateAndroidForeground(icon);
    await generateAndroidLegacy(icon);
    await writeBackgroundReference(icon);
  }

  console.log(`\nDone. Output: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
