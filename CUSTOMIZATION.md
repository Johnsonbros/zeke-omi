# ZEKE AI Fork Customization Plan

## Overview
Transform Omi app into ZEKE AI — personal AI assistant with OpenClaw backend.

## Phase 1: Backend Rerouting ✅ IN PROGRESS
- [x] OmiClaw bridge running (port 8081, Funnel 8464)
- [x] 5 Omi API endpoints implemented
- [ ] Update `app/lib/env/` with ZEKE endpoints
- [ ] Replace Firebase auth with OpenClaw tokens

## Phase 2: Remove Omi Marketplace ("Apps" Section)
**Current:** `app/lib/pages/apps/` — Omi plugin marketplace
**Target:** Replace with ZEKE Apps dashboard

### Files to modify/remove:
- `app/lib/pages/apps/page.dart` — Main apps page (REPLACE)
- `app/lib/pages/apps/app_detail/` — Plugin detail (REMOVE)
- `app/lib/pages/apps/widgets/` — Marketplace widgets (REMOVE)
- `app/lib/providers/app_provider.dart` — Fetches from api.omi.me (REPLACE)
- `app/lib/backend/schema/app.dart` — Omi app schema (REPLACE)

### New ZEKE Apps to add:
1. **ZEKE Chat** — Direct conversation with ZEKE
2. **ZEKETrader** — Trading dashboard (WebView to :5004)
3. **Calendar** — Family calendar (integrated with Google)
4. **Dashboard** — System status, health checks
5. **Context Viewer** — See memories/transcripts
6. **Family** — Family events, contacts
7. **Settings** — ZEKE-specific settings

## Phase 3: Branding
- [ ] App name: "ZEKE AI"
- [ ] Package name: `com.johnsonbros.zeke`
- [ ] App icons: Omega (Ω) theme
- [ ] Splash screen
- [ ] Color scheme (dark theme, Omega blue/gold?)

## Phase 4: Remove Omi Cloud Dependencies
- [ ] Remove Firebase Analytics
- [ ] Remove Mixpanel
- [ ] Remove Omi subscription/payments
- [ ] Remove Omi account creation flow
- [ ] Keep BLE stack untouched

## Phase 5: OpenClaw Integration
- [ ] OmiClaw client built into app (not separate server)
- [ ] Direct WebSocket to OpenClaw gateway
- [ ] Node protocol for camera/notifications
- [ ] Canvas WebView for agent-controlled UI

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
