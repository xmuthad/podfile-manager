import { useState, useCallback, useRef, useMemo } from 'react';
import { parseFileLines } from '../types';
import type { ParsedFileItem } from '../types';
import type { RefObject } from 'react';

interface UseDockerFileBrowserDeps {
  selectedDockerImageRef: RefObject<string>;
}

export function useDockerFileBrowser({ selectedDockerImageRef }: UseDockerFileBrowserDeps) {
  const [dockerFilePath, setDockerFilePath] = useState('/');
  const [dockerFiles, setDockerFiles] = useState<ParsedFileItem[]>([]);
  const [loadingDockerFiles, setLoadingDockerFiles] = useState(false);
  const [dockerError, setDockerError] = useState('');
  const [dockerSelectedFiles, setDockerSelectedFiles] = useState<Set<string>>(new Set());

  const loadReqId = useRef(0);

  const loadDockerFiles = useCallback(async (image: string, path: string) => {
    if (!image) return;
    const reqId = ++loadReqId.current;
    setLoadingDockerFiles(true);
    setDockerError('');
    try {
      const result = await window.electronAPI.listDockerFiles(image, path);
      if (reqId !== loadReqId.current) return;
      setDockerFiles(parseFileLines(result, path));
      setDockerFilePath(path);
    } catch (err: unknown) {
      if (reqId !== loadReqId.current) return;
      setDockerFiles([]);
      setDockerError(err instanceof Error ? err.message : String(err));
    } finally {
      if (reqId === loadReqId.current) {
        setLoadingDockerFiles(false);
      }
    }
  }, []);

  const navigateDockerPath = useCallback((file: ParsedFileItem) => {
    if (!file.isDirectory) return;
    loadDockerFiles(selectedDockerImageRef.current, file.filePath);
  }, [selectedDockerImageRef, loadDockerFiles]);

  const toggleDockerFileSelection = useCallback((file: ParsedFileItem) => {
    if (file.isDirectory) return;
    setDockerSelectedFiles(prev => {
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
    dockerFilePath,
    setDockerFilePath,
    dockerFiles,
    setDockerFiles,
    loadingDockerFiles,
    dockerError,
    setDockerError,
    dockerSelectedFiles,
    setDockerSelectedFiles,
    loadDockerFiles,
    navigateDockerPath,
    toggleDockerFileSelection,
  }), [dockerFilePath, dockerFiles, loadingDockerFiles, dockerError, dockerSelectedFiles,
    loadDockerFiles, navigateDockerPath, toggleDockerFileSelection]);
}
