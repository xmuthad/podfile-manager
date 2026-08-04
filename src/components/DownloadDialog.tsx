interface DownloadDialogProps {
  show: boolean;
  fileInfo: { name: string; path: string } | null;
  downloadMethod: 'kubectl-cp' | 'dd-limit';
  onMethodChange: (method: 'kubectl-cp' | 'dd-limit') => void;
  limitSpeed: number;
  onSpeedChange: (speed: number) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function DownloadDialog({
  show, fileInfo, downloadMethod, onMethodChange,
  limitSpeed, onSpeedChange, onConfirm, onClose,
}: DownloadDialogProps) {
  if (!show || !fileInfo) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal download-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>⬇️ 选择下载方式</h3>
          <button className="btn btn-small" onClick={onClose}>✕</button>
        </div>
        <div className="modal-content">
          <div className="download-file-info">
            <span className="download-file-name">📄 {fileInfo.name}</span>
            <span className="download-file-path">{fileInfo.path}</span>
          </div>
          <div className="download-options">
            <label className={`download-option ${downloadMethod === 'kubectl-cp' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="downloadMethod"
                value="kubectl-cp"
                checked={downloadMethod === 'kubectl-cp'}
                onChange={() => onMethodChange('kubectl-cp')}
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
                onChange={() => onMethodChange('dd-limit')}
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
                        onSpeedChange(isNaN(val) || val < 1 ? 1024 : Math.min(Math.max(val, 1), 10240));
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
            <button className="btn" onClick={onClose}>取消</button>
            <button className="btn btn-primary" onClick={onConfirm}>确认下载</button>
          </div>
        </div>
      </div>
    </div>
  );
}
