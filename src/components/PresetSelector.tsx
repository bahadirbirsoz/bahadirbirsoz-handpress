import React from 'react';
import { SlidersHorizontal, Check, Zap, MessageSquare, Mail, Film, HardDrive } from 'lucide-react';
import { COMPRESSION_PRESETS } from '../utils/presets';
import { CompressionPreset, CompressionSettings } from '../types';

interface PresetSelectorProps {
  settings: CompressionSettings;
  onSelectPreset: (preset: CompressionPreset) => void;
  onOpenAdvanced: () => void;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  settings,
  onSelectPreset,
  onOpenAdvanced,
}) => {
  const getPresetIcon = (id: string) => {
    switch (id) {
      case 'whatsapp':
        return <MessageSquare className="h-4 w-4 text-emerald-400" />;
      case 'discord':
        return <Zap className="h-4 w-4 text-indigo-400" />;
      case 'email':
        return <Mail className="h-4 w-4 text-sky-400" />;
      case 'high-1080p':
      case 'balanced-720p':
        return <Film className="h-4 w-4 text-cyan-400" />;
      case 'saver-360p':
        return <HardDrive className="h-4 w-4 text-amber-400" />;
      default:
        return <SlidersHorizontal className="h-4 w-4 text-purple-400" />;
    }
  };

  return (
    <div id="presets" className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-400">
            Compression Presets
          </h2>
          <p className="text-xs text-slate-500">
            Choose a target upload limit or customize HandBrake video parameters
          </p>
        </div>

        <button
          onClick={onOpenAdvanced}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors py-1 px-2 rounded-lg hover:bg-cyan-950/40"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Advanced HandBrake Controls</span>
        </button>
      </div>

      {/* Preset Grid / Scrollable on mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {COMPRESSION_PRESETS.map((preset) => {
          const isSelected = settings.presetId === preset.id;

          return (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(preset)}
              className={`relative flex flex-col items-start p-3.5 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'border-cyan-500/80 bg-cyan-950/20 shadow-sm shadow-cyan-500/10'
                  : 'border-slate-800 bg-[#121824]/60 hover:border-slate-700 hover:bg-[#151d2a]'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800">
                  {getPresetIcon(preset.id)}
                </div>
                {isSelected ? (
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400">
                    <Check className="h-3.5 w-3.5" />
                    <span>Active</span>
                  </div>
                ) : (
                  preset.badgeLabel && (
                    <span className="text-[10px] font-medium text-slate-400">
                      {preset.badgeLabel}
                    </span>
                  )
                )}
              </div>

              <span className="font-semibold text-sm text-white mb-0.5 tracking-tight">
                {preset.name}
              </span>

              {/* Unboxed metadata line with typographic bullet separators */}
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1.5">
                <span>{preset.targetResolution.toUpperCase()}</span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                {preset.targetMaxMB ? (
                  <span>Max {preset.targetMaxMB} MB</span>
                ) : (
                  <span>{preset.videoBitrateKbps} kbps</span>
                )}
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>{preset.fps} FPS</span>
              </div>

              <p className="text-[11px] text-slate-500 line-clamp-2 leading-tight">
                {preset.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
