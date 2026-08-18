#!/usr/bin/env node
/*
 * Copies generated iOS alternate-icon PNGs into ios/Runner/.
 * Apple matches alternate icons by filename in the bundle root, not via
 * Assets.xcassets.
 *
 * Idempotent: overwrites existing files (they're identical if regenerated).
 */

const fs = require('fs');
const path = require('path');

const SRC = '/Users/tmgnr/poteau-workspace/assets/alternate_icons/ios';
const RUNNER = '/Users/tmgnr/poteau-workspace/poteau-app/ios/Runner';

const ICONS = ['PoteauLegacy', 'KrankLegacy'];

function main() {
  for (const iconName of ICONS) {
    const dir = path.join(SRC, iconName);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png'));
    for (const f of files) {
      fs.copyFileSync(path.join(dir, f), path.join(RUNNER, f));
    }
    console.log(`  ${iconName}: copied ${files.length} files to Runner/`);
  }
}

main();
