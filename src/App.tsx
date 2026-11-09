import React, { useState, useRef, useEffect } from 'react';
import {
  Film,
  SlidersHorizontal,
  HardDrive,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Zap,
  Info,
  Smartphone,
  Layers,
  ArrowRight,
  Download,
} from 'lucide-react';
import { Header } from './components/Header';
import { PresetSelector } from './components/PresetSelector';
import { AdvancedSettingsDrawer } from './components/AdvancedSettingsDrawer';
import { DropZone } from './components/DropZone';
import { QueueItemCard } from './components/QueueItemCard';
import { VideoPreviewModal } from './components/VideoPreviewModal';
import { BatchSummaryBar } from './components/BatchSummaryBar';
import { OfflineIndicator } from './components/OfflineIndicator';
import { VideoQueueItem, CompressionSettings, CompressionPreset } from './types';
import { DEFAULT_SETTINGS, COMPRESSION_PRESETS, formatBytes } from './utils/presets';
import {
  getVideoMetadata,
  compressVideoFile,
  downloadFile,
  createDemoVideoFile,
} from './utils/videoCompressor';

export default function App() {
  const [queue, setQueue] = useState<VideoQueueItem[]>([]);
  const [settings, setSettings] = useState<CompressionSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState(-1);
  const [previewItem, setPreviewItem] = useState<VideoQueueItem | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isProcessingRef = useRef(false);
  isProcessingRef.current = isProcessing;

  // Handle incoming files
  const handleFilesSelected = async (files: File[]) => {
    const newItems: VideoQueueItem[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      file,
      name: file.name,
      originalSize: file.size,
      originalWidth: 0,
      originalHeight: 0,
      duration: 0,
      thumbnailUrl: '',
      status: 'analyzing',
      progress: 0,
      currentFps: 0,
      compressedBlob: null,
      compressedSize: 0,
      compressedWidth: 0,
      compressedHeight: 0,
      savedPercentage: 0,
      downloadUrl: null,
      errorMessage: null,
      elapsedSeconds: 0,
      estimatedSecondsRemaining: 0,
      outputFormat: settings.preferredFormat,
    }));

    setQueue((prev) => [...prev, ...newItems]);

    // Asynchronously probe video metadata for each new item
    for (const item of newItems) {
      try {
        const metadata = await getVideoMetadata(item.file);
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  originalWidth: metadata.width,
                  originalHeight: metadata.height,
                  duration: metadata.duration,
                  thumbnailUrl: metadata.thumbnailUrl,
                  status: 'idle',
                }
              : q
          )
        );
      } catch (err) {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: 'idle',
                  originalWidth: 1280,
                  originalHeight: 720,
                  duration: 10,
                }
              : q
          )
        );
      }
    }
  };

  const handleSelectPreset = (preset: CompressionPreset) => {
    if (preset.id === 'custom') {
      setIsSettingsOpen(true);
      return;
    }

    setSettings((prev) => ({
      ...prev,
      presetId: preset.id,
      targetResolution: preset.targetResolution,
      targetMaxMB: preset.targetMaxMB,
      videoBitrateKbps: preset.videoBitrateKbps || prev.videoBitrateKbps,
      audioBitrateKbps: preset.audioBitrateKbps,
      fps: preset.fps,
    }));
  };

  const handleRemoveQueueItem = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleRetryItem = (id: string) => {
    setQueue((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: 'idle', progress: 0, errorMessage: null } : item
      )
    );
  };

  const handleClearQueue = () => {
    if (isProcessing) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setIsProcessing(false);
    }
    setQueue([]);
  };

  // Start Batch Compression Queue
  const handleStartBatch = async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    abortControllerRef.current = new AbortController();

    const currentQueue = [...queue];

    for (let i = 0; i < currentQueue.length; i++) {
      const item = currentQueue[i];

      // Skip already completed videos
      if (item.status === 'completed') continue;

      setCurrentProcessingIndex(i);

      // Set item to compressing
      setQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: 'compressing', progress: 0 } : q))
      );

      try {
        const result = await compressVideoFile(
          item,
          settings,
          (progressData) => {
            setQueue((prev) =>
              prev.map((q) =>
                q.id === item.id
                  ? {
                      ...q,
                      progress: progressData.progress,
                      currentFps: progressData.currentFps,
                      elapsedSeconds: progressData.elapsedSeconds,
                      estimatedSecondsRemaining: progressData.estimatedRemainingSeconds,
                    }
                  : q
              )
            );
          },
          abortControllerRef.current.signal
        );

        const savedBytes = Math.max(0, item.originalSize - result.size);
        const savedPercentage = Math.round((savedBytes / item.originalSize) * 100);

        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: 'completed',
                  progress: 100,
                  compressedBlob: result.blob,
                  compressedSize: result.size,
                  compressedWidth: result.width,
                  compressedHeight: result.height,
                  savedPercentage,
                  outputFormat: result.format,
                }
              : q
          )
        );

        // Sequential Auto-Save to Android Storage (if enabled)
        if (settings.autoDownloadSequential) {
          const baseName = item.name.replace(/\.[^/.]+$/, '');
          const ext = result.format === 'mp4' ? 'mp4' : 'webm';
          downloadFile(result.blob, `${baseName}_compressed.${ext}`);
        }
      } catch (err: unknown) {
        if (abortControllerRef.current?.signal.aborted) {
          setQueue((prev) =>
            prev.map((q) => (q.id === item.id ? { ...q, status: 'cancelled' } : q))
          );
          break;
        }

        const msg = err instanceof Error ? err.message : 'Compression error';
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: 'error', errorMessage: msg } : q
          )
        );
      }
    }

    setIsProcessing(false);
    setCurrentProcessingIndex(-1);
  };

  const handleCancelBatch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsProcessing(false);
    setCurrentProcessingIndex(-1);
    setQueue((prev) =>
      prev.map((item) =>
        item.status === 'compressing' ? { ...item, status: 'cancelled' } : item
      )
    );
  };

  const handleScrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Quick stats
  const completedCount = queue.filter((i) => i.status === 'completed').length;
  const totalSavedBytes = queue
    .filter((i) => i.status === 'completed')
    .reduce((acc, i) => acc + Math.max(0, i.originalSize - i.compressedSize), 0);

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Bar Header */}
      <Header
        queueCount={queue.length}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onClearQueue={handleClearQueue}
        onScrollToSection={handleScrollToSection}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        {/* Hero Banner / Quick Overview */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-1">
              <span>HandBrake Engine for Android</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-emerald-400">100% Offline & Free</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Instant Video Compression
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-400 max-w-2xl">
              Shrink videos for WhatsApp, Discord, or Email without losing visual clarity. Zero ads, no account needed, and no files ever leave your phone.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          {completedCount > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 self-start md:self-auto">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[11px] font-medium text-emerald-300 block">
                  Batch Space Saved
                </span>
                <span className="text-lg font-bold text-white font-mono tabular-nums">
                  {formatBytes(totalSavedBytes)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Section 1: Presets Selector */}
        <PresetSelector
          settings={settings}
          onSelectPreset={handleSelectPreset}
          onOpenAdvanced={() => setIsSettingsOpen(true)}
        />

        {/* Section 2: Upload & Drop Zone */}
        <DropZone onFilesSelected={handleFilesSelected} isProcessing={isProcessing} />

        {/* Section 3: Batch Queue */}
        <section id="queue" className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-400">
                Video Queue
              </h2>
              <span className="text-xs font-mono font-medium text-slate-400">
                ({queue.length} {queue.length === 1 ? 'file' : 'files'})
              </span>
            </div>

            {queue.length > 0 && (
              <span className="text-xs text-slate-400">
                {settings.autoDownloadSequential ? 'Auto-Save enabled' : 'Manual save'}
              </span>
            )}
          </div>

          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800/80 bg-[#101622]/40 py-12 px-4 text-center">
              <Film className="h-10 w-10 text-slate-700 mb-2.5" />
              <p className="text-sm font-medium text-slate-400">Your queue is empty</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Add video files from your device or click "Try Demo Video" above to test compression instantly.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {queue.map((item) => (
                <QueueItemCard
                  key={item.id}
                  item={item}
                  onRemove={handleRemoveQueueItem}
                  onRetry={handleRetryItem}
                  onPreview={(previewTarget) => setPreviewItem(previewTarget)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Section 4: Privacy & Technology Guarantees */}
        <section id="privacy" className="rounded-2xl border border-slate-800/80 bg-[#101724]/60 p-5 sm:p-6 mt-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-2">
            <ShieldCheck className="h-4 w-4" />
            <span>Zero Ads · Zero Tracking · 100% Offline</span>
          </div>
          <h3 className="text-base font-bold text-white mb-2">
            Why HandPress is Safe for Private Videos
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-3xl">
            Unlike online converter websites that upload your personal gallery videos to remote servers, HandPress decodes and recompresses every frame right inside your Android browser's hardware engine. No internet connection is needed after the first visit, making it completely private and offline-safe.
          </p>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-800/70 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>No Video Uploads or Cloud Servers</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              <span>Hardware-Accelerated WebCodecs</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              <span>Installable Android Progressive Web App</span>
            </div>
          </div>
        </section>
      </main>

      {/* Sticky Bottom Thumb-Zone Batch Controls */}
      <BatchSummaryBar
        queue={queue}
        isProcessing={isProcessing}
        currentProcessingIndex={currentProcessingIndex}
        onStartBatch={handleStartBatch}
        onCancelBatch={handleCancelBatch}
      />

      {/* Advanced HandBrake Inspector Drawer */}
      <AdvancedSettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onChangeSettings={(newSettings) => setSettings(newSettings)}
      />

      {/* Side-by-Side Video Preview Modal */}
      <VideoPreviewModal
        item={previewItem}
        onClose={() => setPreviewItem(null)}
      />

      {/* Offline Status Badge */}
      <OfflineIndicator />
    </div>
  );
}
