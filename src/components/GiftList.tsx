import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import authService from "../services/authService";
import type { ConstituentInfo } from "../types/auth";
import QueueManager from "./QueueManager";
import LazyLoadingStats from "./LazyLoadingStats";
import PdfDownloadStatus from "./PdfDownloadStatus";
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
  dateFrom: string;
  dateTo: string;
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

  // Progressive loading state
  const [displayedGifts, setDisplayedGifts] = useState<Gift[]>([]);
  const [isLoadingComplete, setIsLoadingComplete] = useState<boolean>(false);
  const MAX_CARDS_TO_DISPLAY = 2000;

  // Debounced filters for better performance
  const [immediateFilters, debouncedFilters, setImmediateFilters] = useDebouncedState<Filters>({
    listId: searchParams.get('listId') || '',
    giftType: searchParams.get('giftType') || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || ''
  }, 300);

  // Use debounced filters for API calls
  const filters = debouncedFilters;

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
      const response: GiftListResponse = await authService.executeQuery(
        () => authService.getGifts(50, filters.listId || undefined),
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
    } catch (err: any) {
      console.error("Failed to fetch gifts:", err);
    } finally {
      if (reset) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  }, [filters.listId]);

  // Load more gifts function
  const loadMoreGifts = useCallback(async (): Promise<void> => {
    if (!nextLink || loadingMore) return;

    try {
      setLoadingMore(true);
      const response: GiftListResponse = await authService.executeQuery(
        () => authService.apiRequestUrl(nextLink),
        'loading more gifts'
      );

      setGifts(prev => [...prev, ...(response.value || [])]);
      setNextLink(response.next_link || null);
    } catch (err: any) {
      console.error("Failed to load more gifts:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [nextLink, loadingMore]);

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
      .filter(type => type && type.trim() !== '')
      .map(type => type as string);
    return Array.from(new Set(types)).sort();
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
    if (newFilters.dateFrom) params.set('dateFrom', newFilters.dateFrom);
    if (newFilters.dateTo) params.set('dateTo', newFilters.dateTo);
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
    const newFilters = { listId: '', giftType: '', dateFrom: '', dateTo: '' };
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

  // Progressive loading effect
  useEffect(() => {
    // Only reset if we're actually loading and have no gifts
    if (gifts.length === 0 && loading) {
      setDisplayedGifts([]);
      setIsLoadingComplete(false);
      return;
    }

    // If we have gifts but no displayed gifts yet, start progressive loading
    if (gifts.length > 0 && displayedGifts.length === 0) {
      const timer = setTimeout(() => {
        setDisplayedGifts(gifts.slice(0, Math.min(25, gifts.length)));
      }, 100);
      return () => clearTimeout(timer);
    }

    const targetCount = Math.min(gifts.length, MAX_CARDS_TO_DISPLAY);

    if (displayedGifts.length < targetCount) {
      const timer = setTimeout(() => {
        setDisplayedGifts(prev => {
          const newCount = Math.min(prev.length + 25, targetCount); // Smaller batches for smoother loading
          return gifts.slice(0, newCount);
        });
      }, 150); // Longer delay to reduce flickering

      return () => clearTimeout(timer);
    } else if (displayedGifts.length === targetCount && !isLoadingComplete && !nextLink) {
      // Only set complete when we've displayed all loaded gifts AND there are no more to load from API
      setIsLoadingComplete(true);
    }
  }, [gifts, displayedGifts.length, isLoadingComplete, nextLink, loading]);

  // Debounced card count for smoother display
  const [debouncedDisplayedCount, setDebouncedDisplayedCount] = useState<number>(0);

  useEffect(() => {
    // Don't update the debounced count if we're loading and have no displayed gifts yet
    if (loading && displayedGifts.length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedDisplayedCount(displayedGifts.length);
    }, 200); // Debounce the count updates

    return () => clearTimeout(timer);
  }, [displayedGifts.length, loading]);

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
      {/* Card Count Display */}
      {gifts.length > 0 && (
        <div style={{
          marginBottom: "20px",
          padding: "12px 16px",
          backgroundColor: "#e3f2fd",
          border: "1px solid #bbdefb",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#1565c0"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "16px" }}>📊</span>
            <span style={{ fontWeight: "bold" }}>
              Showing {debouncedDisplayedCount.toLocaleString()} of {totalCount.toLocaleString()} cards
            </span>
            {debouncedDisplayedCount < totalCount && debouncedDisplayedCount < MAX_CARDS_TO_DISPLAY && (
              <span style={{ fontSize: "14px", color: "#1976d2" }}>
                (Loading more...)
              </span>
            )}
          </div>
          {isLoadingComplete && (
            <span style={{ fontSize: "14px", color: "#2e7d32", fontWeight: "bold" }}>
              ✅ All cards loaded
            </span>
          )}
        </div>
      )}

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
      </div>

      {gifts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
          <p>{t('giftList.noGifts')}</p>
        </div>
      ) : (
        // Normal Card View
        <>
          {/* Cards Grid */}
          <div className="gifts-grid" style={{
            display: "block",
            marginBottom: "20px",
            minHeight: "400px",
            fontSize: 0 // Remove whitespace between inline-block elements
          }}>
            {displayedGifts.map((gift, index) => (
              <div key={gift.id} className="gift-card-wrapper" style={{
                display: "inline-block",
                width: `${zoomLevel}px`,
                margin: "10px",
                verticalAlign: "top",
                fontSize: "14px" // Restore font size
              }}>
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
                  cardNumber={index + 1}
                  totalCount={totalCount}
                />
              </div>
            ))}
          </div>

          {/* Completion Message */}
          {isLoadingComplete && !nextLink && (
            <div style={{
              textAlign: "center",
              marginTop: "20px",
              padding: "16px",
              backgroundColor: "#d4edda",
              border: "1px solid #c3e6cb",
              borderRadius: "8px",
              color: "#155724"
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                <span style={{ fontSize: "18px" }}>✅</span>
                <span style={{ fontWeight: "bold", fontSize: "16px" }}>
                  All cards have been displayed
                </span>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#0f5132" }}>
                Showing {displayedGifts.length.toLocaleString()} of {totalCount.toLocaleString()} total cards
              </p>
            </div>
          )}

          {/* Load More Trigger - Only show if not complete and there are more cards to load */}
          {nextLink && !loading && displayedGifts.length < totalCount && (
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
          transition: all 0.3s ease-in-out;
          transform: translateZ(0);
          will-change: transform;
          opacity: 1;
          animation: fadeIn 0.3s ease-in-out;
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

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        /* Print styles for complete view */
        @media print {
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .gift-card-wrapper {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          
          .gift-card {
            break-inside: avoid;
            page-break-inside: avoid;
            box-shadow: none !important;
            border: 1px solid #000 !important;
          }
          
          /* Hide non-essential elements when printing */
          button, select, input {
            display: none !important;
          }
          
          /* Ensure text is readable */
          * {
            color: black !important;
            background: white !important;
          }
        }
      `}</style>
    </div>
  );
};

export default GiftList;
