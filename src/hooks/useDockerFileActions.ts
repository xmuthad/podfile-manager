import { useState, useCallback, useMemo } from 'react';
import type { ParsedFileItem } from '../types';
import type { RefObject } from 'react';
import type { ToastType } from './useToast';

type ToastFn = (message: string, type?: ToastType) => void;

interface UseDockerFileActionsDeps {
  selectedDockerImageRef: RefObject<string>;
  dockerFilePath: string;
  dockerSelectedFiles: Set<string>;
  setDockerSelectedFiles: (files: Set<string>) => void;
  toast: ToastFn;
}

export function useDockerFileActions({
  selectedDockerImageRef, dockerFilePath, dockerSelectedFiles,
  setDockerSelectedFiles, toast,
}: UseDockerFileActionsDeps) {
  const [dockerLoading, setDockerLoading] = useState(false);
  const [dockerShowBatchDownloadDialog, setDockerShowBatchDownloadDialog] = useState(false);
  const [dockerEditMode, setDockerEditMode] = useState(false);
  const [dockerEditFilePath, setDockerEditFilePath] = useState('');
  const [dockerEditFileContent, setDockerEditFileContent] = useState('');

  const downloadFromDockerFile = useCallback(async (file: ParsedFileItem, setIsTransferring: (v: boolean) => void, setError: (v: string) => void) => {
    if (file.isDirectory) return;
    setIsTransferring(true);
    setError('');

    try {
      const result = await window.electronAPI.downloadFromDocker(selectedDockerImageRef.current, file.filePath);
      if (result && result.success) {
        toast(`文件已从 Docker 镜像下载成功!\n\n保存位置: ${result.path}`, 'success');
      }
      setIsTransferring(false);
    } catch (err: unknown) {
      setError('下载失败: ' + (err instanceof Error ? err.message : String(err)));
      setIsTransferring(false);
    }
  }, [selectedDockerImageRef, toast]);

  const confirmDockerBatchDownload = useCallback(async (setIsTransferring: (v: boolean) => void, setError: (v: string) => void) => {
    if (dockerSelectedFiles.size === 0) return;
    setDockerShowBatchDownloadDialog(false);
    setIsTransferring(true);
    setError('');

    try {
      const result = await window.electronAPI.batchDownloadDocker(selectedDockerImageRef.current, Array.from(dockerSelectedFiles), '/tmp');
      if (result && result.success) {
        toast(`Docker 批量下载完成!\n\n打包文件: ${result.path}`, 'success');
      }
    } catch (err: unknown) {
      setError('Docker 批量下载失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsTransferring(false);
      setDockerSelectedFiles(new Set());
    }
  }, [dockerSelectedFiles, selectedDockerImageRef, toast, setDockerSelectedFiles]);

  const startDockerEditFile = useCallback(async (file: ParsedFileItem, setError: (v: string) => void) => {
    if (file.isDirectory) return;
    setDockerLoading(true);
    setError('');
    try {
      const content = await window.electronAPI.readDockerFile(selectedDockerImageRef.current, file.filePath);
      setDockerEditFilePath(file.filePath);
      setDockerEditFileContent(content);
      setDockerEditMode(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDockerLoading(false);
    }
  }, [selectedDockerImageRef]);

  const saveDockerEditFile = useCallback(async (setError: (v: string) => void) => {
    if (!dockerEditFilePath) return;
    setDockerLoading(true);
    setError('');
    try {
      await window.electronAPI.writeDockerFile(selectedDockerImageRef.current, dockerEditFilePath, dockerEditFileContent);
      toast(`Docker 镜像文件已保存: ${dockerEditFilePath}`, 'success');
      setDockerEditMode(false);
      setDockerEditFileContent('');
    } catch (err: unknown) {
      setError('Docker 保存失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDockerLoading(false);
    }
  }, [dockerEditFileContent, selectedDockerImageRef, dockerEditFilePath, toast]);

  const cancelDockerEditFile = useCallback(() => {
    setDockerEditMode(false);
    setDockerEditFileContent('');
  }, []);

  const downloadDockerDirectory = useCallback(async (setIsTransferring: (v: boolean) => void, setError: (v: string) => void) => {
    setDockerLoading(true);
    setError('');
    let startedTransfer = false;
    try {
      const allFiles = await window.electronAPI.getDockerDirectoryTree(selectedDockerImageRef.current, dockerFilePath);
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
      const result = await window.electronAPI.batchDownloadDocker(selectedDockerImageRef.current, allFiles, '/tmp');
      if (result && result.success) {
        toast(`Docker 目录下载完成!\n\n文件数量: ${allFiles.length}\n打包文件: ${result.path}`, 'success');
      }
    } catch (err: unknown) {
      setError('Docker 目录下载失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDockerLoading(false);
      if (startedTransfer) {
        setIsTransferring(false);
      }
    }
  }, [selectedDockerImageRef, dockerFilePath, toast]);

  const readDockerFile = useCallback(async (file: ParsedFileItem, setError: (v: string) => void, setFileContent: (v: string) => void, setShowFileViewer: (v: boolean) => void) => {
    if (file.isDirectory) return;
    setDockerLoading(true);
    setError('');
    try {
      const content = await window.electronAPI.readDockerFile(selectedDockerImageRef.current, file.filePath);
      setFileContent(content);
      setShowFileViewer(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDockerLoading(false);
    }
  }, [selectedDockerImageRef]);

  return useMemo(() => ({
    dockerLoading,
    dockerShowBatchDownloadDialog,
    setDockerShowBatchDownloadDialog,
    dockerEditMode,
    setDockerEditMode,
    dockerEditFilePath,
    setDockerEditFilePath,
    dockerEditFileContent,
    setDockerEditFileContent,
    downloadFromDockerFile,
    confirmDockerBatchDownload,
    startDockerEditFile,
    saveDockerEditFile,
    cancelDockerEditFile,
    downloadDockerDirectory,
    readDockerFile,
  }), [dockerLoading, dockerShowBatchDownloadDialog, dockerEditMode,
    dockerEditFilePath, dockerEditFileContent,
    downloadFromDockerFile, confirmDockerBatchDownload,
    startDockerEditFile, saveDockerEditFile, cancelDockerEditFile,
    downloadDockerDirectory, readDockerFile]);
}
