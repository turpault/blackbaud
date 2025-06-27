import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import authService from "../services/authService";
import type { ConstituentInfo } from "../types/auth";
import LazyLoadingStats from "./LazyLoadingStats";
import GiftCard from "./GiftCard";

// Define types inline since we removed the auth types file
interface Gift {
  id: string;
  amount?: {
    value: number;
    currency?: string;
  };
  currency_code?: string;
  date?: string;
  type?: string;
  constituent_id?: string;
  constituent?: ConstituentInfo;
  attachments?: GiftAttachment[];
  gift_status?: string;
  designation?: string;
  campaign?: string;
  appeal?: string;
  subtype?: string;
  [key: string]: any;
}

interface GiftAttachment {
  id: string;
  name: string;
  file_name: string;
  url?: string;
  content_type: string;
  [key: string]: any;
}

interface GiftListResponse {
  count: number;
  value: Gift[];
  next_link?: string;
}

type SortDirection = 'asc' | 'desc' | null;

interface Filters {
  listId: string;
  giftType: string;
  giftStatus: string;
  dateFrom: string;
  dateTo: string;
  amountFrom: string;
  amountTo: string;
  constituentId: string;
  designation: string;
  campaign: string;
  appeal: string;
  subtype: string;
  acknowledgmentStatus: string;
  receiptStatus: string;
  isAnonymous: string;
  sortBy: string;
  sortDirection: 'asc' | 'desc' | '';
}

// Custom hook for debounced state
const useDebouncedState = <T,>(initialValue: T, delay: number): [T, T, (value: T) => void] => {
  const [immediateValue, setImmediateValue] = useState<T>(initialValue);
  const [debouncedValue, setDebouncedValue] = useState<T>(initialValue);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(immediateValue);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [immediateValue, delay]);

  return [immediateValue, debouncedValue, setImmediateValue];
};

