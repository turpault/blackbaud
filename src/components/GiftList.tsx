import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import authService, { ConstituentInfo } from "../services/authService";
import PdfViewer from "./PdfViewer";

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

const GiftList: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<string | null>(searchParams.get('sortColumn'));
  const [sortDirection, setSortDirection] = useState<SortDirection>(searchParams.get('sortDirection') as SortDirection);
  const [filters, setFilters] = useState<Filters>({
    type: searchParams.get('type') || '',
    status: searchParams.get('status') || '',
    subtype: searchParams.get('subtype') || '',
    list_id: searchParams.get('list_id') || ''
  });
  const [nextLink, setNextLink] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [cachedConstituents, setCachedConstituents] = useState<Record<string, ConstituentInfo | null>>({});
  const [giftAttachments, setGiftAttachments] = useState<Record<string, GiftAttachment[]>>({});
  const [loadingAttachments, setLoadingAttachments] = useState<Set<string>>(new Set());

  const fetchGiftAttachments = useCallback(async (giftId: string): Promise<void> => {
    // Don't fetch if already loading or already have attachments
    if (loadingAttachments.has(giftId) || giftAttachments[giftId]) {
      return;
    }

    setLoadingAttachments(prev => new Set(prev).add(giftId));

    try {
      console.log(`Fetching attachments for gift ${giftId}`);
      const response = await authService.executeQuery(
        () => authService.getGiftAttachments(giftId),
        `fetching attachments for gift ${giftId}`
      );
      
      setGiftAttachments(prev => ({
        ...prev,
        [giftId]: response.value || []
      }));
    } catch (err: any) {
      console.error(`Failed to fetch attachments for gift ${giftId}:`, err);
      // Set empty array to prevent repeated attempts
      setGiftAttachments(prev => ({
        ...prev,
        [giftId]: []
      }));
    } finally {
      setLoadingAttachments(prev => {
        const newSet = new Set(prev);
        newSet.delete(giftId);
        return newSet;
      });
    }
  }, [loadingAttachments, giftAttachments]);

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

      // Fetch constituent details for gifts that have constituent_id
      if (response.value && response.value.length > 0) {
        const constituentIds = response.value
          .map(gift => gift.constituent_id)
          .filter((id): id is string => !!id);
        
        if (constituentIds.length > 0) {
          try {
            const constituents = await authService.executeQuery(
              () => authService.getConstituents(constituentIds),
              'fetching constituent details'
            );
            setCachedConstituents(prev => ({ ...prev, ...constituents }));
          } catch (error) {
            console.warn('Failed to fetch constituent details:', error);
          }
        }
      }
    } catch (err: any) {
      // Error is already handled by executeQuery, but we still need to catch it
      console.error("Failed to fetch gifts:", err);
    } finally {
      if (reset) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  }, [filters.list_id]);

  useEffect(() => {
    fetchGifts();
  }, [fetchGifts]);

  // Refetch gifts when list_id filter changes
  useEffect(() => {
    if (filters.list_id !== '') {
      fetchGifts();
    }
  }, [filters.list_id, fetchGifts]);

  // Load attachments asynchronously for all gifts
  useEffect(() => {
    if (gifts.length > 0) {
      gifts.forEach(gift => {
        // Only fetch if we don't already have attachments and aren't currently loading
        if (!giftAttachments[gift.id] && !loadingAttachments.has(gift.id)) {
          fetchGiftAttachments(gift.id);
        }
      });
    }
  }, [gifts, fetchGiftAttachments, giftAttachments, loadingAttachments]);

  const loadMoreGifts = async (): Promise<void> => {
    if (!nextLink || loadingMore) return;
    
    setLoadingMore(true);
    setError(null);

    try {
      // Use centralized query handler
      const response: GiftListResponse = await authService.executeQuery(
        () => authService.apiRequestUrl(nextLink),
        'loading more gifts',
        (errorMsg) => setError(errorMsg)
      );
      
      setGifts(prev => [...prev, ...(response.value || [])]);
      setNextLink(response.next_link || null);
      setTotalCount(response.count || 0);

      // Fetch constituent details for newly loaded gifts
      if (response.value && response.value.length > 0) {
        const constituentIds = response.value
          .map(gift => gift.constituent_id)
          .filter((id): id is string => !!id);
        
        if (constituentIds.length > 0) {
          try {
            const constituents = await authService.executeQuery(
              () => authService.getConstituents(constituentIds),
              'fetching constituent details'
            );
            setCachedConstituents(prev => ({ ...prev, ...constituents }));
          } catch (error) {
            console.warn('Failed to fetch constituent details:', error);
          }
        }
      }
    } catch (err: any) {
      // Error is already handled by executeQuery, but we still need to catch it
      console.error("Failed to load more gifts:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSort = (column: string): void => {
    let newSortColumn: string | null;
    let newSortDirection: SortDirection;
    
    if (sortColumn === column) {
      // Same column clicked - cycle through asc -> desc -> null
      if (sortDirection === 'asc') {
        newSortColumn = column;
        newSortDirection = 'desc';
      } else if (sortDirection === 'desc') {
        newSortColumn = null;
        newSortDirection = null;
      } else {
        newSortColumn = column;
        newSortDirection = 'asc';
      }
    } else {
      // New column clicked
      newSortColumn = column;
      newSortDirection = 'asc';
    }
    
    setSortColumn(newSortColumn);
    setSortDirection(newSortDirection);
    updateUrlParams(filters, newSortColumn, newSortDirection);
  };

  const getSortValue = useCallback((gift: Gift, column: string): any => {
    switch (column) {
      case 'id':
        return gift.id;
      case 'constituent':
        return gift.constituent_id ? (cachedConstituents[gift.constituent_id]?.name || '') : '';
      case 'amount':
        return gift.amount?.value || 0;
      case 'date':
        return gift.date ? new Date(gift.date).getTime() : 0;
      case 'type':
        return gift.type || '';
      case 'subtype':
        return gift.subtype || '';
      case 'status':
        return gift.gift_status || '';
      case 'designation':
        return gift.designation || '';
      case 'receipt_date':
        return gift.receipt_date ? new Date(gift.receipt_date).getTime() : 0;
      case 'batch_number':
        return gift.batch_number || '';
      case 'reference':
        return gift.reference || '';
      case 'anonymous':
        return gift.is_anonymous ? 'Yes' : 'No';
      case 'attachments':
        return gift.attachments?.length || 0;
      default:
        return '';
    }
  }, [cachedConstituents]);

  const filteredGifts = React.useMemo(() => {
    return gifts.filter(gift => {
      const typeMatch = !filters.type || (gift.type && gift.type.toLowerCase().includes(filters.type.toLowerCase()));
      const statusMatch = !filters.status || (gift.gift_status && gift.gift_status.toLowerCase().includes(filters.status.toLowerCase()));
      const subtypeMatch = !filters.subtype || (gift.subtype && gift.subtype.toLowerCase().includes(filters.subtype.toLowerCase()));
      
      return typeMatch && statusMatch && subtypeMatch;
    });
  }, [gifts, filters]);

  const sortedGifts = React.useMemo(() => {
    if (!sortColumn || !sortDirection) {
      return filteredGifts;
    }

    return [...filteredGifts].sort((a, b) => {
      const aValue = getSortValue(a, sortColumn);
      const bValue = getSortValue(b, sortColumn);

      if (aValue === bValue) return 0;

      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredGifts, sortColumn, sortDirection, getSortValue]);

  const uniqueTypes = React.useMemo(() => {
    const types = gifts
      .map(gift => gift.type)
      .filter(type => type && type.trim() !== '')
      .map(type => type as string);
    return Array.from(new Set(types)).sort();
  }, [gifts]);

  const uniqueStatuses = React.useMemo(() => {
    const statuses = gifts
      .map(gift => gift.gift_status)
      .filter(status => status && status.trim() !== '')
      .map(status => status as string);
    return Array.from(new Set(statuses)).sort();
  }, [gifts]);

  const uniqueSubtypes = React.useMemo(() => {
    const subtypes = gifts
      .map(gift => gift.subtype)
      .filter(subtype => subtype && subtype.trim() !== '')
      .map(subtype => subtype as string);
    return Array.from(new Set(subtypes)).sort();
  }, [gifts]);

  // Update URL parameters when filters change
  const updateUrlParams = (newFilters: Filters, newSortColumn?: string | null, newSortDirection?: SortDirection) => {
    const params = new URLSearchParams();
    
    // Add filters to URL
    if (newFilters.type) params.set('type', newFilters.type);
    if (newFilters.status) params.set('status', newFilters.status);
    if (newFilters.subtype) params.set('subtype', newFilters.subtype);
    if (newFilters.list_id) params.set('list_id', newFilters.list_id);
    
    // Add sorting to URL
    if (newSortColumn) params.set('sortColumn', newSortColumn);
    if (newSortDirection) params.set('sortDirection', newSortDirection);
    
    setSearchParams(params, { replace: true });
  };

  const handleFilterChange = (filterType: keyof Filters, value: string): void => {
    const newFilters = {
      ...filters,
      [filterType]: value
    };
    setFilters(newFilters);
    updateUrlParams(newFilters, sortColumn, sortDirection);
  };

  const clearFilters = (): void => {
    const newFilters = {
      type: '',
      status: '',
      subtype: '',
      list_id: ''
    };
    setFilters(newFilters);
    updateUrlParams(newFilters, sortColumn, sortDirection);
  };

  const toggleRowExpansion = (giftId: string): void => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(giftId)) {
      newExpanded.delete(giftId);
    } else {
      newExpanded.add(giftId);
    }
    setExpandedRows(newExpanded);
  };

  const formatCurrency = (amount?: {
    value: number;
    currency?: string;
  }): string => {
    if (!amount) return "N/A";
    const currency = amount.currency || "USD";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount.value);
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isImageFile = (attachment: GiftAttachment): boolean => {
    if (!attachment.url) return false;

    // Check by file extension
    const imageExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".bmp",
      ".webp",
      ".svg",
    ];
    const url = attachment.url.toLowerCase();
    const hasImageExtension = imageExtensions.some((ext) => url.includes(ext));

    // Check by MIME type if available
    const isImageType = attachment.type?.toLowerCase().startsWith("image/");

    return hasImageExtension || isImageType || false;
  };

  const isPdfFile = (attachment: GiftAttachment): boolean => {
    if (!attachment.url) return false;

    // Check by file extension
    const url = attachment.url.toLowerCase();
    const hasPdfExtension = url.includes(".pdf");

    // Check by MIME type if available
    const isPdfType = attachment.content_type?.toLowerCase() === "application/pdf" ||
                      attachment.type?.toLowerCase() === "application/pdf";

    return hasPdfExtension || isPdfType || false;
  };

  const handleImageError = (attachmentId: string): void => {
    setImageErrors((prev) => new Set(Array.from(prev).concat(attachmentId)));
  };

  const renderAttachments = (gift: Gift): JSX.Element => {
    const giftId = gift.id;
    const isLoadingAttachments = loadingAttachments.has(giftId);
    const fetchedAttachments = giftAttachments[giftId];
    
    // Use fetched attachments if available, otherwise fall back to gift.attachments
    const attachments = fetchedAttachments || gift.attachments;

    if (isLoadingAttachments) {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "16px",
              height: "16px",
              border: "2px solid #f3f3f3",
              borderTop: "2px solid #2196F3",
              borderRadius: "50%",
              animation: "spin 1s linear infinite"
            }}
          />
          <span style={{ color: "#666", fontStyle: "italic" }}>
            Loading attachments...
          </span>
        </div>
      );
    }

    if (!attachments || attachments.length === 0) {
      return (
        <span style={{ color: "#666", fontStyle: "italic" }}>
          No attachments
        </span>
      );
    }

    return (
      <div style={{ maxWidth: "250px" }}>
        {attachments.map((attachment, index) => {
          const attachmentKey = `${attachment.id || index}`;
          const hasImageError = imageErrors.has(attachmentKey);
          const shouldShowAsImage =
            attachment.url && isImageFile(attachment) && !hasImageError;
          const shouldShowAsPdf = attachment.url && isPdfFile(attachment);
          const hasThumbnail = attachment.thumbnail_url && !hasImageError;

          return (
            <div
              key={attachmentKey}
              style={{
                marginBottom: "8px",
                padding: "8px",
                backgroundColor: "#f0f0f0",
                borderRadius: "6px",
                fontSize: "12px",
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                {attachment.name || attachment.file_name || "Unnamed attachment"}
              </div>

              {attachment.content_type && (
                <div style={{ color: "#666", marginBottom: "4px" }}>
                  Type: {attachment.content_type}
                </div>
              )}

              {attachment.file_size && (
                <div style={{ color: "#666", marginBottom: "4px" }}>
                  Size: {formatFileSize(attachment.file_size)}
                </div>
              )}

              {attachment.date && (
                <div style={{ color: "#666", marginBottom: "4px" }}>
                  Date: {formatDate(attachment.date)}
                </div>
              )}

              {attachment.tags && attachment.tags.length > 0 && (
                <div style={{ color: "#666", marginBottom: "4px" }}>
                  Tags: {attachment.tags.join(", ")}
                </div>
              )}

              {/* Show thumbnail if available */}
              {hasThumbnail ? (
                <div style={{ marginTop: "6px" }}>
                  <img
                    src={attachment.thumbnail_url}
                    alt={`${attachment.name || attachment.file_name} thumbnail`}
                    onError={() => handleImageError(attachmentKey)}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100px",
                      width: "auto",
                      height: "auto",
                      borderRadius: "4px",
                      border: "1px solid #ddd",
                      backgroundColor: "white",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  />
                  {attachment.url && (
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "#0066cc",
                        textDecoration: "underline",
                        fontSize: "11px",
                      }}
                    >
                      View Full Size
                    </a>
                  )}
                </div>
              ) : shouldShowAsImage ? (
                <div style={{ marginTop: "6px" }}>
                  <img
                    src={attachment.url}
                    alt={attachment.name || attachment.file_name}
                    onError={() => handleImageError(attachmentKey)}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "150px",
                      width: "auto",
                      height: "auto",
                      borderRadius: "4px",
                      border: "1px solid #ddd",
                      backgroundColor: "white",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  />
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#0066cc",
                      textDecoration: "underline",
                      fontSize: "11px",
                    }}
                  >
                    View Full Size
                  </a>
                </div>
              ) : shouldShowAsPdf ? (
                <div style={{ marginTop: "6px" }}>
                  <PdfViewer
                    url={attachment.url!}
                    name={attachment.name || attachment.file_name}
                    height={300}
                    width="100%"
                  />
                </div>
              ) : attachment.url ? (
                <div style={{ marginTop: "6px" }}>
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#0066cc",
                      textDecoration: "underline",
                      fontSize: "12px",
                      display: "inline-block",
                      padding: "4px 8px",
                      backgroundColor: "white",
                      borderRadius: "3px",
                      border: "1px solid #0066cc",
                    }}
                  >
                    📎 Download/View
                  </a>
                  {hasImageError && (
                    <div
                      style={{
                        color: "#999",
                        fontSize: "10px",
                        marginTop: "2px",
                        fontStyle: "italic",
                      }}
                    >
                      Image preview unavailable
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    color: "#999",
                    fontSize: "11px",
                    fontStyle: "italic",
                    marginTop: "4px",
                  }}
                >
                  No preview available
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: "1400px",
    margin: "0 auto",
    padding: "20px",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: "15px",
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
    backdropFilter: "blur(10px)",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    color: "#333",
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: "center", padding: "40px" }}>
          <div
            style={{
              width: "50px",
              height: "50px",
              border: "3px solid #f3f3f3",
              borderTop: "3px solid #2196F3",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 20px",
            }}
          />
          <p>Loading gifts from Blackbaud API...</p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <h2>🎁 Blackbaud Gifts</h2>
        </div>
        <div
          style={{
            color: "red",
            backgroundColor: "#fee",
            padding: "20px",
            borderRadius: "8px",
            border: "1px solid #fcc",
          }}
        >
          <h3>⚠️ Error Loading Gifts</h3>
          <p>{error}</p>
          <button
            onClick={() => fetchGifts()}
            style={{
              marginTop: "10px",
              padding: "10px 20px",
              backgroundColor: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h2>🎁 Blackbaud Gifts ({sortedGifts.length} of {totalCount.toLocaleString()})</h2>
        <button
          onClick={() => fetchGifts()}
          style={{
            padding: "10px 20px",
            backgroundColor: "#28a745",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {/* List Filter Alert */}
      {filters.list_id && (
        <div style={{
          marginBottom: "20px",
          padding: "12px 16px",
          backgroundColor: "#d1ecf1",
          border: "1px solid #bee5eb",
          borderRadius: "8px",
          color: "#0c5460",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "16px" }}>📝</span>
            <span>
              <strong>Filtered by List:</strong> Showing gifts from List ID {filters.list_id}
            </span>
          </div>
          <button
            onClick={() => {
              const newFilters = { ...filters, list_id: '' };
              setFilters(newFilters);
              updateUrlParams(newFilters, sortColumn, sortDirection);
            }}
            style={{
              padding: "4px 8px",
              backgroundColor: "#0c5460",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px"
            }}
          >
            Clear List Filter
          </button>
        </div>
      )}

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
        flexWrap: "wrap"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontWeight: "bold", fontSize: "14px" }}>Type:</label>
          <select
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            style={{
              padding: "6px 10px",
              border: "1px solid #ced4da",
              borderRadius: "4px",
              fontSize: "14px",
              minWidth: "120px"
            }}
          >
            <option value="">All Types</option>
            {uniqueTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontWeight: "bold", fontSize: "14px" }}>Status:</label>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            style={{
              padding: "6px 10px",
              border: "1px solid #ced4da",
              borderRadius: "4px",
              fontSize: "14px",
              minWidth: "120px"
            }}
          >
            <option value="">All Statuses</option>
            {uniqueStatuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontWeight: "bold", fontSize: "14px" }}>Subtype:</label>
          <select
            value={filters.subtype}
            onChange={(e) => handleFilterChange('subtype', e.target.value)}
            style={{
              padding: "6px 10px",
              border: "1px solid #ced4da",
              borderRadius: "4px",
              fontSize: "14px",
              minWidth: "120px"
            }}
          >
            <option value="">All Subtypes</option>
            {uniqueSubtypes.map(subtype => (
              <option key={subtype} value={subtype}>{subtype}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontWeight: "bold", fontSize: "14px" }}>Sort by:</label>
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
            <option value="">No sorting</option>
            <option value="amount">Amount</option>
            <option value="date">Date</option>
            <option value="constituent">Constituent</option>
            <option value="type">Type</option>
            <option value="status">Status</option>
            <option value="fund">Fund</option>
            <option value="campaign">Campaign</option>
            <option value="appeal">Appeal</option>
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

        {(filters.type || filters.status || filters.subtype || filters.list_id) && (
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
            Clear Filters
          </button>
        )}

        <div style={{ marginLeft: "auto", fontSize: "14px", color: "#6c757d" }}>
          {sortedGifts.length !== totalCount && (
            <span>Showing {sortedGifts.length} of {totalCount.toLocaleString()} gifts</span>
          )}
        </div>
      </div>

      {gifts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
          <p>No gifts found in your Blackbaud account.</p>
        </div>
      ) : (
        <>
          {/* Cards Grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(600px, 1fr))",
            gap: "20px",
            marginBottom: "20px"
          }}>
            {sortedGifts.map((gift) => (
              <div
                key={gift.id}
                style={{
                  backgroundColor: "white",
                  borderRadius: "12px",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                  border: "1px solid #e9ecef",
                  overflow: "hidden",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  cursor: "pointer"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.1)";
                }}
                onClick={() => toggleRowExpansion(gift.id)}
              >
                {/* Card Header - Constituent Name */}
                <div style={{
                  padding: "16px 20px 12px",
                  borderBottom: "1px solid #f0f0f0",
                  backgroundColor: "#f8f9fa"
                }}>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start"
                  }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{
                        margin: 0,
                        fontSize: "18px",
                        fontWeight: "bold",
                        color: "#2c3e50",
                        marginBottom: "4px"
                      }}>
                        {gift.constituent_id ? (
                          <>
                            {cachedConstituents[gift.constituent_id]?.name || "Loading..."}
                            {cachedConstituents[gift.constituent_id]?.lookup_id && (
                              <span style={{
                                fontSize: "12px",
                                color: "#6c757d",
                                marginLeft: "8px",
                                fontWeight: "normal"
                              }}>
                                (ID: {cachedConstituents[gift.constituent_id]?.lookup_id})
                              </span>
                            )}
                          </>
                        ) : (
                          <span style={{ color: "#6c757d" }}>No constituent</span>
                        )}
                      </h3>
                      <p style={{
                        margin: "4px 0 0",
                        fontSize: "12px",
                        color: "#6c757d",
                        fontFamily: "monospace"
                      }}>
                        Gift ID: {gift.id}
                      </p>
                    </div>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}>
                      {gift.is_anonymous && (
                        <span style={{
                          backgroundColor: "#ffc107",
                          color: "#212529",
                          padding: "2px 6px",
                          borderRadius: "12px",
                          fontSize: "11px",
                          fontWeight: "bold"
                        }}>
                          ANON
                        </span>
                      )}
                      <button
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "16px",
                          color: "#007bff",
                          padding: "4px"
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRowExpansion(gift.id);
                        }}
                      >
                        {expandedRows.has(gift.id) ? "▼" : "▶"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ padding: "16px 20px" }}>
                  {/* Amount - Now prominent in body */}
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{
                      fontSize: "24px",
                      fontWeight: "bold",
                      color: "#28a745",
                      marginBottom: "4px"
                    }}>
                      {formatCurrency(gift.amount)}
                    </div>
                    <div style={{
                      fontSize: "12px",
                      color: "#6c757d"
                    }}>
                      Gift Amount
                    </div>
                  </div>

                  {/* Key Details Grid */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "12px",
                    fontSize: "14px",
                    marginBottom: "16px"
                  }}>
                    <div>
                      <div style={{
                        color: "#6c757d",
                        fontSize: "12px",
                        marginBottom: "2px"
                      }}>
                        Date
                      </div>
                      <div style={{ fontWeight: "500" }}>
                        {formatDate(gift.date)}
                      </div>
                    </div>

                    <div>
                      <div style={{
                        color: "#6c757d",
                        fontSize: "12px",
                        marginBottom: "2px"
                      }}>
                        Type
                      </div>
                      <div style={{ fontWeight: "500" }}>
                        {gift.type || "N/A"}
                        {gift.subtype && (
                          <div style={{ fontSize: "11px", color: "#6c757d" }}>
                            {gift.subtype}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <div style={{
                        color: "#6c757d",
                        fontSize: "12px",
                        marginBottom: "2px"
                      }}>
                        Status
                      </div>
                      <div>
                        <span style={{
                          padding: "2px 8px",
                          borderRadius: "12px",
                          fontSize: "11px",
                          fontWeight: "bold",
                          backgroundColor: gift.gift_status === "Active" ? "#d4edda" : "#f8d7da",
                          color: gift.gift_status === "Active" ? "#155724" : "#721c24"
                        }}>
                          {gift.gift_status || "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Fund, Campaign & Appeal */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "12px",
                    fontSize: "13px",
                    marginBottom: "16px"
                  }}>
                    <div>
                      <div style={{
                        color: "#6c757d",
                        fontSize: "11px",
                        marginBottom: "2px"
                      }}>
                        Fund
                      </div>
                      <div style={{ fontWeight: "500" }}>
                        {gift.fund?.description || "N/A"}
                      </div>
                    </div>

                    <div>
                      <div style={{
                        color: "#6c757d",
                        fontSize: "11px",
                        marginBottom: "2px"
                      }}>
                        Campaign
                      </div>
                      <div style={{ fontWeight: "500" }}>
                        {gift.campaign?.description || "N/A"}
                      </div>
                    </div>

                    <div>
                      <div style={{
                        color: "#6c757d",
                        fontSize: "11px",
                        marginBottom: "2px"
                      }}>
                        Appeal
                      </div>
                      <div style={{ fontWeight: "500" }}>
                        {gift.appeal?.description || "N/A"}
                      </div>
                    </div>
                  </div>

                  {/* Attachments Section - Always visible */}
                  <div style={{
                    borderTop: "1px solid #f0f0f0",
                    paddingTop: "16px"
                  }}>
                    <h4 style={{ 
                      margin: "0 0 12px", 
                      fontSize: "14px", 
                      color: "#495057",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}>
                      📎 Attachments
                      {loadingAttachments.has(gift.id) && (
                        <div
                          style={{
                            width: "12px",
                            height: "12px",
                            border: "2px solid #f3f3f3",
                            borderTop: "2px solid #2196F3",
                            borderRadius: "50%",
                            animation: "spin 1s linear infinite"
                          }}
                        />
                      )}
                    </h4>
                    <div onClick={(e) => e.stopPropagation()}>
                      {renderAttachments(gift)}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedRows.has(gift.id) && (
                  <div style={{
                    borderTop: "1px solid #f0f0f0",
                    backgroundColor: "#f8f9fa",
                    padding: "20px"
                  }}>
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "20px",
                      marginBottom: "20px"
                    }}>
                      <div>
                        <h4 style={{ margin: "0 0 12px", fontSize: "16px", color: "#495057" }}>
                          Additional Details
                        </h4>
                        <div style={{ fontSize: "13px", lineHeight: "1.5" }}>
                          <p style={{ margin: "6px 0" }}>
                            <strong>Acknowledgement Status:</strong>{" "}
                            {gift.acknowledgement_status || "N/A"}
                          </p>
                          <p style={{ margin: "6px 0" }}>
                            <strong>Acknowledgement Date:</strong>{" "}
                            {formatDate(gift.acknowledgement_date)}
                          </p>
                          <p style={{ margin: "6px 0" }}>
                            <strong>Receipt Amount:</strong>{" "}
                            {formatCurrency(gift.receipt_amount)}
                          </p>
                          <p style={{ margin: "6px 0" }}>
                            <strong>Receipt Date:</strong>{" "}
                            {formatDate(gift.receipt_date)}
                          </p>
                          <p style={{ margin: "6px 0" }}>
                            <strong>Batch #:</strong>{" "}
                            {gift.batch_number || "N/A"}
                          </p>
                          <p style={{ margin: "6px 0" }}>
                            <strong>Reference:</strong>{" "}
                            {gift.reference || "N/A"}
                          </p>
                          <p style={{ margin: "6px 0" }}>
                            <strong>Gift Aid Status:</strong>{" "}
                            {gift.gift_aid_qualification_status || "N/A"}
                          </p>
                          <p style={{ margin: "6px 0" }}>
                            <strong>Date Added:</strong>{" "}
                            {formatDate(gift.date_added)}
                          </p>
                          <p style={{ margin: "6px 0" }}>
                            <strong>Date Modified:</strong>{" "}
                            {formatDate(gift.date_modified)}
                          </p>
                        </div>
                      </div>
                      <div>
                        <h4 style={{ margin: "0 0 12px", fontSize: "16px", color: "#495057" }}>
                          Payments & Soft Credits
                        </h4>
                        <div style={{ fontSize: "13px", lineHeight: "1.5" }}>
                          {gift.payments && gift.payments.length > 0 ? (
                            <div>
                              <strong>Payments:</strong>
                              {gift.payments.map((payment: GiftPayment, index: number) => (
                                <div
                                  key={index}
                                  style={{
                                    marginLeft: "10px",
                                    marginTop: "4px",
                                    padding: "6px",
                                    backgroundColor: "white",
                                    borderRadius: "4px",
                                    border: "1px solid #e9ecef"
                                  }}
                                >
                                  • Method: {payment.payment_method || "N/A"}
                                  <br />• Check #: {payment.check_number || "N/A"}
                                  <br />• Date: {formatDate(payment.check_date)}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p style={{ margin: "6px 0" }}>No payment details available</p>
                          )}

                          {gift.soft_credits && gift.soft_credits.length > 0 && (
                            <div style={{ marginTop: "12px" }}>
                              <strong>Soft Credits:</strong>
                              {gift.soft_credits.map((credit: SoftCredit, index: number) => (
                                <div
                                  key={index}
                                  style={{
                                    marginLeft: "10px",
                                    marginTop: "4px",
                                    padding: "6px",
                                    backgroundColor: "white",
                                    borderRadius: "4px",
                                    border: "1px solid #e9ecef"
                                  }}
                                >
                                  • {credit.constituent.name}: {formatCurrency(credit.amount)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Load More Button */}
          {nextLink && !loading && (
            <div style={{ textAlign: "center", marginTop: "20px" }}>
              <button
                onClick={loadMoreGifts}
                disabled={loadingMore}
                style={{
                  padding: "12px 24px",
                  backgroundColor: loadingMore ? "#6c757d" : "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: loadingMore ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  margin: "0 auto"
                }}
              >
                {loadingMore ? (
                  <>
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        border: "2px solid #ffffff",
                        borderTop: "2px solid transparent",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite"
                      }}
                    />
                    Loading More...
                  </>
                ) : (
                  "Load More Gifts"
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GiftList;
