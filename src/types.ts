export type QueueStatus = 'idle' | 'analyzing' | 'compressing' | 'completed' | 'error' | 'cancelled';

export interface VideoQueueItem {
  id: string;
  file: File;
  name: string;
  originalSize: number;
  originalWidth: number;
  originalHeight: number;
  duration: number; // in seconds
  thumbnailUrl: string;
  status: QueueStatus;
  progress: number; // 0 - 100
  currentFps: number;
  compressedBlob: Blob | null;
  compressedSize: number;
  compressedWidth: number;
  compressedHeight: number;
  savedPercentage: number;
  downloadUrl: string | null;
  errorMessage: string | null;
  elapsedSeconds: number;
  estimatedSecondsRemaining: number;
  outputFormat: 'mp4' | 'webm';
}

export type TargetResolutionMode = 'source' | '1080p' | '720p' | '480p' | '360p' | 'custom';

export interface CompressionPreset {
  id: string;
  name: string;
  category: 'social' | 'quality' | 'storage';
  targetMaxMB: number | null;
  targetResolution: TargetResolutionMode;
  videoBitrateKbps: number | null; // null = auto calculate from target size
  audioBitrateKbps: number;
  fps: number | 'source';
  description: string;
  badgeLabel?: string;
}

export interface CompressionSettings {
  presetId: string;
  targetResolution: TargetResolutionMode;
  customWidth: number;
  customHeight: number;
  lockAspectRatio: boolean;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  fps: number | 'source';
  targetMaxMB: number | null;
  autoDownloadSequential: boolean;
  muteAudio: boolean;
  preferredFormat: 'mp4' | 'webm';
}
