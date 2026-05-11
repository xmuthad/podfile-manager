import { useState, useCallback } from 'react';
import './App.css';
import type { Container } from './types';
import { useTheme, useTransfer, useTerminal, useK8s, useDocker, useSearch } from './hooks';

function App() {
  const { theme, toggleTheme } = useTheme();
  const {
    transferProgress, isTransferring, setIsTransferring,
    showDownloadDialog, setShowDownloadDialog,
    downloadFileInfo, setDownloadFileInfo,
    downloadMethod, setDownloadMethod,
    limitSpeed, setLimitSpeed,
  } = useTransfer();
  const {
    showTerminal, setShowTerminal,
    terminalOutput, terminalInput, setTerminalInput,
    executeTerminalCommand,
  } = useTerminal();
  const {
    namespaces, selectedNamespace,
    pods, selectedPod,
    containers, selectedContainer,
    currentPath, files, loading, error, setError,
    fileContent, showFileViewer, setShowFileViewer,
    expandedNamespaces,
    expandedPods,
    selectedFiles, showBatchDownloadDialog, setShowBatchDownloadDialog,
    isEditMode, editFilePath, editFileContent, setEditFileContent,
    clusterConfigs, selectedCluster,
    loadFiles,
    viewFile, navigateToPath, handleDownloadClick,
    toggleFileSelection, confirmBatchDownload,
    startEditFile, saveEditFile, cancelEditFile,
    downloadDirectory, uploadFile, changeCluster,
    toggleNamespace, togglePod, selectContainer,
    confirmDownload,
    setFileContent,
  } = useK8s();
  const {
    dockerImages, dockerSearchTerm, setDockerSearchTerm,
    selectedDockerImage, setSelectedDockerImage,
    dockerFilePath, dockerFiles,
    loadingDockerImages, loadingDockerFiles, dockerLoading,
    dockerSelectedFiles, dockerShowBatchDownloadDialog, setDockerShowBatchDownloadDialog,
    dockerEditMode, dockerEditFilePath, dockerEditFileContent, setDockerEditFileContent,
    filteredDockerImages,
    loadDockerImages, loadDockerFiles,
    downloadFromDockerFile, navigateDockerPath,
    toggleDockerFileSelection, confirmDockerBatchDownload,
    startDockerEditFile, saveDockerEditFile, cancelDockerEditFile,
    downloadDockerDirectory, readDockerFile,
  } = useDocker();
  const {
    showSearchModal, setShowSearchModal,
    searchQuery, setSearchQuery,
    searchResults, isSearching,
    performSearch, navigateToSearchResult,
  } = useSearch();

  const [activeTab, setActiveTab] = useState<'k8s' | 'docker'>('k8s');

  const handleTabChange = useCallback((tab: 'k8s' | 'docker') => {
    setActiveTab(tab);
    if (tab === 'docker' && dockerImages.length === 0) {
      loadDockerImages();
    }
  }, [dockerImages.length, loadDockerImages]);

  const onHandleDownloadClick = useCallback((fileLine: string) => {
    handleDownloadClick(fileLine, setDownloadFileInfo, setShowDownloadDialog);
  }, [handleDownloadClick, setDownloadFileInfo, setShowDownloadDialog]);

  const onConfirmDownload = useCallback(() => {
    confirmDownload(downloadFileInfo, downloadMethod, limitSpeed, setIsTransferring, setShowDownloadDialog);
  }, [confirmDownload, downloadFileInfo, downloadMethod, limitSpeed, setIsTransferring, setShowDownloadDialog]);

  const onConfirmBatchDownload = useCallback(() => {
    confirmBatchDownload(setIsTransferring);
  }, [confirmBatchDownload, setIsTransferring]);

  const onDownloadDirectory = useCallback(() => {
    downloadDirectory(setIsTransferring);
  }, [downloadDirectory, setIsTransferring]);

  const onUploadFile = useCallback(() => {
    uploadFile(setIsTransferring);
  }, [uploadFile, setIsTransferring]);

  const onDownloadFromDockerFile = useCallback((fileLine: string) => {
    downloadFromDockerFile(fileLine, setIsTransferring, setError);
  }, [downloadFromDockerFile, setIsTransferring, setError]);

  const onConfirmDockerBatchDownload = useCallback(() => {
    confirmDockerBatchDownload(setIsTransferring, setError);
  }, [confirmDockerBatchDownload, setIsTransferring, setError]);

  const onStartDockerEditFile = useCallback((fileLine: string) => {
    startDockerEditFile(fileLine, setError);
  }, [startDockerEditFile, setError]);

  const onSaveDockerEditFile = useCallback(() => {
    saveDockerEditFile(setError);
  }, [saveDockerEditFile, setError]);

  const onDownloadDockerDirectory = useCallback(() => {
    downloadDockerDirectory(setIsTransferring, setError);
  }, [downloadDockerDirectory, setIsTransferring, setError]);

  const onReadDockerFile = useCallback((fileLine: string) => {
    readDockerFile(fileLine, setError, setFileContent, setShowFileViewer);
  }, [readDockerFile, setError, setFileContent, setShowFileViewer]);

  const onPerformSearch = useCallback(() => {
    performSearch(activeTab, selectedNamespace, selectedPod, selectedContainer, currentPath, selectedDockerImage, dockerFilePath, setError);
  }, [performSearch, activeTab, selectedNamespace, selectedPod, selectedContainer, currentPath, selectedDockerImage, dockerFilePath, setError]);

  const onNavigateToSearchResult = useCallback((path: string) => {
    navigateToSearchResult(path, activeTab, loadFiles, loadDockerFiles, selectedPod, selectedContainer, selectedDockerImage);
  }, [navigateToSearchResult, activeTab, loadFiles, loadDockerFiles, selectedPod, selectedContainer, selectedDockerImage]);

  const onExecuteTerminalCommand = useCallback(() => {
    executeTerminalCommand(activeTab, selectedNamespace, selectedPod, selectedContainer, selectedDockerImage);
  }, [executeTerminalCommand, activeTab, selectedNamespace, selectedPod, selectedContainer, selectedDockerImage]);

  function getPodPhaseColor(phase: string): string {
    switch (phase) {
      case 'Running': return '#38a169';
      case 'Pending': return '#dd6b20';
      case 'Succeeded': return '#667eea';
      case 'Failed': return '#c53030';
      default: return '#718096';
    }
  }

  function getContainerStatusColor(container: Container): string {
    if (container.state.running) return '#38a169';
    if (container.state.terminated) return '#c53030';
    if (container.state.waiting) return '#dd6b20';
    return '#718096';
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  return (
    <div className="app">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <div>
            <h1>🚀 PodFile Manager</h1>
            <p>Kubernetes 集群 Pod 文件管理工具</p>
          </div>
          {clusterConfigs.length > 0 && (
            <div className="cluster-selector">
              <select
                className="cluster-select"
                value={selectedCluster}
                onChange={(e) => changeCluster(e.target.value)}
              >
                {clusterConfigs.map(cluster => (
                  <option key={cluster.name} value={cluster.name}>
                    {cluster.name} ({cluster.cluster})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="header-actions">
            <button className="theme-toggle" onClick={toggleTheme} title="切换主题">
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <button
              className="theme-toggle"
              onClick={() => setShowSearchModal(true)}
              title="搜索文件"
            >
              🔍
            </button>
            <button
              className="theme-toggle"
              onClick={() => setShowTerminal(!showTerminal)}
              title="终端"
            >
              💻
            </button>
          </div>
        </div>
      </header>

      <div className="main-content">
        <aside className="sidebar">
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab ${activeTab === 'k8s' ? 'active' : ''}`}
              onClick={() => handleTabChange('k8s')}
            >
              ☸️ Kubernetes
            </button>
            <button
              className={`sidebar-tab ${activeTab === 'docker' ? 'active' : ''}`}
              onClick={() => handleTabChange('docker')}
            >
              🐳 Docker
            </button>
          </div>

          {activeTab === 'k8s' && (
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
                      onClick={() => toggleNamespace(namespace)}
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
                              onClick={() => togglePod(pod.metadata.name)}
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
                                    onClick={() => selectContainer(container.name)}
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
          )}

          {activeTab === 'docker' && (
            <div className="docker-panel">
              <div className="sidebar-header">
                <h3>🐳 Docker 镜像</h3>
              </div>
              <div className="docker-search">
                <input
                  type="text"
                  placeholder="🔍 搜索镜像..."
                  value={dockerSearchTerm}
                  onChange={(e) => setDockerSearchTerm(e.target.value)}
                />
                {dockerSearchTerm && (
                  <button
                    className="search-clear"
                    onClick={() => setDockerSearchTerm('')}
                  >
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
                    <button className="btn btn-small" onClick={loadDockerImages}>
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
                      onClick={() => {
                        const imageName = `${image.repository}:${image.tag}`;
                        setSelectedDockerImage(imageName);
                        loadDockerFiles(imageName, '/');
                      }}
                    >
                      <div className="docker-image-icon">🐳</div>
                      <div className="docker-image-info">
                        <div className="docker-image-name">{image.repository}</div>
                        <div className="docker-image-tag">{image.tag}</div>
                        <div className="docker-image-meta">{image.size}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>

        <main className="file-browser">
          {activeTab === 'docker' && (
            <div className="docker-browser">
              <div className="toolbar">
                <div className="toolbar-info">
                  <span className="toolbar-icon">🐳</span>
                  <span className="toolbar-path">{dockerFilePath}</span>
                </div>
                {selectedDockerImage && (
                  <>
                    {dockerSelectedFiles.size > 0 && (
                      <button
                        className="btn btn-primary"
                        onClick={() => setDockerShowBatchDownloadDialog(true)}
                        disabled={isTransferring || loadingDockerFiles}
                      >
                        📦 批量下载 ({dockerSelectedFiles.size})
                      </button>
                    )}
                    <button
                      className="btn btn-primary"
                      onClick={() => loadDockerFiles(selectedDockerImage, dockerFilePath)}
                      disabled={isTransferring || loadingDockerFiles}
                    >
                      🔄 刷新
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={onDownloadDockerDirectory}
                      disabled={isTransferring || loadingDockerFiles}
                    >
                      📁 下载目录
                    </button>
                    <button
                      className="btn btn-success"
                      onClick={() => {
                        const parentPath = dockerFilePath.split('/').slice(0, -1).join('/') || '/';
                        loadDockerFiles(selectedDockerImage, parentPath);
                      }}
                      disabled={isTransferring || loadingDockerFiles}
                    >
                      ⬆️ 返回上级
                    </button>
                  </>
                )}
              </div>

              {isTransferring && transferProgress && (
                <div className="transfer-progress">
                  <div className="transfer-info">
                    <div className="transfer-status">
                      {transferProgress.status === 'downloading' && '⬇️ 正在下载'}
                      {transferProgress.status === 'completed' && '✅ 下载完成'}
                      {transferProgress.status === 'error' && '❌ 下载失败'}
                    </div>
                    <div className="transfer-details">
                      {transferProgress.status !== 'error' && transferProgress.status !== 'completed' && (
                        <span className="transfer-speed">{transferProgress.speed || 'calculating...'}</span>
                      )}
                      {transferProgress.status === 'error' && (
                        <span className="transfer-error">{transferProgress.message}</span>
                      )}
                    </div>
                  </div>
                  <div className="progress-bar-container">
                    <div
                      className={`progress-bar ${transferProgress.status === 'error' ? 'error' : transferProgress.status === 'completed' ? 'completed' : ''}`}
                      style={{ width: `${transferProgress.percent || 100}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {loadingDockerFiles && !isTransferring && (
                <div className="loading">
                  <div className="loading-spinner"></div>
                  <div className="loading-text">加载文件列表...</div>
                </div>
              )}

              {error && !isTransferring && (
                <div className="error">
                  <span className="error-icon">⚠️</span>
                  {error}
                </div>
              )}

              {!selectedDockerImage && (
                <div className="empty-state">
                  <div className="empty-state-icon">🐳</div>
                  <h2>从 Docker 镜像下载文件</h2>
                  <p>从左侧选择 Docker 镜像，即可浏览镜像内的文件目录</p>
                </div>
              )}

              {selectedDockerImage && dockerFiles.length > 0 && !loadingDockerFiles && (
                <div className="file-list">
                  {dockerFiles.map((file) => {
                    const parts = file.trim().split(/\s+/);
                    const isDir = parts[0].startsWith('d');
                    const fileName = parts.slice(8).join(' ');
                    const filePath = dockerFilePath.endsWith('/') ? `${dockerFilePath}${fileName}` : `${dockerFilePath}/${fileName}`;
                    const isSelected = dockerSelectedFiles.has(filePath);
                    return (
                      <div key={filePath} className={`file-item ${isSelected ? 'selected' : ''}`}>
                        {!isDir && (
                          <input
                            type="checkbox"
                            className="file-checkbox"
                            checked={isSelected}
                            onChange={() => toggleDockerFileSelection(file)}
                          />
                        )}
                        <div className="file-icon" onClick={() => navigateDockerPath(file)}>
                          {isDir ? '📁' : '📄'}
                        </div>
                        <div className="file-info" onClick={() => navigateDockerPath(file)}>
                          <div className="file-name">{fileName}</div>
                          <div className="file-meta">
                            {parts[4]} bytes | {parts[5]} {parts[6]} {parts[7]}
                          </div>
                        </div>
                        <div className="file-actions">
                          {!isDir && (
                            <>
                              <button className="btn btn-small" onClick={() => onReadDockerFile(file)} disabled={isTransferring}>👁️ 查看</button>
                              <button className="btn btn-small" onClick={() => onStartDockerEditFile(file)} disabled={isTransferring}>✏️ 编辑</button>
                              <button className="btn btn-small btn-primary" onClick={() => onDownloadFromDockerFile(file)} disabled={isTransferring}>⬇️ 下载</button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedDockerImage && dockerFiles.length === 0 && !loadingDockerFiles && !error && (
                <div className="empty-state">
                  <div className="empty-state-icon">📂</div>
                  <p>该目录下没有文件</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'k8s' && selectedContainer && (
            <>
              <div className="toolbar">
                <div className="toolbar-info">
                  <span className="toolbar-icon">📂</span>
                  <span className="toolbar-path">{currentPath}</span>
                </div>
                {selectedFiles.size > 0 && (
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowBatchDownloadDialog(true)}
                    disabled={isTransferring}
                  >
                    📦 批量下载 ({selectedFiles.size})
                  </button>
                )}
                <button
                  className="btn btn-primary"
                  onClick={() => loadFiles(selectedPod, selectedContainer, currentPath)}
                  disabled={isTransferring}
                >
                  🔄 刷新
                </button>
                <button
                  className="btn btn-primary"
                  onClick={onDownloadDirectory}
                  disabled={isTransferring}
                >
                  📁 下载目录
                </button>
                <button
                  className="btn btn-success"
                  onClick={onUploadFile}
                  disabled={isTransferring}
                >
                  ⬆️ 上传
                </button>
              </div>

              {isTransferring && transferProgress && (
                <div className="transfer-progress">
                  <div className="transfer-info">
                    <div className="transfer-status">
                      {transferProgress.status === 'uploading' && '⬆️ 正在上传'}
                      {transferProgress.status === 'downloading' && '⬇️ 正在下载'}
                      {transferProgress.status === 'completed' && '✅ 传输完成'}
                      {transferProgress.status === 'error' && '❌ 传输失败'}
                    </div>
                    <div className="transfer-details">
                      {transferProgress.status !== 'error' && transferProgress.status !== 'completed' && (
                        <>
                          <span className="transfer-speed">{transferProgress.speed || 'calculating...'}</span>
                          <span className="transfer-size">
                            {formatBytes(transferProgress.transferred)} / {formatBytes(transferProgress.total)}
                          </span>
                        </>
                      )}
                      {transferProgress.status === 'error' && (
                        <span className="transfer-error">{transferProgress.message}</span>
                      )}
                    </div>
                  </div>
                  <div className="progress-bar-container">
                    <div
                      className={`progress-bar ${transferProgress.status === 'error' ? 'error' : transferProgress.status === 'completed' ? 'completed' : ''}`}
                      style={{ width: `${transferProgress.percent || 100}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {loading && !isTransferring && (
                <div className="loading">
                  <div className="loading-spinner"></div>
                  <div className="loading-text">加载文件列表...</div>
                </div>
              )}
              {error && !isTransferring && (
                <div className="error">
                  <span className="error-icon">⚠️</span>
                  {error}
                </div>
              )}

              <div className="file-list">
                {files.map((file) => {
                  const parts = file.trim().split(/\s+/);
                  const isDir = parts[0].startsWith('d');
                  const fileName = parts.slice(8).join(' ');
                  const filePath = currentPath.endsWith('/') ? `${currentPath}${fileName}` : `${currentPath}/${fileName}`;
                  const isSelected = selectedFiles.has(filePath);
                  return (
                    <div key={filePath} className={`file-item ${isSelected ? 'selected' : ''}`}>
                      {!isDir && (
                        <input
                          type="checkbox"
                          className="file-checkbox"
                          checked={isSelected}
                          onChange={() => toggleFileSelection(file)}
                        />
                      )}
                      <div className="file-icon" onClick={() => navigateToPath(file)}>
                        {isDir ? '📁' : '📄'}
                      </div>
                      <div className="file-info" onClick={() => navigateToPath(file)}>
                        <div className="file-name">{fileName}</div>
                        <div className="file-meta">
                          {parts[4]} bytes | {parts[5]} {parts[6]} {parts[7]}
                        </div>
                      </div>
                      <div className="file-actions">
                        {!isDir && (
                          <>
                            <button className="btn btn-small" onClick={() => viewFile(file)} disabled={isTransferring}>👁️ 查看</button>
                            <button className="btn btn-small" onClick={() => startEditFile(file)} disabled={isTransferring}>✏️ 编辑</button>
                            <button className="btn btn-small btn-primary" onClick={() => onHandleDownloadClick(file)} disabled={isTransferring}>⬇️ 下载</button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {activeTab === 'k8s' && !selectedContainer && (
            <div className="empty-state">
              <div className="empty-state-icon">☁️</div>
              <h2>开始管理您的 Kubernetes 文件</h2>
              <p>从左侧导航树中选择一个容器来开始浏览和管理 Pod 中的文件</p>
            </div>
          )}
        </main>
      </div>

      {showDownloadDialog && downloadFileInfo && (
        <div className="modal-overlay" onClick={() => setShowDownloadDialog(false)}>
          <div className="modal download-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⬇️ 选择下载方式</h3>
              <button className="btn btn-small" onClick={() => setShowDownloadDialog(false)}>✕</button>
            </div>
            <div className="modal-content">
              <div className="download-file-info">
                <span className="download-file-name">📄 {downloadFileInfo.name}</span>
                <span className="download-file-path">{downloadFileInfo.path}</span>
              </div>

              <div className="download-options">
                <label className={`download-option ${downloadMethod === 'kubectl-cp' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="downloadMethod"
                    value="kubectl-cp"
                    checked={downloadMethod === 'kubectl-cp'}
                    onChange={(e) => setDownloadMethod(e.target.value as 'kubectl-cp')}
                  />
                  <div className="option-content">
                    <div className="option-title">⚡ kubectl cp (快速)</div>
                    <div className="option-desc">直接使用 kubectl cp 命令下载，速度快，无限速</div>
                  </div>
                </label>

                <label className={`download-option ${downloadMethod === 'dd-limit' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="downloadMethod"
                    value="dd-limit"
                    checked={downloadMethod === 'dd-limit'}
                    onChange={(e) => setDownloadMethod(e.target.value as 'dd-limit')}
                  />
                  <div className="option-content">
                    <div className="option-title">🐌 dd 限速 (限速下载)</div>
                    <div className="option-desc">使用 kubectl exec + dd 命令限速下载</div>
                    {downloadMethod === 'dd-limit' && (
                      <div className="speed-input">
                        <label>限速速度 (KB/s):</label>
                        <input
                          type="number"
                          value={limitSpeed}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setLimitSpeed(isNaN(val) || val < 1 ? 1024 : Math.min(Math.max(val, 1), 10240));
                          }}
                          min="1"
                          max="10240"
                        />
                      </div>
                    )}
                  </div>
                </label>
              </div>

              <div className="modal-actions">
                <button className="btn" onClick={() => setShowDownloadDialog(false)}>取消</button>
                <button className="btn btn-primary" onClick={onConfirmDownload}>确认下载</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFileViewer && (
        <div className="modal-overlay" onClick={() => setShowFileViewer(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📄 文件内容</h3>
              <button className="btn btn-small" onClick={() => setShowFileViewer(false)}>✕ 关闭</button>
            </div>
            <div className="modal-content">
              <pre>{fileContent}</pre>
            </div>
          </div>
        </div>
      )}

      {showBatchDownloadDialog && (
        <div className="modal-overlay" onClick={() => setShowBatchDownloadDialog(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📦 批量下载</h3>
              <button className="btn btn-small" onClick={() => setShowBatchDownloadDialog(false)}>✕</button>
            </div>
            <div className="modal-content">
              <p>确认下载以下 {selectedFiles.size} 个文件？</p>
              <div className="selected-files-list">
                {Array.from(selectedFiles).map((file, index) => (
                  <div key={index} className="selected-file-item">
                    📄 {file}
                  </div>
                ))}
              </div>
              <p className="download-note">文件将被打包成 tar 格式下载</p>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowBatchDownloadDialog(false)}>取消</button>
              <button className="btn btn-primary" onClick={onConfirmBatchDownload}>确认下载</button>
            </div>
          </div>
        </div>
      )}

      {isEditMode && (
        <div className="modal-overlay" onClick={() => cancelEditFile()}>
          <div className="modal edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ 编辑文件</h3>
              <div className="edit-actions">
                <button className="btn" onClick={() => cancelEditFile()}>取消</button>
                <button className="btn btn-primary" onClick={saveEditFile} disabled={loading}>💾 保存</button>
              </div>
            </div>
            <div className="modal-content">
              <div className="edit-file-path">{editFilePath}</div>
              <textarea
                className="file-editor"
                value={editFileContent}
                onChange={(e) => setEditFileContent(e.target.value)}
                placeholder="文件内容..."
              />
            </div>
          </div>
        </div>
      )}

      {dockerShowBatchDownloadDialog && (
        <div className="modal-overlay" onClick={() => setDockerShowBatchDownloadDialog(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📦 Docker 批量下载</h3>
              <button className="btn btn-small" onClick={() => setDockerShowBatchDownloadDialog(false)}>✕</button>
            </div>
            <div className="modal-content">
              <p>确认下载以下 {dockerSelectedFiles.size} 个文件？</p>
              <div className="selected-files-list">
                {Array.from(dockerSelectedFiles).map((file, index) => (
                  <div key={index} className="selected-file-item">
                    📄 {file}
                  </div>
                ))}
              </div>
              <p className="download-note">文件将被打包成 tar 格式下载</p>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setDockerShowBatchDownloadDialog(false)}>取消</button>
              <button className="btn btn-primary" onClick={onConfirmDockerBatchDownload}>确认下载</button>
            </div>
          </div>
        </div>
      )}

      {dockerEditMode && (
        <div className="modal-overlay" onClick={() => cancelDockerEditFile()}>
          <div className="modal edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ 编辑 Docker 镜像文件</h3>
              <div className="edit-actions">
                <button className="btn" onClick={() => cancelDockerEditFile()}>取消</button>
                <button className="btn btn-primary" onClick={onSaveDockerEditFile} disabled={dockerLoading}>💾 保存</button>
              </div>
            </div>
            <div className="modal-content">
              <div className="edit-file-path">{dockerEditFilePath}</div>
              <textarea
                className="file-editor"
                value={dockerEditFileContent}
                onChange={(e) => setDockerEditFileContent(e.target.value)}
                placeholder="文件内容..."
              />
            </div>
          </div>
        </div>
      )}

      {showSearchModal && (
        <div className="modal-overlay" onClick={() => setShowSearchModal(false)}>
          <div className="modal search-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔍 文件搜索</h3>
              <button className="btn btn-small" onClick={() => setShowSearchModal(false)}>✕</button>
            </div>
            <div className="modal-content">
              <div className="search-input-container">
                <input
                  type="text"
                  className="search-input"
                  placeholder="输入文件名搜索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onPerformSearch()}
                />
                <button className="btn btn-primary" onClick={onPerformSearch}>搜索</button>
              </div>
              {isSearching && <div className="loading">搜索中...</div>}
              {searchResults.length > 0 && (
                <div className="search-results">
                  {searchResults.map((result) => (
                    <div
                      key={result}
                      className="search-result-item"
                      onClick={() => onNavigateToSearchResult(result)}
                    >
                      📄 {result}
                    </div>
                  ))}
                </div>
              )}
              {searchQuery && !isSearching && searchResults.length === 0 && (
                <div className="empty-state">
                  <p>未找到匹配的文件</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showTerminal && (
        <div className="terminal-container">
          <div className="terminal-header">
            <h3>💻 终端</h3>
            <button className="btn btn-small" onClick={() => setShowTerminal(false)}>✕</button>
          </div>
          <div className="terminal-output">
            <pre>{terminalOutput || '$ Ready...\n'}</pre>
          </div>
          <div className="terminal-input-container">
            <span className="terminal-prompt">$</span>
            <input
              type="text"
              className="terminal-input"
              value={terminalInput}
              onChange={(e) => setTerminalInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onExecuteTerminalCommand();
                }
              }}
              placeholder="输入命令..."
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
