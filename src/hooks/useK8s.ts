import { useCallback, useMemo } from 'react';
import type { ToastType } from './useToast';
import { useClusterNav } from './useClusterNav';
import { useFileBrowser } from './useFileBrowser';
import { useFileActions } from './useFileActions';

type ToastFn = (message: string, type?: ToastType) => void;

/**
 * useK8s — 组合层。
 *
 * 内部由 useClusterNav / useFileBrowser / useFileActions 三个子 hook 组合，
 * 对外暴露与原来完全一致的接口，App.tsx 无需任何改动。
 */
export function useK8s(toast: ToastFn) {
  const nav = useClusterNav(toast);

  const browser = useFileBrowser({
    selectedNamespaceRef: nav.selectedNamespaceRef,
    selectedPod: nav.selectedPod,
    selectedContainer: nav.selectedContainer,
    loading: nav.loading,
    setLoading: nav.setLoading,
    error: nav.error,
    setError: nav.setError,
  });

  const actions = useFileActions({
    selectedNamespaceRef: nav.selectedNamespaceRef,
    selectedPod: nav.selectedPod,
    selectedContainer: nav.selectedContainer,
    currentPath: browser.currentPath,
    selectedFiles: browser.selectedFiles,
    loadFiles: browser.loadFiles,
    setLoading: nav.setLoading,
    setError: nav.setError,
    setSelectedFiles: browser.setSelectedFiles,
    toast,
  });

  // selectContainer 需要同时操作 nav 和 browser 状态
  const selectContainer = useCallback((containerName: string) => {
    nav.setSelectedContainer(containerName);
    browser.loadFiles(nav.selectedPod, containerName, '/');
  }, [nav, browser]);

  // toggleNamespace 需要额外清空 browser 状态
  const toggleNamespace = useCallback((namespace: string) => {
    nav.toggleNamespace(namespace);
    browser.setCurrentPath('/');
    browser.setFiles([]);
  }, [nav, browser]);

  // togglePod 需要额外清空 browser 状态
  const togglePod = useCallback((podName: string) => {
    nav.togglePod(podName);
    browser.setCurrentPath('/');
    browser.setFiles([]);
  }, [nav, browser]);

  // 从全局搜索结果选中 Pod：清空 browser 状态，并自动进入第一个容器的文件目录
  const selectPodFromSearch = useCallback(async (namespace: string, podName: string) => {
    const firstContainer = await nav.selectPodFromSearch(namespace, podName);
    browser.setCurrentPath('/');
    browser.setFiles([]);
    if (firstContainer) {
      nav.setSelectedContainer(firstContainer);
      browser.loadFiles(podName, firstContainer, '/', namespace);
    }
  }, [nav, browser]);

  return useMemo(() => ({
    // nav
    namespaces: nav.namespaces,
    selectedNamespace: nav.selectedNamespace,
    setSelectedNamespace: nav.setSelectedNamespace,
    pods: nav.pods,
    podSearchTerm: nav.podSearchTerm,
    setPodSearchTerm: nav.setPodSearchTerm,
    globalPodResults: nav.globalPodResults,
    searchingPods: nav.searchingPods,
    selectPodFromSearch,
    selectedPod: nav.selectedPod,
    setSelectedPod: nav.setSelectedPod,
    containers: nav.containers,
    selectedContainer: nav.selectedContainer,
    setSelectedContainer: nav.setSelectedContainer,
    expandedNamespaces: nav.expandedNamespaces,
    setExpandedNamespaces: nav.setExpandedNamespaces,
    expandedPods: nav.expandedPods,
    setExpandedPods: nav.setExpandedPods,
    clusterConfigs: nav.clusterConfigs,
    selectedCluster: nav.selectedCluster,
    loading: nav.loading,
    error: nav.error,
    setError: nav.setError,
    loadPods: nav.loadPods,
    loadContainers: nav.loadContainers,
    changeCluster: nav.changeCluster,
    // browser
    currentPath: browser.currentPath,
    setCurrentPath: browser.setCurrentPath,
    files: browser.files,
    fileContent: browser.fileContent,
    setFileContent: browser.setFileContent,
    showFileViewer: browser.showFileViewer,
    setShowFileViewer: browser.setShowFileViewer,
    selectedFiles: browser.selectedFiles,
    loadFiles: browser.loadFiles,
    viewFile: browser.viewFile,
    navigateToPath: browser.navigateToPath,
    handleDownloadClick: browser.handleDownloadClick,
    toggleFileSelection: browser.toggleFileSelection,
    // actions
    showBatchDownloadDialog: actions.showBatchDownloadDialog,
    setShowBatchDownloadDialog: actions.setShowBatchDownloadDialog,
    isEditMode: actions.isEditMode,
    setIsEditMode: actions.setIsEditMode,
    editFilePath: actions.editFilePath,
    editFileContent: actions.editFileContent,
    setEditFileContent: actions.setEditFileContent,
    confirmBatchDownload: actions.confirmBatchDownload,
    startEditFile: actions.startEditFile,
    saveEditFile: actions.saveEditFile,
    cancelEditFile: actions.cancelEditFile,
    downloadDirectory: actions.downloadDirectory,
    uploadFile: actions.uploadFile,
    confirmDownload: actions.confirmDownload,
    // cross-cutting
    toggleNamespace,
    togglePod,
    selectContainer,
  }), [nav, browser, actions, toggleNamespace, togglePod, selectContainer, selectPodFromSearch]);
}
