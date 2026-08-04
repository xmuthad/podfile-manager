import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Container, Pod } from '../types';
import type { ToastType } from './useToast';

type ToastFn = (message: string, type?: ToastType) => void;

/**
 * 集群导航：命名空间 / Pod / 容器 / 集群切换。
 *
 * 不直接操作文件列表——那是 useFileBrowser 的职责。
 * 通过返回 setter 让上层 hook 可以在导航变化时清空文件状态。
 */
export function useClusterNav(toast: ToastFn) {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('');
  const [pods, setPods] = useState<Pod[]>([]);
  const [selectedPod, setSelectedPod] = useState<string>('');
  const [containers, setContainers] = useState<Container[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<string>('');
  const [expandedNamespaces, setExpandedNamespaces] = useState<Set<string>>(new Set());
  const [expandedPods, setExpandedPods] = useState<Set<string>>(new Set());
  const [clusterConfigs, setClusterConfigs] = useState<{ name: string; cluster: string }[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const selectedNamespaceRef = useRef(selectedNamespace);
  const loadReqId = useRef(0);

  const loadNamespaces = useCallback(async () => {
    const reqId = ++loadReqId.current;
    setLoading(true);
    setError('');
    try {
      const result = await window.electronAPI.getNamespaces();
      if (reqId !== loadReqId.current) return;
      setNamespaces(result.items.map(ns => ns.metadata.name));
    } catch (err: unknown) {
      if (reqId !== loadReqId.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (reqId === loadReqId.current) {
        setLoading(false);
      }
    }
  }, []);

  const loadPods = useCallback(async (namespace: string) => {
    const reqId = ++loadReqId.current;
    setLoading(true);
    setError('');
    try {
      const result = await window.electronAPI.getPods(namespace);
      if (reqId !== loadReqId.current) return;
      setPods(result.items);
    } catch (err: unknown) {
      if (reqId !== loadReqId.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (reqId === loadReqId.current) {
        setLoading(false);
      }
    }
  }, []);

  const loadContainers = useCallback(async (namespace: string, pod: string) => {
    const reqId = ++loadReqId.current;
    setLoading(true);
    setError('');
    try {
      const result = await window.electronAPI.getContainers(namespace, pod);
      if (reqId !== loadReqId.current) return;
      setContainers(result.items);
    } catch (err: unknown) {
      if (reqId !== loadReqId.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (reqId === loadReqId.current) {
        setLoading(false);
      }
    }
  }, []);

  const changeCluster = useCallback(async (contextName: string) => {
    try {
      await window.electronAPI.useContext(contextName);
      setSelectedCluster(contextName);
      setNamespaces([]);
      setPods([]);
      setSelectedNamespace('');
      setSelectedPod('');
      setSelectedContainer('');
      await loadNamespaces();
      toast(`已切换到集群: ${contextName}`, 'success');
    } catch (err: unknown) {
      toast('切换集群失败: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  }, [loadNamespaces, toast]);

  const toggleNamespace = useCallback((namespace: string) => {
    setExpandedNamespaces(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(namespace)) {
        newExpanded.delete(namespace);
      } else {
        newExpanded.add(namespace);
      }
      return newExpanded;
    });
    setSelectedNamespace(namespace);
    setSelectedPod('');
    setSelectedContainer('');
    setPods([]);
    setContainers([]);
    setExpandedPods(new Set());
    loadPods(namespace);
  }, [loadPods]);

  const togglePod = useCallback((podName: string) => {
    setExpandedPods(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(podName)) {
        newExpanded.delete(podName);
      } else {
        newExpanded.add(podName);
      }
      return newExpanded;
    });
    setSelectedPod(podName);
    setSelectedContainer('');
    loadContainers(selectedNamespace, podName);
  }, [selectedNamespace, loadContainers]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [contextsResult] = await Promise.all([
          window.electronAPI.getContexts(),
          loadNamespaces(),
        ]);
        if (cancelled) return;
        setClusterConfigs(contextsResult.contexts);
        setSelectedCluster(contextsResult.currentContext);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => { cancelled = true; };
  }, [loadNamespaces]);

  useEffect(() => {
    selectedNamespaceRef.current = selectedNamespace;
  }, [selectedNamespace]);

  return useMemo(() => ({
    namespaces, selectedNamespace, setSelectedNamespace,
    pods, selectedPod, setSelectedPod,
    containers, selectedContainer, setSelectedContainer,
    expandedNamespaces, setExpandedNamespaces,
    expandedPods, setExpandedPods,
    clusterConfigs, selectedCluster,
    loading, setLoading, error, setError,
    selectedNamespaceRef,
    loadNamespaces, loadPods, loadContainers,
    changeCluster, toggleNamespace, togglePod,
  }), [namespaces, selectedNamespace, pods, selectedPod,
    containers, selectedContainer, expandedNamespaces, expandedPods,
    clusterConfigs, selectedCluster, loading, error,
    loadNamespaces, loadPods, loadContainers,
    changeCluster, toggleNamespace, togglePod]);
}
