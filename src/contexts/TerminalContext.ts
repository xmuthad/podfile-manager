import { createContext, useContext } from 'react';
import type { useTerminal } from '../hooks/useTerminal';

export type TerminalContextValue = ReturnType<typeof useTerminal>;

export const TerminalContext = createContext<TerminalContextValue | null>(null);

export function useTerminalContext(): TerminalContextValue {
  const ctx = useContext(TerminalContext);
  if (!ctx) throw new Error('useTerminalContext must be used within AppProvider');
  return ctx;
}
