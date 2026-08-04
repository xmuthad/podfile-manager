import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDocker } from './useDocker';
import type { ParsedFileItem } from '../types';

window.electronAPI = {
  listDockerImages: vi.fn().mockResolvedValue([]),
  listDockerFiles: vi.fn().mockResolvedValue(''),
  downloadFromDocker: vi.fn(),
  batchDownloadDocker: vi.fn(),
  readDockerFile: vi.fn(),
  writeDockerFile: vi.fn(),
  getDockerDirectoryTree: vi.fn(),
} as any;

describe('useDocker Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with empty arrays', () => {
      const { result } = renderHook(() => useDocker(vi.fn()));

      expect(result.current.dockerImages).toEqual([]);
      expect(result.current.dockerFiles).toEqual([]);
    });

    it('should initialize with default selections', () => {
      const { result } = renderHook(() => useDocker(vi.fn()));

      expect(result.current.dockerSearchTerm).toBe('');
      expect(result.current.selectedDockerImage).toBe('');
      expect(result.current.dockerFilePath).toBe('/');
    });

    it('should initialize with default UI states', () => {
      const { result } = renderHook(() => useDocker(vi.fn()));

      expect(result.current.loadingDockerImages).toBe(false);
      expect(result.current.loadingDockerFiles).toBe(false);
      expect(result.current.dockerLoading).toBe(false);
      expect(result.current.dockerEditMode).toBe(false);
      expect(result.current.dockerShowBatchDownloadDialog).toBe(false);
    });
  });

  describe('Image Loading', () => {
    it('should load Docker images', async () => {
      const mockImages = [
        { repository: 'nginx', tag: 'latest', id: 'abc123', size: '142MB' },
        { repository: 'redis', tag: '7.0', id: 'def456', size: '130MB' },
      ];

      window.electronAPI = {
        listDockerImages: vi.fn().mockResolvedValue(mockImages),
      } as any;

      const { result } = renderHook(() => useDocker(vi.fn()));

      await act(async () => {
        await result.current.loadDockerImages();
      });

      expect(result.current.dockerImages).toEqual(mockImages);
      expect(result.current.loadingDockerImages).toBe(false);
    });

    it('should handle image loading error', async () => {
      window.electronAPI = {
        listDockerImages: vi.fn().mockRejectedValue(new Error('Failed to load images')),
      } as any;

      const { result } = renderHook(() => useDocker(vi.fn()));

      await act(async () => {
        await result.current.loadDockerImages();
      });

      expect(result.current.dockerImages).toEqual([]);
      expect(result.current.loadingDockerImages).toBe(false);
    });

    it('should set loading state while fetching images', async () => {
      let resolveFn: (v: unknown[]) => void = () => {};
      window.electronAPI = {
        listDockerImages: vi.fn().mockImplementation(() => new Promise<unknown[]>((resolve) => {
          resolveFn = resolve;
        })),
      } as any;

      const { result } = renderHook(() => useDocker(vi.fn()));

      act(() => {
        result.current.loadDockerImages();
      });

      expect(result.current.loadingDockerImages).toBe(true);

      await act(async () => {
        resolveFn([]);
        await Promise.resolve();
      });
    });
  });

  describe('Image Search', () => {
    it('should filter images by repository', async () => {
      const mockImages = [
        { repository: 'nginx', tag: 'latest', id: 'abc123', size: '142MB' },
        { repository: 'redis', tag: '7.0', id: 'def456', size: '130MB' },
      ];

      window.electronAPI = {
        listDockerImages: vi.fn().mockResolvedValue(mockImages),
      } as any;

      const { result } = renderHook(() => useDocker(vi.fn()));

      await act(async () => {
        await result.current.loadDockerImages();
      });

      expect(result.current.filteredDockerImages).toEqual(mockImages);

      act(() => {
        result.current.setDockerSearchTerm('nginx');
      });

      expect(result.current.filteredDockerImages).toHaveLength(1);
      expect(result.current.filteredDockerImages[0].repository).toBe('nginx');
    });

    it('should filter images by tag', async () => {
      const mockImages = [
        { repository: 'nginx', tag: 'latest', id: 'abc123', size: '142MB' },
        { repository: 'nginx', tag: 'alpine', id: 'def456', size: '100MB' },
      ];

      window.electronAPI = {
        listDockerImages: vi.fn().mockResolvedValue(mockImages),
      } as any;

      const { result } = renderHook(() => useDocker(vi.fn()));

      await act(async () => {
        await result.current.loadDockerImages();
      });

      act(() => {
        result.current.setDockerSearchTerm('alpine');
      });

      expect(result.current.filteredDockerImages).toHaveLength(1);
      expect(result.current.filteredDockerImages[0].tag).toBe('alpine');
    });

    it('should be case insensitive', async () => {
      const mockImages = [
        { repository: 'NGINX', tag: 'latest', id: 'abc123', size: '142MB' },
      ];

      window.electronAPI = {
        listDockerImages: vi.fn().mockResolvedValue(mockImages),
      } as any;

      const { result } = renderHook(() => useDocker(vi.fn()));

      await act(async () => {
        await result.current.loadDockerImages();
      });

      act(() => {
        result.current.setDockerSearchTerm('nginx');
      });

      expect(result.current.filteredDockerImages).toHaveLength(1);
    });

    it('should return all images when search term is empty', async () => {
      const mockImages = [
        { repository: 'nginx', tag: 'latest', id: 'abc123', size: '142MB' },
        { repository: 'redis', tag: '7.0', id: 'def456', size: '130MB' },
      ];

      window.electronAPI = {
        listDockerImages: vi.fn().mockResolvedValue(mockImages),
      } as any;

      const { result } = renderHook(() => useDocker(vi.fn()));

      await act(async () => {
        await result.current.loadDockerImages();
      });

      act(() => {
        result.current.setDockerSearchTerm('');
      });

      expect(result.current.filteredDockerImages).toHaveLength(2);
    });
  });

  describe('File Loading', () => {
    it('should load files from Docker image', async () => {
      const mockFiles = 'drwxr-xr-x|2|root|root|4096|Jan|1|00:00|.\ndrwxr-xr-x|2|root|root|4096|Jan|1|00:00|..\n-rw-r--r--|1|root|root|1024|Jan|1|00:00|config.yaml';

      window.electronAPI = {
        listDockerFiles: vi.fn().mockResolvedValue(mockFiles),
      } as any;

      const { result } = renderHook(() => useDocker(vi.fn()));

      await act(async () => {
        await result.current.loadDockerFiles('nginx:latest', '/');
      });

      expect(result.current.dockerFiles.length).toBeGreaterThan(0);
      expect(result.current.dockerFilePath).toBe('/');
      expect(result.current.loadingDockerFiles).toBe(false);
    });

    it('should not load files without image selected', async () => {
      window.electronAPI = {
        listDockerFiles: vi.fn(),
      } as any;

      const { result } = renderHook(() => useDocker(vi.fn()));

      await act(async () => {
        await result.current.loadDockerFiles('', '/');
      });

      expect(window.electronAPI.listDockerFiles).not.toHaveBeenCalled();
    });

    it('should handle file loading error', async () => {
      window.electronAPI = {
        listDockerFiles: vi.fn().mockRejectedValue(new Error('Failed to load files')),
      } as any;

      const { result } = renderHook(() => useDocker(vi.fn()));

      await act(async () => {
        await result.current.loadDockerFiles('nginx:latest', '/');
      });

      expect(result.current.dockerFiles).toEqual([]);
      expect(result.current.loadingDockerFiles).toBe(false);
    });
  });

  describe('File Selection', () => {
    it('should toggle file selection', async () => {
      const fileItem: ParsedFileItem = { name: 'test.txt', permissions: '-rw-r--r--', owner: 'root', group: 'root', size: '1024', month: 'Jan', day: '1', time: '00:00', isDirectory: false, filePath: '/test.txt' };
      window.electronAPI = {} as any;

      const { result } = renderHook(() => useDocker(vi.fn()));

      await act(async () => {
        result.current.toggleDockerFileSelection(fileItem);
      });

      expect(result.current.dockerSelectedFiles.size).toBe(1);

      await act(async () => {
        result.current.toggleDockerFileSelection(fileItem);
      });

      expect(result.current.dockerSelectedFiles.size).toBe(0);
    });

    it('should not select directories', async () => {
      const dirItem: ParsedFileItem = { name: 'app', permissions: 'drwxr-xr-x', owner: 'root', group: 'root', size: '4096', month: 'Jan', day: '1', time: '00:00', isDirectory: true, filePath: '/app' };
      window.electronAPI = {} as any;

      const { result } = renderHook(() => useDocker(vi.fn()));

      await act(async () => {
        result.current.toggleDockerFileSelection(dirItem);
      });

      expect(result.current.dockerSelectedFiles.size).toBe(0);
    });
  });

  describe('Download Operations', () => {
    it('should download file from Docker image', async () => {
      const fileItem: ParsedFileItem = { name: 'test.txt', permissions: '-rw-r--r--', owner: 'root', group: 'root', size: '1024', month: 'Jan', day: '1', time: '00:00', isDirectory: false, filePath: '/test.txt' };
      window.electronAPI = {
        downloadFromDocker: vi.fn().mockResolvedValue({ success: true, path: '/tmp/test.txt' }),
      } as any;

      const { result } = renderHook(() => useDocker(vi.fn()));
      const mockSetIsTransferring = vi.fn();
      const mockSetError = vi.fn();

      await act(async () => {
        result.current.setSelectedDockerImage('nginx:latest');
      });

      await act(async () => {
        await result.current.downloadFromDockerFile(fileItem, mockSetIsTransferring, mockSetError);
      });

      expect(window.electronAPI.downloadFromDocker).toHaveBeenCalled();
      expect(mockSetIsTransferring).toHaveBeenCalledWith(false);
    });

    it('should handle download error', async () => {
      const fileItem: ParsedFileItem = { name: 'test.txt', permissions: '-rw-r--r--', owner: 'root', group: 'root', size: '1024', month: 'Jan', day: '1', time: '00:00', isDirectory: false, filePath: '/test.txt' };
      window.electronAPI = {
        downloadFromDocker: vi.fn().mockRejectedValue(new Error('Download failed')),
      } as any;

      const { result } = renderHook(() => useDocker(vi.fn()));
      const mockSetIsTransferring = vi.fn();
      const mockSetError = vi.fn();

      await act(async () => {
        result.current.setSelectedDockerImage('nginx:latest');
      });

      await act(async () => {
        await result.current.downloadFromDockerFile(fileItem, mockSetIsTransferring, mockSetError);
      });

      expect(mockSetError).toHaveBeenCalled();
      expect(mockSetIsTransferring).toHaveBeenCalledWith(false);
    });

    it('should not download directories', async () => {
      const dirItem: ParsedFileItem = { name: 'app', permissions: 'drwxr-xr-x', owner: 'root', group: 'root', size: '4096', month: 'Jan', day: '1', time: '00:00', isDirectory: true, filePath: '/app' };
      window.electronAPI = {
        downloadFromDocker: vi.fn(),
      } as any;

      const { result } = renderHook(() => useDocker(vi.fn()));
      const mockSetIsTransferring = vi.fn();
      const mockSetError = vi.fn();

      await act(async () => {
        result.current.setSelectedDockerImage('nginx:latest');
      });

      await act(async () => {
        await result.current.downloadFromDockerFile(dirItem, mockSetIsTransferring, mockSetError);
      });

      expect(window.electronAPI.downloadFromDocker).not.toHaveBeenCalled();
    });
  });

  describe('Batch Download', () => {
    it('should perform batch download', async () => {
      window.electronAPI = {
        batchDownloadDocker: vi.fn().mockResolvedValue({ success: true, path: '/tmp/batch.tar' }),
      } as any;

      const { result } = renderHook(() => useDocker(vi.fn()));
      const mockSetIsTransferring = vi.fn();
      const mockSetError = vi.fn();

      await act(async () => {
        result.current.setSelectedDockerImage('nginx:latest');
        result.current.setDockerSelectedFiles(new Set(['/file1.txt', '/file2.txt']));
        result.current.setDockerShowBatchDownloadDialog(true);
      });

      await act(async () => {
        await result.current.confirmDockerBatchDownload(mockSetIsTransferring, mockSetError);
      });

      expect(window.electronAPI.batchDownloadDocker).toHaveBeenCalled();
      expect(result.current.dockerShowBatchDownloadDialog).toBe(false);
    });

    it('should not batch download when no files selected', async () => {
      window.electronAPI = {
        batchDownloadDocker: vi.fn(),
      } as any;

      const { result } = renderHook(() => useDocker(vi.fn()));
      const mockSetIsTransferring = vi.fn();
      const mockSetError = vi.fn();

      await act(async () => {
        result.current.setSelectedDockerImage('nginx:latest');
        result.current.setDockerSelectedFiles(new Set());
      });

      await act(async () => {
        await result.current.confirmDockerBatchDownload(mockSetIsTransferring, mockSetError);
      });

      expect(window.electronAPI.batchDownloadDocker).not.toHaveBeenCalled();
    });
  });

  describe('Edit Mode', () => {
    it('should start edit mode', async () => {
      const fileItem: ParsedFileItem = { name: 'test.txt', permissions: '-rw-r--r--', owner: 'root', group: 'root', size: '1024', month: 'Jan', day: '1', time: '00:00', isDirectory: false, filePath: '/test.txt' };
      window.electronAPI = {
        readDockerFile: vi.fn().mockResolvedValue('test content'),
      } as any;

      const { result } = renderHook(() => useDocker(vi.fn()));
      const mockSetError = vi.fn();

      await act(async () => {
        result.current.setSelectedDockerImage('nginx:latest');
      });

      await act(async () => {
        await result.current.startDockerEditFile(fileItem, mockSetError);
      });

      expect(result.current.dockerEditMode).toBe(true);
      expect(result.current.dockerEditFileContent).toBe('test content');
    });

    it('should save edited file', async () => {
      window.electronAPI = {
        writeDockerFile: vi.fn().mockResolvedValue({ success: true, path: '/test.txt' }),
      } as any;

      const { result } = renderHook(() => useDocker(vi.fn()));
      const mockSetError = vi.fn();

      await act(async () => {
        result.current.setSelectedDockerImage('nginx:latest');
        result.current.setDockerEditFilePath('/test.txt');
        result.current.setDockerEditFileContent('updated content');
        result.current.setDockerEditMode(true);
      });

      await act(async () => {
        await result.current.saveDockerEditFile(mockSetError);
      });

      expect(window.electronAPI.writeDockerFile).toHaveBeenCalled();
      expect(result.current.dockerEditMode).toBe(false);
    });

    it('should cancel edit mode', async () => {
      window.electronAPI = {} as any;

      const { result } = renderHook(() => useDocker(vi.fn()));

      await act(async () => {
        result.current.setDockerEditMode(true);
        result.current.setDockerEditFileContent('test content');
      });

      await act(async () => {
        result.current.cancelDockerEditFile();
      });

      expect(result.current.dockerEditMode).toBe(false);
      expect(result.current.dockerEditFileContent).toBe('');
    });
  });

  describe('Navigation', () => {
    it('should navigate to directory', async () => {
      const dirItem: ParsedFileItem = { name: 'app', permissions: 'drwxr-xr-x', owner: 'root', group: 'root', size: '4096', month: 'Jan', day: '1', time: '00:00', isDirectory: true, filePath: '/app' };
      window.electronAPI = {
        listDockerFiles: vi.fn().mockResolvedValue(''),
      } as any;

      const { result } = renderHook(() => useDocker(vi.fn()));

      await act(async () => {
        result.current.setSelectedDockerImage('nginx:latest');
      });

      await act(async () => {
        result.current.navigateDockerPath(dirItem);
      });

      expect(window.electronAPI.listDockerFiles).toHaveBeenCalled();
    });

    it('should not navigate to files', async () => {
      const fileItem: ParsedFileItem = { name: 'test.txt', permissions: '-rw-r--r--', owner: 'root', group: 'root', size: '1024', month: 'Jan', day: '1', time: '00:00', isDirectory: false, filePath: '/test.txt' };
      window.electronAPI = {
        listDockerFiles: vi.fn(),
      } as any;

      const { result } = renderHook(() => useDocker(vi.fn()));

      await act(async () => {
        result.current.navigateDockerPath(fileItem);
      });

      expect(window.electronAPI.listDockerFiles).not.toHaveBeenCalled();
    });
  });

  describe('Directory Download', () => {
    it('should download directory', async () => {
      window.electronAPI = {
        getDockerDirectoryTree: vi.fn().mockResolvedValue(['/file1.txt', '/file2.txt']),
        batchDownloadDocker: vi.fn().mockResolvedValue({ success: true, path: '/tmp/dir.tar' }),
      } as any;

      const { result } = renderHook(() => useDocker(vi.fn()));
      const mockSetIsTransferring = vi.fn();
      const mockSetError = vi.fn();

      await act(async () => {
        result.current.setSelectedDockerImage('nginx:latest');
        result.current.setDockerFilePath('/app');
      });

      await act(async () => {
        await result.current.downloadDockerDirectory(mockSetIsTransferring, mockSetError);
      });

      expect(window.electronAPI.getDockerDirectoryTree).toHaveBeenCalled();
      expect(window.electronAPI.batchDownloadDocker).toHaveBeenCalled();
    });

    it('should handle empty directory', async () => {
      const batchDownloadDockerSpy = vi.fn();
      window.electronAPI = {
        getDockerDirectoryTree: vi.fn().mockResolvedValue([]),
        batchDownloadDocker: batchDownloadDockerSpy,
      } as any;

      const { result } = renderHook(() => useDocker(vi.fn()));
      const mockSetIsTransferring = vi.fn();
      const mockSetError = vi.fn();

      await act(async () => {
        result.current.setSelectedDockerImage('nginx:latest');
        result.current.setDockerFilePath('/empty');
      });

      await act(async () => {
        await result.current.downloadDockerDirectory(mockSetIsTransferring, mockSetError);
      });

      expect(batchDownloadDockerSpy).not.toHaveBeenCalled();
    });
  });

  describe('File Reading', () => {
    it('should read file content', async () => {
      const fileItem: ParsedFileItem = { name: 'test.txt', permissions: '-rw-r--r--', owner: 'root', group: 'root', size: '1024', month: 'Jan', day: '1', time: '00:00', isDirectory: false, filePath: '/test.txt' };
      window.electronAPI = {
        readDockerFile: vi.fn().mockResolvedValue('file content'),
      } as any;

      const { result } = renderHook(() => useDocker(vi.fn()));
      const mockSetError = vi.fn();
      const mockSetFileContent = vi.fn();
      const mockSetShowFileViewer = vi.fn();

      await act(async () => {
        result.current.setSelectedDockerImage('nginx:latest');
      });

      await act(async () => {
        await result.current.readDockerFile(fileItem, mockSetError, mockSetFileContent, mockSetShowFileViewer);
      });

      expect(mockSetFileContent).toHaveBeenCalledWith('file content');
      expect(mockSetShowFileViewer).toHaveBeenCalledWith(true);
    });

    it('should handle read error', async () => {
      const fileItem: ParsedFileItem = { name: 'test.txt', permissions: '-rw-r--r--', owner: 'root', group: 'root', size: '1024', month: 'Jan', day: '1', time: '00:00', isDirectory: false, filePath: '/test.txt' };
      window.electronAPI = {
        readDockerFile: vi.fn().mockRejectedValue(new Error('Read failed')),
      } as any;

      const { result } = renderHook(() => useDocker(vi.fn()));
      const mockSetError = vi.fn();
      const mockSetFileContent = vi.fn();
      const mockSetShowFileViewer = vi.fn();

      await act(async () => {
        result.current.setSelectedDockerImage('nginx:latest');
      });

      await act(async () => {
        await result.current.readDockerFile(fileItem, mockSetError, mockSetFileContent, mockSetShowFileViewer);
      });

      expect(mockSetError).toHaveBeenCalled();
    });
  });

  describe('Batch Download Dialog', () => {
    it('should open batch download dialog', async () => {
      window.electronAPI = {} as any;

      const { result } = renderHook(() => useDocker(vi.fn()));

      await act(async () => {
        result.current.setDockerShowBatchDownloadDialog(true);
      });

      expect(result.current.dockerShowBatchDownloadDialog).toBe(true);
    });

    it('should close batch download dialog', async () => {
      window.electronAPI = {} as any;

      const { result } = renderHook(() => useDocker(vi.fn()));

      await act(async () => {
        result.current.setDockerShowBatchDownloadDialog(true);
      });

      await act(async () => {
        result.current.setDockerShowBatchDownloadDialog(false);
      });

      expect(result.current.dockerShowBatchDownloadDialog).toBe(false);
    });
  });
});
