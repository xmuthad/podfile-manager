import { memo } from 'react';
import type { TransferProgress } from '../types';
import { formatBytes } from '../utils';
import { IconUpload, IconDownload, IconCheck, IconAlert } from './icons';

interface TransferProgressBarProps {
  transferProgress: TransferProgress;
  mode: 'k8s' | 'docker';
}

export const TransferProgressBar = memo(function TransferProgressBar({ transferProgress, mode }: TransferProgressBarProps) {
  const statusNode = (() => {
    if (mode === 'k8s' && transferProgress.status === 'uploading') {
      return <><IconUpload size={14} /> 正在上传</>;
    }
    if (transferProgress.status === 'downloading') {
      return <><IconDownload size={14} /> 正在下载</>;
    }
    if (transferProgress.status === 'completed') {
      return <><IconCheck size={14} /> 传输完成</>;
    }
    if (transferProgress.status === 'error') {
      return <><IconAlert size={14} /> 传输失败</>;
    }
    return null;
  })();

  return (
    <div className="transfer-progress">
      <div className="transfer-info">
        <div className="transfer-status">{statusNode}</div>
        <div className="transfer-details">
          {transferProgress.status !== 'error' && transferProgress.status !== 'completed' && (
            <>
              <span className="transfer-speed">{transferProgress.speed || 'calculating...'}</span>
              {mode === 'k8s' && (
                <span className="transfer-size">
                  {formatBytes(transferProgress.transferred)} / {formatBytes(transferProgress.total)}
                </span>
              )}
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
  );
});