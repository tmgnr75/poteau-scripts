// FlutterFlow custom action: isIconSwitchSupported
//
// Use this to gate the icon picker entry point. iOS supports it from 10.3+;
// some Android launchers/OEMs don't expose component enable/disable, in which
// case the package returns false.
//
// Pub dependency: flutter_dynamic_icon_plus ^1.4.0
//
// Returns: bool

import 'package:flutter/services.dart';
import 'package:flutter_dynamic_icon_plus/flutter_dynamic_icon_plus.dart';

Future<bool> isIconSwitchSupported() async {
  try {
    return await FlutterDynamicIconPlus.supportsAlternateIcons == true;
  } on PlatformException {
    return false;
  }
}
