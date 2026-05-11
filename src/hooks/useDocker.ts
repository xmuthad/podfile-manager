import { useState, useCallback, useMemo } from 'react';
import type { DockerImage } from '../types';

export function useDocker() {
  const [dockerImages, setDockerImages] = useState<DockerImage[]>([]);
  const [dockerSearchTerm, setDockerSearchTerm] = useState<string>('');
  const [selectedDockerImage, setSelectedDockerImage] = useState<string>('');
  const [dockerFilePath, setDockerFilePath] = useState<string>('/');
  const [dockerFiles, setDockerFiles] = useState<string[]>([]);
  const [loadingDockerImages, setLoadingDockerImages] = useState(false);
  const [loadingDockerFiles, setLoadingDockerFiles] = useState(false);
  const [dockerLoading, setDockerLoading] = useState(false);
  const [dockerSelectedFiles, setDockerSelectedFiles] = useState<Set<string>>(new Set());
  const [dockerShowBatchDownloadDialog, setDockerShowBatchDownloadDialog] = useState(false);
  const [dockerEditMode, setDockerEditMode] = useState(false);
  const [dockerEditFilePath, setDockerEditFilePath] = useState<string>('');
  const [dockerEditFileContent, setDockerEditFileContent] = useState<string>('');

  const filteredDockerImages = useMemo(() => dockerImages.filter(image => {
    const searchTerm = dockerSearchTerm.toLowerCase();
    return image.repository.toLowerCase().includes(searchTerm) ||
           image.tag.toLowerCase().includes(searchTerm);
  }), [dockerImages, dockerSearchTerm]);

  const loadDockerImages = useCallback(async () => {
    setLoadingDockerImages(true);
    try {
      const images = await window.electronAPI.listDockerImages();
      setDockerImages(images);
    } catch (err: unknown) {
      console.error('[Docker] 加载镜像失败:', err);
    } finally {
      setLoadingDockerImages(false);
    }
  }, []);

  const loadDockerFiles = useCallback(async (image: string, path: string) => {
    if (!image) return;
    setLoadingDockerFiles(true);
    try {
      const result = await window.electronAPI.listDockerFiles(image, path);
      const lines = result.trim().split('\n');
      const fileList = lines.slice(2).filter((line: string) => line.trim() !== '');
      setDockerFiles(fileList);
      setDockerFilePath(path);
    } catch (err: unknown) {
      setDockerFiles([]);
    } finally {
      setLoadingDockerFiles(false);
    }
  }, []);

  const downloadFromDockerFile = useCallback(async (fileLine: string, setIsTransferring: (v: boolean) => void, setError: (v: string) => void) => {
    const parts = fileLine.trim().split(/\s+/);
    if (parts.length < 8) return;
    const fileName = parts.slice(8).join(' ') || parts[parts.length - 1];
    const isDir = parts[0].startsWith('d');
    if (isDir) return;

    const filePath = dockerFilePath.endsWith('/') ? `${dockerFilePath}${fileName}` : `${dockerFilePath}/${fileName}`;
    setIsTransferring(true);
    setError('');

    try {
      const result = await window.electronAPI.downloadFromDocker(selectedDockerImage, filePath);
      if (result && result.success) {
        alert(`✓ 文件已从 Docker 镜像下载成功!\n\n保存位置: ${result.path}`);
      }
      setIsTransferring(false);
    } catch (err: unknown) {
      setError('下载失败: ' + (err instanceof Error ? err.message : String(err)));
      setIsTransferring(false);
    }
  }, [dockerFilePath, selectedDockerImage]);

  const toggleDockerFileSelection = useCallback((fileLine: string) => {
    const parts = fileLine.trim().split(/\s+/);
    if (parts.length < 8) return;
    const fileName = parts.slice(8).join(' ') || parts[parts.length - 1];
    const isDir = parts[0].startsWith('d');
    if (isDir) return;

    const filePath = dockerFilePath.endsWith('/') ? `${dockerFilePath}${fileName}` : `${dockerFilePath}/${fileName}`;
    setDockerSelectedFiles(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(filePath)) {
        newSelected.delete(filePath);
      } else {
        newSelected.add(filePath);
      }
      return newSelected;
    });
  }, [dockerFilePath]);

  const confirmDockerBatchDownload = useCallback(async (setIsTransferring: (v: boolean) => void, setError: (v: string) => void) => {
    if (dockerSelectedFiles.size === 0) return;
    setDockerShowBatchDownloadDialog(false);
    setIsTransferring(true);
    setError('');

    try {
      const result = await window.electronAPI.batchDownloadDocker(selectedDockerImage, Array.from(dockerSelectedFiles), '/tmp');
      if (result && result.success) {
        alert(`✓ Docker 批量下载完成!\n\n打包文件: ${result.path}`);
      }
    } catch (err: unknown) {
      setError('Docker 批量下载失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsTransferring(false);
      setDockerSelectedFiles(new Set());
    }
  }, [dockerSelectedFiles, selectedDockerImage]);

  const startDockerEditFile = useCallback(async (fileLine: string, setError: (v: string) => void) => {
    const parts = fileLine.trim().split(/\s+/);
    if (parts.length < 8) return;
    const fileName = parts.slice(8).join(' ') || parts[parts.length - 1];
    const isDir = parts[0].startsWith('d');
    if (isDir) return;

    const filePath = dockerFilePath.endsWith('/') ? `${dockerFilePath}${fileName}` : `${dockerFilePath}/${fileName}`;
    setDockerLoading(true);
    setError('');
    try {
      const content = await window.electronAPI.readDockerFile(selectedDockerImage, filePath);
      setDockerEditFilePath(filePath);
      setDockerEditFileContent(content);
      setDockerEditMode(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDockerLoading(false);
    }
  }, [dockerFilePath, selectedDockerImage]);

  const saveDockerEditFile = useCallback(async (setError: (v: string) => void) => {
    if (!dockerEditFileContent) return;
    setDockerLoading(true);
    setError('');
    try {
      await window.electronAPI.writeDockerFile(selectedDockerImage, dockerEditFilePath, dockerEditFileContent);
      alert(`✓ Docker 镜像文件已保存: ${dockerEditFilePath}`);
      setDockerEditMode(false);
      setDockerEditFileContent('');
    } catch (err: unknown) {
      setError('Docker 保存失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDockerLoading(false);
    }
  }, [dockerEditFileContent, selectedDockerImage, dockerEditFilePath]);

  const cancelDockerEditFile = useCallback(() => {
    setDockerEditMode(false);
    setDockerEditFileContent('');
  }, []);

  const downloadDockerDirectory = useCallback(async (setIsTransferring: (v: boolean) => void, setError: (v: string) => void) => {
    setDockerLoading(true);
    setError('');
    try {
      const allFiles = await window.electronAPI.getDockerDirectoryTree(selectedDockerImage, dockerFilePath);
      if (allFiles.length === 0) {
        alert('目录为空或无法访问');
        return;
      }
      if (allFiles.length > 1000) {
        alert(`文件数量过多 (${allFiles.length})，请考虑只下载部分目录`);
        return;
      }

      setIsTransferring(true);
      const result = await window.electronAPI.batchDownloadDocker(selectedDockerImage, allFiles, '/tmp');
      if (result && result.success) {
        alert(`✓ Docker 目录下载完成!\n\n文件数量: ${allFiles.length}\n打包文件: ${result.path}`);
      }
    } catch (err: unknown) {
      setError('Docker 目录下载失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDockerLoading(false);
      setIsTransferring(false);
    }
  }, [selectedDockerImage, dockerFilePath]);

  const navigateDockerPath = useCallback((fileLine: string) => {
    const parts = fileLine.trim().split(/\s+/);
    if (parts.length < 8) return;
    const isDir = parts[0].startsWith('d');
    const fileName = parts.slice(8).join(' ');

    if (isDir) {
      const newPath = dockerFilePath.endsWith('/') ? `${dockerFilePath}${fileName}` : `${dockerFilePath}/${fileName}`;
      loadDockerFiles(selectedDockerImage, newPath);
    }
  }, [dockerFilePath, selectedDockerImage, loadDockerFiles]);

  const readDockerFile = useCallback(async (fileLine: string, setError: (v: string) => void, setFileContent: (v: string) => void, setShowFileViewer: (v: boolean) => void) => {
    const parts = fileLine.trim().split(/\s+/);
    if (parts.length < 8) return;
    const fileName = parts.slice(8).join(' ');
    const isDir = parts[0].startsWith('d');
    if (isDir) return;

    const filePath = dockerFilePath.endsWith('/') ? `${dockerFilePath}${fileName}` : `${dockerFilePath}/${fileName}`;
    setDockerLoading(true);
    setError('');
    try {
      const content = await window.electronAPI.readDockerFile(selectedDockerImage, filePath);
      setFileContent(content);
      setShowFileViewer(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDockerLoading(false);
    }
  }, [dockerFilePath, selectedDockerImage]);

  return {
    dockerImages, dockerSearchTerm, setDockerSearchTerm,
    selectedDockerImage, setSelectedDockerImage,
    dockerFilePath, dockerFiles,
    loadingDockerImages, loadingDockerFiles, dockerLoading,
    dockerSelectedFiles, dockerShowBatchDownloadDialog, setDockerShowBatchDownloadDialog,
    dockerEditMode, dockerEditFilePath, dockerEditFileContent, setDockerEditFileContent,
    filteredDockerImages,
    loadDockerImages, loadDockerFiles,
    downloadFromDockerFile, navigateDockerPath,
    toggleDockerFileSelection, confirmDockerBatchDownload,
    startDockerEditFile, saveDockerEditFile, cancelDockerEditFile,
    downloadDockerDirectory, readDockerFile,
  };
}
