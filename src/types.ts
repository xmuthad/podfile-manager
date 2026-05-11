export interface Namespace {
  metadata: {
    name: string;
  };
}

export interface Pod {
  metadata: {
    name: string;
    namespace: string;
  };
  status: {
    phase: string;
    podIP: string;
  };
  spec?: {
    containers: Array<{
      name: string;
      image: string;
    }>;
  };
}

export interface Container {
  name: string;
  image: string;
  ready: boolean;
  restartCount: number;
  state: {
    running?: {
      startedAt: string;
    };
    terminated?: {
      exitCode: number;
      reason: string;
    };
    waiting?: {
      reason: string;
      message: string;
    };
  };
}

export interface DockerImage {
  repository: string;
  tag: string;
  id: string;
  size: string;
}

export interface FileItem {
  name: string;
  permissions: string;
  owner: string;
  group: string;
  size: string;
  date: string;
  time: string;
  isDirectory: boolean;
}

export interface TransferProgress {
  status: 'downloading' | 'uploading' | 'completed' | 'error';
  transferred: number;
  total: number;
  percent?: number;
  speed?: string;
  message?: string;
}

export interface DownloadOption {
  method: 'kubectl-cp' | 'dd-limit';
  speed?: number;
}

export interface ElectronAPI {
  getNamespaces: () => Promise<{ items: Namespace[] }>;
  getPods: (namespace: string) => Promise<{ items: Pod[] }>;
  getContainers: (namespace: string, pod: string) => Promise<{ items: Container[] }>;
  listFiles: (namespace: string, pod: string, container: string, path: string) => Promise<string>;
  downloadFile: (namespace: string, pod: string, container: string, remotePath: string) => Promise<string | null>;
  downloadFileWithLimit: (namespace: string, pod: string, container: string, remotePath: string, limitSpeed: number) => Promise<{ success: boolean; path: string; method: string; speed: number } | null>;
  uploadFile: (namespace: string, pod: string, container: string, remotePath: string) => Promise<string | null>;
  readFile: (namespace: string, pod: string, container: string, remotePath: string) => Promise<string>;
  writeFile: (namespace: string, pod: string, container: string, remotePath: string, content: string) => Promise<{ success: boolean; path: string }>;
  batchDownload: (namespace: string, pod: string, container: string, filePaths: string[], downloadDir: string) => Promise<{ success: boolean; path: string; type: string }>;
  getDirectoryTree: (namespace: string, pod: string, container: string, dirPath: string) => Promise<string[]>;
  searchFiles: (namespace: string, pod: string, container: string, dirPath: string, pattern: string) => Promise<string[]>;
  execCommand: (namespace: string, pod: string, container: string, command: string) => Promise<{ output: string; stderr: string; exitCode: number }>;
  getContexts: () => Promise<{ contexts: { name: string; cluster: string }[]; currentContext: string }>;
  useContext: (contextName: string) => Promise<{ success: boolean; context: string }>;
  onTransferProgress: (callback: (progress: TransferProgress) => void) => () => void;
  onTerminalOutput: (callback: (data: { output: string; type: string }) => void) => () => void;
  listDockerImages: () => Promise<DockerImage[]>;
  listDockerFiles: (imageName: string, path: string) => Promise<string>;
  downloadFromDocker: (imageName: string, filePath: string) => Promise<{ success: boolean; path: string } | null>;
  readDockerFile: (imageName: string, filePath: string) => Promise<string>;
  writeDockerFile: (imageName: string, filePath: string, content: string) => Promise<{ success: boolean; path: string }>;
  batchDownloadDocker: (imageName: string, filePaths: string[], downloadDir: string) => Promise<{ success: boolean; path: string; type: string }>;
  getDockerDirectoryTree: (imageName: string, dirPath: string) => Promise<string[]>;
  searchDockerFiles: (imageName: string, dirPath: string, pattern: string) => Promise<string[]>;
  execDockerCommand: (imageName: string, command: string) => Promise<{ output: string; stderr: string; exitCode: number }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
