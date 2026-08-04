import { useMemo } from 'react';
import type { ToastType } from './useToast';
import { useDockerNav } from './useDockerNav';
import { useDockerFileBrowser } from './useDockerFileBrowser';
import { useDockerFileActions } from './useDockerFileActions';

type ToastFn = (message: string, type?: ToastType) => void;

/**
 * useDocker — 组合层。
 *
 * 内部由 useDockerNav / useDockerFileBrowser / useDockerFileActions 三个子 hook 组合，
 * 对外暴露与原来完全一致的接口。
 */
export function useDocker(toast: ToastFn) {
  const nav = useDockerNav(toast);

  const browser = useDockerFileBrowser({
    selectedDockerImageRef: nav.selectedDockerImageRef,
  });

  const actions = useDockerFileActions({
    selectedDockerImageRef: nav.selectedDockerImageRef,
    dockerFilePath: browser.dockerFilePath,
    dockerSelectedFiles: browser.dockerSelectedFiles,
    setDockerSelectedFiles: browser.setDockerSelectedFiles,
    toast,
  });

  return useMemo(() => ({
    // nav
    dockerImages: nav.dockerImages,
    dockerSearchTerm: nav.dockerSearchTerm,
    setDockerSearchTerm: nav.setDockerSearchTerm,
    selectedDockerImage: nav.selectedDockerImage,
    setSelectedDockerImage: nav.setSelectedDockerImage,
    loadingDockerImages: nav.loadingDockerImages,
    filteredDockerImages: nav.filteredDockerImages,
    loadDockerImages: nav.loadDockerImages,
    // browser
    dockerFilePath: browser.dockerFilePath,
    setDockerFilePath: browser.setDockerFilePath,
    dockerFiles: browser.dockerFiles,
    loadingDockerFiles: browser.loadingDockerFiles,
    dockerError: browser.dockerError,
    setDockerError: browser.setDockerError,
    dockerSelectedFiles: browser.dockerSelectedFiles,
    setDockerSelectedFiles: browser.setDockerSelectedFiles,
    loadDockerFiles: browser.loadDockerFiles,
    navigateDockerPath: browser.navigateDockerPath,
    toggleDockerFileSelection: browser.toggleDockerFileSelection,
    // actions
    dockerLoading: actions.dockerLoading,
    dockerShowBatchDownloadDialog: actions.dockerShowBatchDownloadDialog,
    setDockerShowBatchDownloadDialog: actions.setDockerShowBatchDownloadDialog,
    dockerEditMode: actions.dockerEditMode,
    setDockerEditMode: actions.setDockerEditMode,
    dockerEditFilePath: actions.dockerEditFilePath,
    setDockerEditFilePath: actions.setDockerEditFilePath,
    dockerEditFileContent: actions.dockerEditFileContent,
    setDockerEditFileContent: actions.setDockerEditFileContent,
    downloadFromDockerFile: actions.downloadFromDockerFile,
    confirmDockerBatchDownload: actions.confirmDockerBatchDownload,
    startDockerEditFile: actions.startDockerEditFile,
    saveDockerEditFile: actions.saveDockerEditFile,
    cancelDockerEditFile: actions.cancelDockerEditFile,
    downloadDockerDirectory: actions.downloadDockerDirectory,
    readDockerFile: actions.readDockerFile,
  }), [nav, browser, actions]);
}
