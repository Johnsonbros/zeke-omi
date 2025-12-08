# Overview

Omi is an open-source AI wearable platform designed to capture, transcribe, and intelligently process conversations. It provides automatic summaries, action items, and intelligent assistance. The platform includes a Flutter mobile app, a Python FastAPI backend, hardware firmware, and companion projects like omiGlass (smart glasses) and Zeke Core (personal AI assistant). Omi aims to offer a comprehensive solution for managing and leveraging conversational data, with features like RAG-powered chat, a plugin system, and optional private cloud storage.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Mobile Application (Flutter)
- **Framework**: Flutter with multi-flavor support (dev/prod).
- **State Management**: SharedPreferences for local data, Firebase Firestore for cloud sync.
- **Connectivity**: BLE for wearable communication, Deepgram WebSocket for real-time transcription.
- **AI**: Local vector similarity search for memory retrieval.
- **Authentication**: Firebase Auth.
- **Platforms**: iOS, Android, macOS, Web, Windows.

## Backend (FastAPI + Modal)
- **API Framework**: FastAPI with modular architecture.
- **Deployment**: Modal.com for serverless functions.
- **Authentication**: Firebase Admin SDK, custom API keys.
- **Database**: Google Firestore.
- **Caching**: Redis (Upstash).
- **Storage**: Google Cloud Storage for media.
- **Processing**: Webhook-based event system for conversations, Modal scheduled functions for background tasks.

## Data Architecture
- **Firestore Collections**: Users, conversations, memories, messages, action items, plugin data, API keys.
- **Data Protection**: Standard (plaintext) and Enhanced (AES encryption for sensitive fields).

## AI/ML Pipeline
- **Speech-to-Text**: Deepgram WebSocket API with speaker diarization and multi-language support.
- **Memory Generation**: OpenAI GPT models for structured summaries, insights, and trend detection, optimized with DSPy ReAct.
- **Vector Search**: Pinecone for semantic memory search using OpenAI embeddings for RAG and memory retrieval.
- **Voice Activity Detection**: Pyannote.audio VAD for audio chunking.

## Plugin/App System
- **Capabilities**: Memories processing, chat integration, external triggers (`audio_bytes`, `memory_created`, `conversation_finished`).
- **Integration**: Webhook-based with OAuth support, JSON-based app registry.

## Authentication & Authorization
- **Primary Auth**: Firebase Authentication.
- **API Keys**: MCP and Dev keys with bearer token validation and Redis caching.
- **Encryption**: Per-user AES keys from Firebase UID.

## Notification System
- **Push**: Firebase Cloud Messaging (FCM).
- **Scheduling**: Cron-based for summaries and proactive notifications.
- **Channels**: In-app, push, SMS (Twilio).

## Hardware Integration
- **Omi Device**: ESP32-based BLE wearable for audio capture.
- **omiGlass**: Smart glasses with Seeed XIAO ESP32 S3 and Ollama integration.
- **Firmware Updates**: Nordic DFU protocol.
- **Communication**: Custom BLE audio streaming protocol.

## Companion Projects

