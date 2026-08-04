import { createContext, useContext } from 'react';
import type { useTransfer } from '../hooks/useTransfer';

export type TransferContextValue = ReturnType<typeof useTransfer>;

export const TransferContext = createContext<TransferContextValue | null>(null);

export function useTransferContext(): TransferContextValue {
  const ctx = useContext(TransferContext);
  if (!ctx) throw new Error('useTransferContext must be used within AppProvider');
  return ctx;
}
