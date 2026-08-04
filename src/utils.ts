import type { Container } from './types';

export function getPodPhaseColor(phase: string): string {
  switch (phase) {
    case 'Running': return '#38a169';
    case 'Pending': return '#dd6b20';
    case 'Succeeded': return '#667eea';
    case 'Failed': return '#c53030';
    default: return '#718096';
  }
}

export function getContainerStatusColor(container: Container): string {
  if (container.state.running) return '#38a169';
  if (container.state.terminated) return '#c53030';
  if (container.state.waiting) return '#dd6b20';
  return '#718096';
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
