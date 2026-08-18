// FlutterFlow custom action: getCurrentAppIcon
//
// Returns the icon key currently in use, so the picker UI can highlight it.
//
// Pub dependency: flutter_dynamic_icon_plus ^1.4.0
//
// Returns: String ('default' | 'poteau_legacy' | 'krank_legacy')

import 'package:flutter/services.dart';
import 'package:flutter_dynamic_icon_plus/flutter_dynamic_icon_plus.dart';

Future<String> getCurrentAppIcon() async {
  try {
    final supported = await FlutterDynamicIconPlus.supportsAlternateIcons;
    if (supported != true) return 'default';

    final current = await FlutterDynamicIconPlus.getAlternateIconName();
    if (current == null || current.isEmpty) return 'default';

    switch (current) {
      case 'AppIcon-PoteauLegacy':
      case 'PoteauLegacyAlias':
        return 'poteau_legacy';
      case 'AppIcon-KrankLegacy':
      case 'KrankLegacyAlias':
        return 'krank_legacy';
      default:
        return 'default';
    }
  } on PlatformException {
    return 'default';
  }
}
