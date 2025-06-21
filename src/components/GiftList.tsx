import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import authService from "../services/authService";
import type { ConstituentInfo } from "../services/authService";
import { constituentQueue, attachmentQueue } from "../utils/concurrentQueue";
import QueueManager from "./QueueManager";
import LazyLoadingStats from "./LazyLoadingStats";
import PdfDownloadStatus from "./PdfDownloadStatus";
import GiftCard from "./GiftCard";

// Define types inline since we removed the auth types file
interface Gift {
  id: string;
  constituent_id?: string;
  amount?: {
    value: number;
    currency?: string;
  };
  date?: string;
  type?: string;
  subtype?: string;
  designation?: string;
  reference?: string;
  gift_status?: string;
  acknowledgment_status?: string;
  receipt_status?: string;
  attachments?: GiftAttachment[];
  [key: string]: any;
}

interface GiftAttachment {
  id?: string;
  name: string;
  type?: string;
  url?: string;
  thumbnail_url?: string;
  date?: string;
  file_name?: string;
  file_size?: number;
  content_type?: string;
  parent_id?: string;
  tags?: string[];
  [key: string]: any;
}

interface GiftListResponse {
  count: number;
  value: Gift[];
  next_link?: string;
}

interface GiftPayment {
  payment_method?: string;
  check_number?: string;
  check_date?: string;
  [key: string]: any;
}

interface SoftCredit {
  constituent: {
    name: string;
    [key: string]: any;
  };
  amount?: {
    value: number;
    currency?: string;
  };
  [key: string]: any;
}

type SortDirection = 'asc' | 'desc' | null;

interface Filters {
  type: string;
  status: string;
  subtype: string;
  list_id: string;
}

