import { useState, useCallback, useRef, useMemo } from 'react';
import { parseFileLines } from '../types';
import type { ParsedFileItem } from '../types';
import type { RefObject } from 'react';

/**
 * 文件浏览：列表加载 / 路径导航 / 文件查看 / 文件选择。
 *
 * 依赖外部传入的 selectedNamespaceRef / selectedPod / selectedContainer / loading / error 等。
 */
export function useFileBrowser(deps: {
  selectedNamespaceRef: RefObject<string>;
  selectedPod: string;
  selectedContainer: string;
  loading: boolean;
  setLoading: (v: boolean) => void;
  error: string;
  setError: (v: string) => void;
}) {
  const { selectedNamespaceRef, selectedPod, selectedContainer, setLoading, setError } = deps;

  const [currentPath, setCurrentPath] = useState<string>('/');
  const [files, setFiles] = useState<ParsedFileItem[]>([]);
  const [fileContent, setFileContent] = useState<string>('');
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const loadFilesReqId = useRef(0);

  const loadFiles = useCallback(async (pod: string, container: string, path: string, namespace?: string) => {
    const reqId = ++loadFilesReqId.current;
    setLoading(true);
    setError('');
    const ns = namespace ?? selectedNamespaceRef.current;
    try {
      const result = await window.electronAPI.listFiles(ns, pod, container, path);
      if (reqId !== loadFilesReqId.current) return;
      setFiles(parseFileLines(result, path));
    } catch (err: unknown) {
      if (reqId !== loadFilesReqId.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (reqId === loadFilesReqId.current) {
        setLoading(false);
      }
    }
  }, [selectedNamespaceRef, setLoading, setError]);

  const viewFile = useCallback(async (file: ParsedFileItem) => {
    if (file.isDirectory) return;
    setLoading(true);
    setError('');
    try {
      const content = await window.electronAPI.readFile(selectedNamespaceRef.current, selectedPod, selectedContainer, file.filePath);
      setFileContent(content);
      setShowFileViewer(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedPod, selectedContainer, selectedNamespaceRef, setLoading, setError]);

  const navigateToPath = useCallback((file: ParsedFileItem) => {
    if (!file.isDirectory) return;
    loadFiles(selectedPod, selectedContainer, file.filePath);
  }, [selectedPod, selectedContainer, loadFiles]);

  const handleDownloadClick = useCallback((file: ParsedFileItem, setDownloadFileInfo: (v: { name: string; path: string } | null) => void, setShowDownloadDialog: (v: boolean) => void) => {
    if (file.isDirectory) return;
    setDownloadFileInfo({ name: file.name, path: file.filePath });
    setShowDownloadDialog(true);
  }, []);

  const toggleFileSelection = useCallback((file: ParsedFileItem) => {
    if (file.isDirectory) return;
    setSelectedFiles(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(file.filePath)) {
        newSelected.delete(file.filePath);
      } else {
        newSelected.add(file.filePath);
      }
      return newSelected;
    });
  }, []);

  return useMemo(() => ({
    currentPath, setCurrentPath, files, setFiles,
    fileContent, setFileContent, showFileViewer, setShowFileViewer,
    selectedFiles, setSelectedFiles,
    loadFiles, viewFile, navigateToPath, handleDownloadClick, toggleFileSelection,
  }), [currentPath, files, fileContent, showFileViewer, selectedFiles,
    loadFiles, viewFile, navigateToPath, handleDownloadClick, toggleFileSelection]);
}
