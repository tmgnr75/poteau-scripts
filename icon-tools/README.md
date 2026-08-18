# Alternate app icons — pipeline

Lets users pick their home-screen icon from three options: **Poteau 5** (default,
managed by FlutterFlow), **Poteau Legacy**, **Krank Legacy**.

## Pieces

| File | Purpose |
|---|---|
| `generate_alternate_icons.js` | Builds all 36 export PNGs from the 6 masters in `app-icons-2026/`. Run once per design change. |
| `install_ios_assets.js` | Copies generated iOS PNGs into `poteau-app/ios/Runner/`. |
| `install_android_assets.js` | Copies generated Android PNGs into mipmap folders, writes adaptive XML and colors.xml entries. |
| `patch_info_plist.js` | Adds `CFBundleIcons` + `CFBundleIcons~ipad` declaring the alternates. Idempotent. |
| `patch_xcode_project.js` | Adds the iOS PNGs to the Runner Xcode target so they're bundled into the .app. Idempotent. |
| `patch_android_manifest.js` | Adds `<activity-alias>` entries for each alternate. Idempotent. |
| `post_flutterflow_export.sh` | Orchestrator — runs all of the above. Run after every FlutterFlow export. |
| `flutterflow_custom_actions/` | Three Dart files to paste into FlutterFlow's custom action editor. |

## When the designer ships new masters

1. Drop the 6 PNGs into [app-icons-2026/](../../app-icons-2026/) (`{key}_master_1024.png` + `{key}_logo_1024.png` for each of `poteau_legacy`, `krank_legacy`; plus `poteau_5_*` for the default).
2. Run `node generate_alternate_icons.js` — repopulates [assets/alternate_icons/](../../assets/alternate_icons/).
3. Run `./post_flutterflow_export.sh` — installs into `poteau-app/`.
4. For the **default** Poteau 5 icon, update FlutterFlow's app-icon setting using the master 1024 PNG (FlutterFlow handles its own pipeline).

## When FlutterFlow exports

FF stomps `Info.plist`, `AndroidManifest.xml`, `mipmap-*/`, and the Xcode project. Just rerun:

```bash
./post_flutterflow_export.sh
```

The script is idempotent — running twice is a no-op.

## FlutterFlow setup (one-time)

1. In FlutterFlow's pub dependencies panel, add: `flutter_dynamic_icon_plus: ^1.4.0`
2. Create three custom actions, pasting from `flutterflow_custom_actions/`:
   - `setAppIcon(iconKey: String) -> bool`
   - `getCurrentAppIcon() -> String`
   - `isIconSwitchSupported() -> bool`
3. Build the picker page in FF that calls `setAppIcon`. On Android, show a confirmation dialog that warns the app will close — Android terminates the process when toggling activity-aliases.

## Key technical decisions

- **iOS**: native `setAlternateIconName`. PNGs live as loose files in `Runner/`, not in `Assets.xcassets`. `CFBundleIcons` lists alternates by name.
- **Android**: activity-alias trick. `MainActivity` stays enabled; aliases start `enabled="false"` and `flutter_dynamic_icon_plus` flips them via `PackageManager.setComponentEnabledSetting`. **The OS kills the app when you do this.** No way around it on Android.
- **pbxproj quoting**: filenames containing `@` must be double-quoted in pbxproj (`path = "AppIcon-...@2x.png";`). Bare paths look fine to a human but Xcode rejects the project. Burned an hour on this.

## Layout

```
scripts/icon-tools/
├── generate_alternate_icons.js
├── install_ios_assets.js
├── install_android_assets.js
├── patch_info_plist.js
├── patch_xcode_project.js
├── patch_android_manifest.js
├── post_flutterflow_export.sh
├── flutterflow_custom_actions/
│   ├── setAppIcon.dart
│   ├── getCurrentAppIcon.dart
│   └── isIconSwitchSupported.dart
├── package.json
└── node_modules/

app-icons-2026/                    (designer's masters; gitignored or kept)
assets/alternate_icons/            (generator output)
```
