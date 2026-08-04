import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from './useTheme';
import { useTransfer } from './useTransfer';
import { useSearch } from './useSearch';

window.electronAPI = {
  onTransferProgress: vi.fn(() => () => {}),
  searchFiles: vi.fn(),
  searchDockerFiles: vi.fn(),
} as any;

describe('useTheme Hook', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  describe('Initial State', () => {
    it('should initialize with light theme', () => {
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('light');
    });

    it('should restore theme from localStorage', () => {
      localStorage.setItem('podfile-theme', 'dark');
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('dark');
    });
  });

  describe('toggleTheme', () => {
    it('should toggle from light to dark', async () => {
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('light');

      await act(async () => {
        result.current.toggleTheme();
      });

      expect(result.current.theme).toBe('dark');
      expect(localStorage.getItem('podfile-theme')).toBe('dark');
    });

    it('should toggle from dark to light', async () => {
      localStorage.setItem('podfile-theme', 'dark');
      const { result } = renderHook(() => useTheme());

      await act(async () => {
        result.current.toggleTheme();
      });

      expect(result.current.theme).toBe('light');
      expect(localStorage.getItem('podfile-theme')).toBe('light');
    });

    it('should update document data-theme attribute', async () => {
      const { result } = renderHook(() => useTheme());

      await act(async () => {
        result.current.toggleTheme();
      });

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('should persist theme to localStorage', async () => {
      const { result } = renderHook(() => useTheme());

      await act(async () => {
        result.current.toggleTheme();
      });

      expect(localStorage.getItem('podfile-theme')).toBe('dark');
    });
  });

  describe('Theme Persistence', () => {
    it('should load saved theme on mount', () => {
      localStorage.setItem('podfile-theme', 'dark');

      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('dark');
    });

    it('should handle invalid localStorage value gracefully', () => {
      localStorage.setItem('podfile-theme', 'invalid');
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('light');
    });
  });
});

describe('useTransfer Hook', () => {
  let rafCallbacks: Array<() => void> = [];
  let originalRAF: typeof requestAnimationFrame;
  let originalCAF: typeof cancelAnimationFrame;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Mock rAF to execute callbacks synchronously for testing
    rafCallbacks = [];
    originalRAF = globalThis.requestAnimationFrame;
    originalCAF = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
      rafCallbacks.push(() => cb(0));
      return rafCallbacks.length;
    };
    globalThis.cancelAnimationFrame = (id: number) => {
      rafCallbacks.splice(id - 1, 1);
    };
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRAF;
    globalThis.cancelAnimationFrame = originalCAF;
    vi.useRealTimers();
  });

  const flushRAF = () => {
    const cbs = [...rafCallbacks];
    rafCallbacks = [];
    cbs.forEach(cb => cb());
  };

  describe('Initial State', () => {
    it('should initialize with default values', () => {
      window.electronAPI = {
        onTransferProgress: vi.fn(() => () => {}),
      } as any;

      const { result } = renderHook(() => useTransfer());

      expect(result.current.transferProgress).toBeNull();
      expect(result.current.isTransferring).toBe(false);
      expect(result.current.showDownloadDialog).toBe(false);
      expect(result.current.downloadFileInfo).toBeNull();
      expect(result.current.downloadMethod).toBe('kubectl-cp');
      expect(result.current.limitSpeed).toBe(1024);
    });

    it('should subscribe to transfer progress events', () => {
      const mockUnsubscribe = vi.fn();
      window.electronAPI = {
        onTransferProgress: vi.fn(() => mockUnsubscribe),
      } as any;

      const { unmount } = renderHook(() => useTransfer());
      expect(window.electronAPI.onTransferProgress).toHaveBeenCalled();

      unmount();
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('Transfer Progress Handling', () => {
    it('should update progress when transfer is in progress', () => {
      let progressCallback: any;
      window.electronAPI = {
        onTransferProgress: vi.fn((callback: any) => {
          progressCallback = callback;
          return () => {};
        }),
      } as any;

      const { result } = renderHook(() => useTransfer());

      const progress = {
        status: 'downloading' as const,
        transferred: 500,
        total: 1000,
        percent: 50,
        speed: '500 KB/s',
      };

      act(() => {
        progressCallback(progress);
        flushRAF();
      });

      expect(result.current.transferProgress).toEqual(progress);
      expect(result.current.isTransferring).toBe(true);
    });

    it('should clear progress after completion', () => {
      let progressCallback: any;
      window.electronAPI = {
        onTransferProgress: vi.fn((callback: any) => {
          progressCallback = callback;
          return () => {};
        }),
      } as any;

      const { result } = renderHook(() => useTransfer());

      const progress = {
        status: 'completed' as const,
        transferred: 1000,
        total: 1000,
        percent: 100,
      };

      act(() => {
        progressCallback(progress);
        flushRAF();
      });

      expect(result.current.transferProgress).toEqual(progress);
      expect(result.current.isTransferring).toBe(true);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.transferProgress).toBeNull();
      expect(result.current.isTransferring).toBe(false);
    });

    it('should clear progress after error', () => {
      let progressCallback: any;
      window.electronAPI = {
        onTransferProgress: vi.fn((callback: any) => {
          progressCallback = callback;
          return () => {};
        }),
      } as any;

      const { result } = renderHook(() => useTransfer());

      const progress = {
        status: 'error' as const,
        transferred: 0,
        total: 0,
        message: 'Download failed',
      };

      act(() => {
        progressCallback(progress);
        flushRAF();
      });

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.transferProgress).toBeNull();
    });
  });

  describe('Download Dialog State', () => {
    it('should open download dialog', () => {
      window.electronAPI = {
        onTransferProgress: vi.fn(() => () => {}),
      } as any;

      const { result } = renderHook(() => useTransfer());

      act(() => {
        result.current.setShowDownloadDialog(true);
      });

      expect(result.current.showDownloadDialog).toBe(true);
    });

    it('should set download file info', () => {
      window.electronAPI = {
        onTransferProgress: vi.fn(() => () => {}),
      } as any;

      const { result } = renderHook(() => useTransfer());
      const fileInfo = { name: 'test.txt', path: '/app/test.txt' };

      act(() => {
        result.current.setDownloadFileInfo(fileInfo);
      });

      expect(result.current.downloadFileInfo).toEqual(fileInfo);
    });
  });

  describe('Download Method', () => {
    it('should set download method', () => {
      window.electronAPI = {
        onTransferProgress: vi.fn(() => () => {}),
      } as any;

      const { result } = renderHook(() => useTransfer());

      act(() => {
        result.current.setDownloadMethod('dd-limit');
      });

      expect(result.current.downloadMethod).toBe('dd-limit');
    });

    it('should set limit speed', () => {
      window.electronAPI = {
        onTransferProgress: vi.fn(() => () => {}),
      } as any;

      const { result } = renderHook(() => useTransfer());

      act(() => {
        result.current.setLimitSpeed(2048);
      });

      expect(result.current.limitSpeed).toBe(2048);
    });
  });

  describe('Transferring State', () => {
    it('should set isTransferring to true', () => {
      window.electronAPI = {
        onTransferProgress: vi.fn(() => () => {}),
      } as any;

      const { result } = renderHook(() => useTransfer());

      act(() => {
        result.current.setIsTransferring(true);
      });

      expect(result.current.isTransferring).toBe(true);
    });

    it('should set isTransferring to false', () => {
      window.electronAPI = {
        onTransferProgress: vi.fn(() => () => {}),
      } as any;

      const { result } = renderHook(() => useTransfer());

      act(() => {
        result.current.setIsTransferring(true);
      });

      act(() => {
        result.current.setIsTransferring(false);
      });

      expect(result.current.isTransferring).toBe(false);
    });
  });
});

