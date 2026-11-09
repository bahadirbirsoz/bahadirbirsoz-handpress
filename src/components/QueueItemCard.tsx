import React from 'react';
import {
  Download,
  Trash2,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Film,
  Zap,
} from 'lucide-react';
import { VideoQueueItem } from '../types';
import { formatBytes, formatDuration } from '../utils/presets';
import { downloadFile } from '../utils/videoCompressor';

interface QueueItemCardProps {
  item: VideoQueueItem;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onPreview: (item: VideoQueueItem) => void;
}

export const QueueItemCard: React.FC<QueueItemCardProps> = ({
  item,
  onRemove,
  onRetry,
  onPreview,
}) => {
  const handleDownload = () => {
    if (item.compressedBlob) {
      const baseName = item.name.replace(/\.[^/.]+$/, '');
      const ext = item.outputFormat === 'mp4' ? 'mp4' : 'webm';
      downloadFile(item.compressedBlob, `${baseName}_compressed.${ext}`);
    }
  };

  return (
    <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 rounded-xl border border-slate-800/80 bg-[#121824] p-3.5 transition-all hover:border-slate-700/80">
      {/* Left: Thumbnail & Details */}
      <div className="flex items-start gap-3 w-full sm:w-auto flex-1 min-w-0">
        {/* Thumbnail Container */}
        <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center">
          {item.thumbnailUrl ? (
            <img
              src={item.thumbnailUrl}
              alt={item.name}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <Film className="h-6 w-6 text-slate-600" />
          )}

          {/* Duration timestamp overlay */}
          <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[10px] font-mono text-white">
            {formatDuration(item.duration)}
          </span>

          {item.status === 'completed' && (
            <button
              onClick={() => onPreview(item)}
              title="Preview compressed video"
              className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/60 transition-colors group"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500 text-slate-950 shadow-md group-hover:scale-110 transition-transform">
                <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
              </div>
            </button>
          )}
        </div>

        {/* Video Metadata & Title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-white truncate" title={item.name}>
              {item.name}
            </h4>
          </div>

          {/* Source Specs: unboxed text with typographic bullet separator */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400 mt-0.5">
            <span className="font-mono tabular-nums">{formatBytes(item.originalSize)}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="font-mono tabular-nums">
              {item.originalWidth > 0 ? `${item.originalWidth}×${item.originalHeight}` : 'Probing...'}
            </span>
          </div>

          {/* Compressing Progress state */}
          {item.status === 'compressing' && (
            <div className="mt-2 w-full max-w-md">
              <div className="flex items-center justify-between text-[11px] mb-1 font-mono">
                <span className="text-cyan-400 font-semibold flex items-center gap-1">
                  <Zap className="h-3 w-3 fill-current" />
                  Compressing {item.progress}%
                </span>
                <span className="text-slate-400">
                  {item.currentFps > 0 && `${item.currentFps} FPS · `}
                  {item.estimatedSecondsRemaining > 0
                    ? `~${item.estimatedSecondsRemaining}s left`
                    : `${item.elapsedSeconds}s`}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Completed State Stats */}
          {item.status === 'completed' && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-emerald-400 font-mono tabular-nums">
                {formatBytes(item.compressedSize)}
              </span>
              <span className="text-emerald-500/90 font-medium font-mono">
                (-{item.savedPercentage}%)
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-slate-400 font-mono">
                {item.compressedWidth}×{item.compressedHeight} ({item.outputFormat.toUpperCase()})
              </span>
            </div>
          )}

          {/* Error Message */}
          {item.status === 'error' && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-rose-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{item.errorMessage || 'Compression failed'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        {item.status === 'completed' && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onPreview(item)}
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <Play className="h-3 w-3 fill-current" />
              <span>Preview</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-sm shadow-emerald-500/20 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Save</span>
            </button>
          </div>
        )}

        {item.status === 'error' && (
          <button
            onClick={() => onRetry(item.id)}
            className="flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5 text-cyan-400" />
            <span>Retry</span>
          </button>
        )}

        {item.status !== 'compressing' && (
          <button
            onClick={() => onRemove(item.id)}
            title="Remove from queue"
            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800/60 rounded-lg transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};
