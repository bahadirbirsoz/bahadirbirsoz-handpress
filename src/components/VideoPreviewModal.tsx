import React, { useState, useEffect } from 'react';
import { X, Download, Film, CheckCircle2 } from 'lucide-react';
import { VideoQueueItem } from '../types';
import { formatBytes } from '../utils/presets';
import { downloadFile } from '../utils/videoCompressor';

interface VideoPreviewModalProps {
  item: VideoQueueItem | null;
  onClose: () => void;
}

export const VideoPreviewModal: React.FC<VideoPreviewModalProps> = ({ item, onClose }) => {
  const [viewMode, setViewMode] = useState<'compressed' | 'original' | 'split'>('compressed');
  const [compressedUrl, setCompressedUrl] = useState<string>('');
  const [originalUrl, setOriginalUrl] = useState<string>('');

  useEffect(() => {
    if (!item) return;

    const orig = URL.createObjectURL(item.file);
    setOriginalUrl(orig);

    let comp = '';
    if (item.compressedBlob) {
      comp = URL.createObjectURL(item.compressedBlob);
      setCompressedUrl(comp);
    }

    return () => {
      URL.revokeObjectURL(orig);
      if (comp) URL.revokeObjectURL(comp);
    };
  }, [item]);

  if (!item) return null;

  const handleDownload = () => {
    if (item.compressedBlob) {
      const baseName = item.name.replace(/\.[^/.]+$/, '');
      const ext = item.outputFormat === 'mp4' ? 'mp4' : 'webm';
      downloadFile(item.compressedBlob, `${baseName}_compressed.${ext}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-6 backdrop-blur-md">
      <div className="relative flex flex-col w-full max-w-3xl rounded-2xl border border-slate-800 bg-[#0e1420] shadow-2xl overflow-hidden max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 sm:px-6 py-3.5 bg-[#0e1420]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-950 text-cyan-400">
              <Film className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">
                {item.name}
              </h3>
              <p className="text-xs text-slate-400">
                Compressed from {formatBytes(item.originalSize)} to {formatBytes(item.compressedSize)} (-{item.savedPercentage}%)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-slate-950 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Save</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* View Mode Segmented Controls */}
        <div className="flex items-center justify-center gap-1 p-2 bg-[#0b0f17] border-b border-slate-800/80">
          <button
            onClick={() => setViewMode('compressed')}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
              viewMode === 'compressed'
                ? 'bg-cyan-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Compressed ({formatBytes(item.compressedSize)})
          </button>
          <button
            onClick={() => setViewMode('original')}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
              viewMode === 'original'
                ? 'bg-cyan-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Original ({formatBytes(item.originalSize)})
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`hidden sm:block px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
              viewMode === 'split'
                ? 'bg-cyan-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Side by Side
          </button>
        </div>

        {/* Video Player Display Area */}
        <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center bg-black/60 min-h-[300px]">
          {viewMode === 'compressed' && compressedUrl && (
            <div className="w-full flex flex-col items-center">
              <video
                controls
                autoPlay
                playsInline
                src={compressedUrl}
                className="max-h-[55vh] w-auto rounded-lg shadow-lg"
              />
              <span className="mt-2 text-xs text-slate-400 font-mono">
                {item.compressedWidth}×{item.compressedHeight} · {item.outputFormat.toUpperCase()} · {formatBytes(item.compressedSize)}
              </span>
            </div>
          )}

          {viewMode === 'original' && originalUrl && (
            <div className="w-full flex flex-col items-center">
              <video
                controls
                autoPlay
                playsInline
                src={originalUrl}
                className="max-h-[55vh] w-auto rounded-lg shadow-lg"
              />
              <span className="mt-2 text-xs text-slate-400 font-mono">
                {item.originalWidth}×{item.originalHeight} · Original · {formatBytes(item.originalSize)}
              </span>
            </div>
          )}

          {viewMode === 'split' && (
            <div className="grid grid-cols-2 gap-3 w-full">
              <div className="flex flex-col items-center">
                <span className="text-xs font-semibold text-slate-300 mb-1.5">
                  Original ({item.originalWidth}×{item.originalHeight})
                </span>
                <video
                  controls
                  playsInline
                  src={originalUrl}
                  className="max-h-[45vh] w-full object-contain rounded-lg bg-black"
                />
                <span className="mt-1 text-xs font-mono text-slate-400">
                  {formatBytes(item.originalSize)}
                </span>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-xs font-semibold text-emerald-400 mb-1.5 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Compressed ({item.compressedWidth}×{item.compressedHeight})
                </span>
                <video
                  controls
                  playsInline
                  src={compressedUrl}
                  className="max-h-[45vh] w-full object-contain rounded-lg bg-black"
                />
                <span className="mt-1 text-xs font-mono text-emerald-400">
                  {formatBytes(item.compressedSize)} (-{item.savedPercentage}%)
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
