import { useEscapeKey } from '../hooks/useEscapeKey';
import { IconPackage, IconX, IconFile } from './icons';

interface BatchDownloadDialogProps {
  show: boolean;
  title: string;
  selectedFiles: Set<string>;
  onConfirm: () => void;
  onClose: () => void;
}

export function BatchDownloadDialog({ show, title, selectedFiles, onConfirm, onClose }: BatchDownloadDialogProps) {
  useEscapeKey(show, onClose);
  if (!show) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><IconPackage size={14} /> {title}</h3>
          <button className="btn btn-small" onClick={onClose} aria-label="关闭">
            <IconX size={12} />
          </button>
        </div>
        <div className="modal-content">
          <p>确认下载以下 {selectedFiles.size} 个文件？</p>
          <div className="selected-files-list">
            {Array.from(selectedFiles).map((file) => (
              <div key={file} className="selected-file-item">
                <IconFile size={12} /> {file}
              </div>
            ))}
          </div>
          <p className="download-note">文件将被打包成 tar 格式下载</p>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={onConfirm}>确认下载</button>
        </div>
      </div>
    </div>
  );
}
