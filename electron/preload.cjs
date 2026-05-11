const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getNamespaces: () => ipcRenderer.invoke('kubectl:get-namespaces'),
  getPods: (namespace) => ipcRenderer.invoke('kubectl:get-pods', namespace),
  getContainers: (namespace, pod) => ipcRenderer.invoke('kubectl:get-containers', namespace, pod),
  listFiles: (namespace, pod, container, path) => ipcRenderer.invoke('kubectl:list-files', namespace, pod, container, path),
  downloadFile: (namespace, pod, container, remotePath) => ipcRenderer.invoke('kubectl:download-file', namespace, pod, container, remotePath),
  downloadFileWithLimit: (namespace, pod, container, remotePath, limitSpeed) =>
    ipcRenderer.invoke('kubectl:download-file-with-limit', namespace, pod, container, remotePath, limitSpeed),
  uploadFile: (namespace, pod, container, remotePath) => ipcRenderer.invoke('kubectl:upload-file', namespace, pod, container, remotePath),
  readFile: (namespace, pod, container, remotePath) => ipcRenderer.invoke('kubectl:read-file', namespace, pod, container, remotePath),
  writeFile: (namespace, pod, container, remotePath, content) =>
    ipcRenderer.invoke('kubectl:write-file', namespace, pod, container, remotePath, content),
  batchDownload: (namespace, pod, container, filePaths, downloadDir) =>
    ipcRenderer.invoke('kubectl:batch-download', namespace, pod, container, filePaths, downloadDir),
  getDirectoryTree: (namespace, pod, container, dirPath) =>
    ipcRenderer.invoke('kubectl:get-directory-tree', namespace, pod, container, dirPath),
  searchFiles: (namespace, pod, container, dirPath, pattern) =>
    ipcRenderer.invoke('kubectl:search-files', namespace, pod, container, dirPath, pattern),
  execCommand: (namespace, pod, container, command) =>
    ipcRenderer.invoke('kubectl:exec-command', namespace, pod, container, command),
  getContexts: () => ipcRenderer.invoke('kubectl:get-contexts'),
  useContext: (contextName) => ipcRenderer.invoke('kubectl:use-context', contextName),
  onTransferProgress: (callback) => {
    const handler = (_, progress) => callback(progress);
    ipcRenderer.on('transfer-progress', handler);
    return () => ipcRenderer.removeListener('transfer-progress', handler);
  },
  onTerminalOutput: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('terminal-output', handler);
    return () => ipcRenderer.removeListener('terminal-output', handler);
  },
  listDockerImages: () => ipcRenderer.invoke('docker:list-images'),
  listDockerFiles: (imageName, path) => ipcRenderer.invoke('docker:list-files', imageName, path),
  downloadFromDocker: (imageName, filePath) => ipcRenderer.invoke('docker:download-file', imageName, filePath),
  readDockerFile: (imageName, filePath) => ipcRenderer.invoke('docker:read-file', imageName, filePath),
  writeDockerFile: (imageName, filePath, content) =>
    ipcRenderer.invoke('docker:write-file', imageName, filePath, content),
  batchDownloadDocker: (imageName, filePaths, downloadDir) =>
    ipcRenderer.invoke('docker:batch-download', imageName, filePaths, downloadDir),
  getDockerDirectoryTree: (imageName, dirPath) =>
    ipcRenderer.invoke('docker:get-directory-tree', imageName, dirPath),
  searchDockerFiles: (imageName, dirPath, pattern) =>
    ipcRenderer.invoke('docker:search-files', imageName, dirPath, pattern),
  execDockerCommand: (imageName, command) =>
    ipcRenderer.invoke('docker:exec-command', imageName, command)
});
