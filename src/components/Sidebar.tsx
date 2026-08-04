import { memo } from 'react';
import type { Container, Pod, DockerImage } from '../types';
import { getPodPhaseColor, getContainerStatusColor } from '../utils';
import { useApp } from '../contexts/useApp';

interface K8sTreeProps {
  loading: boolean;
  error: string | null;
  namespaces: string[];
  selectedNamespace: string;
  selectedPod: string;
  selectedContainer: string;
  expandedNamespaces: Set<string>;
  expandedPods: Set<string>;
  pods: Pod[];
  containers: Container[];
  onToggleNamespace: (namespace: string) => void;
  onTogglePod: (pod: string) => void;
  onSelectContainer: (container: string) => void;
}

const K8sTree = memo(function K8sTree({
  loading, error, namespaces, selectedNamespace, selectedPod, selectedContainer,
  expandedNamespaces, expandedPods, pods, containers,
  onToggleNamespace, onTogglePod, onSelectContainer,
}: K8sTreeProps) {
  return (
    <>
      <div className="sidebar-header">
        <h3>🔍 集群导航</h3>
      </div>
      <div className="tree-view">
        {loading && namespaces.length === 0 && (
          <div className="tree-loading">
            <div className="loading-spinner"></div>
            <span>加载中...</span>
          </div>
        )}
        {error && (
          <div className="error">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}
        {namespaces.map(namespace => (
          <div key={namespace} className="tree-item">
            <div
              className={`tree-item-header ${selectedNamespace === namespace && !selectedPod ? 'selected' : ''}`}
              onClick={() => onToggleNamespace(namespace)}
            >
              <span className="tree-arrow">
                {expandedNamespaces.has(namespace) ? '▼' : '▶'}
              </span>
              <span className="tree-icon">📦</span>
              <span className="tree-label">{namespace}</span>
              {expandedNamespaces.has(namespace) && pods.length > 0 && (
                <span className="tree-count">{pods.length}</span>
              )}
            </div>
            {expandedNamespaces.has(namespace) && (
              <div className="tree-children">
                {pods.map(pod => (
                  <div key={pod.metadata.name} className="tree-item">
                    <div
                      className={`tree-item-header pod-header ${selectedPod === pod.metadata.name ? 'selected' : ''}`}
                      onClick={() => onTogglePod(pod.metadata.name)}
                    >
                      <span className="tree-arrow">
                        {expandedPods.has(pod.metadata.name) ? '▼' : '▶'}
                      </span>
                      <span
                        className="pod-status-dot"
                        style={{ backgroundColor: getPodPhaseColor(pod.status.phase) }}
                        title={pod.status.phase}
                      ></span>
                      <span className="tree-label pod-name" title={pod.metadata.name}>
                        {pod.metadata.name}
                      </span>
                    </div>
                    {expandedPods.has(pod.metadata.name) && (
                      <div className="tree-children">
                        {containers.map(container => (
                          <div
                            key={container.name}
                            className={`tree-item-header container-header ${selectedContainer === container.name ? 'selected' : ''}`}
                            onClick={() => onSelectContainer(container.name)}
                          >
                            <span className="tree-arrow invisible">▶</span>
                            <span
                              className="container-status-bar"
                              style={{ backgroundColor: getContainerStatusColor(container) }}
                            ></span>
                            <span className="tree-label container-name" title={container.name}>
                              {container.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
});

interface DockerPanelProps {
  dockerImages: DockerImage[];
  dockerSearchTerm: string;
  selectedDockerImage: string;
  loadingDockerImages: boolean;
  filteredDockerImages: DockerImage[];
  onSearchTermChange: (term: string) => void;
  onSelectImage: (imageName: string) => void;
  onRefresh: () => void;
}

const DockerPanel = memo(function DockerPanel({
  dockerImages, dockerSearchTerm, selectedDockerImage,
  loadingDockerImages, filteredDockerImages,
  onSearchTermChange, onSelectImage, onRefresh,
}: DockerPanelProps) {
  return (
    <div className="docker-panel">
      <div className="sidebar-header">
        <h3>🐳 Docker 镜像</h3>
      </div>
      <div className="docker-search">
        <input
          type="text"
          placeholder="🔍 搜索镜像..."
          value={dockerSearchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
        />
        {dockerSearchTerm && (
          <button className="search-clear" onClick={() => onSearchTermChange('')}>
            ✕
          </button>
        )}
      </div>
      <div className="tree-view">
        {loadingDockerImages && (
          <div className="tree-loading">
            <div className="loading-spinner"></div>
            <span>加载镜像中...</span>
          </div>
        )}
        {!loadingDockerImages && dockerImages.length === 0 && (
          <div className="tree-empty">
            <p>暂无可用镜像</p>
            <button className="btn btn-small" onClick={onRefresh}>
              🔄 刷新
            </button>
          </div>
        )}
        <div className="docker-image-list">
          {dockerSearchTerm && filteredDockerImages.length === 0 && (
            <div className="tree-empty">
              <p>没有找到匹配的镜像</p>
            </div>
          )}
          {filteredDockerImages.map((image) => (
            <div
              key={`${image.repository}:${image.tag}:${image.id}`}
              className={`docker-image-item ${selectedDockerImage === `${image.repository}:${image.tag}` ? 'selected' : ''}`}
              onClick={() => onSelectImage(`${image.repository}:${image.tag}`)}
              title={`${image.repository}:${image.tag} (${image.size})`}
            >
              <div className="docker-image-icon">🐳</div>
              <div className="docker-image-info">
                <div className="docker-image-name" title={image.repository}>{image.repository}</div>
                <div className="docker-image-tag" title={image.tag}>{image.tag}</div>
                <div className="docker-image-meta" title={image.size}>{image.size}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export function Sidebar() {
  const app = useApp();
  return (
    <aside className="sidebar">
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${app.activeTab === 'k8s' ? 'active' : ''}`}
          onClick={() => app.handleTabChange('k8s')}
        >
          ☸️ Kubernetes
        </button>
        <button
          className={`sidebar-tab ${app.activeTab === 'docker' ? 'active' : ''}`}
          onClick={() => app.handleTabChange('docker')}
        >
          🐳 Docker
        </button>
      </div>
      {app.activeTab === 'k8s' && (
        <K8sTree
          loading={app.k8s.loading}
          error={app.k8s.error}
          namespaces={app.k8s.namespaces}
          selectedNamespace={app.k8s.selectedNamespace}
          selectedPod={app.k8s.selectedPod}
          selectedContainer={app.k8s.selectedContainer}
          expandedNamespaces={app.k8s.expandedNamespaces}
          expandedPods={app.k8s.expandedPods}
          pods={app.k8s.pods}
          containers={app.k8s.containers}
          onToggleNamespace={app.k8s.toggleNamespace}
          onTogglePod={app.k8s.togglePod}
          onSelectContainer={app.k8s.selectContainer}
        />
      )}
      {app.activeTab === 'docker' && (
        <DockerPanel
          dockerImages={app.docker.dockerImages}
          dockerSearchTerm={app.docker.dockerSearchTerm}
          selectedDockerImage={app.docker.selectedDockerImage}
          loadingDockerImages={app.docker.loadingDockerImages}
          filteredDockerImages={app.docker.filteredDockerImages}
          onSearchTermChange={app.docker.setDockerSearchTerm}
          onSelectImage={app.handleSelectDockerImage}
          onRefresh={app.docker.loadDockerImages}
        />
      )}
    </aside>
  );
}

export type { K8sTreeProps, DockerPanelProps };
