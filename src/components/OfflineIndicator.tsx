import React from 'react';
import { WifiOff, ShieldCheck } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 z-40 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-950/90 px-3.5 py-2 text-xs font-medium text-amber-200 shadow-xl backdrop-blur-md">
      <WifiOff className="h-4 w-4 text-amber-400" />
      <span>Offline Mode — All video compression runs 100% locally on your phone.</span>
    </div>
  );
};
