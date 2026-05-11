import { useState, useEffect, useCallback } from 'react';
import type { Container, Pod } from '../types';

export function useK8s() {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('');
  const [pods, setPods] = useState<Pod[]>([]);
  const [selectedPod, setSelectedPod] = useState<string>('');
  const [containers, setContainers] = useState<Container[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<string>('');
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [expandedNamespaces, setExpandedNamespaces] = useState<Set<string>>(new Set());
  const [expandedPods, setExpandedPods] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [showBatchDownloadDialog, setShowBatchDownloadDialog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editFilePath, setEditFilePath] = useState<string>('');
  const [editFileContent, setEditFileContent] = useState<string>('');
  const [clusterConfigs, setClusterConfigs] = useState<{ name: string; cluster: string }[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<string>('');

  const loadClusterConfigs = useCallback(async () => {
    try {
      const result = await window.electronAPI.getContexts();
      setClusterConfigs(result.contexts);
      setSelectedCluster(result.currentContext);
    } catch (err) {
      console.error('Failed to load cluster configs:', err);
    }
  }, []);

  const loadNamespaces = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await window.electronAPI.getNamespaces();
      setNamespaces(result.items.map(ns => ns.metadata.name));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPods = useCallback(async (namespace: string) => {
    setLoading(true);
    setError('');
    try {
      const result = await window.electronAPI.getPods(namespace);
      setPods(result.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadContainers = useCallback(async (namespace: string, pod: string) => {
    setLoading(true);
    setError('');
    try {
      const result = await window.electronAPI.getContainers(namespace, pod);
      setContainers(result.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFiles = useCallback(async (pod: string, container: string, path: string, namespace?: string) => {
    setLoading(true);
    setError('');
    setSelectedContainer(container);
    setCurrentPath(path);
    const ns = namespace || selectedNamespace;
    try {
      const result = await window.electronAPI.listFiles(ns, pod, container, path);
      const lines = result.trim().split('\n');
      const fileList = lines.slice(2).filter(line => line.trim() !== '');
      setFiles(fileList);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedNamespace]);

  const viewFile = useCallback(async (fileLine: string) => {
    const parts = fileLine.trim().split(/\s+/);
    if (parts.length < 8) return;
    const fileName = parts.slice(8).join(' ') || parts[parts.length - 1];
    const isDir = parts[0].startsWith('d');
    if (isDir) return;

    const filePath = currentPath.endsWith('/') ? `${currentPath}${fileName}` : `${currentPath}/${fileName}`;
    setLoading(true);
    setError('');
    try {
      const content = await window.electronAPI.readFile(selectedNamespace, selectedPod, selectedContainer, filePath);
      setFileContent(content);
      setShowFileViewer(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [currentPath, selectedNamespace, selectedPod, selectedContainer]);

  const toggleFileSelection = useCallback((fileLine: string) => {
    const parts = fileLine.trim().split(/\s+/);
    if (parts.length < 8) return;
    const fileName = parts.slice(8).join(' ') || parts[parts.length - 1];
    const isDir = parts[0].startsWith('d');
    if (isDir) return;

    const filePath = currentPath.endsWith('/') ? `${currentPath}${fileName}` : `${currentPath}/${fileName}`;
    setSelectedFiles(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(filePath)) {
        newSelected.delete(filePath);
      } else {
        newSelected.add(filePath);
      }
      return newSelected;
    });
  }, [currentPath]);

  const confirmBatchDownload = useCallback(async (setIsTransferring: (v: boolean) => void) => {
    if (selectedFiles.size === 0) return;
    setShowBatchDownloadDialog(false);
    setIsTransferring(true);
    setError('');

    try {
      const result = await window.electronAPI.batchDownload(
        selectedNamespace,
        selectedPod,
        selectedContainer,
        Array.from(selectedFiles),
        '/tmp'
      );
      if (result && result.success) {
        alert(`✓ 批量下载完成!\n\n打包文件: ${result.path}`);
      }
    } catch (err: unknown) {
      setError('批量下载失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsTransferring(false);
      setSelectedFiles(new Set());
    }
  }, [selectedFiles, selectedNamespace, selectedPod, selectedContainer]);

  const startEditFile = useCallback(async (fileLine: string) => {
    const parts = fileLine.trim().split(/\s+/);
    if (parts.length < 8) return;
    const fileName = parts.slice(8).join(' ') || parts[parts.length - 1];
    const isDir = parts[0].startsWith('d');
    if (isDir) return;

    const filePath = currentPath.endsWith('/') ? `${currentPath}${fileName}` : `${currentPath}/${fileName}`;
    setLoading(true);
    setError('');
    try {
      const content = await window.electronAPI.readFile(selectedNamespace, selectedPod, selectedContainer, filePath);
      setEditFilePath(filePath);
      setEditFileContent(content);
      setIsEditMode(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [currentPath, selectedNamespace, selectedPod, selectedContainer]);

  const saveEditFile = useCallback(async () => {
    if (!editFileContent) return;
    setLoading(true);
    setError('');
    try {
      await window.electronAPI.writeFile(selectedNamespace, selectedPod, selectedContainer, editFilePath, editFileContent);
      alert(`✓ 文件已保存: ${editFilePath}`);
      setIsEditMode(false);
      setEditFileContent('');
    } catch (err: unknown) {
      setError('保存失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, [editFileContent, selectedNamespace, selectedPod, selectedContainer, editFilePath]);

  const cancelEditFile = useCallback(() => {
    setIsEditMode(false);
    setEditFileContent('');
    setError('');
  }, []);

  const downloadDirectory = useCallback(async (setIsTransferring: (v: boolean) => void) => {
    setLoading(true);
    setError('');
    try {
      const allFiles = await window.electronAPI.getDirectoryTree(selectedNamespace, selectedPod, selectedContainer, currentPath);
      if (allFiles.length === 0) {
        alert('目录为空或无法访问');
        return;
      }
      if (allFiles.length > 1000) {
        alert(`文件数量过多 (${allFiles.length})，请考虑只下载部分目录`);
        return;
      }

      setIsTransferring(true);
      const result = await window.electronAPI.batchDownload(selectedNamespace, selectedPod, selectedContainer, allFiles, '/tmp');
      if (result && result.success) {
        alert(`✓ 目录下载完成!\n\n文件数量: ${allFiles.length}\n打包文件: ${result.path}`);
      }
    } catch (err: unknown) {
      setError('目录下载失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
      setIsTransferring(false);
    }
  }, [selectedNamespace, selectedPod, selectedContainer, currentPath]);

  const uploadFile = useCallback(async (setIsTransferring: (v: boolean) => void) => {
    setIsTransferring(true);
    setError('');
    try {
      const result = await window.electronAPI.uploadFile(selectedNamespace, selectedPod, selectedContainer, currentPath);
      if (result) {
        alert(`✓ 文件已上传: ${result}`);
        await loadFiles(selectedPod, selectedContainer, currentPath);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setIsTransferring(false);
    }
  }, [selectedNamespace, selectedPod, selectedContainer, currentPath, loadFiles]);

  const navigateToPath = useCallback((fileLine: string) => {
    const parts = fileLine.trim().split(/\s+/);
    if (parts.length < 8) return;
    const isDir = parts[0].startsWith('d');
    const fileName = parts.slice(8).join(' ');

    if (isDir) {
      const newPath = currentPath.endsWith('/') ? `${currentPath}${fileName}` : `${currentPath}/${fileName}`;
      loadFiles(selectedPod, selectedContainer, newPath);
    }
  }, [currentPath, selectedPod, selectedContainer, loadFiles]);

  const handleDownloadClick = useCallback((fileLine: string, setDownloadFileInfo: (v: { name: string; path: string } | null) => void, setShowDownloadDialog: (v: boolean) => void) => {
    const parts = fileLine.trim().split(/\s+/);
    if (parts.length < 8) return;
    const fileName = parts.slice(8).join(' ');
    const isDir = parts[0].startsWith('d');
    if (isDir) return;

    const filePath = currentPath.endsWith('/') ? `${currentPath}${fileName}` : `${currentPath}/${fileName}`;
    setDownloadFileInfo({ name: fileName, path: filePath });
    setShowDownloadDialog(true);
  }, [currentPath]);

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
        await window.electronAPI.downloadFile(
          selectedNamespace,
          selectedPod,
          selectedContainer,
          downloadFileInfo.path
        );
      } else {
        const result = await window.electronAPI.downloadFileWithLimit(
          selectedNamespace,
          selectedPod,
          selectedContainer,
          downloadFileInfo.path,
          limitSpeed
        );
        if (result) {
          alert(`✓ 文件已下载 (限速 ${limitSpeed}KB/s): ${result.path}`);
        }
      }
      setIsTransferring(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setIsTransferring(false);
    }
  }, [selectedNamespace, selectedPod, selectedContainer]);

  const changeCluster = useCallback(async (contextName: string) => {
    try {
      await window.electronAPI.useContext(contextName);
      setSelectedCluster(contextName);
      setNamespaces([]);
      setPods([]);
      setSelectedNamespace('');
      setSelectedPod('');
      setSelectedContainer('');
      setFiles([]);
      await loadNamespaces();
      alert(`✓ 已切换到集群: ${contextName}`);
    } catch (err: unknown) {
      alert('切换集群失败: ' + (err instanceof Error ? err.message : String(err)));
    }
  }, [loadNamespaces]);

  const toggleNamespace = useCallback((namespace: string) => {
    setExpandedNamespaces(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(namespace)) {
        newExpanded.delete(namespace);
      } else {
        newExpanded.add(namespace);
        loadPods(namespace);
      }
      return newExpanded;
    });
    setSelectedNamespace(namespace);
    setSelectedPod('');
    setSelectedContainer('');
    setCurrentPath('/');
    setFiles([]);
    setExpandedPods(new Set());
  }, [loadPods]);

  const togglePod = useCallback((podName: string) => {
    setExpandedPods(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(podName)) {
        newExpanded.delete(podName);
      } else {
        newExpanded.add(podName);
        loadContainers(selectedNamespace, podName);
      }
      return newExpanded;
    });
    setSelectedPod(podName);
    setSelectedContainer('');
    setCurrentPath('/');
    setFiles([]);
  }, [selectedNamespace, loadContainers]);

  const selectContainer = useCallback((containerName: string) => {
    setSelectedContainer(containerName);
    loadFiles(selectedPod, containerName, '/');
  }, [selectedPod, loadFiles]);

  useEffect(() => {
    loadClusterConfigs();
    loadNamespaces();
  }, [loadClusterConfigs, loadNamespaces]);

  return {
    namespaces, selectedNamespace, setSelectedNamespace,
    pods, selectedPod, setSelectedPod,
    containers, selectedContainer,
    currentPath, files, loading, error, setError,
    fileContent, showFileViewer, setShowFileViewer,
    expandedNamespaces, setExpandedNamespaces,
    expandedPods, setExpandedPods,
    selectedFiles, showBatchDownloadDialog, setShowBatchDownloadDialog,
    isEditMode, editFilePath, editFileContent, setEditFileContent,
    clusterConfigs, selectedCluster,
    loadPods, loadContainers, loadFiles,
    viewFile, navigateToPath, handleDownloadClick,
    toggleFileSelection, confirmBatchDownload,
    startEditFile, saveEditFile, cancelEditFile,
    downloadDirectory, uploadFile, changeCluster,
    toggleNamespace, togglePod, selectContainer,
    confirmDownload,
    setFileContent,
  };
}
