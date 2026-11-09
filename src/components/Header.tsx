import React, { useState } from 'react';
import { Download, Film, HardDrive, ShieldCheck, Sparkles } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface HeaderProps {
  queueCount: number;
  onOpenSettings: () => void;
  onClearQueue: () => void;
  onScrollToSection: (sectionId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  queueCount,
  onOpenSettings,
  onClearQueue,
  onScrollToSection,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-[#0b0f17]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Brand Wordmark (Single text element + icon) */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 text-slate-950 shadow-sm shadow-cyan-500/20">
            <Film className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white whitespace-nowrap">
            HandPress
          </span>
        </div>

        {/* Zone 2: Navigation Links (single-line, clean unboxed text) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <button
            onClick={() => onScrollToSection('presets')}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Presets
          </button>
          <button
            onClick={onOpenSettings}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            HandBrake Settings
          </button>
          <button
            onClick={() => onScrollToSection('queue')}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Queue ({queueCount})
          </button>
          <button
            onClick={() => onScrollToSection('privacy')}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 text-emerald-400/90"
          >
            <ShieldCheck className="h-4 w-4" />
            100% Offline & Private
          </button>
        </nav>

        {/* Zone 3: Primary Action / PWA Install Button */}
        <div className="flex items-center gap-2.5 shrink-0">
          {queueCount > 0 && (
            <button
              onClick={onClearQueue}
              className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-400 transition-colors whitespace-nowrap shrink-0"
            >
              Clear Queue
            </button>
          )}

          {isInstallable && !isInstalled && (
            <button
              onClick={install}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 px-3.5 py-1.5 text-xs font-semibold text-slate-950 transition-colors shadow-sm shadow-cyan-500/20 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              Install on Android
            </button>
          )}

          {isIOS && !isInstalled && (
            <button
              onClick={() => setShowIOSGuide(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              Install App
            </button>
          )}

          {isInstalled && (
            <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium whitespace-nowrap shrink-0">
              <HardDrive className="h-3.5 w-3.5" />
              Installed App
            </div>
          )}
        </div>
      </div>

      {/* iOS Safari Installation Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-white">Install HandPress on iOS</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              1. Tap the <span className="font-semibold text-white">Share</span> button in Safari toolbar below.<br />
              2. Scroll down and choose <span className="font-semibold text-white">Add to Home Screen</span>.<br />
              3. HandPress will launch as a standalone full-screen app with offline support.
            </p>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full rounded-xl bg-slate-800 py-2.5 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
