import { useState, useEffect } from 'react';
import type { TransferProgress } from '../types';

export function useTransfer() {
  const [transferProgress, setTransferProgress] = useState<TransferProgress | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [downloadFileInfo, setDownloadFileInfo] = useState<{ name: string; path: string } | null>(null);
  const [downloadMethod, setDownloadMethod] = useState<'kubectl-cp' | 'dd-limit'>('kubectl-cp');
  const [limitSpeed, setLimitSpeed] = useState<number>(1024);

  useEffect(() => {
    const unsubscribe = window.electronAPI.onTransferProgress((progress) => {
      setTransferProgress(progress);
      if (progress.status === 'completed' || progress.status === 'error') {
        setTimeout(() => {
          setIsTransferring(false);
          setTransferProgress(null);
        }, 2000);
      }
    });

    return unsubscribe;
  }, []);

  return {
    transferProgress,
    isTransferring,
    setIsTransferring,
    showDownloadDialog,
    setShowDownloadDialog,
    downloadFileInfo,
    setDownloadFileInfo,
    downloadMethod,
    setDownloadMethod,
    limitSpeed,
    setLimitSpeed,
  };
}
