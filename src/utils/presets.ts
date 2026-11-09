import { CompressionPreset, CompressionSettings } from '../types';

export const COMPRESSION_PRESETS: CompressionPreset[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp Limit',
    category: 'social',
    targetMaxMB: 15.5,
    targetResolution: '720p',
    videoBitrateKbps: null, // Dynamic: fits strictly under 16MB
    audioBitrateKbps: 96,
    fps: 30,
    description: 'Guarantees video fits strictly under WhatsApp 16 MB limit.',
    badgeLabel: '16 MB Cap',
  },
  {
    id: 'discord',
    name: 'Discord Free',
    category: 'social',
    targetMaxMB: 24.5,
    targetResolution: '1080p',
    videoBitrateKbps: null, // Dynamic: fits under 25MB
    audioBitrateKbps: 128,
    fps: 30,
    description: 'Optimized for Discord 25 MB non-Nitro upload limit.',
    badgeLabel: '25 MB Cap',
  },
  {
    id: 'email',
    name: 'Email / Web',
    category: 'social',
    targetMaxMB: 9.5,
    targetResolution: '480p',
    videoBitrateKbps: null, // Dynamic: fits under 10MB
    audioBitrateKbps: 64,
    fps: 24,
    description: 'High compression for standard email attachments (< 10 MB).',
    badgeLabel: '10 MB Cap',
  },
  {
    id: 'balanced-720p',
    name: 'Balanced 720p',
    category: 'quality',
    targetMaxMB: null,
    targetResolution: '720p',
    videoBitrateKbps: 1400,
    audioBitrateKbps: 128,
    fps: 30,
    description: 'Crisp HD quality with a 65–80% typical size reduction.',
    badgeLabel: 'Most Popular',
  },
  {
    id: 'high-1080p',
    name: 'High Quality 1080p',
    category: 'quality',
    targetMaxMB: null,
    targetResolution: '1080p',
    videoBitrateKbps: 2800,
    audioBitrateKbps: 192,
    fps: 30,
    description: 'Preserves fine detail with moderate 40–60% file shrinkage.',
    badgeLabel: 'FHD',
  },
  {
    id: 'saver-360p',
    name: 'Extreme Saver 360p',
    category: 'storage',
    targetMaxMB: null,
    targetResolution: '360p',
    videoBitrateKbps: 550,
    audioBitrateKbps: 64,
    fps: 24,
    description: 'Maximum space savings (up to 90%+), ideal for spoken lectures or voice clips.',
    badgeLabel: 'Ultra Small',
  },
  {
    id: 'custom',
    name: 'Custom (HandBrake)',
    category: 'quality',
    targetMaxMB: null,
    targetResolution: 'custom',
    videoBitrateKbps: 1500,
    audioBitrateKbps: 128,
    fps: 30,
    description: 'Configure exact width, height, aspect ratio, bitrate, and frame rate.',
    badgeLabel: 'Advanced',
  },
];

export const DEFAULT_SETTINGS: CompressionSettings = {
  presetId: 'balanced-720p',
  targetResolution: '720p',
  customWidth: 1280,
  customHeight: 720,
  lockAspectRatio: true,
  videoBitrateKbps: 1400,
  audioBitrateKbps: 128,
  fps: 30,
  targetMaxMB: null,
  autoDownloadSequential: true,
  muteAudio: false,
  preferredFormat: 'mp4',
};

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}
