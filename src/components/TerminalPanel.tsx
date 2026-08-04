import { memo } from 'react';

interface TerminalPanelProps {
  show: boolean;
  output: string;
  input: string;
  onInputChange: (value: string) => void;
  onExecute: () => void;
  onClose: () => void;
}

export const TerminalPanel = memo(function TerminalPanel({ show, output, input, onInputChange, onExecute, onClose }: TerminalPanelProps) {
  if (!show) return null;
  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <h3>💻 终端</h3>
        <button className="btn btn-small" onClick={onClose}>✕</button>
      </div>
      <div className="terminal-output">
        <pre>{output || '$ Ready...\n'}</pre>
      </div>
      <div className="terminal-input-container">
        <span className="terminal-prompt">$</span>
        <input
          type="text"
          className="terminal-input"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onExecute();
            }
          }}
          placeholder="输入命令..."
        />
      </div>
    </div>
  );
});
