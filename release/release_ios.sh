#!/usr/bin/env bash
# Build poteau-app and upload it to TestFlight, unattended.
#
# Usage:  scripts/release/release_ios.sh
#
# Version and build number come from poteau-app/pubspec.yaml -- bump there
# first. Requires:
#   - ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8
#   - an Apple Distribution certificate in the login keychain
#     (Xcode > Settings > Accounts > Manage Certificates > + > Apple Distribution).
#     An Apple Development cert is NOT enough: xcodebuild archive can get by
#     with one because Xcode signs at upload time, but -exportArchive for
#     app-store-connect cannot.
set -euo pipefail

APP_DIR="$HOME/poteau-workspace/poteau-app"
KEY_ID="8S2YGG4B5Z"
ISSUER_ID="69a6de86-2a28-47e3-e053-5b8c7c11a4d1"
TEAM_ID="U8H94QVNGM"

cd "$APP_DIR"

VERSION=$(grep '^version:' pubspec.yaml | sed 's/version: *//' | tr -d '[:space:]')
NAME="${VERSION%%+*}"
BUILD="${VERSION##*+}"
ARCHIVE="$HOME/Library/Developer/Xcode/Archives/poteau-${NAME}-${BUILD}.xcarchive"
IPA_DIR="$APP_DIR/build/ipa"
LOG="$APP_DIR/build/release_ios.log"
mkdir -p "$APP_DIR/build"
: > "$LOG"

echo "==> Releasing $NAME (build $BUILD)"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "!! Working tree is dirty. Commit first -- a release should be reproducible."
  git status --short
  exit 1
fi

# Regenerate ios/Flutter/Generated.xcconfig from pubspec.yaml. xcodebuild
# reads FLUTTER_BUILD_NUMBER from there, and it is only rewritten by a
# `flutter build` -- so bumping pubspec.yaml and going straight to xcodebuild
# silently ships the PREVIOUS build number. That happened on 5.1.0+203:
# pubspec said 203, the uploaded ipa contained 202.
echo "==> Syncing Flutter build config (pubspec -> Generated.xcconfig)"
flutter build ios --release --no-codesign --config-only 2>&1 | tee -a "$LOG"
XC_BUILD=$(grep '^FLUTTER_BUILD_NUMBER=' ios/Flutter/Generated.xcconfig | cut -d= -f2)
if [[ "$XC_BUILD" != "$BUILD" ]]; then
  echo "!! Generated.xcconfig says build $XC_BUILD but pubspec.yaml says $BUILD."
  echo "   Refusing to ship a mislabelled build."
  exit 1
fi
echo "    build number confirmed: $XC_BUILD"

echo "==> Archiving"
rm -rf "$ARCHIVE"
# tee, never pipe to tail/head: those buffer the whole stream and the log
# stays empty until the build ends, so a healthy build looks like a dead one.
set -o pipefail
xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner \
  -configuration Release -archivePath "$ARCHIVE" \
  archive -allowProvisioningUpdates "DEVELOPMENT_TEAM=$TEAM_ID" 2>&1 | tee -a "$LOG"

echo "==> Exporting .ipa"
rm -rf "$IPA_DIR"
xcodebuild -exportArchive -archivePath "$ARCHIVE" \
  -exportPath "$IPA_DIR" -exportOptionsPlist ios/ExportOptions.plist \
  -allowProvisioningUpdates 2>&1 | tee -a "$LOG"

IPA=$(find "$IPA_DIR" -name '*.ipa' -maxdepth 1 | head -1)
[[ -n "$IPA" ]] || { echo "!! No .ipa produced"; exit 1; }

IPA_BUILD=$(unzip -p "$IPA" "Payload/Runner.app/Info.plist" 2>/dev/null \
  | plutil -extract CFBundleVersion raw -o - - 2>/dev/null)
if [[ "$IPA_BUILD" != "$BUILD" ]]; then
  echo "!! The .ipa contains build $IPA_BUILD but pubspec.yaml says $BUILD."
  echo "   Refusing to upload a mislabelled build."
  exit 1
fi
echo "==> .ipa build number verified: $IPA_BUILD"

echo "==> Validating $IPA"
xcrun altool --validate-app -f "$IPA" -t ios \
  --apiKey "$KEY_ID" --apiIssuer "$ISSUER_ID"

echo "==> Uploading to TestFlight"
xcrun altool --upload-app -f "$IPA" -t ios \
  --apiKey "$KEY_ID" --apiIssuer "$ISSUER_ID"

echo "==> Done. $NAME ($BUILD) is processing in App Store Connect."
echo "    Full log: $LOG"
echo "    Processing takes ~5-15 min before it appears in TestFlight."
