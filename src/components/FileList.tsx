import { memo } from 'react';
import type { ParsedFileItem } from '../types';

interface FileListProps {
  files: ParsedFileItem[];
  selectedFiles: Set<string>;
  isTransferring: boolean;
  onNavigate: (file: ParsedFileItem) => void;
  onToggleSelection: (file: ParsedFileItem) => void;
  onView: (file: ParsedFileItem) => void;
  onEdit: (file: ParsedFileItem) => void;
  onDownload: (file: ParsedFileItem) => void;
}

interface FileRowProps {
  file: ParsedFileItem;
  isSelected: boolean;
  isTransferring: boolean;
  onNavigate: (file: ParsedFileItem) => void;
  onToggleSelection: (file: ParsedFileItem) => void;
  onView: (file: ParsedFileItem) => void;
  onEdit: (file: ParsedFileItem) => void;
  onDownload: (file: ParsedFileItem) => void;
}

const FileRow = memo(function FileRow({
  file, isSelected, isTransferring,
  onNavigate, onToggleSelection, onView, onEdit, onDownload,
}: FileRowProps) {
  const isDir = file.isDirectory;
  return (
    <div className={`file-item ${isSelected ? 'selected' : ''}`}>
      {!isDir && (
        <input
          type="checkbox"
          className="file-checkbox"
          checked={isSelected}
          onChange={() => onToggleSelection(file)}
        />
      )}
      <div className="file-icon" onClick={() => onNavigate(file)}>
        {isDir ? '📁' : '📄'}
      </div>
      <div className="file-info" onClick={() => onNavigate(file)}>
        <div className="file-name">{file.name}</div>
        <div className="file-meta">
          {file.size} bytes | {file.month} {file.day} {file.time}
        </div>
      </div>
      <div className="file-actions">
        {!isDir && (
          <>
            <button className="btn btn-small" onClick={() => onView(file)} disabled={isTransferring}>👁️ 查看</button>
            <button className="btn btn-small" onClick={() => onEdit(file)} disabled={isTransferring}>✏️ 编辑</button>
            <button className="btn btn-small btn-primary" onClick={() => onDownload(file)} disabled={isTransferring}>⬇️ 下载</button>
          </>
        )}
      </div>
    </div>
  );
});

export const FileList = memo(function FileList({
  files, selectedFiles, isTransferring,
  onNavigate, onToggleSelection, onView, onEdit, onDownload,
}: FileListProps) {
  return (
    <div className="file-list">
      {files.map((file) => (
        <FileRow
          key={file.filePath}
          file={file}
          isSelected={selectedFiles.has(file.filePath)}
          isTransferring={isTransferring}
          onNavigate={onNavigate}
          onToggleSelection={onToggleSelection}
          onView={onView}
          onEdit={onEdit}
          onDownload={onDownload}
        />
      ))}
    </div>
  );
});
