import { useState, useCallback, useRef, useEffect, useMemo, type ReactNode } from 'react';
import { useTheme, useTransfer, useTerminal, useK8s, useDocker, useSearch, useToast } from '../hooks';
import { AppContext } from './useApp';
import { TerminalContext } from './TerminalContext';
import { TransferContext } from './TransferContext';
import type { ParsedFileItem } from '../types';

export interface AppContextValue {
  // Theme
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  // Toast
  toasts: ReturnType<typeof useToast>['toasts'];
  removeToast: ReturnType<typeof useToast>['removeToast'];
  // K8s
  k8s: ReturnType<typeof useK8s>;
  // Docker
  docker: ReturnType<typeof useDocker>;
  // Search
  showSearchModal: boolean;
  setShowSearchModal: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  searchResults: string[];
  isSearching: boolean;
  // Tab
  activeTab: 'k8s' | 'docker';
  setActiveTab: (tab: 'k8s' | 'docker') => void;
  // Cross-cutting callbacks
  handleTabChange: (tab: 'k8s' | 'docker') => void;
  handleSelectDockerImage: (imageName: string) => void;
  onHandleDownloadClick: (file: ParsedFileItem) => void;
  onConfirmDownload: () => void;
  onConfirmBatchDownload: () => void;
  onDownloadDirectory: () => void;
  onUploadFile: () => void;
  onDownloadFromDockerFile: (file: ParsedFileItem) => void;
  onConfirmDockerBatchDownload: () => void;
  onStartDockerEditFile: (file: ParsedFileItem) => void;
  onSaveDockerEditFile: () => void;
  onDownloadDockerDirectory: () => void;
  onReadDockerFile: (file: ParsedFileItem) => void;
  onPerformSearch: () => void;
  onNavigateToSearchResult: (path: string) => void;
  onExecuteTerminalCommand: () => void;
}

