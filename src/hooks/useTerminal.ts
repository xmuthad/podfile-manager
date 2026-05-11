import { useState, useEffect, useCallback } from 'react';

const MAX_TERMINAL_OUTPUT = 50000;

export function useTerminal() {
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string>('');
  const [terminalInput, setTerminalInput] = useState<string>('');

  useEffect(() => {
    const unsubscribe = window.electronAPI.onTerminalOutput((data) => {
      setTerminalOutput(prev => {
        const next = prev + data.output;
        return next.length > MAX_TERMINAL_OUTPUT
          ? next.slice(next.length - MAX_TERMINAL_OUTPUT)
          : next;
      });
    });

    return unsubscribe;
  }, []);

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

  return {
    showTerminal,
    setShowTerminal,
    terminalOutput,
    setTerminalOutput,
    terminalInput,
    setTerminalInput,
    executeTerminalCommand,
  };
}
