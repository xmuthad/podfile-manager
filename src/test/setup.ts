import '@testing-library/jest-dom';
import { vi } from 'vitest';

const mockElectronAPI = {
  getNamespaces: vi.fn(),
  getPods: vi.fn(),
  getContainers: vi.fn(),
  listFiles: vi.fn(),
  downloadFile: vi.fn(),
  downloadFileOptions: vi.fn(),
  downloadFileWithLimit: vi.fn(),
  uploadFile: vi.fn(),
  readFile: vi.fn(),
  onTransferProgress: vi.fn(() => () => {}),
  listDockerImages: vi.fn(),
  listDockerFiles: vi.fn(),
  downloadFromDocker: vi.fn(),
  readDockerFile: vi.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
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
