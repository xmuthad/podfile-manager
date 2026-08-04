import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { TransferProgress } from '../types';

export function useTransfer() {
  const [transferProgress, setTransferProgress] = useState<TransferProgress | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [downloadFileInfo, setDownloadFileInfo] = useState<{ name: string; path: string } | null>(null);
  const [downloadMethod, setDownloadMethod] = useState<'kubectl-cp' | 'dd-limit'>('kubectl-cp');
  const [limitSpeed, setLimitSpeed] = useState<number>(1024);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestProgressRef = useRef<TransferProgress | null>(null);
  const rafIdRef = useRef<number>(0);

  const flushProgress = useCallback(() => {
    const p = latestProgressRef.current;
    if (p) {
      setTransferProgress(p);
      setIsTransferring(true);
    }
    rafIdRef.current = 0;

    if (p && (p.status === 'completed' || p.status === 'error')) {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => {
        setIsTransferring(false);
        setTransferProgress(null);
        clearTimerRef.current = null;
      }, 2000);
    }
  }, []);

  useEffect(() => {
    // 浏览器预览或测试时 electronAPI 不存在，跳过订阅
    if (!window.electronAPI) return;
    const unsubscribe = window.electronAPI.onTransferProgress((progress) => {
      latestProgressRef.current = progress;

      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(flushProgress);
      }
    });

    return () => {
      unsubscribe();
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, [flushProgress]);

  return useMemo(() => ({
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
  }), [transferProgress, isTransferring, showDownloadDialog,
    downloadFileInfo, downloadMethod, limitSpeed]);
}
