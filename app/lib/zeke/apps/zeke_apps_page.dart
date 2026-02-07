import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'zeke_webview_page.dart';
import 'zeke_chat_page.dart';

/// ZEKE Apps Page - Replaces Omi's marketplace with our actual apps
class ZekeAppsPage extends StatelessWidget {
  const ZekeAppsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.primary,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 20),
                    Text(
                      'ZEKE Apps',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Your personal AI ecosystem',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 16,
                  crossAxisSpacing: 16,
                  childAspectRatio: 1.1,
                ),
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final apps = [
                      _ZekeAppCard(
                        title: 'ZEKE Chat',
                        subtitle: 'Talk to ZEKE',
                        icon: Icons.chat_bubble,
                        color: Colors.blue,
                        onTap: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (context) => const ZekeChatPage(),
                            ),
                          );
                        },
                      ),
                      _ZekeAppCard(
                        title: 'ZEKETrader',
                        subtitle: 'AI Trading System',
                        icon: Icons.trending_up,
                        color: Colors.green,
                        url: 'https://zeke.tail5b81a2.ts.net:8444',
                      ),
                      _ZekeAppCard(
                        title: 'Dashboard',
                        subtitle: 'System Status',
                        icon: Icons.dashboard,
                        color: Colors.deepPurple,
                        url: 'https://zeke.tail5b81a2.ts.net:8470',
                      ),
                      _ZekeAppCard(
                        title: 'Calendar',
                        subtitle: 'Family Schedule',
                        icon: Icons.calendar_month,
                        color: Colors.orange,
                        onTap: () {
                          // TODO: Open calendar page with Google sync
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Calendar coming soon!')),
                          );
                        },
                      ),
                      _ZekeAppCard(
                        title: 'StoryForge',
                        subtitle: 'Audiobook Creator',
                        icon: Icons.auto_stories,
                        color: Colors.purple,
                        url: 'https://zeke.tail5b81a2.ts.net:8443',
                      ),
                      _ZekeAppCard(
                        title: 'Family',
                        subtitle: 'Events & Contacts',
                        icon: Icons.family_restroom,
                        color: Colors.pink,
                        onTap: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Family hub coming soon!')),
                          );
                        },
                      ),
                    ];
                    return apps[index];
                  },
                  childCount: 6,
                ),
              ),
            ),
            const SliverToBoxAdapter(
              child: SizedBox(height: 100),
            ),
          ],
        ),
      ),
    );
  }
}

class _ZekeAppCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final String? url;
  final VoidCallback? onTap;

  const _ZekeAppCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    this.url,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Colors.grey[900],
      elevation: 4,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      child: InkWell(
        onTap: () {
          if (onTap != null) {
            onTap!();
          } else if (url != null) {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (context) => ZekeWebViewPage(
                  title: title,
                  url: url!,
                ),
              ),
            );
          }
        },
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  icon,
                  size: 32,
                  color: color,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: TextStyle(
                  color: Colors.grey[400],
                  fontSize: 12,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