### Zeke Core (Personal AI Assistant)
- **Purpose**: Proactive task management and skill orchestration.
- **Stack**: FastAPI, PostgreSQL + pgvector, Celery + Redis workers.
- **Dashboard**: React + Vite + TailwindCSS with gradient-themed UI, responsive bottom navigation, and dynamic category filtering.
- **Features**: Memory curation, task planning, research, location awareness (Overland iOS integration).
- **Semantic Cache**: Optimizes LLM responses via cosine similarity caching.
- **GraphRAG Knowledge Graph**: Uses entity relationships for multi-hop reasoning on memories.
- **OAuth2-Style API Scopes**: Granular permission control for integrations.
- **Resource Lifecycle Management**: Ensures proper cleanup and prevents memory leaks.
- **Notification Permission System**: Controls plugin notification access.
- **Memory Curation System**: Automates classification, tagging, and enrichment of memories. Includes a mobile-first swipe-based curation interface (Tinder-like) where users swipe left to save and right to remove memories. Rejected memories prompt for feedback (reason selection + optional details) to create a reinforcement learning loop for improving future curation quality. **Quality Filters**: Automatic detection of low-quality memories (third-person language like "the user", vague phrases, low specificity) with quality scoring (0.0-1.0). Memories with score below 0.5 are auto-flagged for review. Memory extraction prompts generate first-person, specific, actionable content.
- **Place Intelligence System**: Comprehensive location-aware feature set for geo-contextual AI assistance.
  - **Places Model**: Named locations with geofence radius, categories (home/work/gym/restaurant/etc.), visit tracking, and dwell time analytics.
  - **PlaceService**: Haversine-based place detection, Redis-cached current place state, visit lifecycle management (entry/exit/dwell time).
  - **Overland Integration**: Automatic place detection on GPS location updates, triggers on place entry/exit.
  - **Location-Linked Data**: Memories auto-tagged with current place, tasks with arrival/departure triggers.
  - **Place-Aware Chat**: Orchestrator includes place context in conversations, `search_memories_at_place` tool for queries like "What did I do at the gym?"
  - **Places Dashboard UI**: Full management page with map visualization, visit history, statistics, add/edit/delete places. Features a **Current Location Card** at the top showing live GPS position on an interactive map with motion status, travel status, battery level, and coordinates. **Quick Add** button saves the current location as a new place instantly. **Suggested Places** section displays mini map previews with pin markers for easy location identification.
  - **Automatic Place Discovery**: Clusters frequently visited GPS coordinates into suggested places using distance-based clustering. Shows visit counts and suggests categories based on visit times. Users can confirm suggestions with one click.
  - **Routine Detection**: Analyzes visit patterns over 28 days to identify recurring schedules. Detects routines by day-of-week and hour with confidence scoring. Checks for routine deviations ("You're usually at the gym at this time").
  - **Place Tags**: Colored labels for organizing places (e.g., "outdoor", "quiet", "expensive"). Many-to-many relationship with places. Full CRUD API at `/api/places/tags` and `/api/places/{id}/tags`.
  - **Place Triggers**: Automated actions on place entry/exit. Supports action types: reminder, notification, mode_switch, task_create. Configurable cooldown to prevent repeated triggering. Full CRUD API at `/api/places/{id}/triggers`.
  - **Place Lists**: Named collections of places for grouping (e.g., "Workout Spots", "Client Sites", "Favorite Restaurants"). Many-to-many with ordering. Full CRUD API at `/api/places/lists` and `/api/places/lists/{id}/places`.
- **Emotional Memory Context**: Analyzes memories for sentiment (score -1 to +1), emotional weight (0.0-1.0), milestone detection (family moments, personal achievements, creative breakthroughs), and personal significance classification. Emotionally significant memories receive a 30% boost in RAG retrieval.
- **Personal Life Context Engine**: Time-based context modes (Morning Planning, Family Time, Writing Mode, Work Mode) with automatic switching, proactive briefings (morning/evening), focus support features (drift detection, refocus prompts), and parking lot for capturing tangent ideas during focused work.
- **Time-Sensitive Reminders**: Dedicated reminder system for urgent items (school pickups, appointments) with lead time notifications and priority levels.
- **Omi iOS App Integration**: Direct webhook endpoint at `/api/omi/conversation` that receives raw conversation data from the Omi iOS app, processes transcripts, extracts memories, and enables personalized ZEKE interactions.
- **Real-Time Audio Streaming**: Configurable audio streaming endpoint at `/api/omi/audio` that receives raw PCM audio bytes from Omi devices, stores as WAV files with path traversal protection. Settings: `omi_audio_streaming_enabled`, `omi_audio_storage_path`, `omi_audio_auto_transcribe`.

### MCP Server
- **Protocol**: Model Context Protocol for AI tool integration.
- **Tools**: `get_memories`, `create_memory`, `edit_memory`, `delete_memory`, `get_conversations`.
- **Deployment**: Docker container.

# External Dependencies

## Core Services
- **Firebase**: Authentication, Firestore, Cloud Messaging, Admin SDK.
- **Google Cloud Platform**: Cloud Storage, Service Account authentication.
- **Modal.com**: Serverless deployment.
- **Upstash Redis**: Caching and rate limiting.

## AI/ML APIs
- **OpenAI**: GPT models (GPT-4/GPT-3.5) for text generation, `text-embedding-ada-002` for embeddings.
- **Deepgram**: Real-time speech-to-text.
- **Pinecone**: Vector database.
- **Hume AI**: Emotional analysis (optional).

## Third-Party Integrations
- **Twilio**: SMS notifications.
- **Langfuse**: LLM observability.
- **Google APIs**: OAuth, Calendar, Gmail.
- **Ollama**: Local LLM hosting for omiGlass.
- **Overland iOS**: GPS data integration for Zeke Core.