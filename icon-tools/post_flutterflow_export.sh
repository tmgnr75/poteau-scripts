#!/usr/bin/env bash
#
# Run after every FlutterFlow export of poteau-app to re-apply the alternate
# app icon configuration (FF overwrites Info.plist, AndroidManifest.xml, mipmap
# folders, and the Xcode project).
#
# Idempotent — safe to run multiple times.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> Regenerating alternate-icon pack from masters"
# Cheap re-run so a fresh master in app-icons-2026/ propagates to the pipeline
# output before the install steps copy it into the app tree. Skipping this and
# only running install_* copied stale 45%-k Krank output into the mipmaps on
# 2026-07-23 (see git 6036eb2 aftermath).
node generate_alternate_icons.js

echo "==> Installing iOS alternate icon assets"
node install_ios_assets.js

echo "==> Patching Info.plist"
node patch_info_plist.js

echo "==> Patching Xcode project (project.pbxproj)"
node patch_xcode_project.js

echo "==> Patching Xcode project (Crashlytics dSYM upload phase)"
# FF exports drop this run-script phase, which silently breaks iOS crash
# symbolication until someone notices "Missing dSYM (required)" in Crashlytics.
node patch_crashlytics_dsym_phase.js

echo "==> Installing Android alternate icon assets"
node install_android_assets.js

echo "==> Patching AndroidManifest.xml"
node patch_android_manifest.js

echo
echo "Alternate app icons installed."
echo "Next: rebuild the app (flutter clean && flutter pub get && flutter build ...)"
