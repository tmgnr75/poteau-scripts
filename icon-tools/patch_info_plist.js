#!/usr/bin/env node
/*
 * Adds CFBundleIcons + CFBundleIcons~ipad blocks to Info.plist declaring the
 * alternate icons. Idempotent: if alternates are already declared correctly,
 * exits without writing.
 */

const plist = require('plist');
const fs = require('fs');
const path = require('path');

const INFO_PLIST = '/Users/tmgnr/poteau-workspace/poteau-app/ios/Runner/Info.plist';

const ALTERNATES = ['AppIcon-PoteauLegacy', 'AppIcon-KrankLegacy'];

// Sizes that Apple's App Store validator strictly checks for iPad app icons.
// Base-name resolution (CFBundleIconFiles: [baseName]) is NOT enough — the
// validator won't discover these sizes unless they're explicitly enumerated
// in the iPad block's CFBundleIconFiles array. Missing them causes
// ITMS-90892 warnings on upload.
const IPAD_REQUIRED_SIZES = ['76x76@2x', '83.5x83.5@2x'];

function buildIconsBlock({ ipad } = { ipad: false }) {
  const alternateIcons = {};
  for (const name of ALTERNATES) {
    const files = [name];
    if (ipad) {
      for (const size of IPAD_REQUIRED_SIZES) {
        files.push(`${name}${size}`);
      }
    }
    alternateIcons[name] = {
      CFBundleIconFiles: files,
      UIPrerenderedIcon: false,
    };
  }
  return {
    CFBundlePrimaryIcon: {
      CFBundleIconFiles: ['AppIcon'],
    },
    CFBundleAlternateIcons: alternateIcons,
  };
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function main() {
  const raw = fs.readFileSync(INFO_PLIST, 'utf8');
  const parsed = plist.parse(raw);

  const desiredIphone = buildIconsBlock({ ipad: false });
  const desiredIpad = buildIconsBlock({ ipad: true });
  const currentIphone = parsed.CFBundleIcons;
  const currentIpad = parsed['CFBundleIcons~ipad'];

  if (deepEqual(currentIphone, desiredIphone) && deepEqual(currentIpad, desiredIpad)) {
    console.log('Info.plist already up to date');
    return;
  }

  parsed.CFBundleIcons = desiredIphone;
  parsed['CFBundleIcons~ipad'] = desiredIpad;

  const out = plist.build(parsed);
  fs.writeFileSync(INFO_PLIST, out);
  console.log(`Patched ${INFO_PLIST}`);
}

main();