describe('useSearch Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useSearch(vi.fn()));

      expect(result.current.showSearchModal).toBe(false);
      expect(result.current.searchQuery).toBe('');
      expect(result.current.searchResults).toEqual([]);
      expect(result.current.isSearching).toBe(false);
    });
  });

  describe('Modal State', () => {
    it('should open search modal', () => {
      const { result } = renderHook(() => useSearch(vi.fn()));

      act(() => {
        result.current.setShowSearchModal(true);
      });

      expect(result.current.showSearchModal).toBe(true);
    });

    it('should close search modal', () => {
      const { result } = renderHook(() => useSearch(vi.fn()));

      act(() => {
        result.current.setShowSearchModal(true);
      });

      act(() => {
        result.current.setShowSearchModal(false);
      });

      expect(result.current.showSearchModal).toBe(false);
    });
  });

  describe('Search Query', () => {
    it('should update search query', () => {
      const { result } = renderHook(() => useSearch(vi.fn()));

      act(() => {
        result.current.setSearchQuery('test');
      });

      expect(result.current.searchQuery).toBe('test');
    });

    it('should clear search query', () => {
      const { result } = renderHook(() => useSearch(vi.fn()));

      act(() => {
        result.current.setSearchQuery('test');
      });

      act(() => {
        result.current.setSearchQuery('');
      });

      expect(result.current.searchQuery).toBe('');
    });
  });

  describe('performSearch', () => {
    it('should not search with empty query', async () => {
      window.electronAPI = {
        searchFiles: vi.fn(),
        searchDockerFiles: vi.fn(),
      } as any;

      const { result } = renderHook(() => useSearch(vi.fn()));
      const mockSetError = vi.fn();

      await act(async () => {
        await result.current.performSearch(
          'k8s',
          'default',
          'nginx-pod',
          'nginx',
          '/',
          '',
          '/',
          mockSetError
        );
      });

      expect(window.electronAPI.searchFiles).not.toHaveBeenCalled();
      expect(window.electronAPI.searchDockerFiles).not.toHaveBeenCalled();
    });

    it('should not search without container or image selected', async () => {
      window.electronAPI = {
        searchFiles: vi.fn(),
        searchDockerFiles: vi.fn(),
      } as any;

      const { result } = renderHook(() => useSearch(vi.fn()));
      const mockSetError = vi.fn();

      await act(async () => {
        result.current.setSearchQuery('test');
      });

      await act(async () => {
        await result.current.performSearch(
          'k8s',
          '',
          '',
          '',
          '/',
          '',
          '/',
          mockSetError
        );
      });

      expect(window.electronAPI.searchFiles).not.toHaveBeenCalled();
    });

    it('should perform search in K8s mode', async () => {
      window.electronAPI = {
        searchFiles: vi.fn().mockResolvedValue(['/app/test.txt', '/app/config.yaml']),
        searchDockerFiles: vi.fn(),
      } as any;

      const { result } = renderHook(() => useSearch(vi.fn()));
      const mockSetError = vi.fn();

      await act(async () => {
        result.current.setSearchQuery('test');
      });

      await act(async () => {
        await result.current.performSearch(
          'k8s',
          'default',
          'nginx-pod',
          'nginx',
          '/',
          '',
          '/',
          mockSetError
        );
      });

      expect(window.electronAPI.searchFiles).toHaveBeenCalledWith(
        'default',
        'nginx-pod',
        'nginx',
        '/',
        'test'
      );
      expect(result.current.searchResults).toEqual(['/app/test.txt', '/app/config.yaml']);
      expect(result.current.isSearching).toBe(false);
    });

    it('should perform search in Docker mode', async () => {
      window.electronAPI = {
        searchFiles: vi.fn(),
        searchDockerFiles: vi.fn().mockResolvedValue(['/etc/nginx.conf']),
      } as any;

      const { result } = renderHook(() => useSearch(vi.fn()));
      const mockSetError = vi.fn();

      await act(async () => {
        result.current.setSearchQuery('nginx');
      });

      await act(async () => {
        await result.current.performSearch(
          'docker',
          '',
          '',
          '',
          '/',
          'nginx:latest',
          '/etc',
          mockSetError
        );
      });

      expect(window.electronAPI.searchDockerFiles).toHaveBeenCalledWith(
        'nginx:latest',
        '/etc',
        'nginx'
      );
      expect(result.current.searchResults).toEqual(['/etc/nginx.conf']);
    });

    it('should handle search error', async () => {
      window.electronAPI = {
        searchFiles: vi.fn().mockRejectedValue(new Error('Search failed')),
        searchDockerFiles: vi.fn(),
      } as any;

      const { result } = renderHook(() => useSearch(vi.fn()));
      const mockSetError = vi.fn();

      await act(async () => {
        result.current.setSearchQuery('test');
      });

      await act(async () => {
        await result.current.performSearch(
          'k8s',
          'default',
          'nginx-pod',
          'nginx',
          '/',
          '',
          '/',
          mockSetError
        );
      });

      expect(mockSetError).toHaveBeenCalledWith('搜索失败: Search failed');
      expect(result.current.isSearching).toBe(false);
    });
  });

  describe('navigateToSearchResult', () => {
    it('should close modal and clear search', () => {
      window.electronAPI = {
        searchFiles: vi.fn(),
        searchDockerFiles: vi.fn(),
      } as any;

      const { result } = renderHook(() => useSearch(vi.fn()));

      act(() => {
        result.current.setShowSearchModal(true);
        result.current.setSearchQuery('test');
        result.current.setSearchResults(['/app/test.txt']);
      });

      const mockLoadFiles = vi.fn();
      const mockLoadDockerFiles = vi.fn();

      act(() => {
        result.current.navigateToSearchResult(
          '/app/test.txt',
          'k8s',
          mockLoadFiles,
          mockLoadDockerFiles,
          'nginx-pod',
          'nginx',
          ''
        );
      });

      expect(result.current.showSearchModal).toBe(false);
      expect(result.current.searchQuery).toBe('');
      expect(result.current.searchResults).toEqual([]);
    });

    it('should navigate to K8s file location', () => {
      window.electronAPI = {
        searchFiles: vi.fn(),
        searchDockerFiles: vi.fn(),
      } as any;

      const { result } = renderHook(() => useSearch(vi.fn()));
      const mockLoadFiles = vi.fn();
      const mockLoadDockerFiles = vi.fn();

      act(() => {
        result.current.navigateToSearchResult(
          '/app/test.txt',
          'k8s',
          mockLoadFiles,
          mockLoadDockerFiles,
          'nginx-pod',
          'nginx',
          ''
        );
      });

      expect(mockLoadFiles).toHaveBeenCalledWith('nginx-pod', 'nginx', '/app');
    });

    it('should navigate to Docker file location', () => {
      window.electronAPI = {
        searchFiles: vi.fn(),
        searchDockerFiles: vi.fn(),
      } as any;

      const { result } = renderHook(() => useSearch(vi.fn()));
      const mockLoadFiles = vi.fn();
      const mockLoadDockerFiles = vi.fn();

      act(() => {
        result.current.navigateToSearchResult(
          '/etc/nginx.conf',
          'docker',
          mockLoadFiles,
          mockLoadDockerFiles,
          '',
          '',
          'nginx:latest'
        );
      });

      expect(mockLoadDockerFiles).toHaveBeenCalledWith('nginx:latest', '/etc');
    });

    it('should handle root path navigation', () => {
      window.electronAPI = {
        searchFiles: vi.fn(),
        searchDockerFiles: vi.fn(),
      } as any;

      const { result } = renderHook(() => useSearch(vi.fn()));
      const mockLoadFiles = vi.fn();
      const mockLoadDockerFiles = vi.fn();

      act(() => {
        result.current.navigateToSearchResult(
          '/test.txt',
          'k8s',
          mockLoadFiles,
          mockLoadDockerFiles,
          'nginx-pod',
          'nginx',
          ''
        );
      });

      expect(mockLoadFiles).toHaveBeenCalledWith('nginx-pod', 'nginx', '/');
    });
  });
});
