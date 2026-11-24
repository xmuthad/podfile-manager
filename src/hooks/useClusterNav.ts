import { useState, useEffect, useCallback, useRef, useMemo, useDeferredValue } from 'react';
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
  const [podSearchTerm, setPodSearchTerm] = useState('');
  const deferredPodSearchTerm = useDeferredValue(podSearchTerm);
  const [globalPodResults, setGlobalPodResults] = useState<Pod[]>([]);
  const [searchingPods, setSearchingPods] = useState(false);
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
  // 三个 loader 各自独立请求序号：selectPodFromSearch 会并发触发 loadPods + loadContainers，
  // 共用一个序号会互相取消，导致 pod 列表被丢弃。
  const loadNsReqId = useRef(0);
  const loadPodsReqId = useRef(0);
  const loadContainersReqId = useRef(0);
  const searchReqId = useRef(0);

  // 全命名空间 Pod 搜索：防抖 300ms，请求序号防竞态
  useEffect(() => {
    const term = deferredPodSearchTerm.trim();
    if (!term) {
      ++searchReqId.current;
      setGlobalPodResults([]);
      setSearchingPods(false);
      return;
    }
    const timer = setTimeout(async () => {
      const reqId = ++searchReqId.current;
      setSearchingPods(true);
      try {
        const result = await window.electronAPI.getAllPods(term);
        if (reqId !== searchReqId.current) return;
        setGlobalPodResults(result.items as Pod[]);
      } catch (err: unknown) {
        if (reqId !== searchReqId.current) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (reqId === searchReqId.current) {
          setSearchingPods(false);
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [deferredPodSearchTerm]);

  const loadNamespaces = useCallback(async () => {
    const reqId = ++loadNsReqId.current;
    setLoading(true);
    setError('');
    try {
      const result = await window.electronAPI.getNamespaces();
      if (reqId !== loadNsReqId.current) return;
      setNamespaces(result.items.map(ns => ns.metadata.name));
    } catch (err: unknown) {
      if (reqId !== loadNsReqId.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (reqId === loadNsReqId.current) {
        setLoading(false);
      }
    }
  }, []);

  const loadPods = useCallback(async (namespace: string) => {
    const reqId = ++loadPodsReqId.current;
    setLoading(true);
    setError('');
    try {
      const result = await window.electronAPI.getPods(namespace);
      if (reqId !== loadPodsReqId.current) return;
      setPods(result.items);
    } catch (err: unknown) {
      if (reqId !== loadPodsReqId.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (reqId === loadPodsReqId.current) {
        setLoading(false);
      }
    }
  }, []);

  const loadContainers = useCallback(async (namespace: string, pod: string): Promise<Container[]> => {
    const reqId = ++loadContainersReqId.current;
    setLoading(true);
    setError('');
    try {
      const result = await window.electronAPI.getContainers(namespace, pod);
      if (reqId !== loadContainersReqId.current) return [];
      setContainers(result.items);
      return result.items;
    } catch (err: unknown) {
      if (reqId !== loadContainersReqId.current) return [];
      setError(err instanceof Error ? err.message : String(err));
      return [];
    } finally {
      if (reqId === loadContainersReqId.current) {
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

  // 从全局搜索结果选中 Pod：定位到其命名空间并展开选中，返回第一个容器名供上层加载文件
  const selectPodFromSearch = useCallback(async (namespace: string, podName: string): Promise<string> => {
    setPodSearchTerm('');
    setSelectedNamespace(namespace);
    setSelectedPod(podName);
    setSelectedContainer('');
    setContainers([]);
    setExpandedNamespaces(prev => new Set(prev).add(namespace));
    setExpandedPods(prev => new Set(prev).add(podName));
    loadPods(namespace);
    const containers = await loadContainers(namespace, podName);
    return containers[0]?.name ?? '';
  }, [loadPods, loadContainers]);

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
    podSearchTerm, setPodSearchTerm,
    globalPodResults, searchingPods,
    containers, selectedContainer, setSelectedContainer,
    expandedNamespaces, setExpandedNamespaces,
    expandedPods, setExpandedPods,
    clusterConfigs, selectedCluster,
    loading, setLoading, error, setError,
    selectedNamespaceRef,
    loadNamespaces, loadPods, loadContainers,
    changeCluster, toggleNamespace, togglePod, selectPodFromSearch,
  }), [namespaces, selectedNamespace, pods, selectedPod,
    podSearchTerm, globalPodResults, searchingPods,
    containers, selectedContainer, expandedNamespaces, expandedPods,
    clusterConfigs, selectedCluster, loading, error,
    loadNamespaces, loadPods, loadContainers,
    changeCluster, toggleNamespace, togglePod, selectPodFromSearch]);
}
