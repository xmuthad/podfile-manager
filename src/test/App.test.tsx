import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

const mockNamespaces = {
  items: [
    { metadata: { name: 'default' } },
    { metadata: { name: 'kube-system' } },
  ],
};

const mockPods = {
  items: [
    {
      metadata: { name: 'nginx-pod' },
      status: { phase: 'Running' },
    },
    {
      metadata: { name: 'redis-pod' },
      status: { phase: 'Pending' },
    },
  ],
};

const mockContainers = {
  items: [
    { name: 'nginx', image: 'nginx:latest', ready: true, restartCount: 0, state: { running: { startedAt: '2024-01-01' } } },
    { name: 'redis', image: 'redis:latest', ready: true, restartCount: 0, state: { running: { startedAt: '2024-01-01' } } },
  ],
};

const mockDockerImages = [
  { repository: 'nginx', tag: 'latest', id: 'abc123', size: '142MB' },
  { repository: 'redis', tag: '7.0', id: 'def456', size: '130MB' },
];

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  describe('Initial Render', () => {
    it('renders the header with title', async () => {
      window.electronAPI.getNamespaces = vi.fn().mockImplementation(() => new Promise(() => {}));

      await act(async () => {
        render(<App />);
      });

      expect(screen.getByText('🚀 PodFile Manager')).toBeInTheDocument();
    });

    it('renders the subtitle', async () => {
      window.electronAPI.getNamespaces = vi.fn().mockImplementation(() => new Promise(() => {}));

      await act(async () => {
        render(<App />);
      });

      expect(screen.getByText('Kubernetes 集群 Pod 文件管理工具')).toBeInTheDocument();
    });

    it('renders the Kubernetes tab by default', async () => {
      window.electronAPI.getNamespaces = vi.fn().mockImplementation(() => new Promise(() => {}));

      await act(async () => {
        render(<App />);
      });

      const k8sTab = screen.getByText('☸️ Kubernetes');
      expect(k8sTab).toBeInTheDocument();
      expect(k8sTab.closest('button')).toHaveClass('active');
    });

    it('renders the Docker tab', async () => {
      window.electronAPI.getNamespaces = vi.fn().mockImplementation(() => new Promise(() => {}));

      await act(async () => {
        render(<App />);
      });

      expect(screen.getByText('🐳 Docker')).toBeInTheDocument();
    });

    it('renders the sidebar header', async () => {
      window.electronAPI.getNamespaces = vi.fn().mockImplementation(() => new Promise(() => {}));

      await act(async () => {
        render(<App />);
      });

      expect(screen.getByText('🔍 集群导航')).toBeInTheDocument();
    });
  });

  describe('Namespace Loading', () => {
    it('loads and displays namespaces', async () => {
      window.electronAPI.getNamespaces = vi.fn().mockResolvedValue(mockNamespaces);

      await act(async () => {
        render(<App />);
      });

      await waitFor(() => {
        expect(screen.getByText('default')).toBeInTheDocument();
      });

      expect(screen.getByText('kube-system')).toBeInTheDocument();
    });

    it('handles namespace loading error', async () => {
      window.electronAPI.getNamespaces = vi.fn().mockRejectedValue(new Error('连接集群失败'));

      await act(async () => {
        render(<App />);
      });

      await waitFor(() => {
        expect(screen.getByText('连接集群失败')).toBeInTheDocument();
      });
    });

    it('displays loading state while fetching namespaces', () => {
      window.electronAPI.getNamespaces = vi.fn().mockImplementation(() => new Promise(() => {}));

      render(<App />);

      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });

    it('displays namespace tree structure', async () => {
      window.electronAPI.getNamespaces = vi.fn().mockResolvedValue(mockNamespaces);

      await act(async () => {
        render(<App />);
      });

      const namespaceHeaders = screen.getAllByText('📦');
      expect(namespaceHeaders.length).toBe(2);
    });
  });

  describe('Pod Loading', () => {
    it('expands namespace and loads pods', async () => {
      window.electronAPI.getNamespaces = vi.fn().mockResolvedValue(mockNamespaces);
      window.electronAPI.getPods = vi.fn().mockResolvedValue(mockPods);

      await act(async () => {
        render(<App />);
      });

      await waitFor(() => {
        expect(screen.getByText('default')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('default'));

      await waitFor(() => {
        expect(screen.getByText('nginx-pod')).toBeInTheDocument();
      });

      expect(screen.getByText('redis-pod')).toBeInTheDocument();
    });

    it('displays pod status indicator with correct colors', async () => {
      window.electronAPI.getNamespaces = vi.fn().mockResolvedValue(mockNamespaces);
      window.electronAPI.getPods = vi.fn().mockResolvedValue(mockPods);

      await act(async () => {
        render(<App />);
      });

      await waitFor(() => screen.getByText('default'));
      await userEvent.click(screen.getByText('default'));

      await waitFor(() => {
        const runningDot = document.querySelector('[title="Running"]');
        const pendingDot = document.querySelector('[title="Pending"]');
        expect(runningDot).toBeInTheDocument();
        expect(pendingDot).toBeInTheDocument();
      });
    });

    it('handles pod loading error', async () => {
      window.electronAPI.getNamespaces = vi.fn().mockResolvedValue(mockNamespaces);
      window.electronAPI.getPods = vi.fn().mockRejectedValue(new Error('获取 Pod 列表失败'));

      await act(async () => {
        render(<App />);
      });

      await waitFor(() => screen.getByText('default'));
      await userEvent.click(screen.getByText('default'));

      await waitFor(() => {
        expect(screen.getByText('获取 Pod 列表失败')).toBeInTheDocument();
      });
    });
  });

  describe('Container Loading', () => {
    it('expands pod and loads containers', async () => {
      window.electronAPI.getNamespaces = vi.fn().mockResolvedValue(mockNamespaces);
      window.electronAPI.getPods = vi.fn().mockResolvedValue(mockPods);
      window.electronAPI.getContainers = vi.fn().mockResolvedValue(mockContainers);

      await act(async () => {
        render(<App />);
      });

      await waitFor(() => screen.getByText('default'));

      await userEvent.click(screen.getByText('default'));

      await waitFor(() => screen.getByText('nginx-pod'));

      await userEvent.click(screen.getByText('nginx-pod'));

      await waitFor(() => {
        expect(screen.getByText('nginx')).toBeInTheDocument();
        expect(screen.getByText('redis')).toBeInTheDocument();
      });
    });

    it('displays container status bars', async () => {
      window.electronAPI.getNamespaces = vi.fn().mockResolvedValue(mockNamespaces);
      window.electronAPI.getPods = vi.fn().mockResolvedValue(mockPods);
      window.electronAPI.getContainers = vi.fn().mockResolvedValue(mockContainers);

      await act(async () => {
        render(<App />);
      });

      await waitFor(() => screen.getByText('default'));
      await userEvent.click(screen.getByText('default'));

      await waitFor(() => screen.getByText('nginx-pod'));
      await userEvent.click(screen.getByText('nginx-pod'));

      await waitFor(() => {
        const containerBars = document.querySelectorAll('.container-status-bar');
        expect(containerBars.length).toBe(2);
      });
    });

    it('handles container loading error', async () => {
      window.electronAPI.getNamespaces = vi.fn().mockResolvedValue(mockNamespaces);
      window.electronAPI.getPods = vi.fn().mockResolvedValue(mockPods);
      window.electronAPI.getContainers = vi.fn().mockRejectedValue(new Error('获取容器列表失败'));

      await act(async () => {
        render(<App />);
      });

      await waitFor(() => screen.getByText('default'));
      await userEvent.click(screen.getByText('default'));

      await waitFor(() => screen.getByText('nginx-pod'));
      await userEvent.click(screen.getByText('nginx-pod'));

      await waitFor(() => {
        expect(screen.getByText('获取容器列表失败')).toBeInTheDocument();
      });
    });
  });

  describe('Tab Switching', () => {
    it('switches to Docker tab', async () => {
      window.electronAPI.getNamespaces = vi.fn().mockImplementation(() => new Promise(() => {}));

      await act(async () => {
        render(<App />);
      });

      const dockerTab = screen.getByText('🐳 Docker');
      await userEvent.click(dockerTab);

      await waitFor(() => {
        expect(screen.getByText('🐳 Docker 镜像')).toBeInTheDocument();
      });
    });

    it('switches back to Kubernetes tab', async () => {
      window.electronAPI.getNamespaces = vi.fn().mockResolvedValue(mockNamespaces);

      await act(async () => {
        render(<App />);
      });

      await waitFor(() => screen.getByText('default'));

      const dockerTab = screen.getByText('🐳 Docker');
      await userEvent.click(dockerTab);

      await waitFor(() => screen.getByText('🐳 Docker 镜像'));

      const k8sTab = screen.getByText('☸️ Kubernetes');
      await userEvent.click(k8sTab);

      await waitFor(() => {
        expect(screen.getByText('🔍 集群导航')).toBeInTheDocument();
      });
    });

    it('loads Docker images when switching to Docker tab', async () => {
      window.electronAPI.getNamespaces = vi.fn().mockImplementation(() => new Promise(() => {}));
      window.electronAPI.listDockerImages = vi.fn().mockResolvedValue(mockDockerImages);

      await act(async () => {
        render(<App />);
      });

      await userEvent.click(screen.getByText('🐳 Docker'));

      await waitFor(() => {
        expect(screen.getByText('nginx')).toBeInTheDocument();
        expect(screen.getByText('redis')).toBeInTheDocument();
      });
    });
  });

  describe('Docker Image Search', () => {
    it('displays search input', async () => {
      window.electronAPI.getNamespaces = vi.fn().mockImplementation(() => new Promise(() => {}));
      window.electronAPI.listDockerImages = vi.fn().mockResolvedValue([]);

      await act(async () => {
        render(<App />);
      });

      await userEvent.click(screen.getByText('🐳 Docker'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('🔍 搜索镜像...')).toBeInTheDocument();
      });
    });

    it('filters Docker images by search term', async () => {
      window.electronAPI.getNamespaces = vi.fn().mockImplementation(() => new Promise(() => {}));
      window.electronAPI.listDockerImages = vi.fn().mockResolvedValue(mockDockerImages);

      await act(async () => {
        render(<App />);
      });

      await userEvent.click(screen.getByText('🐳 Docker'));

      await waitFor(() => screen.getByText('nginx'));

      const searchInput = screen.getByPlaceholderText('🔍 搜索镜像...');
      await userEvent.type(searchInput, 'nginx');

      await waitFor(() => {
        expect(screen.getByText('nginx')).toBeInTheDocument();
      });
    });

    it('shows no results message when filter matches nothing', async () => {
      window.electronAPI.getNamespaces = vi.fn().mockImplementation(() => new Promise(() => {}));
      window.electronAPI.listDockerImages = vi.fn().mockResolvedValue(mockDockerImages);

      await act(async () => {
        render(<App />);
      });

      await userEvent.click(screen.getByText('🐳 Docker'));

      await waitFor(() => screen.getByText('nginx'));

      const searchInput = screen.getByPlaceholderText('🔍 搜索镜像...');
      await userEvent.type(searchInput, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText('没有找到匹配的镜像')).toBeInTheDocument();
      });
    });
  });

  describe('Empty States', () => {
    it('shows Kubernetes empty state when no container selected', async () => {
      window.electronAPI.getNamespaces = vi.fn().mockResolvedValue(mockNamespaces);

      await act(async () => {
        render(<App />);
      });

      await waitFor(() => screen.getByText('default'));

      expect(screen.getByText('开始管理您的 Kubernetes 文件')).toBeInTheDocument();
    });

    it('shows Docker empty state when no image selected', async () => {
      window.electronAPI.getNamespaces = vi.fn().mockImplementation(() => new Promise(() => {}));
      window.electronAPI.listDockerImages = vi.fn().mockResolvedValue([]);

      await act(async () => {
        render(<App />);
      });

      await userEvent.click(screen.getByText('🐳 Docker'));

      await waitFor(() => {
        expect(screen.getByText('从 Docker 镜像下载文件')).toBeInTheDocument();
      });
    });
  });

  describe('Helper Functions', () => {
    it('getPodPhaseColor returns correct colors', () => {
      const getPodPhaseColor = (phase: string): string => {
        switch (phase) {
          case 'Running': return '#38a169';
          case 'Pending': return '#dd6b20';
          case 'Succeeded': return '#667eea';
          case 'Failed': return '#c53030';
          default: return '#718096';
        }
      };

      expect(getPodPhaseColor('Running')).toBe('#38a169');
      expect(getPodPhaseColor('Pending')).toBe('#dd6b20');
      expect(getPodPhaseColor('Succeeded')).toBe('#667eea');
      expect(getPodPhaseColor('Failed')).toBe('#c53030');
      expect(getPodPhaseColor('Unknown')).toBe('#718096');
    });

    it('getContainerStatusColor returns correct colors', () => {
      const getContainerStatusColor = (container: any): string => {
        if (container.state.running) return '#38a169';
        if (container.state.terminated) return '#c53030';
        if (container.state.waiting) return '#dd6b20';
        return '#718096';
      };

      expect(getContainerStatusColor({ state: { running: {} } })).toBe('#38a169');
      expect(getContainerStatusColor({ state: { terminated: {} } })).toBe('#c53030');
      expect(getContainerStatusColor({ state: { waiting: {} } })).toBe('#dd6b20');
      expect(getContainerStatusColor({ state: {} })).toBe('#718096');
    });

    it('formatBytes formats bytes correctly', () => {
      const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
      };

      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(1073741824)).toBe('1 GB');
    });
  });

  describe('Error Handling', () => {
    it('displays error messages in the UI', async () => {
      window.electronAPI.getNamespaces = vi.fn().mockRejectedValue(new Error('测试错误'));

      await act(async () => {
        render(<App />);
      });

      await waitFor(() => {
        expect(screen.getByText('测试错误')).toBeInTheDocument();
        expect(screen.getByText('⚠️')).toBeInTheDocument();
      });
    });

    it('handles multiple errors gracefully', async () => {
      window.electronAPI.getNamespaces = vi.fn().mockRejectedValue(new Error('第一个错误'));

      await act(async () => {
        render(<App />);
      });

      await waitFor(() => screen.getByText('第一个错误'));

      window.electronAPI.getNamespaces = vi.fn().mockRejectedValue(new Error('第二个错误'));

      await act(async () => {
        render(<App />);
      });

      await waitFor(() => {
        expect(screen.getByText('第二个错误')).toBeInTheDocument();
      });
    });
  });

  describe('File Browser (when container selected)', () => {
    it('shows file browser when container is selected', async () => {
      window.electronAPI.getNamespaces = vi.fn().mockResolvedValue(mockNamespaces);
      window.electronAPI.getPods = vi.fn().mockResolvedValue(mockPods);
      window.electronAPI.getContainers = vi.fn().mockResolvedValue(mockContainers);
      window.electronAPI.listFiles = vi.fn().mockResolvedValue('total 8\ndrwxr-xr-x  2 root root 40966 Jan  1 00:00 app\n-rw-r--r--  1 root root  1024 Jan  1 00:00 config.yaml');

      await act(async () => {
        render(<App />);
      });

      await waitFor(() => screen.getByText('default'));
      await userEvent.click(screen.getByText('default'));

      await waitFor(() => screen.getByText('nginx-pod'));
      await userEvent.click(screen.getByText('nginx-pod'));

      await waitFor(() => screen.getByText('nginx'));
      await userEvent.click(screen.getByText('nginx'));

      await waitFor(() => {
        expect(screen.getByText('config.yaml')).toBeInTheDocument();
      });
    });

    it('displays toolbar with refresh button', async () => {
      window.electronAPI.getNamespaces = vi.fn().mockResolvedValue(mockNamespaces);
      window.electronAPI.getPods = vi.fn().mockResolvedValue(mockPods);
      window.electronAPI.getContainers = vi.fn().mockResolvedValue(mockContainers);
      window.electronAPI.listFiles = vi.fn().mockResolvedValue('');

      await act(async () => {
        render(<App />);
      });

      await waitFor(() => screen.getByText('default'));
      await userEvent.click(screen.getByText('default'));

      await waitFor(() => screen.getByText('nginx-pod'));
      await userEvent.click(screen.getByText('nginx-pod'));

      await waitFor(() => screen.getByText('nginx'));
      await userEvent.click(screen.getByText('nginx'));

      await waitFor(() => {
        expect(screen.getByText('🔄 刷新')).toBeInTheDocument();
      });
    });
  });

  describe('File Browser Operations', () => {
    it('should display toolbar with buttons when container is selected', async () => {
      window.electronAPI.getNamespaces = vi.fn().mockResolvedValue(mockNamespaces);
      window.electronAPI.getPods = vi.fn().mockResolvedValue(mockPods);
      window.electronAPI.getContainers = vi.fn().mockResolvedValue(mockContainers);

      await act(async () => {
        render(<App />);
      });

      await waitFor(() => screen.getByText('default'));
      await userEvent.click(screen.getByText('default'));

      await waitFor(() => screen.getByText('nginx-pod'));
      await userEvent.click(screen.getByText('nginx-pod'));

      await waitFor(() => screen.getByText('nginx'));
      await userEvent.click(screen.getByText('nginx'));

      await waitFor(() => {
        expect(screen.getByText('🔄 刷新')).toBeInTheDocument();
      });
    });
  });

  describe('Docker File Operations', () => {
    it('should call listDockerFiles when Docker image is clicked', async () => {
      window.electronAPI.getNamespaces = vi.fn().mockImplementation(() => new Promise(() => {}));
      window.electronAPI.listDockerImages = vi.fn().mockResolvedValue(mockDockerImages);

      await act(async () => {
        render(<App />);
      });

      await userEvent.click(screen.getByText('🐳 Docker'));

      await waitFor(() => screen.getByText('nginx'));

      await userEvent.click(screen.getByText('nginx'));

      await waitFor(() => {
        expect(window.electronAPI.listDockerFiles).toHaveBeenCalled();
      });
    });
  });
});
