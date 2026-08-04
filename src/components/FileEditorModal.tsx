interface FileEditorModalProps {
  show: boolean;
  title: string;
  filePath: string;
  content: string;
  loading: boolean;
  onContentChange: (content: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function FileEditorModal({
  show, title, filePath, content, loading,
  onContentChange, onSave, onCancel,
}: FileEditorModalProps) {
  if (!show) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <div className="edit-actions">
            <button className="btn" onClick={onCancel}>取消</button>
            <button className="btn btn-primary" onClick={onSave} disabled={loading}>💾 保存</button>
          </div>
        </div>
        <div className="modal-content">
          <div className="edit-file-path">{filePath}</div>
          <textarea
            className="file-editor"
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            placeholder="文件内容..."
          />
        </div>
      </div>
    </div>
  );
}
