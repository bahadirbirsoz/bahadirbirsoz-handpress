# HandPress — Offline Video Compressor for Android

A high-performance, 100% offline-only Android web app and PWA for video compression. Designed with the power and flexibility of HandBrake but streamlined for mobile touch ergonomics, featuring quick one-tap size/social presets, custom resolution and bitrate controls, batch processing queues, and automated sequential exports to device storage with zero ads and zero tracking.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and user experience decisions have been established based on your preferences:

- **Compression Workflow**: Quick smart presets (WhatsApp 16MB, Discord 25MB, Email 10MB, Web 720p/1080p) combined with an expandable HandBrake-style inspector for granular control over resolution (scaling/custom dimensions), video bitrate, CRF quality, audio bitrate, and frame rate.
- **Format & Codec**: MP4 (H.264 / AAC) prioritized as the primary format for universal playback across Android gallery, social media apps, and web browsers, with intelligent fallback to WebM/VP9 if client platform hardware requires.
- **Batch Processing & Export**: Sequential automated queue processing with direct auto-saving to Android device storage, plus progress monitors and per-file completion statistics (size reduction percentage, saved MBs).
- **100% Offline & Private**: Zero cloud uploads or external API dependencies; all video decoding, canvas scaling, and stream encoding happen strictly on-device in the browser sandbox.

---

### 1. Overview & Core Concept

- **What It Does**: HandPress enables Android and mobile users to compress single or batch video files directly in the browser without installing bloatware, viewing ads, or uploading private videos to third-party servers.
- **Target Audience / Persona**: Mobile creators, students, and everyday Android users who need to downscale videos to fit messaging limits (WhatsApp, Discord, Gmail), save storage space on their device, or re-encode video at specific dimensions.
- **Key Value**: Desktop-grade HandBrake flexibility packaged into an intuitive, thumb-friendly mobile interface that operates entirely offline, respects battery and memory limits, and processes batches seamlessly.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. *Source Selection*: Drag-and-drop or tap to select one or multiple videos via native file picker. Immediate display of original file sizes, dimensions, duration, and thumbnails.
  2. *Preset & Adjustment*: Choose a quick preset (e.g. "Discord 25MB", "WhatsApp 16MB", "Compact 720p", "High Quality 1080p") or toggle the "Advanced HandBrake Controls" sheet to customize width, height, aspect-ratio lock, video bitrate (kbps), audio bitrate, and FPS.
  3. *Batch Queue & Execution*: Tap "Start Batch Compression". Real-time visual progress bar, speed indicator, estimated time remaining, and current frame render preview.
  4. *Sequential Export*: As each video finishes, it automatically triggers a sequential file download to the Android Downloads folder with clean before/after savings badges.
  5. *PWA Installation*: Prominent in-app "Install to Home Screen" affordance for full standalone native Android experience with offline caching.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Utilitarian, precision-tool aesthetic inspired by modern studio software and Android Material 3 ergonomics. High-contrast, clean typography, dark theme by default with crisp slate tones and vivid emerald/cyan accents for compression status.
  - *Color Palette & Mood*:
    - Canvas: Deep Slate Neutral (`#0b0f17` background, `#151c28` cards and surfaces)
    - Borders: Subtle hairlines (`#222f42` or `rgba(255,255,255,0.08)`)
    - Primary Accent: Precision Electric Teal (`#0ea5e9` / `#06b6d4`)
    - Success/Savings: Vivid Emerald (`#10b981`) for bytes saved and finished tasks
    - Text: Primary `#f8fafc`, Muted `#94a3b8`
  - *Typography & Hierarchy*:
    - Display / Brand: Plus Jakarta Sans (clean, geometric, legible at small scales)
    - Body: DM Sans / Inter system font
    - Data & Metrics: Tabular numerals with `font-mono tabular-nums` for timestamps, file sizes, percentages, and bitrates
  - *Component Styling & Layout*:
    - 44px+ touch targets across all mobile buttons, tabs, and toggles
    - Smooth bottom sheet / drawer for advanced HandBrake settings
    - Unboxed metadata with typographic separators (`·`), zero clutter pills

- **Interactive Feedback & Motion**:
  - Tactile spring transitions when expanding video inspector cards
  - Real-time animated progress rings and horizontal fill gauges
  - Live side-by-side file size delta counters (`142 MB ➔ 18.4 MB (87% saved)`)

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Client-Side Native WebCodecs & Canvas Video Processing Engine**
  - *Chosen Approach*: Decodes video frames via HTML5 Video / Canvas at target custom resolution, capturing audio via Web Audio API, and encoding at target bitrates using hardware-accelerated `MediaRecorder` / WebCodecs with MP4 H.264 profile.
  - *Why*: Delivers 100% offline execution with zero network latency, instant startup, no 30MB WebAssembly bundle download, and minimal battery consumption on mobile Android chipsets.
  - *Alternatives Considered*: FFmpeg.wasm was considered, but requires downloading 30MB+ WebAssembly binaries (violating offline-first startup) and causes mobile browser tabs to crash due to WebAssembly memory limits (2GB cap and OOM risks on Android).

