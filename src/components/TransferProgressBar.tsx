import { memo } from 'react';
import type { TransferProgress } from '../types';
import { formatBytes } from '../utils';

interface TransferProgressBarProps {
  transferProgress: TransferProgress;
  mode: 'k8s' | 'docker';
}

export const TransferProgressBar = memo(function TransferProgressBar({ transferProgress, mode }: TransferProgressBarProps) {
  const statusText = (() => {
    if (mode === 'k8s') {
      if (transferProgress.status === 'uploading') return '⬆️ 正在上传';
      if (transferProgress.status === 'downloading') return '⬇️ 正在下载';
    } else {
      if (transferProgress.status === 'downloading') return '⬇️ 正在下载';
    }
    if (transferProgress.status === 'completed') return '✅ 传输完成';
    if (transferProgress.status === 'error') return '❌ 传输失败';
    return '';
  })();

  return (
    <div className="transfer-progress">
      <div className="transfer-info">
        <div className="transfer-status">{statusText}</div>
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