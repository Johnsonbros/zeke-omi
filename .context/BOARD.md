# ZEKE Pendant (Omi Fork) Board

> Fork of Omi app → ZEKE AI with OpenClaw integration

## 🔥 In Progress

- [ ] **Omi app webhook config** — Enable Real-time Transcript in Omi Developer Settings
- [ ] **Install Omi app** — User must install the created app (not just create it)
- [ ] **iOS branding** — Update iOS configs, generate Omega-themed icons

## 📋 Up Next

- [ ] Test BLE → OmiClaw → Context Server → OpenClaw pipeline
- [ ] Single-device pairing mode (ignore other pendants)
- [ ] Canvas WebView integration
- [ ] Build APK v0.5.0 with full integration
- [ ] Remove Omi cloud dependencies

## ✅ Done (This Sprint)

- [x] Fork created: Johnsonbros/zeke-omi — 2026-02-07
- [x] ZEKE Apps page replacing Omi marketplace — 2026-02-07
- [x] ZEKE Chat page — 2026-02-07
- [x] WebView page — 2026-02-07
- [x] Rebranded: "ZEKE AI" / com.johnsonbros.zeke — 2026-02-07
- [x] Kotlin sources moved to new package — 2026-02-07
- [x] .dev.env with ZEKE/OpenClaw endpoints — 2026-02-07
- [x] CUSTOMIZATION.md with full fork plan — 2026-02-07

## 🚫 Blocked

- [ ] **Webhook not triggering** — App created but not installed in Omi app. User must go to Explore → Find app → Install.

---

## Key URLs

- **OmiClaw Bridge:** https://zeke.tail5b81a2.ts.net:8464
- **Fork Repo:** https://github.com/Johnsonbros/zeke-omi
- **Upstream:** https://github.com/BasedHardware/omi

## Webhook Config

```
URL: https://zeke.tail5b81a2.ts.net:8464/webhooks/transcript
Events: Real-time Transcript, Conversation Events, Day Summary
```