- **Decision 2: Two-Tier Control Architecture (Quick Presets + HandBrake Inspector)**
  - *Chosen Approach*: Top-level interface surfaces 1-tap presets (Discord 25MB, WhatsApp 16MB, Email 10MB, HD 720p, Full HD 1080p, Low Bandwidth 480p). An "Advanced Settings" drawer reveals full HandBrake controls: custom resolution inputs with aspect ratio lock, video bitrate slider, audio bitrate selector (64k to 320k), and target FPS (15/24/30/60).
  - *Why*: Satisfies users who want a 2-second quick shrink while empowering power users who need exact dimensions and bitrates.

- **Decision 3: Sequential Auto-Save Queue**
  - *Chosen Approach*: Files are compressed sequentially in FIFO order. Once a file finishes, it triggers automated browser download with a clear filename suffix (`_compressed.mp4`) and immediately proceeds to the next video, preventing browser memory pressure.
  - *Why*: Processing multiple high-res videos simultaneously in mobile RAM causes browser tab eviction; sequential processing ensures stability and predictability.

- **Decision 4: Full PWA Compliance with Offline Service Worker**
  - *Chosen Approach*: Vite PWA plugin with manifest, offline precaching, maskable Android icons, and custom in-app install banner with standalone detection.
  - *Why*: Allows Android users to install HandPress directly as a native-feeling app from Chrome/Firefox and launch it without an internet connection.

---

### 4. Technical Architecture & Data Strategy (Technical Reference)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        HandPress Android PWA                           │
├────────────────────────────────────────────────────────────────────────┤
│  Top Navigation (Brand Wordmark, PWA Install CTA, Clear All)           │
├───────────────────────────────┬────────────────────────────────────────┤
│         Batch Queue           │            Settings Panel              │
│  ┌─────────────────────────┐  │  ┌──────────────────────────────────┐  │
│  │ • Video Item 1 (Active) │  │  │ Quick Presets:                   │  │
│  │   Progress: 64% (2.4x)  │  │  │ [WhatsApp] [Discord] [720p] [FHD]│  │
│  │ • Video Item 2 (Queued) │  │  ├──────────────────────────────────┤  │
│  │ • Video Item 3 (Done)   │  │  │ Advanced HandBrake Controls:     │  │
│  │   142MB ➔ 19MB (-86%)   │  │  │ • Resolution: W x H + Ratio Lock│  │
│  └─────────────────────────┘  │  │ • Bitrate / CRF Target Mode     │  │
│                               │  │ • Audio Bitrate & FPS Controls   │  │
│  ┌─────────────────────────┐  │  └──────────────────────────────────┘  │
│  │ File Selector / Drop    │  │                                        │
│  └─────────────────────────┘  │  [ Start Batch Compression Button ]    │
├───────────────────────────────┴────────────────────────────────────────┤
│                 Client-Side Offline Processing Engine                  │
│   Video Decoder ──► Offscreen/Canvas Scaler ──► Audio/Video Stream     │
│                             │                                          │
│                             ▼                                          │
│              MediaRecorder (H.264 / AAC MP4)                           │
│                             │                                          │
│                             ▼                                          │
│             Sequential Auto-Save to Device Storage                     │
└────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - `VideoQueueItem`:
    - `id`: unique string
    - `file`: raw File object
    - `name`, `originalSize`: number (bytes)
    - `duration`: number (seconds)
    - `originalWidth`, `originalHeight`: number
    - `thumbnailUrl`: string
    - `status`: `'idle' | 'analyzing' | 'processing' | 'completed' | 'error' | 'cancelled'`
    - `progress`: number (0 to 100)
    - `compressedBlob`: Blob | null
    - `compressedSize`: number
    - `savedPercentage`: number
    - `errorMessage`: string | null
  - `CompressionSettings`:
    - `presetId`: `'whatsapp' | 'discord' | 'email' | '720p' | '1080p' | '480p' | 'custom'`
    - `targetResolutionMode`: `'original' | '1080p' | '720p' | '480p' | 'custom'`
    - `customWidth`: number
    - `customHeight`: number
    - `lockAspectRatio`: boolean
    - `videoBitrateKbps`: number (or calculated from target size)
    - `audioBitrateKbps`: 64 | 96 | 128 | 192 | 256
    - `frameRate`: 15 | 24 | 30 | 60 | 'source'
    - `targetMaxMB`: number | null (for size-constrained presets)

- **Interactive Component Mapping**:
  - `Header`: App title, PWA Install button, offline badge, batch summary
  - `PresetSelector`: Horizontal chip/button carousel of quick presets with real-time target estimates
  - `AdvancedSettingsSheet`: HandBrake inspector for custom dimensions, bitrate sliders, aspect ratio controls, and audio quality
  - `BatchQueue`: List of selected videos with thumbnail preview, dimension stats, progress indicators, status indicators, and delete/reorder buttons
  - `FileDropZone`: Large tap/drop area optimized for Android gallery access (`input accept="video/*" multiple`)
  - `ProcessingDashboard`: Active compression HUD showing time elapsed, time remaining, frame rate, and current file index
  - `SavingsSummaryModal`: Post-batch summary celebrating total storage reclaimed and sequential download confirmations
