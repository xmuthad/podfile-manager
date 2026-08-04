import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { ElectronAPI, TransferProgress, TerminalOutput } from './types.js';
import { IPC_CHANNELS as CH } from './types.js';

const electronAPI = {
  getNamespaces: () => ipcRenderer.invoke(CH.KUBECTL_GET_NAMESPACES),
  getPods: (namespace: string) => ipcRenderer.invoke(CH.KUBECTL_GET_PODS, namespace),
  getContainers: (namespace: string, pod: string) => ipcRenderer.invoke(CH.KUBECTL_GET_CONTAINERS, namespace, pod),
  listFiles: (namespace: string, pod: string, container: string | null, path: string) =>
    ipcRenderer.invoke(CH.KUBECTL_LIST_FILES, namespace, pod, container, path),
  downloadFile: (namespace: string, pod: string, container: string | null, remotePath: string) =>
    ipcRenderer.invoke(CH.KUBECTL_DOWNLOAD_FILE, namespace, pod, container, remotePath),
  downloadFileWithLimit: (
    namespace: string,
    pod: string,
    container: string | null,
    remotePath: string,
    limitSpeed: number
  ) => ipcRenderer.invoke(CH.KUBECTL_DOWNLOAD_FILE_WITH_LIMIT, namespace, pod, container, remotePath, limitSpeed),
  uploadFile: (namespace: string, pod: string, container: string | null, remotePath: string) =>
    ipcRenderer.invoke(CH.KUBECTL_UPLOAD_FILE, namespace, pod, container, remotePath),
  readFile: (namespace: string, pod: string, container: string | null, remotePath: string) =>
    ipcRenderer.invoke(CH.KUBECTL_READ_FILE, namespace, pod, container, remotePath),
  writeFile: (namespace: string, pod: string, container: string | null, remotePath: string, content: string) =>
    ipcRenderer.invoke(CH.KUBECTL_WRITE_FILE, namespace, pod, container, remotePath, content),
  batchDownload: (namespace: string, pod: string, container: string | null, filePaths: string[], downloadDir: string) =>
    ipcRenderer.invoke(CH.KUBECTL_BATCH_DOWNLOAD, namespace, pod, container, filePaths, downloadDir),
  getDirectoryTree: (namespace: string, pod: string, container: string | null, dirPath: string) =>
    ipcRenderer.invoke(CH.KUBECTL_GET_DIRECTORY_TREE, namespace, pod, container, dirPath),
  searchFiles: (namespace: string, pod: string, container: string | null, dirPath: string, pattern: string) =>
    ipcRenderer.invoke(CH.KUBECTL_SEARCH_FILES, namespace, pod, container, dirPath, pattern),
  execCommand: (namespace: string, pod: string, container: string | null, command: string) =>
    ipcRenderer.invoke(CH.KUBECTL_EXEC_COMMAND, namespace, pod, container, command),
  getContexts: () => ipcRenderer.invoke(CH.KUBECTL_GET_CONTEXTS),
  useContext: (contextName: string) => ipcRenderer.invoke(CH.KUBECTL_USE_CONTEXT, contextName),
  onTransferProgress: (callback: (progress: TransferProgress) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, progress: TransferProgress) => callback(progress);
    ipcRenderer.on(CH.TRANSFER_PROGRESS, handler);
    return () => ipcRenderer.removeListener(CH.TRANSFER_PROGRESS, handler);
  },
  onTerminalOutput: (callback: (data: TerminalOutput) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, data: TerminalOutput) => callback(data);
    ipcRenderer.on(CH.TERMINAL_OUTPUT, handler);
    return () => ipcRenderer.removeListener(CH.TERMINAL_OUTPUT, handler);
  },
  listDockerImages: () => ipcRenderer.invoke(CH.DOCKER_LIST_IMAGES),
  listDockerFiles: (imageName: string, path: string) => ipcRenderer.invoke(CH.DOCKER_LIST_FILES, imageName, path),
  downloadFromDocker: (imageName: string, filePath: string) =>
    ipcRenderer.invoke(CH.DOCKER_DOWNLOAD_FILE, imageName, filePath),
  readDockerFile: (imageName: string, filePath: string) => ipcRenderer.invoke(CH.DOCKER_READ_FILE, imageName, filePath),
  writeDockerFile: (imageName: string, filePath: string, content: string) =>
    ipcRenderer.invoke(CH.DOCKER_WRITE_FILE, imageName, filePath, content),
  batchDownloadDocker: (imageName: string, filePaths: string[], downloadDir: string) =>
    ipcRenderer.invoke(CH.DOCKER_BATCH_DOWNLOAD, imageName, filePaths, downloadDir),
  getDockerDirectoryTree: (imageName: string, dirPath: string) =>
    ipcRenderer.invoke(CH.DOCKER_GET_DIRECTORY_TREE, imageName, dirPath),
  searchDockerFiles: (imageName: string, dirPath: string, pattern: string) =>
    ipcRenderer.invoke(CH.DOCKER_SEARCH_FILES, imageName, dirPath, pattern),
  execDockerCommand: (imageName: string, command: string) =>
    ipcRenderer.invoke(CH.DOCKER_EXEC_COMMAND, imageName, command)
} satisfies ElectronAPI;

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type { ElectronAPI };

