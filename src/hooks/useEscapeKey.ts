import { useEffect, useRef } from 'react';

/**
 * 当 active 为 true 时监听全局 Escape 键并触发 onEscape。
 * 用于让各弹窗统一支持 ESC 关闭。
 *
 * 回调存入 ref，避免父组件每次渲染传入新箭头函数时反复重订阅。
 */
export function useEscapeKey(active: boolean, onEscape: () => void) {
  const onEscapeRef = useRef(onEscape);

  // 在 effect 中同步最新回调，避免渲染期写 ref（react-hooks/refs）
  useEffect(() => {
    onEscapeRef.current = onEscape;
  });

  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscapeRef.current();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active]);
}
