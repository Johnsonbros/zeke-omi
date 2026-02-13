import 'package:flutter/material.dart';
import 'package:omi/pages/onboarding/wrapper.dart';
import 'package:omi/pages/home/page.dart';
import 'package:omi/pages/onboarding/device_selection.dart';
import 'package:omi/pages/persona/persona_profile.dart';
import 'package:omi/backend/preferences.dart';
import 'package:omi/providers/auth_provider.dart';
import 'package:provider/provider.dart';

class MobileApp extends StatelessWidget {
  const MobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<AuthenticationProvider>(
      builder: (context, authProvider, child) {
        // ZEKE: Bypass Firebase auth - go directly to home page for BLE pairing
        // This allows us to use the app without Firebase authentication
        // while maintaining upstream merge compatibility
        return const HomePageWrapper();

        // Original auth flow (kept for upstream merge compatibility):
        // if (authProvider.isSignedIn()) {
        //   if (SharedPreferencesUtil().onboardingCompleted) {
        //     return const HomePageWrapper();
        //   } else {
        //     return const OnboardingWrapper();
        //   }
        // } else if (SharedPreferencesUtil().hasOmiDevice == false &&
        //     SharedPreferencesUtil().hasPersonaCreated &&
        //     SharedPreferencesUtil().verifiedPersonaId != null) {
        //   return const PersonaProfilePage();
        // } else {
        //   return const DeviceSelectionPage();
        // }
      },
    );
  }
}