// Loading states for better UX
interface LoadingStates {
  constituents: Set<string>;
  attachments: Set<string>;
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
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<string | null>(searchParams.get('sortColumn'));
  const [sortDirection, setSortDirection] = useState<SortDirection>(searchParams.get('sortDirection') as SortDirection);
  const [nextLink, setNextLink] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [cachedConstituents, setCachedConstituents] = useState<Record<string, ConstituentInfo | null>>({});
  const [giftAttachments, setGiftAttachments] = useState<Record<string, GiftAttachment[]>>({});
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    constituents: new Set(),
    attachments: new Set()
  });
  const [cachedLists, setCachedLists] = useState<Record<string, { name: string; description?: string }>>({});

  // PDF loading statistics
  const [pdfStats, setPdfStats] = useState({
    totalPdfs: 0,
    loadedPdfs: 0,
    pendingPdfs: 0
  });
  const [loadedPdfIds, setLoadedPdfIds] = useState<Set<string>>(new Set());

  // Zoom level for card sizing
  const [zoomLevel, setZoomLevel] = useState<number>(500); // Default 500px width

  // Refs for tracking loading states
  const loadingAttachmentsRef = useRef<Set<string>>(new Set());
  const loadingTasksRef = useRef<Set<string>>(new Set()); // Track queued tasks to prevent duplicates

  // Debounced filters for better performance
  const [immediateFilters, debouncedFilters, setImmediateFilters] = useDebouncedState<Filters>({
    type: searchParams.get('type') || '',
    status: searchParams.get('status') || '',
    subtype: searchParams.get('subtype') || '',
    list_id: searchParams.get('list_id') || ''
  }, 300);

  // Use debounced filters for API calls
  const filters = debouncedFilters;

  // Wrap isPdfFile in useCallback to fix dependency issues
  const isPdfFile = useCallback((attachment: GiftAttachment): boolean => {
    const fileName = attachment.file_name || attachment.name || '';
    const contentType = attachment.content_type || '';
    return fileName.toLowerCase().endsWith('.pdf') || contentType.toLowerCase().includes('pdf');
  }, []);

  // Wrap handleImageError in useCallback to fix dependency issues
  const handleImageError = useCallback((attachmentId: string): void => {
    setImageErrors(prev => new Set([...Array.from(prev), attachmentId]));
  }, []);

  // Queue constituent loading using the queue
  const queueConstituentLoad = useCallback((constituentId: string): void => {
    console.log(`📋 Queueing constituent load for ${constituentId}. Already cached: ${cachedConstituents[constituentId] !== undefined}`);

    if (!constituentId || cachedConstituents[constituentId] !== undefined) return;

    // Add task to the queue
    constituentQueue.add({
      id: `constituent_${constituentId}`,
      type: 'constituent',
      priority: 1,
      execute: async () => {
        console.log(`📡 Fetching constituent ${constituentId} from API`);
        const constituent = await authService.getConstituent(constituentId);
        console.log(`✅ Fetched constituent ${constituentId}:`, constituent);
        return constituent;
      },
      onSuccess: (constituent) => {
        console.log(`💾 Updating cached constituent ${constituentId}:`, constituent);
        setCachedConstituents(prev => ({ ...prev, [constituentId]: constituent }));
      },
      onError: (error) => {
        console.error(`❌ Failed to fetch constituent ${constituentId}:`, error);
        setCachedConstituents(prev => ({ ...prev, [constituentId]: null }));
      }
    });
  }, [cachedConstituents]);

  // Load gift attachments using the queue
  const loadGiftAttachments = useCallback(async (giftId: string): Promise<void> => {
    // Don't fetch if already loading, already have attachments, or task already queued
    if (loadingAttachmentsRef.current.has(giftId) ||
      giftAttachments[giftId] !== undefined ||
      loadingTasksRef.current.has(giftId)) {
      console.log(`🚫 Skipping attachment load for ${giftId} - already loading, loaded, or queued`);
      return;
    }

    // Mark as loading and track task
    const newLoadingAttachments = new Set([...Array.from(loadingStates.attachments), giftId]);
    setLoadingStates(prev => ({
      ...prev,
      attachments: newLoadingAttachments
    }));
    loadingAttachmentsRef.current.add(giftId);
    loadingTasksRef.current.add(giftId);

    console.log(`📋 Queueing attachment load for gift ${giftId}`);

    // Add task to the queue
    attachmentQueue.add({
      id: `attachment_${giftId}`,
      type: 'attachment',
      priority: 2,
      execute: async () => {
        console.log(`📡 Loading attachments for gift ${giftId}`);
        const response = await authService.executeQuery(
          () => authService.getGiftAttachments(giftId),
          `fetching attachments for gift ${giftId}`
        );
        console.log(`✅ Loaded attachments for gift ${giftId}:`, response);
        return response;
      },
      onSuccess: (response) => {
        console.log(`💾 Updating attachments for gift ${giftId}:`, response);
        setGiftAttachments(prev => ({
          ...prev,
          [giftId]: response.value || []
        }));
      },
      onError: (error) => {
        console.error(`❌ Failed to fetch attachments for gift ${giftId}:`, error);
        setGiftAttachments(prev => ({
          ...prev,
          [giftId]: []
        }));
      }
    });

    // Set up cleanup
    const cleanup = () => {
      const remainingLoading = new Set(Array.from(loadingStates.attachments).filter(id => id !== giftId));
      setLoadingStates(prev => ({
        ...prev,
        attachments: remainingLoading
      }));
      loadingAttachmentsRef.current.delete(giftId);
      loadingTasksRef.current.delete(giftId);
    };

    // Wait for task to complete
    setTimeout(() => {
      cleanup();
    }, 100);
  }, [giftAttachments, loadingStates.attachments]);

  // Load attachments for visible gifts when they come into view
  const loadAttachmentsForVisibleGifts = useCallback((visibleGiftIds: string[]): void => {
    visibleGiftIds.forEach(giftId => {
      if (!loadingAttachmentsRef.current.has(giftId) && giftAttachments[giftId] === undefined) {
        // Small delay to avoid overwhelming the API
        setTimeout(() => loadGiftAttachments(giftId), Math.random() * 500);
      }
    });
  }, [loadGiftAttachments, giftAttachments]);

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
      // Use centralized query handler
      const response: GiftListResponse = await authService.executeQuery(
        () => authService.getGifts(50, filters.list_id || undefined),
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

      // Queue constituent loading for new gifts
      const newGifts = response.value || [];
      newGifts.forEach(gift => {
        if (gift.constituent_id && cachedConstituents[gift.constituent_id] === undefined) {
          queueConstituentLoad(gift.constituent_id);
        }
      });

    } catch (error) {
      console.error('❌ Error fetching gifts:', error);
      setError('Failed to load gifts');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filters.list_id, cachedConstituents, queueConstituentLoad]);

  const loadMoreGifts = useCallback(async (): Promise<void> => {
    if (!nextLink || loadingMore) return;

    try {
      setLoadingMore(true);
      const response: GiftListResponse = await authService.executeQuery(
        () => authService.apiRequestUrl(nextLink),
        'fetching more gifts'
      );

      setGifts(prev => [...prev, ...(response.value || [])]);
      setNextLink(response.next_link || null);

      // Queue constituent loading for new gifts
      const newGifts = response.value || [];
      newGifts.forEach(gift => {
        if (gift.constituent_id && cachedConstituents[gift.constituent_id] === undefined) {
          queueConstituentLoad(gift.constituent_id);
        }
      });

    } catch (error) {
      console.error('❌ Error loading more gifts:', error);
      setError('Failed to load more gifts');
    } finally {
      setLoadingMore(false);
    }
  }, [nextLink, loadingMore, cachedConstituents, queueConstituentLoad]);

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

  const memoizedHandlePdfLoaded = useCallback((pdfId: string): void => {
    setLoadedPdfIds(prev => new Set([...Array.from(prev), pdfId]));
    setPdfStats(prev => ({
      ...prev,
      loadedPdfs: prev.loadedPdfs + 1,
      pendingPdfs: Math.max(0, prev.pendingPdfs - 1)
    }));
  }, []);

  const memoizedHandleImageError = useCallback((attachmentId: string): void => {
    setImageErrors(prev => new Set([...Array.from(prev), attachmentId]));
  }, []);

  // Sort gifts based on current sort settings
  const sortedGifts = useMemo(() => {
    if (!sortColumn) return gifts;

    return [...gifts].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'amount':
          aValue = a.amount?.value || 0;
          bValue = b.amount?.value || 0;
          break;
        case 'date':
          aValue = new Date(a.date || '').getTime();
          bValue = new Date(b.date || '').getTime();
          break;
        case 'constituent':
          aValue = cachedConstituents[a.constituent_id || '']?.name || '';
          bValue = cachedConstituents[b.constituent_id || '']?.name || '';
          break;
        case 'type':
          aValue = a.type || '';
          bValue = b.type || '';
          break;
        case 'status':
          aValue = a.gift_status || '';
          bValue = b.gift_status || '';
          break;
        case 'fund':
          aValue = a.designation || '';
          bValue = b.designation || '';
          break;
        case 'campaign':
          aValue = a.campaign || '';
          bValue = b.campaign || '';
          break;
        case 'appeal':
          aValue = a.appeal || '';
          bValue = b.appeal || '';
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [gifts, sortColumn, sortDirection, cachedConstituents]);

  // Get unique values for filter dropdowns
  const uniqueTypes = useMemo(() => {
    const types = gifts
      .map(gift => gift.type)
      .filter(type => type && type.trim() !== '')
      .map(type => type as string);
    return Array.from(new Set(types)).sort();
  }, [gifts]);

  const uniqueStatuses = useMemo(() => {
    const statuses = gifts
      .map(gift => gift.gift_status)
      .filter(status => status && status.trim() !== '')
      .map(status => status as string);
    return Array.from(new Set(statuses)).sort();
  }, [gifts]);

  const uniqueSubtypes = useMemo(() => {
    const subtypes = gifts
      .map(gift => gift.subtype)
      .filter(subtype => subtype && subtype.trim() !== '')
      .map(subtype => subtype as string);
    return Array.from(new Set(subtypes)).sort();
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
    if (newFilters.type) params.set('type', newFilters.type);
    if (newFilters.status) params.set('status', newFilters.status);
    if (newFilters.subtype) params.set('subtype', newFilters.subtype);
    if (newFilters.list_id) params.set('list_id', newFilters.list_id);
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
    const newFilters = { type: '', status: '', subtype: '', list_id: '' };
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
      console.log(`📋 Loading list name for ${listId}`);
      const response = await authService.executeQuery(
        () => authService.getList(listId),
        `fetching list ${listId}`
      );

      if (response) {
        setCachedLists(prev => ({
          ...prev,
          [listId]: {
            name: response.name || response.title || 'Unknown List',
            description: response.description
          }
        }));
      }
    } catch (error) {
      console.error(`❌ Failed to load list name for ${listId}:`, error);
      setCachedLists(prev => ({
        ...prev,
        [listId]: {
          name: 'Unknown List',
          description: undefined
        }
      }));
    }
  }, [cachedLists]);

  // Load list name when list filter is set
  useEffect(() => {
    if (filters.list_id && !cachedLists[filters.list_id]) {
      loadListName(filters.list_id);
    }
  }, [filters.list_id, cachedLists, loadListName]);

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
        <h2>🎁 {t('giftList.title')}</h2>
      </div>

      {/* Filter and Sort Controls */}
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
            value={immediateFilters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
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
            value={immediateFilters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
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
          <label style={{ fontWeight: "bold", fontSize: "14px" }}>{t('giftList.filters.subtype')}:</label>
          <select
            value={immediateFilters.subtype}
            onChange={(e) => handleFilterChange('subtype', e.target.value)}
            style={{
              padding: "6px 10px",
              border: "1px solid #ced4da",
              borderRadius: "4px",
              fontSize: "14px",
              minWidth: "120px"
            }}
          >
            <option value="">{t('giftList.filters.allSubtypes')}</option>
            {uniqueSubtypes.map(subtype => (
              <option key={subtype} value={subtype}>{subtype}</option>
            ))}
          </select>
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

        {(immediateFilters.type || immediateFilters.status || immediateFilters.subtype || immediateFilters.list_id) && (
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

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontWeight: "bold", fontSize: "14px" }}>Card Size:</label>
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
            <option value={300}>Small (300px)</option>
            <option value={400}>Medium (400px)</option>
            <option value={500}>Large (500px)</option>
            <option value={600}>Extra Large (600px)</option>
            <option value={700}>Huge (700px)</option>
          </select>
        </div>
      </div>

      {gifts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
          <p>{t('giftList.noGifts')}</p>
        </div>
      ) : (
        <>
          {/* Cards Grid */}
          <div className="gifts-grid" style={{
            display: "block",
            marginBottom: "20px",
            minHeight: "400px",
            fontSize: 0 // Remove whitespace between inline-block elements
          }}>
            {sortedGifts.map((gift) => (
              <div key={gift.id} className="gift-card-wrapper" style={{
                display: "inline-block",
                width: `${zoomLevel}px`,
                margin: "10px",
                verticalAlign: "top",
                fontSize: "14px" // Restore font size
              }}>
                <GiftCard
                  gift={gift}
                  expandedRows={expandedRows}
                  onToggleExpansion={memoizedToggleRowExpansion}
                  onHandlePdfLoaded={memoizedHandlePdfLoaded}
                  onHandleImageError={memoizedHandleImageError}
                  formatCurrency={formatCurrency}
                  formatDate={formatDate}
                  zoomLevel={zoomLevel}
                />
              </div>
            ))}
          </div>

          {/* Load More Trigger */}
          {nextLink && !loading && (
            <div
              ref={loadMoreTriggerRef}
              style={{
                textAlign: "center",
                marginTop: "20px",
                padding: "20px",
                minHeight: "60px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
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
        </>
      )}

      {/* Queue Manager */}
      <QueueManager showDetails={true} />

      {/* PDF Loading Statistics */}
      <LazyLoadingStats
        totalPdfs={pdfStats.totalPdfs}
        loadedPdfs={pdfStats.loadedPdfs}
        pendingPdfs={pdfStats.pendingPdfs}
        showDetails={true}
      />

      {/* PDF Download Status */}
      <PdfDownloadStatus showDetails={true} />

      {/* CSS Styles for responsive grid */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .gifts-grid {
          text-align: center;
          padding: 10px;
        }
        
        .gift-card-wrapper {
          transition: all 0.2s ease-in-out;
          transform: translateZ(0);
          will-change: transform;
        }
        
        .gift-card-wrapper:hover {
          transform: translateY(-2px) translateZ(0);
        }
        
        .gift-card {
          transition: all 0.2s ease-in-out;
          transform: translateZ(0);
          will-change: transform;
          min-height: 200px;
          width: 100%;
          box-sizing: border-box;
        }
        
        .gift-card:hover {
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }
        
        .loading-placeholder {
          height: 18px;
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: loading 1.5s infinite;
          border-radius: 4px;
          min-width: 120px;
          display: inline-block;
        }
        
        @keyframes loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        
        .constituent-name {
          min-height: 24px;
          display: flex;
          align-items: center;
          height: 24px;
          overflow: hidden;
        }

        .constituent-name h3 {
          margin: 0;
          line-height: 24px;
          height: 24px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
};

export default GiftList;
