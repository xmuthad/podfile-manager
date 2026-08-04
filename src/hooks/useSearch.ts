import { useState, useCallback } from 'react';
import type { ToastType } from './useToast';

type ToastFn = (message: string, type?: ToastType) => void;

export function useSearch(toast: ToastFn) {
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const performSearch = useCallback(async (
    activeTab: 'k8s' | 'docker',
    selectedNamespace: string,
    selectedPod: string,
    selectedContainer: string,
    currentPath: string,
    selectedDockerImage: string,
    dockerFilePath: string,
    setError: (v: string) => void
  ) => {
    if (!searchQuery.trim()) return;
    if (!selectedContainer && !selectedDockerImage) {
      toast('请先选择一个容器或 Docker 镜像', 'warning');
      return;
    }

    setIsSearching(true);
    setSearchResults([]);
    try {
      let results: string[];
      if (activeTab === 'k8s') {
        results = await window.electronAPI.searchFiles(selectedNamespace, selectedPod, selectedContainer, currentPath, searchQuery);
      } else {
        results = await window.electronAPI.searchDockerFiles(selectedDockerImage, dockerFilePath, searchQuery);
      }
      setSearchResults(results);
    } catch (err: unknown) {
      setError('搜索失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, toast]);

  const navigateToSearchResult = useCallback((
    path: string,
    activeTab: 'k8s' | 'docker',
    loadFiles: (pod: string, container: string, path: string) => void,
    loadDockerFiles: (image: string, path: string) => void,
    selectedPod: string,
    selectedContainer: string,
    selectedDockerImage: string
  ) => {
    setShowSearchModal(false);
    setSearchQuery('');
    setSearchResults([]);
    if (activeTab === 'k8s') {
      const dirPath = path.substring(0, path.lastIndexOf('/')) || '/';
      loadFiles(selectedPod, selectedContainer, dirPath);
    } else {
      const dirPath = path.substring(0, path.lastIndexOf('/')) || '/';
      loadDockerFiles(selectedDockerImage, dirPath);
    }
  }, []);

  return {
    showSearchModal, setShowSearchModal,
    searchQuery, setSearchQuery,
    searchResults, setSearchResults, isSearching,
    performSearch, navigateToSearchResult,
  };
}
