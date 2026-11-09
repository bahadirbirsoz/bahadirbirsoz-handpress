import React, { useState } from 'react';
import {
  X,
  SlidersHorizontal,
  Link2,
  Link2Off,
  Volume2,
  VolumeX,
  Sparkles,
  Zap,
  HardDrive,
  Info,
  Layers,
} from 'lucide-react';
import { CompressionSettings, TargetResolutionMode } from '../types';

interface AdvancedSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: CompressionSettings;
  onChangeSettings: (newSettings: CompressionSettings) => void;
}

export const AdvancedSettingsDrawer: React.FC<AdvancedSettingsDrawerProps> = ({
  isOpen,
  onClose,
  settings,
  onChangeSettings,
}) => {
  if (!isOpen) return null;

  const updateSetting = <K extends keyof CompressionSettings>(
    key: K,
    value: CompressionSettings[K]
  ) => {
    onChangeSettings({
      ...settings,
      [key]: value,
      // If user adjusts custom values, mark preset as custom
      presetId: key === 'presetId' ? (value as string) : 'custom',
    });
  };

  const setAspectRatioPreset = (w: number, h: number) => {
    onChangeSettings({
      ...settings,
      presetId: 'custom',
      targetResolution: 'custom',
      customWidth: w,
      customHeight: h,
    });
  };

  // Estimate file size per minute
  const totalBitrateKbps = (settings.muteAudio ? 0 : settings.audioBitrateKbps) + settings.videoBitrateKbps;
  const estimatedMBPerMinute = ((totalBitrateKbps * 60) / 8 / 1024).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm transition-opacity">
      {/* Drawer Container (Responsive: full width on mobile, max-w-md on tablet/desktop) */}
      <div className="relative flex h-full w-full max-w-lg flex-col border-l border-slate-800 bg-[#0d131d] shadow-2xl overflow-y-auto">
        {/* Drawer Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-[#0d131d]/95 px-5 py-4 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                HandBrake Controls
              </h2>
              <p className="text-xs text-slate-400">
                Custom resolution, bitrate, audio & frame rate
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Close settings"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 space-y-6 p-5">
          {/* Section 1: Resolution & Geometry */}
          <div className="rounded-xl border border-slate-800/90 bg-[#121926] p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Resolution & Dimensions
              </label>
              <span className="text-xs text-cyan-400 font-medium">
                {settings.targetResolution.toUpperCase()}
              </span>
            </div>

            {/* Resolution Selector Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900 rounded-lg mb-3">
              {(['source', '1080p', '720p', '480p', '360p', 'custom'] as TargetResolutionMode[]).map(
                (mode) => (
                  <button
                    key={mode}
                    onClick={() => updateSetting('targetResolution', mode)}
                    className={`py-1.5 px-2 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                      settings.targetResolution === mode
                        ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    {mode === 'source' ? 'Original' : mode.toUpperCase()}
                  </button>
                )
              )}
            </div>

            {/* Custom Dimensions Form */}
            {settings.targetResolution === 'custom' && (
              <div className="mt-3 space-y-3 pt-3 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[11px] font-medium text-slate-400 block mb-1">
                      Width (px)
                    </label>
                    <input
                      type="number"
                      step={2}
                      min={120}
                      max={3840}
                      value={settings.customWidth}
                      onChange={(e) => {
                        const newW = parseInt(e.target.value) || 1280;
                        if (settings.lockAspectRatio) {
                          const ratio = settings.customWidth / Math.max(1, settings.customHeight);
                          const newH = Math.round(newW / ratio / 2) * 2;
                          onChangeSettings({
                            ...settings,
                            presetId: 'custom',
                            customWidth: newW,
                            customHeight: newH,
                          });
                        } else {
                          updateSetting('customWidth', newW);
                        }
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white font-mono tabular-nums focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  <div className="pt-5">
                    <button
                      onClick={() => updateSetting('lockAspectRatio', !settings.lockAspectRatio)}
                      title={settings.lockAspectRatio ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
                      className={`p-2 rounded-lg border transition-colors ${
                        settings.lockAspectRatio
                          ? 'border-cyan-500/50 bg-cyan-950/40 text-cyan-400'
                          : 'border-slate-800 bg-slate-900 text-slate-500'
                      }`}
                    >
                      {settings.lockAspectRatio ? (
                        <Link2 className="h-4 w-4" />
                      ) : (
                        <Link2Off className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  <div className="flex-1">
                    <label className="text-[11px] font-medium text-slate-400 block mb-1">
                      Height (px)
                    </label>
                    <input
                      type="number"
                      step={2}
                      min={120}
                      max={2160}
                      value={settings.customHeight}
                      onChange={(e) => {
                        const newH = parseInt(e.target.value) || 720;
                        if (settings.lockAspectRatio) {
                          const ratio = settings.customWidth / Math.max(1, settings.customHeight);
                          const newW = Math.round(newH * ratio / 2) * 2;
                          onChangeSettings({
                            ...settings,
                            presetId: 'custom',
                            customWidth: newW,
                            customHeight: newH,
                          });
                        } else {
                          updateSetting('customHeight', newH);
                        }
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white font-mono tabular-nums focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Aspect Ratio Shortcuts */}
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1.5">
                    Quick Frame Ratios:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setAspectRatioPreset(1920, 1080)}
                      className="px-2.5 py-1 text-[11px] rounded bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700"
                    >
                      16:9 (1080p)
                    </button>
                    <button
                      onClick={() => setAspectRatioPreset(1080, 1920)}
                      className="px-2.5 py-1 text-[11px] rounded bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700"
                    >
                      9:16 (Shorts/Reels)
                    </button>
                    <button
                      onClick={() => setAspectRatioPreset(1080, 1080)}
                      className="px-2.5 py-1 text-[11px] rounded bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700"
                    >
                      1:1 (Square)
                    </button>
                    <button
                      onClick={() => setAspectRatioPreset(1440, 1080)}
                      className="px-2.5 py-1 text-[11px] rounded bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700"
                    >
                      4:3 (Classic)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Video Bitrate & Quality */}
          <div className="rounded-xl border border-slate-800/90 bg-[#121926] p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Video Bitrate
              </label>
              <span className="text-sm font-semibold text-cyan-400 font-mono tabular-nums">
                {settings.videoBitrateKbps} kbps ({(settings.videoBitrateKbps / 1000).toFixed(1)} Mbps)
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Higher bitrates preserve finer details in motion scenes; lower bitrates drastically reduce file size.
            </p>

            <input
              type="range"
              min={200}
              max={8000}
              step={100}
              value={settings.videoBitrateKbps}
              onChange={(e) => updateSetting('videoBitrateKbps', parseInt(e.target.value))}
              className="w-full accent-cyan-400 h-2 bg-slate-900 rounded-lg cursor-pointer"
            />

            <div className="flex justify-between text-[11px] text-slate-500 font-mono mt-1">
              <span>200k (Smallest)</span>
              <span>1,500k (Balanced)</span>
              <span>8,000k (Master)</span>
            </div>

            <div className="mt-3 flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/60 text-xs">
              <span className="text-slate-400">Estimated Output Volume:</span>
              <span className="text-emerald-400 font-mono font-medium">
                ~{estimatedMBPerMinute} MB per minute
              </span>
            </div>
          </div>

          {/* Section 3: Audio Encoding */}
          <div className="rounded-xl border border-slate-800/90 bg-[#121926] p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Audio Stream
              </label>
              <button
                onClick={() => updateSetting('muteAudio', !settings.muteAudio)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  settings.muteAudio
                    ? 'border-amber-500/50 bg-amber-950/30 text-amber-300'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                {settings.muteAudio ? (
                  <>
                    <VolumeX className="h-3.5 w-3.5" />
                    <span>Audio Stripped</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Audio Kept</span>
                  </>
                )}
              </button>
            </div>

            {!settings.muteAudio && (
              <div>
                <span className="text-[11px] text-slate-400 block mb-1.5">
                  Audio Bitrate (AAC / Opus):
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[64, 96, 128, 192].map((bitrate) => (
                    <button
                      key={bitrate}
                      onClick={() => updateSetting('audioBitrateKbps', bitrate)}
                      className={`py-1.5 px-2 rounded text-xs font-mono font-medium transition-colors ${
                        settings.audioBitrateKbps === bitrate
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {bitrate}k
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Frame Rate (FPS) */}
          <div className="rounded-xl border border-slate-800/90 bg-[#121926] p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Frame Rate (FPS)
              </label>
              <span className="text-xs font-mono text-cyan-400">
                {settings.fps === 'source' ? 'Original Source' : `${settings.fps} FPS`}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {(['source', 15, 24, 30, 60] as (number | 'source')[]).map((fps) => (
                <button
                  key={fps}
                  onClick={() => updateSetting('fps', fps)}
                  className={`py-1.5 px-2 rounded text-xs font-mono font-medium transition-colors ${
                    settings.fps === fps
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {fps === 'source' ? 'Source' : `${fps}`}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Dropping from 60 to 30 or 24 FPS cuts up to 35% additional file weight without lowering spatial resolution.
            </p>
          </div>

          {/* Section 5: Batch & Export Options */}
          <div className="rounded-xl border border-slate-800/90 bg-[#121926] p-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 block mb-3">
              Batch & Export Automation
            </label>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60 mb-2">
              <div>
                <span className="text-xs font-medium text-white block">
                  Sequential Auto-Save to Android
                </span>
                <span className="text-[11px] text-slate-400">
                  Automatically triggers file download as each video completes
                </span>
              </div>

              <input
                type="checkbox"
                checked={settings.autoDownloadSequential}
                onChange={(e) => updateSetting('autoDownloadSequential', e.target.checked)}
                className="h-4 w-4 rounded accent-cyan-400 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60">
              <div>
                <span className="text-xs font-medium text-white block">
                  Target Container Format
                </span>
                <span className="text-[11px] text-slate-400">
                  MP4 (H.264) for Android gallery; WebM for pure web
                </span>
              </div>

              <select
                value={settings.preferredFormat}
                onChange={(e) => updateSetting('preferredFormat', e.target.value as 'mp4' | 'webm')}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white focus:outline-none"
              >
                <option value="mp4">MP4 (Recommended)</option>
                <option value="webm">WebM</option>
              </select>
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="sticky bottom-0 border-t border-slate-800 bg-[#0d131d]/95 p-4 backdrop-blur-md">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-cyan-500 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 hover:bg-cyan-400 active:scale-[0.99] transition-all"
          >
            Apply Settings
          </button>
        </div>
      </div>
    </div>
  );
};
