import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

const MAX_TERMINAL_OUTPUT = 50000;
const FLUSH_INTERVAL = 100;

export function useTerminal() {
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string>('');
  const [terminalInput, setTerminalInput] = useState<string>('');

  const bufferRef = useRef<string[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const totalLengthRef = useRef(0);

  const flushBuffer = useCallback(() => {
    if (bufferRef.current.length === 0) return;
    const newChunk = bufferRef.current.join('');
    bufferRef.current = [];
    flushTimerRef.current = null;

    setTerminalOutput(prev => {
      const next = prev + newChunk;
      if (next.length > MAX_TERMINAL_OUTPUT) {
        const trimmed = next.slice(next.length - MAX_TERMINAL_OUTPUT);
        totalLengthRef.current = trimmed.length;
        return trimmed;
      }
      totalLengthRef.current = next.length;
      return next;
    });
  }, []);

  useEffect(() => {
    // 浏览器预览或测试时 electronAPI 不存在，跳过订阅
    if (!window.electronAPI) return;
    const unsubscribe = window.electronAPI.onTerminalOutput((data) => {
      bufferRef.current.push(data.output);
      totalLengthRef.current += data.output.length;

      if (totalLengthRef.current > MAX_TERMINAL_OUTPUT * 1.5) {
        flushBuffer();
        return;
      }

      if (!flushTimerRef.current) {
        flushTimerRef.current = setTimeout(flushBuffer, FLUSH_INTERVAL);
      }
    });

    return () => {
      unsubscribe();
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, [flushBuffer]);

  const executeTerminalCommand = useCallback(async (
    activeTab: 'k8s' | 'docker',
    selectedNamespace: string,
    selectedPod: string,
    selectedContainer: string,
    selectedDockerImage: string
  ) => {
    if (!terminalInput.trim()) return;
    const cmd = terminalInput;
    setTerminalInput('');
    setTerminalOutput(prev => {
      const next = prev + '$ ' + cmd + '\n';
      return next.length > MAX_TERMINAL_OUTPUT
        ? next.slice(next.length - MAX_TERMINAL_OUTPUT)
        : next;
    });

    try {
      if (activeTab === 'k8s') {
        await window.electronAPI.execCommand(
          selectedNamespace,
          selectedPod,
          selectedContainer,
          cmd
        );
      } else {
        await window.electronAPI.execDockerCommand(selectedDockerImage, cmd);
      }
    } catch (err: unknown) {
      setTerminalOutput(prev => prev + 'Error: ' + (err instanceof Error ? err.message : String(err)) + '\n');
    }
  }, [terminalInput]);

  return useMemo(() => ({
    showTerminal,
    setShowTerminal,
    terminalOutput,
    setTerminalOutput,
    terminalInput,
    setTerminalInput,
    executeTerminalCommand,
  }), [showTerminal, terminalOutput, terminalInput, executeTerminalCommand]);
}
