/**
 * Electron 主进程与渲染进程之间共享的 IPC 类型。
 * 该文件无任何运行时代码，可被 main / preload / 渲染层共同引用。
 */

/**
 * 所有 IPC channel 名称的单一事实源。
 *
 * - `as const` 推导为字面量联合类型，main/preload 必须用同名字符串
 * - 拼写错误会在编译期被 TypeScript 拦截
 * - 增加新 channel 时只改这里一处
 */
export const IPC_CHANNELS = {
  // kubectl
  KUBECTL_GET_NAMESPACES: 'kubectl:get-namespaces',
  KUBECTL_GET_PODS: 'kubectl:get-pods',
  KUBECTL_GET_CONTAINERS: 'kubectl:get-containers',
  KUBECTL_LIST_FILES: 'kubectl:list-files',
  KUBECTL_DOWNLOAD_FILE: 'kubectl:download-file',
  KUBECTL_DOWNLOAD_FILE_WITH_LIMIT: 'kubectl:download-file-with-limit',
  KUBECTL_UPLOAD_FILE: 'kubectl:upload-file',
  KUBECTL_READ_FILE: 'kubectl:read-file',
  KUBECTL_WRITE_FILE: 'kubectl:write-file',
  KUBECTL_BATCH_DOWNLOAD: 'kubectl:batch-download',
  KUBECTL_GET_DIRECTORY_TREE: 'kubectl:get-directory-tree',
  KUBECTL_SEARCH_FILES: 'kubectl:search-files',
  KUBECTL_GET_CONTEXTS: 'kubectl:get-contexts',
  KUBECTL_USE_CONTEXT: 'kubectl:use-context',
  KUBECTL_EXEC_COMMAND: 'kubectl:exec-command',
  // docker
  DOCKER_LIST_IMAGES: 'docker:list-images',
  DOCKER_LIST_FILES: 'docker:list-files',
  DOCKER_DOWNLOAD_FILE: 'docker:download-file',
  DOCKER_READ_FILE: 'docker:read-file',
  DOCKER_WRITE_FILE: 'docker:write-file',
  DOCKER_BATCH_DOWNLOAD: 'docker:batch-download',
  DOCKER_GET_DIRECTORY_TREE: 'docker:get-directory-tree',
  DOCKER_SEARCH_FILES: 'docker:search-files',
  DOCKER_EXEC_COMMAND: 'docker:exec-command',
  // 主进程 → 渲染进程事件
  TRANSFER_PROGRESS: 'transfer-progress',
  TERMINAL_OUTPUT: 'terminal-output'
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export type TransferStatus = 'downloading' | 'uploading' | 'completed' | 'error';

export interface TransferProgress {
  status: TransferStatus;
  transferred: number;
  total: number;
  percent?: number;
  speed?: string;
  message?: string;
}

export interface TerminalOutput {
  output: string;
  type: string;
}

/**
 * K8s 容器状态（kubectl get pod -o json 中的 status.containerStatuses 元素）。
 * 用于 kubectl:get-containers 处理器反序列化 JSON 响应。
 */
export interface ContainerStatus {
  name: string;
  ready: boolean;
  restartCount: number;
  state: {
    running?: { startedAt: string };
    terminated?: { exitCode: number; reason: string };
    waiting?: { reason: string; message: string };
  };
}

/**
 * kubectl get pod -o json 的反序列化结果（仅用到字段）。
 */
export interface PodData {
  spec: {
    containers: Array<{ name: string; image: string }>;
  };
  status?: {
    containerStatuses?: ContainerStatus[];
  };
}

/**
 * kubectl:get-containers 返回的容器项（按 UI 层需要裁剪后的形状）。
 */
export type ContainerState =
  | { running: { startedAt: string } }
  | { terminated: { exitCode: number; reason: string } }
  | { waiting: { reason: string; message: string } };

export interface ContainerInfo {
  name: string;
  image: string;
  ready: boolean;
  restartCount: number;
  state: ContainerState;
}

/**
 * 渲染层 window.electronAPI 的完整类型签名。
 * 由 preload 的实际实现 typeof 推导（保持单一事实源）。
 */
export type ElectronAPI = {
  // kubectl
  getNamespaces: () => Promise<{ items: Array<{ metadata: { name: string } }> }>;
  getPods: (namespace: string) => Promise<{ items: Array<{ metadata: { name: string; namespace: string }; status: { phase: string; podIP: string } }> }>;
  getContainers: (namespace: string, pod: string) => Promise<{ items: ContainerInfo[] }>;
  listFiles: (namespace: string, pod: string, container: string | null, path: string) => Promise<string>;
  downloadFile: (namespace: string, pod: string, container: string | null, remotePath: string) => Promise<string | null>;
  downloadFileWithLimit: (
    namespace: string,
    pod: string,
    container: string | null,
    remotePath: string,
    limitSpeed: number
  ) => Promise<{ success: boolean; path: string; method: string; speed: number } | null>;
  uploadFile: (namespace: string, pod: string, container: string | null, remotePath: string) => Promise<string | null>;
  readFile: (namespace: string, pod: string, container: string | null, remotePath: string) => Promise<string>;
  writeFile: (namespace: string, pod: string, container: string | null, remotePath: string, content: string) => Promise<{ success: boolean; path: string }>;
  batchDownload: (namespace: string, pod: string, container: string | null, filePaths: string[], downloadDir: string) => Promise<{ success: boolean; path: string; type: string }>;
  getDirectoryTree: (namespace: string, pod: string, container: string | null, dirPath: string) => Promise<string[]>;
  searchFiles: (namespace: string, pod: string, container: string | null, dirPath: string, pattern: string) => Promise<string[]>;
  execCommand: (namespace: string, pod: string, container: string | null, command: string) => Promise<{ output: string; stderr: string; exitCode: number | null }>;
  getContexts: () => Promise<{ contexts: Array<{ name: string; cluster: string }>; currentContext: string }>;
  useContext: (contextName: string) => Promise<{ success: boolean; context: string }>;

  // docker
  listDockerImages: () => Promise<Array<{ repository: string; tag: string; id: string; size: string }>>;
  listDockerFiles: (imageName: string, path: string) => Promise<string>;
  downloadFromDocker: (imageName: string, filePath: string) => Promise<{ success: boolean; path: string } | null>;
  readDockerFile: (imageName: string, filePath: string) => Promise<string>;
  writeDockerFile: (imageName: string, filePath: string, content: string) => Promise<{ success: boolean; path: string }>;
  batchDownloadDocker: (imageName: string, filePaths: string[], downloadDir: string) => Promise<{ success: boolean; path: string; type: string }>;
  getDockerDirectoryTree: (imageName: string, dirPath: string) => Promise<string[]>;
  searchDockerFiles: (imageName: string, dirPath: string, pattern: string) => Promise<string[]>;
  execDockerCommand: (imageName: string, command: string) => Promise<{ output: string; stderr: string; exitCode: number | null }>;

  // 事件订阅
  onTransferProgress: (callback: (progress: TransferProgress) => void) => () => void;
  onTerminalOutput: (callback: (data: TerminalOutput) => void) => () => void;
};
