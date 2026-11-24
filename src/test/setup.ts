import '@testing-library/jest-dom';
import { vi } from 'vitest';
import type { ElectronAPI } from '../types';

const createElectronAPIMock = (): ElectronAPI => ({
  getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
  getPods: vi.fn().mockResolvedValue({ items: [] }),
  getAllPods: vi.fn().mockResolvedValue({ items: [] }),
  getContainers: vi.fn().mockResolvedValue({ items: [] }),
  listFiles: vi.fn().mockResolvedValue(''),
  downloadFile: vi.fn().mockResolvedValue(null),
  downloadFileWithLimit: vi.fn().mockResolvedValue(null),
  uploadFile: vi.fn().mockResolvedValue(null),
  readFile: vi.fn().mockResolvedValue(''),
  writeFile: vi.fn().mockResolvedValue({ success: true, path: '' }),
  batchDownload: vi.fn().mockResolvedValue({ success: true, path: '', type: 'tar' }),
  getDirectoryTree: vi.fn().mockResolvedValue([]),
  searchFiles: vi.fn().mockResolvedValue([]),
  execCommand: vi.fn().mockResolvedValue({ output: '', stderr: '', exitCode: 0 }),
  getContexts: vi.fn().mockResolvedValue({ contexts: [], currentContext: '' }),
  useContext: vi.fn().mockResolvedValue({ success: true, context: '' }),
  onTransferProgress: vi.fn(() => () => {}),
  onTerminalOutput: vi.fn(() => () => {}),
  listDockerImages: vi.fn().mockResolvedValue([]),
  listDockerFiles: vi.fn().mockResolvedValue(''),
  downloadFromDocker: vi.fn().mockResolvedValue({ success: true, path: '' }),
  readDockerFile: vi.fn().mockResolvedValue(''),
  writeDockerFile: vi.fn().mockResolvedValue({ success: true, path: '' }),
  batchDownloadDocker: vi.fn().mockResolvedValue({ success: true, path: '', type: 'tar' }),
  getDockerDirectoryTree: vi.fn().mockResolvedValue([]),
  searchDockerFiles: vi.fn().mockResolvedValue([]),
  execDockerCommand: vi.fn().mockResolvedValue({ output: '', stderr: '', exitCode: 0 }),
});

Object.defineProperty(window, 'electronAPI', {
  value: createElectronAPIMock(),
  writable: true,
  configurable: true,
});

window.matchMedia = vi.fn((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

globalThis.alert = vi.fn();
globalThis.confirm = vi.fn(() => true);

