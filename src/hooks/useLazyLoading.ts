import { useEffect, useRef, useState, useCallback } from 'react';

interface UseLazyLoadingOptions {
  threshold?: number;
  rootMargin?: string;
  fallback?: boolean;
}

interface UseLazyLoadingReturn {
  isVisible: boolean;
  hasIntersectionObserver: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  forceLoad: () => void;
}

export const useLazyLoading = (options: UseLazyLoadingOptions = {}): UseLazyLoadingReturn => {
  const { 
    threshold = 0.1, 
    rootMargin = '50px', 
    fallback = true 
  } = options;
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [hasIntersectionObserver, setHasIntersectionObserver] = useState<boolean>(true);

  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    if (entry.isIntersecting) {
      setIsVisible(true);
    }
  }, []);

  const forceLoad = useCallback(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    // Check if Intersection Observer is supported
    if (!('IntersectionObserver' in window)) {
      console.warn('Intersection Observer not supported, using fallback behavior');
      setHasIntersectionObserver(false);
      if (fallback) {
        setIsVisible(true);
      }
      return;
    }

    const observer = new IntersectionObserver(handleIntersection, {
      threshold,
      rootMargin,
    });

    const currentRef = containerRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [handleIntersection, threshold, rootMargin, fallback]);

  return {
    isVisible,
    hasIntersectionObserver,
    containerRef,
    forceLoad,
  };
}; 