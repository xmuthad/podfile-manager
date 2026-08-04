import type { TransferProgress as SharedTransferProgress, TerminalOutput, ElectronAPI as SharedElectronAPI } from '../electron/types';

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

export interface ParsedFileItem {
  name: string;
  permissions: string;
  owner: string;
  group: string;
  size: string;
  month: string;
  day: string;
  time: string;
  isDirectory: boolean;
  filePath: string;
}

/**
 * 解析后端 list-files 返回的文件行。
 * 格式：<perms>|<links>|<owner>|<group>|<size>|<month>|<day>|<time-or-year>|<name>
 * 用 '|' 分隔，前 8 段固定，剩余是文件名（支持含 '|' 的文件名）。
 */
export function parseFileLine(line: string): Omit<ParsedFileItem, 'filePath'> | null {
  if (!line || !line.trim()) return null;
  const trimmed = line.trim();

  const parts = trimmed.split('|');
  if (parts.length < 9) return null;
  return {
    permissions: parts[0],
    owner: parts[2],
    group: parts[3],
    size: parts[4],
    month: parts[5],
    day: parts[6],
    time: parts[7],
    name: parts.slice(8).join('|').trim(),
    isDirectory: parts[0].startsWith('d'),
  };
}

/** 批量解析文件行并预计算 filePath，返回 ParsedFileItem[] */
export function parseFileLines(text: string, basePath: string): ParsedFileItem[] {
  return text.split('\n')
    .map(line => {
      const parsed = parseFileLine(line);
      if (!parsed) return null;
      const filePath = basePath.endsWith('/') ? `${basePath}${parsed.name}` : `${basePath}/${parsed.name}`;
      return { ...parsed, filePath };
    })
    .filter((item): item is ParsedFileItem => item !== null);
}

// 重新导出共享类型，保持外部 `import { TransferProgress, ElectronAPI } from '../types'` 兼容。
export type TransferProgress = SharedTransferProgress;
export type { TerminalOutput };
export type ElectronAPI = SharedElectronAPI;

export interface DownloadOption {
  method: 'kubectl-cp' | 'dd-limit';
  speed?: number;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
