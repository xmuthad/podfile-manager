import { useState, useCallback, useMemo } from 'react';
import type { RefObject } from 'react';
import type { ParsedFileItem } from '../types';
import type { ToastType } from './useToast';

type ToastFn = (message: string, type?: ToastType) => void;

/**
 * 文件操作：下载 / 上传 / 编辑 / 批量下载。
 *
 * 依赖外部传入的导航状态和文件浏览状态。
 */
export function useFileActions(deps: {
  selectedNamespaceRef: RefObject<string>;
  selectedPod: string;
  selectedContainer: string;
  currentPath: string;
  selectedFiles: Set<string>;
  loadFiles: (pod: string, container: string, path: string) => void;
  setLoading: (v: boolean) => void;
  setError: (v: string) => void;
  setSelectedFiles: (v: Set<string>) => void;
  toast: ToastFn;
}) {
  const {
    selectedNamespaceRef, selectedPod, selectedContainer,
    currentPath, selectedFiles, loadFiles,
    setLoading, setError, setSelectedFiles, toast,
  } = deps;

  const [showBatchDownloadDialog, setShowBatchDownloadDialog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editFilePath, setEditFilePath] = useState<string>('');
  const [editFileContent, setEditFileContent] = useState<string>('');

  const confirmBatchDownload = useCallback(async (setIsTransferring: (v: boolean) => void) => {
    if (selectedFiles.size === 0) return;
    setShowBatchDownloadDialog(false);
    setIsTransferring(true);
    setError('');

    try {
      const result = await window.electronAPI.batchDownload(
        selectedNamespaceRef.current,
        selectedPod,
        selectedContainer,
        Array.from(selectedFiles),
        '/tmp'
      );
      if (result && result.success) {
        toast(`批量下载完成!\n\n打包文件: ${result.path}`, 'success');
      }
    } catch (err: unknown) {
      setError('批量下载失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsTransferring(false);
      setSelectedFiles(new Set());
    }
  }, [selectedFiles, selectedPod, selectedContainer, selectedNamespaceRef, setError, setSelectedFiles, toast]);

  const startEditFile = useCallback(async (file: ParsedFileItem) => {
    if (file.isDirectory) return;
    setLoading(true);
    setError('');
    try {
      const content = await window.electronAPI.readFile(selectedNamespaceRef.current, selectedPod, selectedContainer, file.filePath);
      setEditFilePath(file.filePath);
      setEditFileContent(content);
      setIsEditMode(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedPod, selectedContainer, selectedNamespaceRef, setLoading, setError]);

  const saveEditFile = useCallback(async () => {
    if (!editFilePath) return;
    setLoading(true);
    setError('');
    try {
      await window.electronAPI.writeFile(selectedNamespaceRef.current, selectedPod, selectedContainer, editFilePath, editFileContent);
      toast(`文件已保存: ${editFilePath}`, 'success');
      setIsEditMode(false);
      setEditFileContent('');
    } catch (err: unknown) {
      setError('保存失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, [editFileContent, selectedPod, selectedContainer, editFilePath, selectedNamespaceRef, setLoading, setError, toast]);

  const cancelEditFile = useCallback(() => {
    setIsEditMode(false);
    setEditFileContent('');
    setError('');
  }, [setError]);

  const downloadDirectory = useCallback(async (setIsTransferring: (v: boolean) => void) => {
    setLoading(true);
    setError('');
    let startedTransfer = false;
    try {
      const allFiles = await window.electronAPI.getDirectoryTree(selectedNamespaceRef.current, selectedPod, selectedContainer, currentPath);
      if (allFiles.length === 0) {
        toast('目录为空或无法访问', 'warning');
        return;
      }
      if (allFiles.length > 1000) {
        toast(`文件数量过多 (${allFiles.length})，请考虑只下载部分目录`, 'warning');
        return;
      }

      setIsTransferring(true);
      startedTransfer = true;
      const result = await window.electronAPI.batchDownload(selectedNamespaceRef.current, selectedPod, selectedContainer, allFiles, '/tmp');
      if (result && result.success) {
        toast(`目录下载完成!\n\n文件数量: ${allFiles.length}\n打包文件: ${result.path}`, 'success');
      }
    } catch (err: unknown) {
      setError('目录下载失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
      if (startedTransfer) {
        setIsTransferring(false);
      }
    }
  }, [selectedPod, selectedContainer, currentPath, selectedNamespaceRef, setLoading, setError, toast]);

  const uploadFile = useCallback(async (setIsTransferring: (v: boolean) => void) => {
    setIsTransferring(true);
    setError('');
    try {
      const result = await window.electronAPI.uploadFile(selectedNamespaceRef.current, selectedPod, selectedContainer, currentPath);
      if (result) {
        toast(`文件已上传: ${result}`, 'success');
        await loadFiles(selectedPod, selectedContainer, currentPath);
      }
      setIsTransferring(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setIsTransferring(false);
    }
  }, [selectedPod, selectedContainer, currentPath, selectedNamespaceRef, loadFiles, setError, toast]);

  const confirmDownload = useCallback(async (
    downloadFileInfo: { name: string; path: string } | null,
    downloadMethod: string,
    limitSpeed: number,
    setIsTransferring: (v: boolean) => void,
    setShowDownloadDialog: (v: boolean) => void
  ) => {
    if (!downloadFileInfo) return;

    setShowDownloadDialog(false);
    setIsTransferring(true);
    setError('');

    try {
      if (downloadMethod === 'kubectl-cp') {
        const result = await window.electronAPI.downloadFile(
          selectedNamespaceRef.current,
          selectedPod,
          selectedContainer,
          downloadFileInfo.path
        );
        if (result) {
          toast(`文件已下载: ${result}`, 'success');
        }
      } else {
        const result = await window.electronAPI.downloadFileWithLimit(
          selectedNamespaceRef.current,
          selectedPod,
          selectedContainer,
          downloadFileInfo.path,
          limitSpeed
        );
        if (result) {
          toast(`文件已下载 (限速 ${limitSpeed}KB/s): ${result.path}`, 'success');
        }
      }
      setIsTransferring(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setIsTransferring(false);
    }
  }, [selectedPod, selectedContainer, selectedNamespaceRef, setError, toast]);

  return useMemo(() => ({
    showBatchDownloadDialog, setShowBatchDownloadDialog,
    isEditMode, setIsEditMode, editFilePath, setEditFilePath, editFileContent, setEditFileContent,
    confirmBatchDownload, startEditFile, saveEditFile, cancelEditFile,
    downloadDirectory, uploadFile, confirmDownload,
  }), [showBatchDownloadDialog, isEditMode, editFilePath, editFileContent,
    confirmBatchDownload, startEditFile, saveEditFile, cancelEditFile,
    downloadDirectory, uploadFile, confirmDownload]);
}
