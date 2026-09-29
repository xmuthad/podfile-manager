import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useK8s } from './useK8s';

window.electronAPI = {
  getContexts: vi.fn().mockResolvedValue({ contexts: [], currentContext: '' }),
  getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
  getPods: vi.fn().mockResolvedValue({ items: [] }),
  getContainers: vi.fn().mockResolvedValue({ items: [] }),
  listFiles: vi.fn().mockResolvedValue(''),
  readFile: vi.fn(),
  useContext: vi.fn(),
} as any;

describe('useK8s Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with empty arrays', async () => {
      window.electronAPI = {
        getContexts: vi.fn().mockResolvedValue({ contexts: [], currentContext: '' }),
        getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
      } as any;

      const { result } = renderHook(() => useK8s(vi.fn()));

      expect(result.current.namespaces).toEqual([]);
      expect(result.current.pods).toEqual([]);
      expect(result.current.containers).toEqual([]);
      expect(result.current.files).toEqual([]);

      // 等待 mount 时的 getContexts / loadNamespaces 副作用落定，
      // 否则异步 setState 会在用例结束后触发 act(...) 警告
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should initialize with empty selections', async () => {
      window.electronAPI = {
        getContexts: vi.fn().mockResolvedValue({ contexts: [], currentContext: '' }),
        getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
      } as any;

      const { result } = renderHook(() => useK8s(vi.fn()));

      expect(result.current.selectedNamespace).toBe('');
      expect(result.current.selectedPod).toBe('');
      expect(result.current.selectedContainer).toBe('');
      expect(result.current.currentPath).toBe('/');

      // 同上：等待 mount 副作用完成，避免遗留的异步更新逸出 act(...)
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should initialize with default UI states', async () => {
      window.electronAPI = {
        getContexts: vi.fn().mockResolvedValue({ contexts: [], currentContext: '' }),
        getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
      } as any;

      const { result } = renderHook(() => useK8s(vi.fn()));

      expect(result.current.error).toBe('');
      expect(result.current.showFileViewer).toBe(false);
      expect(result.current.isEditMode).toBe(false);
      expect(result.current.showBatchDownloadDialog).toBe(false);

      // 等待 mount 时的副作用完成，loading 应当归位
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('Cluster Configuration', () => {
    it('should load cluster configs on mount', async () => {
      const mockContexts = {
        contexts: [
          { name: 'cluster1', cluster: 'kubernetes' },
          { name: 'cluster2', cluster: 'kubernetes' },
        ],
        currentContext: 'cluster1',
      };

      window.electronAPI = {
        getContexts: vi.fn().mockResolvedValue(mockContexts),
        getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
      } as any;

      const { result } = renderHook(() => useK8s(vi.fn()));

      await waitFor(() => {
        expect(result.current.clusterConfigs).toEqual(mockContexts.contexts);
      });

      expect(result.current.selectedCluster).toBe('cluster1');
    });

    it('should handle cluster config load error', async () => {
      window.electronAPI = {
        getContexts: vi.fn().mockRejectedValue(new Error('Failed to load contexts')),
        getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
      } as any;

      renderHook(() => useK8s(vi.fn()));

      await waitFor(() => {
        expect(window.electronAPI.getContexts).toHaveBeenCalled();
      });
    });
  });

  describe('Namespace Loading', () => {
    it('should load namespaces', async () => {
      const mockNamespaces = {
        items: [
          { metadata: { name: 'default' } },
          { metadata: { name: 'kube-system' } },
        ],
      };

      window.electronAPI = {
        getContexts: vi.fn().mockResolvedValue({ contexts: [], currentContext: '' }),
        getNamespaces: vi.fn().mockResolvedValue(mockNamespaces),
      } as any;

      const { result } = renderHook(() => useK8s(vi.fn()));

      await waitFor(() => {
        expect(result.current.namespaces).toEqual(['default', 'kube-system']);
      });
    });

    it('should handle namespace loading error', async () => {
      window.electronAPI = {
        getContexts: vi.fn().mockResolvedValue({ contexts: [], currentContext: '' }),
        getNamespaces: vi.fn().mockRejectedValue(new Error('Connection failed')),
      } as any;

      const { result } = renderHook(() => useK8s(vi.fn()));

      await waitFor(() => {
        expect(result.current.error).toBe('Connection failed');
      });
    });
  });

  describe('Pod Loading', () => {
    it('should load pods for namespace', async () => {
      const mockPods = {
        items: [
          { metadata: { name: 'nginx-pod' }, status: { phase: 'Running' } },
          { metadata: { name: 'redis-pod' }, status: { phase: 'Pending' } },
        ],
      };

      window.electronAPI = {
        getContexts: vi.fn().mockResolvedValue({ contexts: [], currentContext: '' }),
        getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
        getPods: vi.fn().mockResolvedValue(mockPods),
      } as any;

      const { result } = renderHook(() => useK8s(vi.fn()));

      await act(async () => {
        await result.current.loadPods('default');
      });

      expect(result.current.pods).toEqual(mockPods.items);
    });

    it('should handle pod loading error', async () => {
      window.electronAPI = {
        getContexts: vi.fn().mockResolvedValue({ contexts: [], currentContext: '' }),
        getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
        getPods: vi.fn().mockRejectedValue(new Error('Failed to get pods')),
      } as any;

      const { result } = renderHook(() => useK8s(vi.fn()));

      await act(async () => {
        await result.current.loadPods('default');
      });

      expect(result.current.error).toBe('Failed to get pods');
    });
  });

  describe('Container Loading', () => {
    it('should load containers for pod', async () => {
      const mockContainers = {
        items: [
          { name: 'nginx', image: 'nginx:latest', ready: true, restartCount: 0, state: { running: {} } },
        ],
      };

      window.electronAPI = {
        getContexts: vi.fn().mockResolvedValue({ contexts: [], currentContext: '' }),
        getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
        getContainers: vi.fn().mockResolvedValue(mockContainers),
      } as any;

      const { result } = renderHook(() => useK8s(vi.fn()));

      await act(async () => {
        await result.current.loadContainers('default', 'nginx-pod');
      });

      expect(result.current.containers).toEqual(mockContainers.items);
    });

    it('should handle container loading error', async () => {
      window.electronAPI = {
        getContexts: vi.fn().mockResolvedValue({ contexts: [], currentContext: '' }),
        getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
        getContainers: vi.fn().mockRejectedValue(new Error('Failed to get containers')),
      } as any;

      const { result } = renderHook(() => useK8s(vi.fn()));

      await act(async () => {
        await result.current.loadContainers('default', 'nginx-pod');
      });

      expect(result.current.error).toBe('Failed to get containers');
    });
  });

  describe('File Operations', () => {
    it('should load files', async () => {
      const mockFiles = 'drwxr-xr-x|2|root|root|4096|Jan|1|00:00|.|\ndrwxr-xr-x|2|root|root|4096|Jan|1|00:00|..|\n-rw-r--r--|1|root|root|1024|Jan|1|00:00|config.yaml';

      window.electronAPI = {
        getContexts: vi.fn().mockResolvedValue({ contexts: [], currentContext: '' }),
        getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
        listFiles: vi.fn().mockResolvedValue(mockFiles),
      } as any;

      const { result } = renderHook(() => useK8s(vi.fn()));

      await act(async () => {
        await result.current.loadFiles('nginx-pod', 'nginx', '/');
      });

      expect(result.current.files.length).toBeGreaterThan(0);
      expect(result.current.currentPath).toBe('/');
    });

    it('should view file content', async () => {
      const mockContent = 'server {\n  listen 80;\n}';
      const fileItem = { name: 'config.yaml', permissions: '-rw-r--r--', owner: 'root', group: 'root', size: '1024', month: 'Jan', day: '1', time: '00:00', isDirectory: false, filePath: '/config.yaml' };

      window.electronAPI = {
        getContexts: vi.fn().mockResolvedValue({ contexts: [], currentContext: '' }),
        getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
        readFile: vi.fn().mockResolvedValue(mockContent),
      } as any;

      const { result } = renderHook(() => useK8s(vi.fn()));

      await act(async () => {
        result.current.setSelectedNamespace('default');
        result.current.setSelectedPod('nginx-pod');
        result.current.setSelectedContainer('nginx');
      });

      await act(async () => {
        await result.current.viewFile(fileItem);
      });

      expect(result.current.fileContent).toBe(mockContent);
      expect(result.current.showFileViewer).toBe(true);
    });

    it('should not view directory files', async () => {
      const dirItem = { name: 'app', permissions: 'drwxr-xr-x', owner: 'root', group: 'root', size: '4096', month: 'Jan', day: '1', time: '00:00', isDirectory: true, filePath: '/app' };
      window.electronAPI = {
        getContexts: vi.fn().mockResolvedValue({ contexts: [], currentContext: '' }),
        getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
        readFile: vi.fn(),
      } as any;

      const { result } = renderHook(() => useK8s(vi.fn()));

      await act(async () => {
        await result.current.viewFile(dirItem);
      });

      expect(window.electronAPI.readFile).not.toHaveBeenCalled();
    });
  });

  describe('File Selection', () => {
    it('should toggle file selection', async () => {
      const fileItem = { name: 'test.txt', permissions: '-rw-r--r--', owner: 'root', group: 'root', size: '1024', month: 'Jan', day: '1', time: '00:00', isDirectory: false, filePath: '/test.txt' };
      window.electronAPI = {
        getContexts: vi.fn().mockResolvedValue({ contexts: [], currentContext: '' }),
        getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
      } as any;

      const { result } = renderHook(() => useK8s(vi.fn()));

      await act(async () => {
        result.current.setSelectedNamespace('default');
        result.current.setSelectedPod('nginx-pod');
        result.current.setSelectedContainer('nginx');
      });

      await act(async () => {
        result.current.toggleFileSelection(fileItem);
      });

      expect(result.current.selectedFiles.size).toBe(1);

      await act(async () => {
        result.current.toggleFileSelection(fileItem);
      });

      expect(result.current.selectedFiles.size).toBe(0);
    });
  });

  describe('Navigation', () => {
    it('should navigate to directory', async () => {
      const dirItem = { name: 'app', permissions: 'drwxr-xr-x', owner: 'root', group: 'root', size: '4096', month: 'Jan', day: '1', time: '00:00', isDirectory: true, filePath: '/app' };
      window.electronAPI = {
        getContexts: vi.fn().mockResolvedValue({ contexts: [], currentContext: '' }),
        getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
        listFiles: vi.fn().mockResolvedValue(''),
      } as any;

      const { result } = renderHook(() => useK8s(vi.fn()));

      await act(async () => {
        result.current.setSelectedNamespace('default');
        result.current.setSelectedPod('nginx-pod');
        result.current.setSelectedContainer('nginx');
      });

      await act(async () => {
        result.current.navigateToPath(dirItem);
      });

      expect(window.electronAPI.listFiles).toHaveBeenCalled();
    });

    it('should not navigate to files', async () => {
      const fileItem = { name: 'test.txt', permissions: '-rw-r--r--', owner: 'root', group: 'root', size: '1024', month: 'Jan', day: '1', time: '00:00', isDirectory: false, filePath: '/test.txt' };
      window.electronAPI = {
        getContexts: vi.fn().mockResolvedValue({ contexts: [], currentContext: '' }),
        getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
        listFiles: vi.fn(),
      } as any;

      const { result } = renderHook(() => useK8s(vi.fn()));

      await act(async () => {
        result.current.navigateToPath(fileItem);
      });

      expect(window.electronAPI.listFiles).not.toHaveBeenCalled();
    });
  });

  describe('UI State Management', () => {
    it('should set error', async () => {
      window.electronAPI = {
        getContexts: vi.fn().mockResolvedValue({ contexts: [], currentContext: '' }),
        getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
      } as any;

      const { result } = renderHook(() => useK8s(vi.fn()));

      await act(async () => {
        result.current.setError('Test error');
      });

      expect(result.current.error).toBe('Test error');
    });

    it('should open file viewer', async () => {
      window.electronAPI = {
        getContexts: vi.fn().mockResolvedValue({ contexts: [], currentContext: '' }),
        getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
      } as any;

      const { result } = renderHook(() => useK8s(vi.fn()));

      await act(async () => {
        result.current.setShowFileViewer(true);
      });

      expect(result.current.showFileViewer).toBe(true);
    });

    it('should open batch download dialog', async () => {
      window.electronAPI = {
        getContexts: vi.fn().mockResolvedValue({ contexts: [], currentContext: '' }),
        getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
      } as any;

      const { result } = renderHook(() => useK8s(vi.fn()));

      await act(async () => {
        result.current.setShowBatchDownloadDialog(true);
      });

      expect(result.current.showBatchDownloadDialog).toBe(true);
    });
  });

  describe('Namespace Tree Management', () => {
    it('should toggle namespace expansion', async () => {
      window.electronAPI = {
        getContexts: vi.fn().mockResolvedValue({ contexts: [], currentContext: '' }),
        getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
        getPods: vi.fn().mockResolvedValue({ items: [] }),
      } as any;

      const { result } = renderHook(() => useK8s(vi.fn()));

      await act(async () => {
        result.current.toggleNamespace('default');
      });

      expect(result.current.expandedNamespaces.has('default')).toBe(true);
      expect(result.current.selectedNamespace).toBe('default');
    });

    it('should collapse namespace', async () => {
      window.electronAPI = {
        getContexts: vi.fn().mockResolvedValue({ contexts: [], currentContext: '' }),
        getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
        getPods: vi.fn().mockResolvedValue({ items: [] }),
      } as any;

      const { result } = renderHook(() => useK8s(vi.fn()));

      await act(async () => {
        result.current.toggleNamespace('default');
      });

      await act(async () => {
        result.current.toggleNamespace('default');
      });

      expect(result.current.expandedNamespaces.has('default')).toBe(false);
    });
  });

  describe('Pod Tree Management', () => {
    it('should toggle pod expansion', async () => {
      window.electronAPI = {
        getContexts: vi.fn().mockResolvedValue({ contexts: [], currentContext: '' }),
        getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
        getContainers: vi.fn().mockResolvedValue({ items: [] }),
      } as any;

      const { result } = renderHook(() => useK8s(vi.fn()));

      await act(async () => {
        result.current.setSelectedNamespace('default');
      });

      await act(async () => {
        result.current.togglePod('nginx-pod');
      });

      expect(result.current.expandedPods.has('nginx-pod')).toBe(true);
      expect(result.current.selectedPod).toBe('nginx-pod');
    });
  });

  describe('Container Selection', () => {
    it('should select container and load files', async () => {
      window.electronAPI = {
        getContexts: vi.fn().mockResolvedValue({ contexts: [], currentContext: '' }),
        getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
        listFiles: vi.fn().mockResolvedValue(''),
      } as any;

      const { result } = renderHook(() => useK8s(vi.fn()));

      await act(async () => {
        result.current.setSelectedNamespace('default');
        result.current.setSelectedPod('nginx-pod');
      });

      await act(async () => {
        result.current.selectContainer('nginx');
      });

      expect(result.current.selectedContainer).toBe('nginx');
      expect(window.electronAPI.listFiles).toHaveBeenCalled();
    });
  });

  describe('Download Operations', () => {
    it('should open download dialog', async () => {
      const fileItem = { name: 'test.txt', permissions: '-rw-r--r--', owner: 'root', group: 'root', size: '1024', month: 'Jan', day: '1', time: '00:00', isDirectory: false, filePath: '/test.txt' };
      window.electronAPI = {
        getContexts: vi.fn().mockResolvedValue({ contexts: [], currentContext: '' }),
        getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
      } as any;

      const { result } = renderHook(() => useK8s(vi.fn()));

      const mockSetDownloadFileInfo = vi.fn();
      const mockSetShowDownloadDialog = vi.fn();

      await act(async () => {
        result.current.handleDownloadClick(fileItem, mockSetDownloadFileInfo, mockSetShowDownloadDialog);
      });

      expect(mockSetDownloadFileInfo).toHaveBeenCalled();
      expect(mockSetShowDownloadDialog).toHaveBeenCalledWith(true);
    });

    it('should not open download dialog for directories', async () => {
      const dirItem = { name: 'app', permissions: 'drwxr-xr-x', owner: 'root', group: 'root', size: '4096', month: 'Jan', day: '1', time: '00:00', isDirectory: true, filePath: '/app' };
      window.electronAPI = {
        getContexts: vi.fn().mockResolvedValue({ contexts: [], currentContext: '' }),
        getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
      } as any;

      const { result } = renderHook(() => useK8s(vi.fn()));

      const mockSetDownloadFileInfo = vi.fn();
      const mockSetShowDownloadDialog = vi.fn();

      await act(async () => {
        result.current.handleDownloadClick(dirItem, mockSetDownloadFileInfo, mockSetShowDownloadDialog);
      });

      expect(mockSetDownloadFileInfo).not.toHaveBeenCalled();
      expect(mockSetShowDownloadDialog).not.toHaveBeenCalled();
    });
  });

  describe('Edit Mode', () => {
    it('should start edit mode', async () => {
      const fileItem = { name: 'test.txt', permissions: '-rw-r--r--', owner: 'root', group: 'root', size: '1024', month: 'Jan', day: '1', time: '00:00', isDirectory: false, filePath: '/test.txt' };
      window.electronAPI = {
        getContexts: vi.fn().mockResolvedValue({ contexts: [], currentContext: '' }),
        getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
        readFile: vi.fn().mockResolvedValue('test content'),
      } as any;

      const { result } = renderHook(() => useK8s(vi.fn()));

      await act(async () => {
        result.current.setSelectedNamespace('default');
        result.current.setSelectedPod('nginx-pod');
        result.current.setSelectedContainer('nginx');
      });

      await act(async () => {
        await result.current.startEditFile(fileItem);
      });

      expect(result.current.isEditMode).toBe(true);
      expect(result.current.editFileContent).toBe('test content');
    });

    it('should cancel edit mode', async () => {
      window.electronAPI = {
        getContexts: vi.fn().mockResolvedValue({ contexts: [], currentContext: '' }),
        getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
      } as any;

      const { result } = renderHook(() => useK8s(vi.fn()));

      await act(async () => {
        result.current.setIsEditMode(true);
        result.current.setEditFileContent('test content');
      });

      await act(async () => {
        result.current.cancelEditFile();
      });

      expect(result.current.isEditMode).toBe(false);
      expect(result.current.editFileContent).toBe('');
    });
  });

  describe('Cluster Switching', () => {
    it('should change cluster', async () => {
      window.electronAPI = {
        getContexts: vi.fn().mockResolvedValue({ contexts: [{ name: 'cluster1' }], currentContext: 'cluster1' }),
        getNamespaces: vi.fn().mockResolvedValue({ items: [] }),
        useContext: vi.fn().mockResolvedValue({ success: true }),
      } as any;

      const { result } = renderHook(() => useK8s(vi.fn()));

      await act(async () => {
        await result.current.changeCluster('cluster2');
      });

      expect(window.electronAPI.useContext).toHaveBeenCalledWith('cluster2');
    });
  });
});
