import { lazy, Suspense } from 'react';
import { AppProvider } from './contexts/AppContext';
import { useApp } from './contexts/useApp';
import { useTerminalContext } from './contexts/TerminalContext';
import { useTransferContext } from './contexts/TransferContext';
import { ToastContainer } from './components/ToastContainer';
import { Sidebar } from './components/Sidebar';
import { FileList } from './components/FileList';
import { TransferProgressBar } from './components/TransferProgressBar';
import './App.css';

const FileViewerModal = lazy(() => import('./components/FileViewerModal').then(m => ({ default: m.FileViewerModal })));
const DownloadDialog = lazy(() => import('./components/DownloadDialog').then(m => ({ default: m.DownloadDialog })));
const BatchDownloadDialog = lazy(() => import('./components/BatchDownloadDialog').then(m => ({ default: m.BatchDownloadDialog })));
const FileEditorModal = lazy(() => import('./components/FileEditorModal').then(m => ({ default: m.FileEditorModal })));
const SearchModal = lazy(() => import('./components/SearchModal').then(m => ({ default: m.SearchModal })));
const TerminalPanel = lazy(() => import('./components/TerminalPanel').then(m => ({ default: m.TerminalPanel })));

function AppHeader() {
  const app = useApp();
  const terminal = useTerminalContext();
  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
        <div>
          <h1>🚀 PodFile Manager</h1>
          <p>Kubernetes 集群 Pod 文件管理工具</p>
        </div>
        {app.k8s.clusterConfigs.length > 0 && (
          <div className="cluster-selector">
            <select
              className="cluster-select"
              value={app.k8s.selectedCluster}
              onChange={(e) => app.k8s.changeCluster(e.target.value)}
            >
              {app.k8s.clusterConfigs.map(cluster => (
                <option key={cluster.name} value={cluster.name}>
                  {cluster.name} ({cluster.cluster})
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="header-actions">
          <button className="theme-toggle" onClick={app.toggleTheme} title="切换主题">
            {app.theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button
            className="theme-toggle"
            onClick={() => app.setShowSearchModal(true)}
            title="搜索文件"
          >
            🔍
          </button>
          <button
            className="theme-toggle"
            onClick={() => terminal.setShowTerminal(!terminal.showTerminal)}
            title="终端"
          >
            💻
          </button>
        </div>
      </div>
    </header>
  );
}

function TransferBar() {
  const app = useApp();
  const transfer = useTransferContext();
  if (!transfer.isTransferring || !transfer.transferProgress) return null;
  return <TransferProgressBar transferProgress={transfer.transferProgress} mode={app.activeTab} />;
}

function K8sFileBrowser() {
  const app = useApp();
  const transfer = useTransferContext();
  if (app.activeTab !== 'k8s' || !app.k8s.selectedContainer) return null;

  return (
    <>
      <div className="toolbar">
        <div className="toolbar-info">
          <span className="toolbar-icon">📂</span>
          <span className="toolbar-path">{app.k8s.currentPath}</span>
        </div>
        {app.k8s.selectedFiles.size > 0 && (
          <button
            className="btn btn-primary"
            onClick={() => app.k8s.setShowBatchDownloadDialog(true)}
            disabled={transfer.isTransferring}
          >
            📦 批量下载 ({app.k8s.selectedFiles.size})
          </button>
        )}
        <button
          className="btn btn-primary"
          onClick={() => app.k8s.loadFiles(app.k8s.selectedPod, app.k8s.selectedContainer, app.k8s.currentPath)}
          disabled={transfer.isTransferring}
        >
          🔄 刷新
        </button>
        <button
          className="btn btn-primary"
          onClick={app.onDownloadDirectory}
          disabled={transfer.isTransferring}
        >
          📁 下载目录
        </button>
        <button
          className="btn btn-success"
          onClick={app.onUploadFile}
          disabled={transfer.isTransferring}
        >
          ⬆️ 上传
        </button>
      </div>

      <TransferBar />

      {app.k8s.loading && !transfer.isTransferring && (
        <div className="loading">
          <div className="loading-spinner"></div>
          <div className="loading-text">加载文件列表...</div>
        </div>
      )}
      {app.k8s.error && !transfer.isTransferring && (
        <div className="error">
          <span className="error-icon">⚠️</span>
          {app.k8s.error}
        </div>
      )}

      <FileList
        files={app.k8s.files}
        selectedFiles={app.k8s.selectedFiles}
        isTransferring={transfer.isTransferring}
        onNavigate={app.k8s.navigateToPath}
        onToggleSelection={app.k8s.toggleFileSelection}
        onView={app.k8s.viewFile}
        onEdit={app.k8s.startEditFile}
        onDownload={app.onHandleDownloadClick}
      />
    </>
  );
}

function DockerFileBrowser() {
  const app = useApp();
  const transfer = useTransferContext();
  if (app.activeTab !== 'docker') return null;

  return (
    <div className="docker-browser">
      <div className="toolbar">
        <div className="toolbar-info">
          <span className="toolbar-icon">🐳</span>
          <span className="toolbar-path">{app.docker.dockerFilePath}</span>
        </div>
        {app.docker.selectedDockerImage && (
          <>
            {app.docker.dockerSelectedFiles.size > 0 && (
              <button
                className="btn btn-primary"
                onClick={() => app.docker.setDockerShowBatchDownloadDialog(true)}
                disabled={transfer.isTransferring || app.docker.loadingDockerFiles}
              >
                📦 批量下载 ({app.docker.dockerSelectedFiles.size})
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={() => app.docker.loadDockerFiles(app.docker.selectedDockerImage, app.docker.dockerFilePath)}
              disabled={transfer.isTransferring || app.docker.loadingDockerFiles}
            >
              🔄 刷新
            </button>
            <button
              className="btn btn-primary"
              onClick={app.onDownloadDockerDirectory}
              disabled={transfer.isTransferring || app.docker.loadingDockerFiles}
            >
              📁 下载目录
            </button>
            <button
              className="btn btn-success"
              onClick={() => {
                const parentPath = app.docker.dockerFilePath.split('/').slice(0, -1).join('/') || '/';
                app.docker.loadDockerFiles(app.docker.selectedDockerImage, parentPath);
              }}
              disabled={transfer.isTransferring || app.docker.loadingDockerFiles}
            >
              ⬆️ 返回上级
            </button>
          </>
        )}
      </div>

      <TransferBar />

      {app.docker.loadingDockerFiles && !transfer.isTransferring && (
        <div className="loading">
          <div className="loading-spinner"></div>
          <div className="loading-text">加载文件列表...</div>
        </div>
      )}

      {app.docker.dockerError && !transfer.isTransferring && (
        <div className="error">
          <span className="error-icon">⚠️</span>
          {app.docker.dockerError}
        </div>
      )}

      {!app.docker.selectedDockerImage && (
        <div className="empty-state">
          <div className="empty-state-icon">🐳</div>
          <h2>从 Docker 镜像下载文件</h2>
          <p>从左侧选择 Docker 镜像，即可浏览镜像内的文件目录</p>
        </div>
      )}

      {app.docker.selectedDockerImage && app.docker.dockerFiles.length > 0 && !app.docker.loadingDockerFiles && (
        <FileList
          files={app.docker.dockerFiles}
          selectedFiles={app.docker.dockerSelectedFiles}
          isTransferring={transfer.isTransferring}
          onNavigate={app.docker.navigateDockerPath}
          onToggleSelection={app.docker.toggleDockerFileSelection}
          onView={app.onReadDockerFile}
          onEdit={app.onStartDockerEditFile}
          onDownload={app.onDownloadFromDockerFile}
        />
      )}

      {app.docker.selectedDockerImage && app.docker.dockerFiles.length === 0 && !app.docker.loadingDockerFiles && !app.docker.dockerError && (
        <div className="empty-state">
          <div className="empty-state-icon">📂</div>
          <p>该目录下没有文件</p>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  const app = useApp();
  if (app.activeTab !== 'k8s' || app.k8s.selectedContainer) return null;
  return (
    <div className="empty-state">
      <div className="empty-state-icon">☁️</div>
      <h2>开始管理您的 Kubernetes 文件</h2>
      <p>从左侧导航树中选择一个容器来开始浏览和管理 Pod 中的文件</p>
    </div>
  );
}

function TerminalSection() {
  const terminal = useTerminalContext();
  const app = useApp();
  return (
    <TerminalPanel
      show={terminal.showTerminal}
      output={terminal.terminalOutput}
      input={terminal.terminalInput}
      onInputChange={terminal.setTerminalInput}
      onExecute={app.onExecuteTerminalCommand}
      onClose={() => terminal.setShowTerminal(false)}
    />
  );
}

function AppContent() {
  const app = useApp();
  const transfer = useTransferContext();

  return (
    <div className="app">
      <ToastContainer toasts={app.toasts} onRemove={app.removeToast} />
      <AppHeader />

      <div className="main-content">
        <Sidebar />
        <main className="file-browser">
          <K8sFileBrowser />
          <DockerFileBrowser />
          <EmptyState />
        </main>
      </div>

      <Suspense fallback={null}>
        <DownloadDialog
          show={transfer.showDownloadDialog}
          fileInfo={transfer.downloadFileInfo}
          downloadMethod={transfer.downloadMethod}
          onMethodChange={transfer.setDownloadMethod}
          limitSpeed={transfer.limitSpeed}
          onSpeedChange={transfer.setLimitSpeed}
          onConfirm={app.onConfirmDownload}
          onClose={() => transfer.setShowDownloadDialog(false)}
        />

        <FileViewerModal
          show={app.k8s.showFileViewer}
          content={app.k8s.fileContent}
          onClose={() => app.k8s.setShowFileViewer(false)}
        />

        <BatchDownloadDialog
          show={app.k8s.showBatchDownloadDialog}
          title="📦 批量下载"
          selectedFiles={app.k8s.selectedFiles}
          onConfirm={app.onConfirmBatchDownload}
          onClose={() => app.k8s.setShowBatchDownloadDialog(false)}
        />

        <FileEditorModal
          show={app.k8s.isEditMode}
          title="✏️ 编辑文件"
          filePath={app.k8s.editFilePath}
          content={app.k8s.editFileContent}
          loading={app.k8s.loading}
          onContentChange={app.k8s.setEditFileContent}
          onSave={app.k8s.saveEditFile}
          onCancel={app.k8s.cancelEditFile}
        />

        <BatchDownloadDialog
          show={app.docker.dockerShowBatchDownloadDialog}
          title="📦 Docker 批量下载"
          selectedFiles={app.docker.dockerSelectedFiles}
          onConfirm={app.onConfirmDockerBatchDownload}
          onClose={() => app.docker.setDockerShowBatchDownloadDialog(false)}
        />

        <FileEditorModal
          show={app.docker.dockerEditMode}
          title="✏️ 编辑 Docker 镜像文件"
          filePath={app.docker.dockerEditFilePath}
          content={app.docker.dockerEditFileContent}
          loading={app.docker.dockerLoading}
          onContentChange={app.docker.setDockerEditFileContent}
          onSave={app.onSaveDockerEditFile}
          onCancel={app.docker.cancelDockerEditFile}
        />

        <SearchModal
          show={app.showSearchModal}
          searchQuery={app.searchQuery}
          isSearching={app.isSearching}
          searchResults={app.searchResults}
          onQueryChange={app.setSearchQuery}
          onSearch={app.onPerformSearch}
          onResultClick={app.onNavigateToSearchResult}
          onClose={() => app.setShowSearchModal(false)}
        />

        <TerminalSection />
      </Suspense>
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
