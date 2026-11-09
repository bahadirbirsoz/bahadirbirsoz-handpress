import React from 'react';
import { Play, Square, Download, HardDrive, CheckCheck, Zap } from 'lucide-react';
import { VideoQueueItem } from '../types';
import { formatBytes } from '../utils/presets';
import { downloadFile } from '../utils/videoCompressor';

interface BatchSummaryBarProps {
  queue: VideoQueueItem[];
  isProcessing: boolean;
  currentProcessingIndex: number;
  onStartBatch: () => void;
  onCancelBatch: () => void;
}

export const BatchSummaryBar: React.FC<BatchSummaryBarProps> = ({
  queue,
  isProcessing,
  currentProcessingIndex,
  onStartBatch,
  onCancelBatch,
}) => {
  if (queue.length === 0) return null;

  const totalOriginalBytes = queue.reduce((acc, item) => acc + item.originalSize, 0);
  const completedItems = queue.filter((item) => item.status === 'completed');
  const totalCompressedBytes = completedItems.reduce((acc, item) => acc + item.compressedSize, 0);
  const totalSavedBytes = completedItems.reduce(
    (acc, item) => acc + Math.max(0, item.originalSize - item.compressedSize),
    0
  );

  const pendingCount = queue.filter(
    (item) => item.status === 'idle' || item.status === 'error'
  ).length;

  const handleDownloadAll = () => {
    completedItems.forEach((item, index) => {
      if (item.compressedBlob) {
        setTimeout(() => {
          const baseName = item.name.replace(/\.[^/.]+$/, '');
          const ext = item.outputFormat === 'mp4' ? 'mp4' : 'webm';
          downloadFile(item.compressedBlob!, `${baseName}_compressed.${ext}`);
        }, index * 400); // Small stagger to ensure Android Downloads downloads cleanly
      }
    });
  };

  return (
    <div className="sticky bottom-0 z-30 w-full border-t border-slate-800 bg-[#0d131d]/95 p-3.5 sm:p-4 backdrop-blur-md shadow-2xl">
      <div className="mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 max-w-7xl">
        {/* Left: Batch Queue Stats */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-slate-300 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="text-white font-semibold font-mono tabular-nums">{queue.length}</span>
            <span className="text-slate-400">videos queued ({formatBytes(totalOriginalBytes)})</span>
          </div>

          {completedItems.length > 0 && (
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold font-mono tabular-nums">
              <CheckCheck className="h-4 w-4" />
              <span>
                {completedItems.length} done · Saved {formatBytes(totalSavedBytes)}
              </span>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          {completedItems.length > 1 && !isProcessing && (
            <button
              onClick={handleDownloadAll}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-emerald-400" />
              <span>Save All ({completedItems.length})</span>
            </button>
          )}

          {isProcessing ? (
            <button
              onClick={onCancelBatch}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl bg-rose-500/20 border border-rose-500/40 px-5 py-2.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/30 transition-colors"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              <span>
                Cancel ({currentProcessingIndex + 1}/{queue.length})
              </span>
            </button>
          ) : (
            <button
              onClick={onStartBatch}
              disabled={pendingCount === 0}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-xs font-bold transition-all shadow-lg ${
                pendingCount > 0
                  ? 'bg-gradient-to-r from-cyan-500 to-emerald-400 text-slate-950 shadow-cyan-500/20 hover:opacity-95 active:scale-[0.98]'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>
                {completedItems.length > 0 && pendingCount > 0
                  ? `Compress Remaining (${pendingCount})`
                  : `Start Compression (${pendingCount})`}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
