// ZEKE Apps Page - Replaces Omi marketplace
// Original Omi page backed up to page.dart.omi-original

import 'package:flutter/material.dart';
import 'package:omi/zeke/apps/zeke_apps_page.dart';

export 'package:omi/zeke/apps/zeke_apps_page.dart';

class AppsPage extends StatefulWidget {
  final bool showAppBar;
  const AppsPage({super.key, this.showAppBar = false});

  @override
  State<AppsPage> createState() => AppsPageState();
}

class AppsPageState extends State<AppsPage> with AutomaticKeepAliveClientMixin {
  void scrollToTop() {
    // No-op for compatibility with home page
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return const ZekeAppsPage();
  }

  @override
  bool get wantKeepAlive => true;
}