/** 让 useCallback 始终读取最新值而不触发重建 */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => { ref.current = value; });
  return ref;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { toasts, toast, removeToast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const transfer = useTransfer();
  const terminal = useTerminal();
  const k8s = useK8s(toast);
  const docker = useDocker(toast);
  const {
    showSearchModal, setShowSearchModal,
    searchQuery, setSearchQuery,
    searchResults, isSearching,
    performSearch, navigateToSearchResult,
  } = useSearch(toast);

  const [activeTab, setActiveTab] = useState<'k8s' | 'docker'>('k8s');

  const k8sRef = useLatest(k8s);
  const dockerRef = useLatest(docker);
  const transferRef = useLatest(transfer);
  const terminalRef = useLatest(terminal);
  const performSearchRef = useLatest(performSearch);
  const navigateToSearchResultRef = useLatest(navigateToSearchResult);
  const activeTabRef = useLatest(activeTab);

  const handleTabChange = useCallback((tab: 'k8s' | 'docker') => {
    setActiveTab(tab);
    if (tab === 'docker' && dockerRef.current.dockerImages.length === 0) {
      dockerRef.current.loadDockerImages();
    }
  }, [dockerRef]);

  const handleSelectDockerImage = useCallback((imageName: string) => {
    dockerRef.current.setSelectedDockerImage(imageName);
    dockerRef.current.loadDockerFiles(imageName, '/');
  }, [dockerRef]);

  const onHandleDownloadClick = useCallback((file: ParsedFileItem) => {
    k8sRef.current.handleDownloadClick(file, transferRef.current.setDownloadFileInfo, transferRef.current.setShowDownloadDialog);
  }, [k8sRef, transferRef]);

  const onConfirmDownload = useCallback(() => {
    const t = transferRef.current;
    k8sRef.current.confirmDownload(t.downloadFileInfo, t.downloadMethod, t.limitSpeed, t.setIsTransferring, t.setShowDownloadDialog);
  }, [k8sRef, transferRef]);

  const onConfirmBatchDownload = useCallback(() => {
    k8sRef.current.confirmBatchDownload(transferRef.current.setIsTransferring);
  }, [k8sRef, transferRef]);

  const onDownloadDirectory = useCallback(() => {
    k8sRef.current.downloadDirectory(transferRef.current.setIsTransferring);
  }, [k8sRef, transferRef]);

  const onUploadFile = useCallback(() => {
    k8sRef.current.uploadFile(transferRef.current.setIsTransferring);
  }, [k8sRef, transferRef]);

  const onDownloadFromDockerFile = useCallback((file: ParsedFileItem) => {
    dockerRef.current.downloadFromDockerFile(file, transferRef.current.setIsTransferring, dockerRef.current.setDockerError);
  }, [dockerRef, transferRef]);

  const onConfirmDockerBatchDownload = useCallback(() => {
    dockerRef.current.confirmDockerBatchDownload(transferRef.current.setIsTransferring, dockerRef.current.setDockerError);
  }, [dockerRef, transferRef]);

  const onStartDockerEditFile = useCallback((file: ParsedFileItem) => {
    dockerRef.current.startDockerEditFile(file, dockerRef.current.setDockerError);
  }, [dockerRef]);

  const onSaveDockerEditFile = useCallback(() => {
    dockerRef.current.saveDockerEditFile(dockerRef.current.setDockerError);
  }, [dockerRef]);

  const onDownloadDockerDirectory = useCallback(() => {
    dockerRef.current.downloadDockerDirectory(transferRef.current.setIsTransferring, dockerRef.current.setDockerError);
  }, [dockerRef, transferRef]);

  const onReadDockerFile = useCallback((file: ParsedFileItem) => {
    dockerRef.current.readDockerFile(file, dockerRef.current.setDockerError, k8sRef.current.setFileContent, k8sRef.current.setShowFileViewer);
  }, [dockerRef, k8sRef]);

  const onPerformSearch = useCallback(() => {
    const k = k8sRef.current;
    const d = dockerRef.current;
    performSearchRef.current(activeTabRef.current, k.selectedNamespace, k.selectedPod, k.selectedContainer, k.currentPath, d.selectedDockerImage, d.dockerFilePath, k.setError);
  }, [performSearchRef, k8sRef, dockerRef, activeTabRef]);

  const onNavigateToSearchResult = useCallback((path: string) => {
    const k = k8sRef.current;
    const d = dockerRef.current;
    navigateToSearchResultRef.current(path, activeTabRef.current, k.loadFiles, d.loadDockerFiles, k.selectedPod, k.selectedContainer, d.selectedDockerImage);
  }, [navigateToSearchResultRef, k8sRef, dockerRef, activeTabRef]);

  const onExecuteTerminalCommand = useCallback(() => {
    const k = k8sRef.current;
    const d = dockerRef.current;
    terminalRef.current.executeTerminalCommand(activeTabRef.current, k.selectedNamespace, k.selectedPod, k.selectedContainer, d.selectedDockerImage);
  }, [terminalRef, k8sRef, dockerRef, activeTabRef]);

  const appContextValue = useMemo(() => ({
    theme, toggleTheme,
    toasts, removeToast,
    k8s, docker,
    showSearchModal, setShowSearchModal,
    searchQuery, setSearchQuery,
    searchResults, isSearching,
    activeTab, setActiveTab,
    handleTabChange, handleSelectDockerImage,
    onHandleDownloadClick, onConfirmDownload,
    onConfirmBatchDownload, onDownloadDirectory, onUploadFile,
    onDownloadFromDockerFile, onConfirmDockerBatchDownload,
    onStartDockerEditFile, onSaveDockerEditFile,
    onDownloadDockerDirectory, onReadDockerFile,
    onPerformSearch, onNavigateToSearchResult,
    onExecuteTerminalCommand,
  }), [theme, toggleTheme, toasts, removeToast, k8s, docker,
    showSearchModal, setShowSearchModal, searchQuery, setSearchQuery,
    searchResults, isSearching, activeTab, setActiveTab,
    handleTabChange, handleSelectDockerImage,
    onHandleDownloadClick, onConfirmDownload,
    onConfirmBatchDownload, onDownloadDirectory, onUploadFile,
    onDownloadFromDockerFile, onConfirmDockerBatchDownload,
    onStartDockerEditFile, onSaveDockerEditFile,
    onDownloadDockerDirectory, onReadDockerFile,
    onPerformSearch, onNavigateToSearchResult,
    onExecuteTerminalCommand]);

  return (
    <TerminalContext.Provider value={terminal}>
      <TransferContext.Provider value={transfer}>
        <AppContext.Provider value={appContextValue}>
          {children}
        </AppContext.Provider>
      </TransferContext.Provider>
    </TerminalContext.Provider>
  );
}
