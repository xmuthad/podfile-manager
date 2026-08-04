import { useState, useCallback, useMemo, useRef, useEffect, useDeferredValue } from 'react';
import type { DockerImage } from '../types';
import type { ToastType } from './useToast';

type ToastFn = (message: string, type?: ToastType) => void;

export function useDockerNav(toast?: ToastFn) {
  const [dockerImages, setDockerImages] = useState<DockerImage[]>([]);
  const [dockerSearchTerm, setDockerSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(dockerSearchTerm);
  const [selectedDockerImage, setSelectedDockerImage] = useState('');
  const [loadingDockerImages, setLoadingDockerImages] = useState(false);
  const selectedDockerImageRef = useRef(selectedDockerImage);
  useEffect(() => {
    selectedDockerImageRef.current = selectedDockerImage;
  }, [selectedDockerImage]);

  const filteredDockerImages = useMemo(() => {
    return dockerImages.filter(image => {
      const searchTerm = deferredSearchTerm.toLowerCase();
      return image.repository.toLowerCase().includes(searchTerm) ||
             image.tag.toLowerCase().includes(searchTerm);
    });
  }, [dockerImages, deferredSearchTerm]);

  const loadReqId = useRef(0);

  const loadDockerImages = useCallback(async () => {
    const reqId = ++loadReqId.current;
    setLoadingDockerImages(true);
    try {
      const images = await window.electronAPI.listDockerImages();
      if (reqId !== loadReqId.current) return;
      setDockerImages(images);
    } catch (err: unknown) {
      if (reqId !== loadReqId.current) return;
      toast?.('加载 Docker 镜像失败: ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      if (reqId === loadReqId.current) {
        setLoadingDockerImages(false);
      }
    }
  }, [toast]);

  return useMemo(() => ({
    dockerImages,
    dockerSearchTerm,
    setDockerSearchTerm,
    selectedDockerImage,
    setSelectedDockerImage,
    selectedDockerImageRef,
    loadingDockerImages,
    filteredDockerImages,
    loadDockerImages,
  }), [dockerImages, dockerSearchTerm, selectedDockerImage,
    loadingDockerImages, filteredDockerImages, loadDockerImages]);
}