const GiftList: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<string | null>(searchParams.get('sortColumn'));
  const [sortDirection, setSortDirection] = useState<SortDirection>(searchParams.get('sortDirection') as SortDirection);
  const [nextLink, setNextLink] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [cachedLists, setCachedLists] = useState<Record<string, { name: string; description?: string }>>({});

  // PDF loading statistics
  const [pdfStats] = useState({
    totalPdfs: 0,
    loadedPdfs: 0,
    pendingPdfs: 0
  });

  // Zoom level for card sizing
  const [zoomLevel, setZoomLevel] = useState<number>(500); // Default 500px width

  // Virtual scrolling state for infinite scrolling with absolute positioning
  const [visibleRange, setVisibleRange] = useState<{ start: number; end: number }>({ start: 0, end: 50 });
  const [cardHeight, setCardHeight] = useState<number>(750); // Estimated card height
  const [containerHeight, setContainerHeight] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Grid layout state
  const [cardsPerRow, setCardsPerRow] = useState<number>(3); // Default 3 cards per row
  const gridGap = 20; // Gap between cards

  // Track the index to jump to after visible range updates
  const [pendingJumpIndex, setPendingJumpIndex] = useState<number | null>(null);

  // Jump to card functionality
  const [jumpToIndex, setJumpToIndex] = useState<string>('');
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Filter visibility state
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Focus state for keyboard navigation
  const [isFocused, setIsFocused] = useState<boolean>(false);

  // Debounced filters for better performance
  const [immediateFilters, debouncedFilters, setImmediateFilters] = useDebouncedState<Filters>({
    listId: searchParams.get('listId') || '',
    giftType: searchParams.get('giftType') || '',
    giftStatus: searchParams.get('giftStatus') || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    amountFrom: searchParams.get('amountFrom') || '',
    amountTo: searchParams.get('amountTo') || '',
    constituentId: searchParams.get('constituentId') || '',
    designation: searchParams.get('designation') || '',
    campaign: searchParams.get('campaign') || '',
    appeal: searchParams.get('appeal') || '',
    subtype: searchParams.get('subtype') || '',
    acknowledgmentStatus: searchParams.get('acknowledgmentStatus') || '',
    receiptStatus: searchParams.get('receiptStatus') || '',
    isAnonymous: searchParams.get('isAnonymous') || '',
    sortBy: searchParams.get('sortBy') || '',
    sortDirection: searchParams.get('sortDirection') as SortDirection || ''
  }, 300);

  // Use debounced filters for API calls
  const filters = debouncedFilters;

  const [currentOffset, setCurrentOffset] = useState<number>(0);
  const [backgroundLoading, setBackgroundLoading] = useState<boolean>(false);
  const [backgroundProgress, setBackgroundProgress] = useState<{ loaded: number; total: number }>({ loaded: 0, total: 0 });

  // Fetch gifts function
  const fetchGifts = useCallback(async (reset: boolean = true): Promise<void> => {
    if (reset) {
      setLoading(true);
      setError(null);
      setGifts([]);
      setNextLink(null);
    } else {
      setLoadingMore(true);
    }

    try {
      // Convert string filters to proper types for API
      const apiFilters = {
        listId: filters.listId || undefined,
        giftType: filters.giftType || undefined,
        giftStatus: filters.giftStatus || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        amountFrom: filters.amountFrom ? parseFloat(filters.amountFrom) : undefined,
        amountTo: filters.amountTo ? parseFloat(filters.amountTo) : undefined,
        constituentId: filters.constituentId || undefined,
        designation: filters.designation || undefined,
        campaign: filters.campaign || undefined,
        appeal: filters.appeal || undefined,
        subtype: filters.subtype || undefined,
        acknowledgmentStatus: filters.acknowledgmentStatus || undefined,
        receiptStatus: filters.receiptStatus || undefined,
        isAnonymous: filters.isAnonymous ? filters.isAnonymous === 'true' : undefined,
        sortBy: filters.sortBy || undefined,
        sortDirection: filters.sortDirection || undefined
      };

      const response: GiftListResponse = await authService.executeQuery(
        () => authService.getGifts(1000, 0, apiFilters),
        'fetching gifts',
        (errorMsg) => setError(errorMsg)
      );

      if (reset) {
        setGifts(response.value || []);
      } else {
        setGifts(prev => [...prev, ...(response.value || [])]);
      }

      setNextLink(response.next_link || null);
      setTotalCount(response.count || 0);

      // Auto-start background loading if there are more gifts available
      if (response.next_link && response.count && response.count > (response.value?.length || 0)) {
        console.log(`🔄 Auto-starting background loading: ${response.value?.length || 0} loaded, ${response.count} total available`);
        setTimeout(() => loadAllGiftsInBackground(), 1000); // Small delay to let initial load settle
      }
    } catch (err: any) {
      console.error("Failed to fetch gifts:", err);
    } finally {
      if (reset) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  }, [filters]);

  // Load more gifts function
  const loadMoreGifts = useCallback(async (): Promise<void> => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      // Convert string filters to proper types for API
      const apiFilters = {
        listId: filters.listId || undefined,
        giftType: filters.giftType || undefined,
        giftStatus: filters.giftStatus || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        amountFrom: filters.amountFrom ? parseFloat(filters.amountFrom) : undefined,
        amountTo: filters.amountTo ? parseFloat(filters.amountTo) : undefined,
        constituentId: filters.constituentId || undefined,
        designation: filters.designation || undefined,
        campaign: filters.campaign || undefined,
        appeal: filters.appeal || undefined,
        subtype: filters.subtype || undefined,
        acknowledgmentStatus: filters.acknowledgmentStatus || undefined,
        receiptStatus: filters.receiptStatus || undefined,
        isAnonymous: filters.isAnonymous ? filters.isAnonymous === 'true' : undefined,
        sortBy: filters.sortBy || undefined,
        sortDirection: filters.sortDirection || undefined
      };

      const response: GiftListResponse = await authService.executeQuery(
        () => authService.getGifts(1000, currentOffset, apiFilters),
        'loading more gifts'
      );
      setGifts(prev => [...prev, ...(response.value || [])]);
      setTotalCount(response.count || 0);
      setCurrentOffset(prev => prev + 1000);
    } catch (err: any) {
      console.error("Failed to load more gifts:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, currentOffset, filters]);

  // Load all gifts in background
  const loadAllGiftsInBackground = useCallback(async (): Promise<void> => {
    if (backgroundLoading) return;

    setBackgroundLoading(true);
    setBackgroundProgress({ loaded: gifts.length, total: totalCount });

    let offset = gifts.length;
    let hasMore = true;

    try {
      while (hasMore) {
        // Convert string filters to proper types for API
        const apiFilters = {
          listId: filters.listId || undefined,
          giftType: filters.giftType || undefined,
          giftStatus: filters.giftStatus || undefined,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          amountFrom: filters.amountFrom ? parseFloat(filters.amountFrom) : undefined,
          amountTo: filters.amountTo ? parseFloat(filters.amountTo) : undefined,
          constituentId: filters.constituentId || undefined,
          designation: filters.designation || undefined,
          campaign: filters.campaign || undefined,
          appeal: filters.appeal || undefined,
          subtype: filters.subtype || undefined,
          acknowledgmentStatus: filters.acknowledgmentStatus || undefined,
          receiptStatus: filters.receiptStatus || undefined,
          isAnonymous: filters.isAnonymous ? filters.isAnonymous === 'true' : undefined,
          sortBy: filters.sortBy || undefined,
          sortDirection: filters.sortDirection || undefined
        };

        const response: GiftListResponse = await authService.executeQuery(
          () => authService.getGifts(1000, offset, apiFilters),
          `loading gifts page ${Math.floor(offset / 1000) + 1}`
        );

        if (response.value && response.value.length > 0) {
          setGifts(prev => [...prev, ...response.value]);
          offset += response.value.length;
          setBackgroundProgress({ loaded: offset, total: response.count || totalCount });

          // Small delay to prevent overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          hasMore = false;
        }

        // Check if we have a next link
        if (!response.next_link) {
          hasMore = false;
        }
      }

      console.log(`✅ Background loading complete: ${offset} gifts loaded`);
    } catch (err: any) {
      console.error("Failed to load all gifts in background:", err);
    } finally {
      setBackgroundLoading(false);
    }
  }, [backgroundLoading, gifts.length, totalCount, filters]);

  // Load gifts on mount and when filters change
  useEffect(() => {
    fetchGifts();
  }, [fetchGifts]);

  // Memoized handlers to prevent unnecessary re-renders
  const memoizedToggleRowExpansion = useCallback((giftId: string): void => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(giftId)) {
        newSet.delete(giftId);
      } else {
        newSet.add(giftId);
      }
      return newSet;
    });
  }, []);

  // Placeholder functions for required props
  const handlePdfLoaded = useCallback((pdfId: string): void => {
    // Placeholder - can be implemented later if needed
    console.log('PDF loaded:', pdfId);
  }, []);

  const handleImageError = useCallback((attachmentId: string): void => {
    // Placeholder - can be implemented later if needed
    console.log('Image error:', attachmentId);
  }, []);

  // Get unique values for filter dropdowns
  const uniqueTypes = useMemo(() => {
    const types = gifts
      .map(gift => gift.type)
      .filter((type): type is string => !!type)
      .filter((type, index, arr) => arr.indexOf(type) === index)
      .sort();
    return types;
  }, [gifts]);

  const uniqueStatuses = useMemo(() => {
    const statuses = gifts
      .map(gift => gift.gift_status)
      .filter((status): status is string => !!status)
      .filter((status, index, arr) => arr.indexOf(status) === index)
      .sort();
    return statuses;
  }, [gifts]);

  const handleSort = (column: string): void => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const formatCurrency = (amount?: {
    value: number;
    currency?: string;
  }): string => {
    if (!amount || amount.value === undefined) return 'N/A';
    const currency = amount.currency || 'USD';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount.value);
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const updateUrlParams = (newFilters: Filters, newSortColumn?: string | null, newSortDirection?: SortDirection) => {
    const params = new URLSearchParams();
    if (newFilters.listId) params.set('listId', newFilters.listId);
    if (newFilters.giftType) params.set('giftType', newFilters.giftType);
    if (newFilters.giftStatus) params.set('giftStatus', newFilters.giftStatus);
    if (newFilters.dateFrom) params.set('dateFrom', newFilters.dateFrom);
    if (newFilters.dateTo) params.set('dateTo', newFilters.dateTo);
    if (newFilters.amountFrom) params.set('amountFrom', newFilters.amountFrom);
    if (newFilters.amountTo) params.set('amountTo', newFilters.amountTo);
    if (newFilters.constituentId) params.set('constituentId', newFilters.constituentId);
    if (newFilters.designation) params.set('designation', newFilters.designation);
    if (newFilters.campaign) params.set('campaign', newFilters.campaign);
    if (newFilters.appeal) params.set('appeal', newFilters.appeal);
    if (newFilters.subtype) params.set('subtype', newFilters.subtype);
    if (newFilters.acknowledgmentStatus) params.set('acknowledgmentStatus', newFilters.acknowledgmentStatus);
    if (newFilters.receiptStatus) params.set('receiptStatus', newFilters.receiptStatus);
    if (newFilters.isAnonymous) params.set('isAnonymous', newFilters.isAnonymous);
    if (newFilters.sortBy) params.set('sortBy', newFilters.sortBy);
    if (newSortColumn) params.set('sortColumn', newSortColumn);
    if (newSortDirection) params.set('sortDirection', newSortDirection);
    setSearchParams(params);
  };

  const handleFilterChange = (filterType: keyof Filters, value: string): void => {
    const newFilters = { ...immediateFilters, [filterType]: value };
    setImmediateFilters(newFilters);
    updateUrlParams(newFilters, sortColumn, sortDirection);
  };

  const clearFilters = (): void => {
    const newFilters: Filters = {
      listId: '',
      giftType: '',
      giftStatus: '',
      dateFrom: '',
      dateTo: '',
      amountFrom: '',
      amountTo: '',
      constituentId: '',
      designation: '',
      campaign: '',
      appeal: '',
      subtype: '',
      acknowledgmentStatus: '',
      receiptStatus: '',
      isAnonymous: '',
      sortBy: '',
      sortDirection: '' as const
    };
    setImmediateFilters(newFilters);
    updateUrlParams(newFilters, sortColumn, sortDirection);
  };

  // Intersection observer for infinite scroll and PDF loading
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Set up intersection observer for infinite scroll
    if (loadMoreTriggerRef.current && nextLink && !loadingMore) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && nextLink && !loadingMore) {
              console.log('🔄 Load more trigger visible, loading more gifts...');
              loadMoreGifts();
            }
          });
        },
        { threshold: 0.1, rootMargin: '100px' }
      );

      observerRef.current.observe(loadMoreTriggerRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [nextLink, loadingMore, loadMoreGifts]);

  // Load list name when filtering by list
  const loadListName = useCallback(async (listId: string): Promise<void> => {
    if (!listId || cachedLists[listId]) return;

    try {
      console.log(`📋 Loading list name for ${listId} from cached lists`);

      // Get all lists and find the one with matching ID
      const response = await authService.executeQuery(
        () => authService.getLists(1000, 'Gift'), // Get a large number to ensure we find the list
        'fetching lists to find list name'
      );

      if (response && response.value && Array.isArray(response.value)) {
        const list = response.value.find((l: any) => l.id === listId);
        if (list) {
          setCachedLists(prev => ({
            ...prev,
            [listId]: {
              name: list.name || list.title || 'Unknown List',
              description: list.description
            }
          }));
          console.log(`✅ Found list name for ${listId}: ${list.name}`);
        } else {
          console.warn(`⚠️ List ${listId} not found in cached lists`);
          setCachedLists(prev => ({
            ...prev,
            [listId]: {
              name: `List ${listId}`,
              description: undefined
            }
          }));
        }
      }
    } catch (error) {
      console.error(`❌ Failed to load list name for ${listId}:`, error);
      setCachedLists(prev => ({
        ...prev,
        [listId]: {
          name: `List ${listId}`,
          description: undefined
        }
      }));
    }
  }, [cachedLists]);

  // Load list name when list filter is set
  useEffect(() => {
    if (filters.listId && !cachedLists[filters.listId]) {
      loadListName(filters.listId);
    }
  }, [filters.listId, cachedLists, loadListName]);

  // Preserve scroll position on refresh
  useEffect(() => {
    const savedScrollPosition = sessionStorage.getItem('giftListScrollPosition');
    if (savedScrollPosition && !loading) {
      setTimeout(() => {
        window.scrollTo(0, parseInt(savedScrollPosition));
      }, 100);
    }

    return () => {
      sessionStorage.setItem('giftListScrollPosition', window.scrollY.toString());
    };
  }, [loading]);

  // Jump to specific card index
  const handleJumpToCard = useCallback((index: number): void => {
    // If the card is not in the visible range, update the visible range
    if (index < visibleRange.start || index > visibleRange.end) {
      setPendingJumpIndex(index);
      // Calculate the row and scroll position
      const row = Math.floor(index / cardsPerRow);
      const scrollTop = row * (cardHeight + gridGap);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ top: scrollTop, behavior: 'auto' });
      }
    } else {
      // If already visible, scroll to it
      const cardElement = cardRefs.current.get(index);
      if (cardElement) {
        cardElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        cardElement.style.boxShadow = '0 0 20px rgba(0, 123, 255, 0.8)';
        setTimeout(() => { cardElement.style.boxShadow = ''; }, 2000);
      }
    }
  }, [visibleRange, cardsPerRow, cardHeight, gridGap]);

  // Get visible gifts for rendering
  const visibleGifts = useMemo(() => {
    return gifts.slice(visibleRange.start, visibleRange.end + 1);
  }, [gifts, visibleRange]);

  // After visible range updates, if there's a pending jump, scroll to the card
  useEffect(() => {
    if (pendingJumpIndex !== null) {
      const cardElement = cardRefs.current.get(pendingJumpIndex);
      if (cardElement) {
        cardElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        cardElement.style.boxShadow = '0 0 20px rgba(0, 123, 255, 0.8)';
        setTimeout(() => { cardElement.style.boxShadow = ''; }, 2000);
        setPendingJumpIndex(null);
      }
    }
  }, [visibleGifts, pendingJumpIndex]);

  // Handle jump to card form submission
  const handleJumpToSubmit = useCallback((e: React.FormEvent): void => {
    e.preventDefault();
    const index = parseInt(jumpToIndex) - 1; // Convert to 0-based index
    const maxIndex = gifts.length - 1;

    if (isNaN(index) || index < 0) {
      alert(t('giftList.jumpToCard.invalidNumber'));
      return;
    }

    if (index > maxIndex) {
      alert(t('giftList.jumpToCard.notLoaded', { number: index + 1, max: maxIndex + 1 }));
      return;
    }

    handleJumpToCard(index);
    setJumpToIndex(''); // Clear the input
  }, [jumpToIndex, gifts.length, handleJumpToCard, t]);

  // Register card ref
  const registerCardRef = useCallback((index: number, element: HTMLDivElement | null): void => {
    if (element) {
      cardRefs.current.set(index, element);

      // Measure actual card height and update if different
      const measuredHeight = element.offsetHeight;
      if (measuredHeight > 0 && Math.abs(measuredHeight - cardHeight) > 5) {
        console.log(`📏 Card height updated: ${cardHeight}px → ${measuredHeight}px`);
        setCardHeight(measuredHeight);
      }
    } else {
      cardRefs.current.delete(index);
    }
  }, [cardHeight]);

  // Measure average card height from visible cards
  const measureAverageCardHeight = useCallback(() => {
    if (cardRefs.current.size === 0) return;

    const heights: number[] = [];
    cardRefs.current.forEach((element) => {
      const height = element.offsetHeight;
      if (height > 0) {
        heights.push(height);
      }
    });

    if (heights.length > 0) {
      const averageHeight = Math.round(heights.reduce((sum, h) => sum + h, 0) / heights.length);
      if (Math.abs(averageHeight - cardHeight) > 5) {
        console.log(`📏 Average card height updated: ${cardHeight}px → ${averageHeight}px (from ${heights.length} cards)`);
        setCardHeight(averageHeight);
      }
    }
  }, [cardHeight]);

  // Virtual scrolling logic
  const calculateVisibleRange = useCallback(() => {
    if (!scrollContainerRef.current || !containerRef.current) return;

    const scrollTop = scrollContainerRef.current.scrollTop;
    const viewportHeight = containerRef.current.clientHeight;
    const buffer = 2; // Number of rows to render outside viewport

    const rowHeight = cardHeight + gridGap;
    const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
    const endRow = Math.min(
      Math.ceil(gifts.length / cardsPerRow) - 1,
      Math.ceil((scrollTop + viewportHeight) / rowHeight) + buffer
    );

    const startIndex = startRow * cardsPerRow;
    const endIndex = Math.min(gifts.length - 1, (endRow + 1) * cardsPerRow - 1);

    setVisibleRange({ start: startIndex, end: endIndex });
  }, [cardHeight, gridGap, cardsPerRow, gifts.length]);

  // Handle scroll events for virtual scrolling
  const handleScroll = useCallback(() => {
    requestAnimationFrame(calculateVisibleRange);
  }, [calculateVisibleRange]);

  // Set up scroll listener
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // Calculate container height and update visible range when gifts change
  useEffect(() => {
    if (containerRef.current && gifts.length > 0) {
      const totalRows = Math.ceil(gifts.length / cardsPerRow);
      const totalHeight = totalRows * (cardHeight + gridGap) - gridGap; // Subtract gap from last row
      setContainerHeight(totalHeight);
      calculateVisibleRange();
    }
  }, [gifts.length, cardHeight, cardsPerRow, gridGap, calculateVisibleRange]);

  // Debounced effect to recalculate when card height changes
  useEffect(() => {
    if (gifts.length > 0) {
      const timeoutId = setTimeout(() => {
        const totalRows = Math.ceil(gifts.length / cardsPerRow);
        const totalHeight = totalRows * (cardHeight + gridGap) - gridGap;
        setContainerHeight(totalHeight);
        calculateVisibleRange();
      }, 100); // Small delay to batch multiple height updates

      return () => clearTimeout(timeoutId);
    }
  }, [cardHeight, cardsPerRow, gridGap, gifts.length, calculateVisibleRange]);

  // Periodically measure average card height for accuracy
  useEffect(() => {
    if (visibleGifts.length > 0 && cardRefs.current.size > 0) {
      const intervalId = setInterval(() => {
        measureAverageCardHeight();
      }, 2000); // Measure every 2 seconds

      return () => clearInterval(intervalId);
    }
  }, [visibleGifts.length, measureAverageCardHeight]);

  // Calculate grid position for cards
  const getCardGridPosition = useCallback((index: number) => {
    const row = Math.floor(index / cardsPerRow);
    const col = index % cardsPerRow;
    const totalRowWidth = cardsPerRow * zoomLevel + (cardsPerRow - 1) * gridGap;
    const containerWidth = containerRef.current?.clientWidth || 0;
    const leftOffset = Math.max(0, (containerWidth - totalRowWidth) / 2);
    const top = row * (cardHeight + gridGap);
    const left = leftOffset + col * (zoomLevel + gridGap);
    return { top, left, row, col };
  }, [cardsPerRow, cardHeight, gridGap, zoomLevel]);

  // Calculate container width and update cards per row
  const calculateGridLayout = useCallback(() => {
    if (!containerRef.current) return;

    const containerWidth = containerRef.current.clientWidth;
    const availableWidth = containerWidth - (gridGap * 2); // Account for padding
    const newCardsPerRow = Math.max(1, Math.floor(availableWidth / (zoomLevel + gridGap)));

    if (newCardsPerRow !== cardsPerRow) {
      console.log(`📐 Grid layout updated: ${cardsPerRow} → ${newCardsPerRow} cards per row`);
      setCardsPerRow(newCardsPerRow);
    }
  }, [cardsPerRow, zoomLevel, gridGap]);

  // Handle keyboard scrolling
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current) return;

    const scrollContainer = scrollContainerRef.current;
    const currentScrollTop = scrollContainer.scrollTop;
    const rowHeight = cardHeight + gridGap; // Height of one row

    console.log(`Key pressed: ${e.key}, Current scroll: ${currentScrollTop}, Row height: ${rowHeight}`);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        // Scroll to next row exactly
        const nextRowTop = Math.ceil(currentScrollTop / rowHeight) * rowHeight + rowHeight;
        console.log(`Arrow Down: scrolling to ${nextRowTop}`);
        scrollContainer.scrollTo({
          top: nextRowTop,
          behavior: 'smooth'
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        // Scroll to previous row exactly
        const prevRowTop = Math.max(0, Math.floor(currentScrollTop / rowHeight) * rowHeight - rowHeight);
        console.log(`Arrow Up: scrolling to ${prevRowTop}`);
        scrollContainer.scrollTo({
          top: prevRowTop,
          behavior: 'smooth'
        });
        break;
      case 'PageDown':
        e.preventDefault();
        // Scroll to next 10 rows exactly
        const next10RowsTop = Math.ceil(currentScrollTop / rowHeight) * rowHeight + (10 * rowHeight);
        console.log(`Page Down: scrolling to ${next10RowsTop}`);
        scrollContainer.scrollTo({
          top: next10RowsTop,
          behavior: 'smooth'
        });
        break;
      case 'PageUp':
        e.preventDefault();
        // Scroll to previous 10 rows exactly
        const prev10RowsTop = Math.max(0, Math.floor(currentScrollTop / rowHeight) * rowHeight - (10 * rowHeight));
        console.log(`Page Up: scrolling to ${prev10RowsTop}`);
        scrollContainer.scrollTo({
          top: prev10RowsTop,
          behavior: 'smooth'
        });
        break;
      case 'Home':
        e.preventDefault();
        console.log('Home: scrolling to top');
        scrollContainer.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
        break;
      case 'End':
        e.preventDefault();
        console.log('End: scrolling to bottom');
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: 'smooth'
        });
        break;
    }
  }, [cardHeight, gridGap]);

  // Update grid layout when zoom level or container size changes
  useEffect(() => {
    calculateGridLayout();
  }, [calculateGridLayout, zoomLevel]);

  // Handle window resize for responsive grid
  useEffect(() => {
    const handleResize = () => {
      calculateGridLayout();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateGridLayout]);

  // Set focus on scroll container when gifts are loaded
  useEffect(() => {
    if (!loading && gifts.length > 0 && scrollContainerRef.current) {
      // Small delay to ensure the DOM is fully rendered
      const timer = setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.focus();
          console.log('🎯 Focus set on gift list scroll container');
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [loading, gifts.length]);

  // Handle refresh with cache clearing
  const handleRefresh = useCallback(async (): Promise<void> => {
    // Clear gift cache before fetching fresh data
    authService.clearGiftCache();
    console.log('Cleared gift cache before refresh');

    // Reset offset and fetch fresh data
    setCurrentOffset(0);
    await fetchGifts(true);
  }, [fetchGifts]);

  if (loading) {
    return (
      <div style={{
        margin: "0 auto",
        padding: "20px",
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        borderRadius: "15px",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
        backdropFilter: "blur(10px)",
        minHeight: "600px",
        position: "relative"
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          color: "#333",
          minHeight: "60px"
        }}>
          <h2>🎁 Blackbaud Gifts</h2>
        </div>

        {/* Filter and Sort Controls - Keep consistent structure */}
        <div style={{
          marginBottom: "20px",
          padding: "15px",
          backgroundColor: "#f8f9fa",
          borderRadius: "8px",
          border: "1px solid #dee2e6",
          display: "flex",
          alignItems: "center",
          gap: "15px",
          flexWrap: "wrap",
          minHeight: "60px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontWeight: "bold", fontSize: "14px" }}>{t('giftList.filters.type')}:</label>
            <select disabled style={{
              padding: "6px 10px",
              border: "1px solid #ced4da",
              borderRadius: "4px",
              fontSize: "14px",
              minWidth: "120px",
              backgroundColor: "#e9ecef"
            }}>
              <option>{t('giftList.filters.allTypes')}</option>
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontWeight: "bold", fontSize: "14px" }}>{t('giftList.filters.status')}:</label>
            <select disabled style={{
              padding: "6px 10px",
              border: "1px solid #ced4da",
              borderRadius: "4px",
              fontSize: "14px",
              minWidth: "120px",
              backgroundColor: "#e9ecef"
            }}>
              <option>{t('giftList.filters.allStatuses')}</option>
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontWeight: "bold", fontSize: "14px" }}>{t('giftList.filters.subtype')}:</label>
            <select disabled style={{
              padding: "6px 10px",
              border: "1px solid #ced4da",
              borderRadius: "4px",
              fontSize: "14px",
              minWidth: "120px",
              backgroundColor: "#e9ecef"
            }}>
              <option>{t('giftList.filters.allSubtypes')}</option>
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontWeight: "bold", fontSize: "14px" }}>{t('giftList.filters.sortBy')}:</label>
            <select disabled style={{
              padding: "6px 10px",
              border: "1px solid #ced4da",
              borderRadius: "4px",
              fontSize: "14px",
              minWidth: "140px",
              backgroundColor: "#e9ecef"
            }}>
              <option>{t('giftList.filters.noSorting')}</option>
            </select>
          </div>
        </div>

        {/* Loading overlay */}
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(255, 255, 255, 0.9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "15px",
          zIndex: 10
        }}>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                border: "4px solid #f3f3f3",
                borderTop: "4px solid #007bff",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                margin: "0 auto 16px"
              }}
            />
            <p style={{ fontSize: "16px", color: "#666", margin: 0 }}>
              {t('giftList.loading')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        margin: "0 auto",
        padding: "20px",
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        borderRadius: "15px",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
        backdropFilter: "blur(10px)",
        minHeight: "600px"
      }}>
        <div style={{ textAlign: "center", padding: "40px", color: "#dc3545" }}>
          <h2>❌ Error</h2>
          <p>{error}</p>
          <button
            onClick={() => fetchGifts()}
            style={{
              padding: "10px 20px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            {t('giftList.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      margin: "0 auto",
      padding: "20px",
      backgroundColor: "rgba(255, 255, 255, 0.95)",
      borderRadius: "15px",
      boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
      backdropFilter: "blur(10px)",
      minHeight: "600px",
      position: "relative"
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "20px",
        color: "#333",
        minHeight: "60px"
      }}>
        <div>
          <h2>🎁 {t('giftList.title')}</h2>
          {filters.listId && cachedLists[filters.listId] && (
            <div style={{
              fontSize: "14px",
              color: "#666",
              marginTop: "4px",
              fontStyle: "italic"
            }}>
              List: "{cachedLists[filters.listId].name}"
              {cachedLists[filters.listId].description && (
                <span style={{ marginLeft: "8px" }}>
                  - {cachedLists[filters.listId].description}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Keyboard Navigation Indicator */}
        {isFocused && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 12px",
            backgroundColor: "#d4edda",
            border: "1px solid #c3e6cb",
            borderRadius: "6px",
            fontSize: "12px",
            color: "#155724",
            fontWeight: "bold"
          }}>
            ⌨️ Keyboard Active
          </div>
        )}

        {/* Card Size and Jump to Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontWeight: "bold", fontSize: "14px" }}>{t('giftList.cardSize')}:</label>
            <select
              value={zoomLevel}
              onChange={(e) => setZoomLevel(Number(e.target.value))}
              style={{
                padding: "6px 10px",
                border: "1px solid #ced4da",
                borderRadius: "4px",
                fontSize: "14px",
                minWidth: "120px"
              }}
            >
              <option value={300}>{t('giftList.cardSizes.small')}</option>
              <option value={400}>{t('giftList.cardSizes.medium')}</option>
              <option value={500}>{t('giftList.cardSizes.large')}</option>
              <option value={600}>{t('giftList.cardSizes.extraLarge')}</option>
              <option value={700}>{t('giftList.cardSizes.huge')}</option>
            </select>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              padding: "6px 12px",
              backgroundColor: showFilters ? "#28a745" : "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}
            title={showFilters ? "Hide filters" : "Show filters"}
          >
            {showFilters ? "🔽" : "🔼"} Filters
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontWeight: "bold", fontSize: "14px" }}>{t('giftList.jumpToCard.label')}:</label>
            <form onSubmit={handleJumpToSubmit} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <input
                type="number"
                value={jumpToIndex}
                onChange={(e) => setJumpToIndex(e.target.value)}
                placeholder={t('giftList.jumpToCard.placeholder')}
                min="1"
                max={gifts.length}
                style={{
                  padding: "6px 10px",
                  border: "1px solid #ced4da",
                  borderRadius: "4px",
                  fontSize: "14px",
                  width: "80px"
                }}
              />
              <button
                type="submit"
                style={{
                  padding: "6px 12px",
                  backgroundColor: "#28a745",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "bold"
                }}
                title={`${t('giftList.jumpToCard.label')} (1-${gifts.length})`}
              >
                🎯
              </button>
            </form>
          </div>

          <button
            onClick={handleRefresh}
            style={{
              padding: "8px 16px",
              backgroundColor: "#17a2b8",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
            title="Refresh gifts and clear cache"
          >
            🔄 Refresh
          </button>

          <button
            onClick={loadAllGiftsInBackground}
            disabled={backgroundLoading}
            style={{
              padding: "8px 16px",
              backgroundColor: backgroundLoading ? "#6c757d" : "#28a745",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: backgroundLoading ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
            title={backgroundLoading ? "Loading all gifts..." : "Load all gifts in background"}
          >
            {backgroundLoading ? "⏳" : "📥"} {backgroundLoading ? "Loading..." : "Load All"}
          </button>
        </div>
      </div>

      {/* Background Loading Progress */}
      {backgroundLoading && (
        <div style={{
          marginBottom: "15px",
          padding: "10px 15px",
          backgroundColor: "#e3f2fd",
          border: "1px solid #bbdefb",
          borderRadius: "6px",
          display: "flex",
          alignItems: "center",
          gap: "10px"
        }}>
          <div
            style={{
              width: "20px",
              height: "20px",
              border: "2px solid #f3f3f3",
              borderTop: "2px solid #2196F3",
              borderRadius: "50%",
              animation: "spin 1s linear infinite"
            }}
          />
          <span style={{ fontSize: "14px", color: "#1565c0" }}>
            Loading all gifts: {backgroundProgress.loaded.toLocaleString()} of {backgroundProgress.total.toLocaleString()}
            ({Math.round((backgroundProgress.loaded / backgroundProgress.total) * 100)}%)
          </span>
        </div>
      )}

      {/* Filter and Sort Controls */}
      {showFilters && (
        <div style={{
          marginBottom: "20px",
          padding: "15px",
          backgroundColor: "#f8f9fa",
          borderRadius: "8px",
          border: "1px solid #dee2e6",
          display: "flex",
          alignItems: "center",
          gap: "15px",
          flexWrap: "wrap",
          minHeight: "60px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontWeight: "bold", fontSize: "14px" }}>{t('giftList.filters.type')}:</label>
            <select
              value={immediateFilters.giftType}
              onChange={(e) => handleFilterChange('giftType', e.target.value)}
              style={{
                padding: "6px 10px",
                border: "1px solid #ced4da",
                borderRadius: "4px",
                fontSize: "14px",
                minWidth: "120px"
              }}
            >
              <option value="">{t('giftList.filters.allTypes')}</option>
              {uniqueTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontWeight: "bold", fontSize: "14px" }}>{t('giftList.filters.status')}:</label>
            <select
              value={immediateFilters.giftStatus}
              onChange={(e) => handleFilterChange('giftStatus', e.target.value)}
              style={{
                padding: "6px 10px",
                border: "1px solid #ced4da",
                borderRadius: "4px",
                fontSize: "14px",
                minWidth: "120px"
              }}
            >
              <option value="">{t('giftList.filters.allStatuses')}</option>
              {uniqueStatuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontWeight: "bold", fontSize: "14px" }}>{t('giftList.filters.amountFrom')}:</label>
            <input
              type="number"
              value={immediateFilters.amountFrom}
              onChange={(e) => handleFilterChange('amountFrom', e.target.value)}
              placeholder="Min amount"
              style={{
                padding: "6px 10px",
                border: "1px solid #ced4da",
                borderRadius: "4px",
                fontSize: "14px",
                width: "100px"
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontWeight: "bold", fontSize: "14px" }}>{t('giftList.filters.amountTo')}:</label>
            <input
              type="number"
              value={immediateFilters.amountTo}
              onChange={(e) => handleFilterChange('amountTo', e.target.value)}
              placeholder="Max amount"
              style={{
                padding: "6px 10px",
                border: "1px solid #ced4da",
                borderRadius: "4px",
                fontSize: "14px",
                width: "100px"
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontWeight: "bold", fontSize: "14px" }}>{t('giftList.filters.dateFrom')}:</label>
            <input
              type="date"
              value={immediateFilters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              style={{
                padding: "6px 10px",
                border: "1px solid #ced4da",
                borderRadius: "4px",
                fontSize: "14px",
                minWidth: "120px"
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontWeight: "bold", fontSize: "14px" }}>{t('giftList.filters.dateTo')}:</label>
            <input
              type="date"
              value={immediateFilters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              style={{
                padding: "6px 10px",
                border: "1px solid #ced4da",
                borderRadius: "4px",
                fontSize: "14px",
                minWidth: "120px"
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontWeight: "bold", fontSize: "14px" }}>{t('giftList.filters.sortBy')}:</label>
            <select
              value={sortColumn || ''}
              onChange={(e) => handleSort(e.target.value)}
              style={{
                padding: "6px 10px",
                border: "1px solid #ced4da",
                borderRadius: "4px",
                fontSize: "14px",
                minWidth: "140px"
              }}
            >
              <option value="">{t('giftList.filters.noSorting')}</option>
              <option value="amount">{t('giftList.columns.amount')}</option>
              <option value="date">{t('giftList.columns.date')}</option>
              <option value="constituent">{t('giftList.columns.constituent')}</option>
              <option value="type">{t('giftList.columns.type')}</option>
              <option value="status">{t('giftList.columns.status')}</option>
              <option value="fund">{t('giftList.columns.fund')}</option>
              <option value="campaign">{t('giftList.columns.campaign')}</option>
              <option value="appeal">{t('giftList.columns.appeal')}</option>
            </select>
            {sortColumn && (
              <button
                onClick={() => handleSort(sortColumn)}
                style={{
                  padding: "6px 8px",
                  backgroundColor: "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px"
                }}
                title={`Currently sorted ${sortDirection}ending - click to change`}
              >
                {sortDirection === 'asc' ? '↑' : '↓'}
              </button>
            )}
          </div>

          {(immediateFilters.giftType || immediateFilters.dateFrom || immediateFilters.dateTo) && (
            <button
              onClick={clearFilters}
              style={{
                padding: "6px 12px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px"
              }}
            >
              {t('giftList.filters.clear')}
            </button>
          )}

          <div style={{ marginLeft: "auto", fontSize: "14px", color: "#6c757d" }}>
            {gifts.length !== totalCount && (
              <span>{t('giftList.showing', { shown: gifts.length, total: totalCount.toLocaleString() })}</span>
            )}
          </div>
        </div>
      )}

      {gifts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
          <p>{t('giftList.noGifts')}</p>
        </div>
      ) : (
        // Virtual Scrolling Card View
        <>
          {/* Virtual Scrolling Container */}
          <div
            ref={containerRef}
            style={{
              height: "70vh",
              overflow: "hidden",
              position: "relative",
              border: "1px solid #dee2e6",
              borderRadius: "8px",
              backgroundColor: "#f8f9fa"
            }}
          >
            {/* Scrollable container with total height */}
            <div
              ref={scrollContainerRef}
              tabIndex={0}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              style={{
                height: "100%",
                overflow: "auto",
                position: "relative",
                outline: "none",
                border: isFocused ? "2px solid #007bff" : "none",
                borderRadius: isFocused ? "6px" : "0",
                transition: "border-color 0.2s ease"
              }}
            >
              {/* Virtual content with total height */}
              <div style={{
                height: `${containerHeight}px`,
                position: "relative",
                width: "100%"
              }}>
                {/* Only render visible cards with absolute positioning */}
                {visibleGifts.map((gift, visibleIndex) => {
                  const actualIndex = visibleRange.start + visibleIndex;
                  const gridPos = getCardGridPosition(actualIndex);
                  return (
                    <div
                      key={gift.id}
                      ref={(el) => registerCardRef(actualIndex, el)}
                      className="gift-card-wrapper"
                      style={{
                        position: "absolute",
                        top: `${gridPos.top}px`,
                        left: `${gridPos.left}px`,
                        width: `${zoomLevel}px`,
                        height: `${cardHeight}px`
                      }}
                    >
                      <GiftCard
                        key={gift.id}
                        gift={gift}
                        expandedRows={expandedRows}
                        onToggleExpansion={memoizedToggleRowExpansion}
                        onHandlePdfLoaded={handlePdfLoaded}
                        onHandleImageError={handleImageError}
                        formatCurrency={formatCurrency}
                        formatDate={formatDate}
                        zoomLevel={zoomLevel}
                        cardNumber={actualIndex + 1}
                        totalCount={totalCount}
                      />
                    </div>
                  );
                })}

                {/* Load More Trigger - Positioned at the bottom for infinite scrolling */}
                {nextLink && !loading && gifts.length < totalCount && (
                  <div
                    ref={loadMoreTriggerRef}
                    style={{
                      position: "absolute",
                      top: `${getCardGridPosition(gifts.length).top}px`,
                      left: "50%",
                      transform: "translateX(-50%)",
                      padding: "20px",
                      minHeight: "60px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(255, 255, 255, 0.9)",
                      borderRadius: "8px",
                      border: "1px solid #dee2e6"
                    }}
                  >
                    {loadingMore ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div
                          style={{
                            width: "20px",
                            height: "20px",
                            border: "2px solid #f3f3f3",
                            borderTop: "2px solid #007bff",
                            borderRadius: "50%",
                            animation: "spin 1s linear infinite"
                          }}
                        />
                        <span>{t('giftList.loadingMore')}</span>
                      </div>
                    ) : (
                      <span style={{ color: "#666", fontSize: "14px" }}>
                        {t('giftList.scrollForMore')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* PDF Loading Statistics */}
      <LazyLoadingStats
        totalPdfs={pdfStats.totalPdfs}
        loadedPdfs={pdfStats.loadedPdfs}
        pendingPdfs={pdfStats.pendingPdfs}
        showDetails={true}
      />
    </div>
  );
};

export default GiftList;
