# AiSync Hermes Omi App

Public Omi integration app for connecting Omi to a user-owned Hermes agent through AiSync.

This is the public connector, not the private AiSync Omi-compatible backend. Omi sends webhook events to this app; this app normalizes them, applies conservative defaults, and forwards them to the configured Hermes/AiSync receiver.

## Product Role

This app should make one thing easy for Omi users:

```text
Omi device / Omi app
  -> Omi webhook or Chat Tool
  -> AiSync Hermes Omi App
  -> user-owned Hermes receiver
  -> memory candidate, context, approval, or command
```

Omi audio and transcripts are treated as read-only sensory context by default. Commands should come through Omi Chat Tools or a separate explicit promotion step.

## Receiver Modes

| Mode | Use When |
| --- | --- |
| `none` | Local smoke testing only. Events are accepted and logged but not forwarded. |
| `webhook` | A private AiSync/Hermes receiver URL is available. The app POSTs normalized events to it. |
| `paperclip_cli` | The app runs on the same host as Paperclip and can create Paperclip issues for Hermes agents. |

Public deployments should use `webhook`. Local/private deployments can use `paperclip_cli`.

## What It Does

- Accepts Omi real-time transcript webhooks.
- Accepts Omi memory creation webhooks.
- Accepts optional raw audio byte webhooks for custom STT or feature extraction.
- Exposes an Omi Chat Tools manifest at `/.well-known/omi-tools.json`.
- Provides an `ask_hermes` chat tool endpoint at `/tools/ask`.
- Optionally forwards normalized events to Hermes, AiSync, or Paperclip.
- Stores metadata by default; full payload and audio storage are opt-in.

## Omi App Configuration

Use these fields when creating or editing the app in Omi:

| Field | Value |
| --- | --- |
| App Name | `AiSync Hermes` |
| Category | `Productivity` |
| App Home URL | `https://zeke.aisyncservices.com/omi` |
| Real-Time Transcript Webhook | `https://zeke.aisyncservices.com/webhook/transcript` |
| Memory Creation Webhook | `https://zeke.aisyncservices.com/webhook/memory` |
| Audio Bytes Webhook | `https://zeke.aisyncservices.com/webhook/audio` |
| Setup Completed URL | `https://zeke.aisyncservices.com/setup-completed` |
| Chat Tools Manifest URL | `https://zeke.aisyncservices.com/.well-known/omi-tools.json` |
| GitHub Source URL | `https://github.com/Johnsonbros/zeke-omi/tree/main/aisync-hermes-omi-app` |

For public listing, deploy this to a stable HTTPS URL and keep response latency low. A tunnel is only for development.

## Run Locally

```bash
cd aisync-hermes-omi-app
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --host 0.0.0.0 --port 8000
```

Health check:

```bash
curl http://127.0.0.1:8000/health
```

Transcript smoke test:

```bash
curl -X POST http://127.0.0.1:8000/webhook/transcript \
  -H 'Content-Type: application/json' \
  -d '[{"text":"AiSync Hermes Omi app smoke test","speaker":"SPEAKER_00"}]'
```

Chat tool smoke test:

```bash
curl -X POST http://127.0.0.1:8000/tools/ask \
  -H 'Content-Type: application/json' \
  -d '{"uid":"test","app_id":"aisync-hermes","tool_name":"ask_hermes","request":"create a Hermes task from this Omi message"}'
```

## Environment Variables

See `.env.example` for all options.

Key settings:

- `HERMES_FORWARD_MODE`: `none`, `webhook`, or `paperclip_cli`.
- `HERMES_FORWARD_URL`: private AiSync/Hermes receiver endpoint for `webhook` mode.
- `HERMES_FORWARD_TOKEN`: optional bearer token for the private forward URL.
- `PAPERCLIP_COMPANY_ID`: required for `paperclip_cli` mode.
- `PAPERCLIP_ASSIGNEE_AGENT_ID`: optional Hermes/Paperclip agent assignment.
- `OMI_WEBHOOK_TOKEN`: optional shared webhook token if the Omi app can send one.
- `OMI_DEBUG_TOKEN`: enables protected `/events` inspection.
- `STORE_PAYLOADS`: defaults to `false`; set `true` only for short debug windows.
- `SAVE_AUDIO`: defaults to `false`; set `true` only when intentionally collecting raw audio chunks.

## Privacy Notes

Voice transcripts and raw audio can be sensitive. The default runtime records metadata, extracted text, endpoint path, uid, session id, and timestamps, but does not persist full webhook payloads or audio bytes. Enable full payload or audio storage only for a controlled debug session.

## Related Omi Docs

- Integration apps: https://docs.omi.me/doc/developer/apps/Integrations
- Developer API: https://docs.omi.me/doc/developer/api/overview
- Chat tools: https://docs.omi.me/doc/developer/apps/ChatTools
- Publishing: https://docs.omi.me/doc/developer/apps/Submitting
- Open-source app structure: https://docs.omi.me/doc/developer/apps/OpenSource
