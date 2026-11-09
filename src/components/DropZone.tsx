import React, { useRef, useState } from 'react';
import { UploadCloud, Plus, Video, Play, Sparkles, AlertCircle } from 'lucide-react';
import { createDemoVideoFile } from '../utils/videoCompressor';

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  isProcessing: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onFilesSelected,
  isProcessing,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isProcessing) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isProcessing) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const validFiles = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith('video/') || /\.(mp4|mov|mkv|webm|m4v|avi|3gp)$/i.test(file.name)
      );
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
      // Reset input value so same files can be re-selected if removed
      e.target.value = '';
    }
  };

  const handleLoadDemo = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isProcessing || isGeneratingDemo) return;
    setIsGeneratingDemo(true);
    try {
      const demoFile = await createDemoVideoFile();
      onFilesSelected([demoFile]);
    } catch (err) {
      console.error('Failed to create demo video', err);
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => {
        if (!isProcessing) fileInputRef.current?.click();
      }}
      className={`group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-all cursor-pointer ${
        isDragOver
          ? 'border-cyan-400 bg-cyan-950/30 shadow-lg shadow-cyan-500/10'
          : 'border-slate-800 bg-[#101622]/80 hover:border-slate-700 hover:bg-[#131b29]'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
        disabled={isProcessing}
      />

      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 text-cyan-400 mb-3.5 group-hover:scale-105 group-hover:border-cyan-500/40 transition-transform">
        <UploadCloud className="h-7 w-7" />
      </div>

      <h3 className="text-base font-semibold text-white tracking-tight">
        Tap to Select Videos or Drag & Drop
      </h3>
      <p className="mt-1 text-xs text-slate-400 max-w-sm">
        Supports multiple videos at once for batch processing. MP4, MOV, WebM, MKV, and Android Camera files.
      </p>

      {/* Action Buttons row */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-slate-950 shadow-sm shadow-cyan-500/20 hover:bg-cyan-400 transition-colors"
        >
          <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
          <span>Browse Device Files</span>
        </button>

        <button
          type="button"
          onClick={handleLoadDemo}
          disabled={isGeneratingDemo}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          <span>{isGeneratingDemo ? 'Generating Sample...' : 'Try Demo Video'}</span>
        </button>
      </div>

      {/* Unboxed features banner */}
      <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-500">
        <span>100% Offline Processing</span>
        <span aria-hidden="true">·</span>
        <span>Zero Server Uploads</span>
        <span aria-hidden="true">·</span>
        <span>Batch Queue Ready</span>
      </div>
    </div>
  );
};
