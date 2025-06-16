import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import authService from "../services/authService";

// Define types for List API
interface List {
  id: string;
  name: string;
  description?: string;
  type?: string;
  status?: string;
  date_created?: string;
  date_modified?: string;
  created_by?: string;
  modified_by?: string;
  constituent_count?: number;
  [key: string]: any;
}

interface ListsResponse {
  count: number;
  value: List[];
  next_link?: string;
}

type SortDirection = 'asc' | 'desc' | null;

interface Filters {
  type: string;
  status: string;
  listType: string;
}

const Lists: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<string | null>(searchParams.get('sortColumn'));
  const [sortDirection, setSortDirection] = useState<SortDirection>(searchParams.get('sortDirection') as SortDirection);
  const [filters, setFilters] = useState<Filters>({
    type: searchParams.get('type') || '',
    status: searchParams.get('status') || '',
    listType: searchParams.get('listType') || 'Gift'
  });
  const [nextLink, setNextLink] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Available list types based on Blackbaud API documentation
  const availableListTypes = [
    { value: '', label: 'All Types' },
    { value: 'Constituent', label: 'Constituent' },
    { value: 'Gift', label: 'Gift' },
    { value: 'Action', label: 'Action' },
    { value: 'Opportunity', label: 'Opportunity' },
    { value: 'Event', label: 'Event' },
    { value: 'Education', label: 'Education' },
    { value: 'Relationship', label: 'Relationship' },
    { value: 'Membership', label: 'Membership' },
    { value: 'Campaign', label: 'Campaign' },
    { value: 'Fund', label: 'Fund' },
    { value: 'Appeal', label: 'Appeal' }
  ];

  useEffect(() => {
    fetchLists();
  }, []);

  // Refetch lists when list type filter changes
  useEffect(() => {
    if (filters.listType !== '') {
      fetchLists();
    }
  }, [filters.listType]);

  const fetchLists = async (reset: boolean = true): Promise<void> => {
    try {
      if (reset) {
        setLoading(true);
        setError(null);
        setLists([]);
        setNextLink(null);
      } else {
        setLoadingMore(true);
      }

      // Get lists from the auth service
      const response: ListsResponse = await authService.getLists(50, filters.listType || undefined);
      
      if (reset) {
        setLists(response.value || []);
      } else {
        setLists(prev => [...prev, ...(response.value || [])]);
      }
      
      setNextLink(response.next_link || null);
      setTotalCount(response.count || 0);

    } catch (err: any) {
      console.error("Failed to fetch lists:", err);
      setError(
        err.message || "Failed to fetch lists from Blackbaud API"
      );
    } finally {
      if (reset) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  };

  const loadMoreLists = async (): Promise<void> => {
    if (!nextLink || loadingMore) return;
    
    try {
      setLoadingMore(true);
      setError(null);

      // Use the next_link URL to fetch more lists
      const response: ListsResponse = await authService.apiRequestUrl(nextLink);
      
      setLists(prev => [...prev, ...(response.value || [])]);
      setNextLink(response.next_link || null);
      setTotalCount(response.count || 0);
    } catch (err: any) {
      console.error("Failed to load more lists:", err);
      setError(
        err.message || "Failed to load more lists from Blackbaud API"
      );
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

  const getSortValue = (list: List, column: string): any => {
    switch (column) {
      case 'id':
        return list.id;
      case 'name':
        return list.name || '';
      case 'type':
        return list.type || '';
      case 'status':
        return list.status || '';
      case 'description':
        return list.description || '';
      case 'constituent_count':
        return list.constituent_count || 0;
      case 'date_created':
        return list.date_created ? new Date(list.date_created).getTime() : 0;
      case 'date_modified':
        return list.date_modified ? new Date(list.date_modified).getTime() : 0;
      case 'created_by':
        return list.created_by || '';
      case 'modified_by':
        return list.modified_by || '';
      default:
        return '';
    }
  };

  const filteredLists = React.useMemo(() => {
    return lists.filter(list => {
      const typeMatch = !filters.type || (list.type && list.type.toLowerCase().includes(filters.type.toLowerCase()));
      const statusMatch = !filters.status || (list.status && list.status.toLowerCase().includes(filters.status.toLowerCase()));
      
      return typeMatch && statusMatch;
    });
  }, [lists, filters]);

  const sortedLists = React.useMemo(() => {
    if (!sortColumn || !sortDirection) {
      return filteredLists;
    }

    return [...filteredLists].sort((a, b) => {
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
  }, [filteredLists, sortColumn, sortDirection]);

  const getSortIndicator = (column: string): string => {
    if (sortColumn !== column) return '';
    if (sortDirection === 'asc') return ' ↑';
    if (sortDirection === 'desc') return ' ↓';
    return '';
  };

  const uniqueTypes = React.useMemo(() => {
    const types = lists
      .map(list => list.type)
      .filter(type => type && type.trim() !== '')
      .map(type => type as string);
    return Array.from(new Set(types)).sort();
  }, [lists]);

  const uniqueStatuses = React.useMemo(() => {
    const statuses = lists
      .map(list => list.status)
      .filter(status => status && status.trim() !== '')
      .map(status => status as string);
    return Array.from(new Set(statuses)).sort();
  }, [lists]);

  // Update URL parameters when filters change
  const updateUrlParams = (newFilters: Filters, newSortColumn?: string | null, newSortDirection?: SortDirection) => {
    const params = new URLSearchParams();
    
    // Add filters to URL
    if (newFilters.type) params.set('type', newFilters.type);
    if (newFilters.status) params.set('status', newFilters.status);
    if (newFilters.listType) params.set('listType', newFilters.listType);
    
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
      listType: ''
    };
    setFilters(newFilters);
    updateUrlParams(newFilters, sortColumn, sortDirection);
  };

  const toggleRowExpansion = (listId: string): void => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(listId)) {
      newExpanded.delete(listId);
    } else {
      newExpanded.add(listId);
    }
    setExpandedRows(newExpanded);
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  };

  const handleViewGifts = (listId: string): void => {
    // Navigate to gifts tab with list_id filter
    navigate(`/dashboard/gifts?list_id=${encodeURIComponent(listId)}`);
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

  const tableStyle: React.CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
    backgroundColor: "white",
    borderRadius: "8px",
    overflow: "hidden",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  };

  const thStyle: React.CSSProperties = {
    backgroundColor: "#f8f9fa",
    padding: "12px 8px",
    textAlign: "left",
    fontWeight: "bold",
    borderBottom: "2px solid #dee2e6",
    position: "sticky",
    top: 0,
    zIndex: 10,
    cursor: "pointer",
    userSelect: "none",
    transition: "background-color 0.2s",
  };

  const thHoverStyle: React.CSSProperties = {
    backgroundColor: "#e9ecef",
  };

  const tdStyle: React.CSSProperties = {
    padding: "12px 8px",
    borderBottom: "1px solid #dee2e6",
    verticalAlign: "top",
  };

  const expandButtonStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "16px",
    color: "#0066cc",
    padding: "4px",
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
          <p>Loading lists from Blackbaud API...</p>
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
          <h2>📝 Blackbaud Lists</h2>
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
          <h3>⚠️ Error Loading Lists</h3>
          <p>{error}</p>
          <button
            onClick={() => fetchLists()}
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
        <h2>📝 Blackbaud Lists ({sortedLists.length} of {totalCount.toLocaleString()})</h2>
        <button
          onClick={() => fetchLists()}
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

      {/* Filter Controls */}
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
          <label style={{ fontWeight: "bold", fontSize: "14px" }}>List Type:</label>
          <select
            value={filters.listType}
            onChange={(e) => handleFilterChange('listType', e.target.value)}
            style={{
              padding: "6px 10px",
              border: "1px solid #ced4da",
              borderRadius: "4px",
              fontSize: "14px",
              minWidth: "140px"
            }}
          >
            {availableListTypes.map(listType => (
              <option key={listType.value} value={listType.value}>{listType.label}</option>
            ))}
          </select>
        </div>

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

        {(filters.type || filters.status || filters.listType) && (
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
          {sortedLists.length !== totalCount && (
            <span>Showing {sortedLists.length} of {totalCount.toLocaleString()} lists</span>
          )}
        </div>
      </div>

      {lists.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
          <p>No lists found in your Blackbaud account.</p>
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, cursor: 'default' }}>Actions</th>
                  <th style={{ ...thStyle, cursor: 'default' }}>Gifts</th>
                  <th 
                    style={thStyle} 
                    onClick={() => handleSort('id')}
                    onMouseEnter={(e) => Object.assign(e.currentTarget.style, thHoverStyle)}
                    onMouseLeave={(e) => Object.assign(e.currentTarget.style, thStyle)}
                  >
                    ID{getSortIndicator('id')}
                  </th>
                  <th 
                    style={thStyle} 
                    onClick={() => handleSort('name')}
                    onMouseEnter={(e) => Object.assign(e.currentTarget.style, thHoverStyle)}
                    onMouseLeave={(e) => Object.assign(e.currentTarget.style, thStyle)}
                  >
                    Name{getSortIndicator('name')}
                  </th>
                  <th 
                    style={thStyle} 
                    onClick={() => handleSort('description')}
                    onMouseEnter={(e) => Object.assign(e.currentTarget.style, thHoverStyle)}
                    onMouseLeave={(e) => Object.assign(e.currentTarget.style, thStyle)}
                  >
                    Description{getSortIndicator('description')}
                  </th>
                  <th 
                    style={thStyle} 
                    onClick={() => handleSort('type')}
                    onMouseEnter={(e) => Object.assign(e.currentTarget.style, thHoverStyle)}
                    onMouseLeave={(e) => Object.assign(e.currentTarget.style, thStyle)}
                  >
                    Type{getSortIndicator('type')}
                  </th>
                  <th 
                    style={thStyle} 
                    onClick={() => handleSort('status')}
                    onMouseEnter={(e) => Object.assign(e.currentTarget.style, thHoverStyle)}
                    onMouseLeave={(e) => Object.assign(e.currentTarget.style, thStyle)}
                  >
                    Status{getSortIndicator('status')}
                  </th>
                  <th 
                    style={thStyle} 
                    onClick={() => handleSort('constituent_count')}
                    onMouseEnter={(e) => Object.assign(e.currentTarget.style, thHoverStyle)}
                    onMouseLeave={(e) => Object.assign(e.currentTarget.style, thStyle)}
                  >
                    Count{getSortIndicator('constituent_count')}
                  </th>
                  <th 
                    style={thStyle} 
                    onClick={() => handleSort('date_created')}
                    onMouseEnter={(e) => Object.assign(e.currentTarget.style, thHoverStyle)}
                    onMouseLeave={(e) => Object.assign(e.currentTarget.style, thStyle)}
                  >
                    Created{getSortIndicator('date_created')}
                  </th>
                  <th 
                    style={thStyle} 
                    onClick={() => handleSort('date_modified')}
                    onMouseEnter={(e) => Object.assign(e.currentTarget.style, thHoverStyle)}
                    onMouseLeave={(e) => Object.assign(e.currentTarget.style, thStyle)}
                  >
                    Modified{getSortIndicator('date_modified')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedLists.map((list) => (
                  <React.Fragment key={list.id}>
                    <tr>
                      <td style={tdStyle}>
                        <button
                          style={expandButtonStyle}
                          onClick={() => toggleRowExpansion(list.id)}
                          title="Toggle details"
                        >
                          {expandedRows.has(list.id) ? "▼" : "▶"}
                        </button>
                      </td>
                      <td style={tdStyle}>
                        <button
                          onClick={() => handleViewGifts(list.id)}
                          style={{
                            padding: "4px 8px",
                            backgroundColor: "#28a745",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px"
                          }}
                          title={`View gifts for ${list.name}`}
                        >
                          🎁 View Gifts
                        </button>
                      </td>
                      <td style={tdStyle}>{list.id}</td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: "bold" }}>
                          {list.name || "N/A"}
                        </div>
                      </td>
                      <td style={tdStyle}>{list.description || "N/A"}</td>
                      <td style={tdStyle}>{list.type || "N/A"}</td>
                      <td style={tdStyle}>{list.status || "N/A"}</td>
                      <td style={tdStyle}>{list.constituent_count?.toLocaleString() || "N/A"}</td>
                      <td style={tdStyle}>{formatDate(list.date_created)}</td>
                      <td style={tdStyle}>{formatDate(list.date_modified)}</td>
                    </tr>
                    {expandedRows.has(list.id) && (
                      <tr>
                        <td
                          colSpan={10}
                          style={{
                            ...tdStyle,
                            backgroundColor: "#f8f9fa",
                            padding: "20px",
                          }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: "20px",
                            }}
                          >
                            <div>
                              <h4>List Details</h4>
                              <p>
                                <strong>Created By:</strong>{" "}
                                {list.created_by || "N/A"}
                              </p>
                              <p>
                                <strong>Modified By:</strong>{" "}
                                {list.modified_by || "N/A"}
                              </p>
                              <p>
                                <strong>Date Created:</strong>{" "}
                                {formatDate(list.date_created)}
                              </p>
                              <p>
                                <strong>Date Modified:</strong>{" "}
                                {formatDate(list.date_modified)}
                              </p>
                            </div>
                            <div>
                              <h4>Additional Information</h4>
                              {Object.entries(list)
                                .filter(([key, value]) => 
                                  !['id', 'name', 'description', 'type', 'status', 'constituent_count', 'date_created', 'date_modified', 'created_by', 'modified_by'].includes(key) &&
                                  value !== null && 
                                  value !== undefined && 
                                  value !== ''
                                )
                                .map(([key, value]) => (
                                  <p key={key}>
                                    <strong>{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</strong>{" "}
                                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                  </p>
                                ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Load More Button */}
          {nextLink && !loading && (
            <div style={{ textAlign: "center", marginTop: "20px" }}>
              <button
                onClick={loadMoreLists}
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
                  "Load More Lists"
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Lists; 