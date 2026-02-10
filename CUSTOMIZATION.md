# ZEKE AI Fork Customization Plan

## Overview
Transform Omi app into ZEKE AI — personal AI assistant with OpenClaw backend.

## Phase 1: Backend Rerouting ✅ COMPLETE
- [x] OmiClaw bridge running (port 8081, Funnel 8464)
- [x] 5 Omi API endpoints implemented (memories, conversations, health)
- [x] Created `.dev.env` with ZEKE endpoints
- [ ] Replace Firebase auth with OpenClaw tokens (TODO)

## Phase 2: Remove Omi Marketplace ("Apps" Section) ✅ COMPLETE
**Current:** `app/lib/pages/apps/` — Omi plugin marketplace
**Target:** Replace with ZEKE Apps dashboard

### Completed:
- [x] Created `lib/zeke/apps/zeke_apps_page.dart` — New apps grid
- [x] Created `lib/zeke/apps/zeke_chat_page.dart` — Chat UI with ZEKE
- [x] Created `lib/zeke/apps/zeke_webview_page.dart` — In-app WebView
- [x] Replaced `app/lib/pages/apps/page.dart` to use ZekeAppsPage
- [x] Original Omi page backed up to `page.dart.omi-original`

### ZEKE Apps (Implemented):
1. **ZEKE Chat** ✅ — Native chat UI (OpenClaw integration TODO)
2. **ZEKETrader** ✅ — WebView to :8444
3. **Dashboard** ✅ — WebView to :8470
4. **Calendar** ⏳ — Placeholder (Google sync TODO)
5. **StoryForge** ✅ — WebView to :8443
6. **Family** ⏳ — Placeholder (Family hub TODO)

### Files preserved (not yet removed):
- `app/lib/pages/apps/app_detail/` — May reuse for our app details
- `app/lib/providers/app_provider.dart` — May repurpose for ZEKE state

## Phase 3: Branding ✅ IN PROGRESS
- [x] App name: "ZEKE AI" (prod), "ZEKE Dev" (dev)
- [x] Package name: `com.johnsonbros.zeke`
- [x] Deep link scheme: `zeke://`
- [x] Kotlin sources moved to new package
- [ ] App icons: Omega (Ω) theme (TODO)
- [ ] Splash screen (TODO)
- [ ] iOS branding (TODO)
- [ ] Color scheme (dark theme, Omega blue/gold?)

## Phase 4: Remove Omi Cloud Dependencies
- [ ] Remove Firebase Analytics
- [ ] Remove Mixpanel
- [ ] Remove Omi subscription/payments
- [ ] Remove Omi account creation flow
- [ ] Keep BLE stack untouched

## Phase 5: OpenClaw Node Integration ✅ IN PROGRESS

### Completed (2026-02-10):
- [x] Protocol definitions (`lib/zeke/node/protocol/capabilities.dart`)
  - All capabilities: canvas, camera, screen, sms, voiceWake, location
  - All commands: canvas.*, camera.*, location.*, sms.*
- [x] Gateway WebSocket session (`lib/zeke/node/gateway/gateway_session.dart`)
  - Connection lifecycle, authentication, heartbeat
  - Command routing, request/response handling
- [x] Camera manager (`lib/zeke/node/managers/camera_manager.dart`)
  - camera.snap (photo), camera.clip (video)
- [x] Canvas manager (`lib/zeke/node/managers/canvas_manager.dart`)
  - canvas.present, hide, navigate, eval, snapshot
  - canvas.a2ui.push, reset
- [x] Location manager (`lib/zeke/node/managers/location_manager.dart`)
  - location.get with accuracy levels
- [x] SMS manager (`lib/zeke/node/managers/sms_manager.dart`)
  - sms.send (Android only, via platform channel)
- [x] Node runtime (`lib/zeke/node/node_runtime.dart`)
  - Main coordinator, command dispatch
- [x] Gateway settings UI (`lib/zeke/node/widgets/gateway_settings_widget.dart`)

### TODO:
- [ ] Voice wake manager (voiceWake capability)
- [ ] Register plugins in MainActivity
- [ ] Integration with main app navigation
- [ ] Auto-reconnect on app resume
- [ ] mDNS/NSD gateway discovery

### Files Created:
```
lib/zeke/node/
├── node.dart                          # Barrel export (31 lines)
├── node_runtime.dart                  # Main coordinator (360 lines)
├── protocol/
│   └── capabilities.dart              # Protocol constants (82 lines)
├── gateway/
│   └── gateway_session.dart           # WebSocket session (316 lines)
├── managers/
│   ├── camera_manager.dart            # Camera commands (196 lines)
│   ├── canvas_manager.dart            # Canvas commands (207 lines)
│   ├── location_manager.dart          # Location commands (148 lines)
│   ├── screen_manager.dart            # Screen recording (161 lines)
│   └── sms_manager.dart               # SMS commands (110 lines)
└── widgets/
    ├── gateway_settings_widget.dart   # Settings UI (276 lines)
    └── canvas_webview_widget.dart     # Canvas WebView (241 lines)

android/app/src/main/kotlin/com/johnsonbros/zeke/
├── SmsPlugin.kt                       # Native SMS API (251 lines)
└── ScreenRecordPlugin.kt              # Native screen recording (297 lines)
```

**Total: 2,128 lines Dart + 548 lines Kotlin = 2,676 lines**

## File Structure (Target)

```
app/lib/
├── zeke/                    # NEW: ZEKE-specific code
│   ├── apps/               # Our apps grid
│   │   ├── zeke_chat.dart
│   │   ├── trader.dart
│   │   ├── calendar.dart
│   │   ├── dashboard.dart
│   │   └── family.dart
│   ├── services/
│   │   ├── openclaw_client.dart
│   │   └── context_server.dart
│   └── widgets/
│       └── zeke_app_card.dart
├── pages/
│   ├── apps/               # REPLACED: Now shows our apps
│   │   └── page.dart       # Grid of ZEKE apps
│   ├── chat/              # KEEP: Enhanced for ZEKE
│   ├── conversations/     # KEEP: Transcripts
│   └── memories/          # KEEP: Memory viewer
└── providers/
    └── zeke_provider.dart  # NEW: ZEKE state management
```

## API Endpoints (OmiClaw Bridge)

| Omi Endpoint | ZEKE Endpoint | Status |
|--------------|---------------|--------|
| `api.omi.me/v1/health` | `localhost:8081/v1/health` | ✅ |
| `api.omi.me/v1/dev/user/memories` | `localhost:8081/v1/dev/user/memories` | ✅ |
| `api.omi.me/v1/dev/user/conversations` | `localhost:8081/v1/dev/user/conversations` | ✅ |
| Firebase Auth | OpenClaw token | TODO |
| Omi Apps API | N/A (removed) | N/A |

## Environment Config

```dart
// app/lib/env/zeke_env.dart (NEW)
class ZekeEnv {
  static const String apiBaseUrl = 'https://zeke.tail5b81a2.ts.net:8464';
  static const String openclawWs = 'wss://zeke.tail5b81a2.ts.net';
  static const String contextServer = 'wss://zeke.tail5b81a2.ts.net:8456';
}
```

## Build Commands

```bash
# Dev build
cd app && flutter build apk --debug

# Release build (on flex-large)
ssh ubuntu@100.66.116.13
cd ~/zeke-omi-fork/app
flutter build apk --release
```

---

*Last updated: 2026-02-07*
