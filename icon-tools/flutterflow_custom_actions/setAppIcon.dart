// FlutterFlow custom action: setAppIcon
//
// Switches the home-screen icon between the default and the alternates.
//
// Pub dependency to add in FlutterFlow: flutter_dynamic_icon_plus ^1.4.0
//
// Args (FlutterFlow custom action signature):
//   iconKey: String  ('default' | 'poteau_legacy' | 'krank_legacy')
// Returns: bool (true if switched, false if platform doesn't support it)
//
// On Android, switching kills the app — call this from a UI confirmation
// dialog that warns the user the app will close.

import 'package:flutter/services.dart';
import 'package:flutter_dynamic_icon_plus/flutter_dynamic_icon_plus.dart';

Future<bool> setAppIcon(String iconKey) async {
  // iOS: pass the alternate name (or null for primary).
  // Android: pass the activity-alias class-name suffix.
  String? iosName;
  String? androidClassName;

  switch (iconKey) {
    case 'default':
      iosName = null;
      androidClassName = 'MainActivity';
      break;
    case 'poteau_legacy':
      iosName = 'AppIcon-PoteauLegacy';
      androidClassName = 'PoteauLegacyAlias';
      break;
    case 'krank_legacy':
      iosName = 'AppIcon-KrankLegacy';
      androidClassName = 'KrankLegacyAlias';
      break;
    default:
      return false;
  }

  try {
    final supported = await FlutterDynamicIconPlus.supportsAlternateIcons;
    if (supported != true) return false;

    await FlutterDynamicIconPlus.setAlternateIconName(
      iconName: iosName,
      classNameAndroid: androidClassName,
    );
    return true;
  } on PlatformException {
    return false;
  }
}
