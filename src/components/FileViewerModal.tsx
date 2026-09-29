import { useEscapeKey } from '../hooks/useEscapeKey';
import { IconFile, IconX } from './icons';

interface FileViewerModalProps {
  show: boolean;
  content: string;
  onClose: () => void;
}

export function FileViewerModal({ show, content, onClose }: FileViewerModalProps) {
  useEscapeKey(show, onClose);
  if (!show) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><IconFile size={14} /> 文件内容</h3>
          <button className="btn btn-small" onClick={onClose} aria-label="关闭">
            <IconX size={12} /> 关闭
          </button>
        </div>
        <div className="modal-content">
          <pre>{content}</pre>
        </div>
      </div>
    </div>
  );
}
