import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import authService from "../services/authService";

// Define types for Query API
interface Query {
  id: string;
  name: string;
  description?: string;
  type?: string;
  category?: string;
  date_created?: string;
  date_modified?: string;
  created_by?: string;
  modified_by?: string;
  record_count?: number;
  [key: string]: any;
}

interface QueriesResponse {
  count: number;
  value: Query[];
  next_link?: string;
}

type SortDirection = 'asc' | 'desc' | null;

interface Filters {
  type: string;
  category: string;
}

const Queries: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [queries, setQueries] = useState<Query[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<string | null>(searchParams.get('sortColumn'));
  const [sortDirection, setSortDirection] = useState<SortDirection>(searchParams.get('sortDirection') as SortDirection);
  const [filters, setFilters] = useState<Filters>({
    type: searchParams.get('type') || '',
    category: searchParams.get('category') || ''
  });
  const [nextLink, setNextLink] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);

  useEffect(() => {
    fetchQueries();
  }, []);

  const fetchQueries = async (reset: boolean = true): Promise<void> => {
    if (reset) {
      setLoading(true);
      setError(null);
      setQueries([]);
      setNextLink(null);
    } else {
      setLoadingMore(true);
    }

    try {
      // Use centralized query handler
      const response: QueriesResponse = await authService.executeQuery(
        () => authService.getQueries(50),
        'fetching queries',
        (errorMsg) => setError(errorMsg)
      );
      
      if (reset) {
        setQueries(response.value || []);
      } else {
        setQueries(prev => [...prev, ...(response.value || [])]);
      }
      
      setNextLink(response.next_link || null);
      setTotalCount(response.count || 0);
    } catch (err: any) {
      // Error is already handled by executeQuery, but we still need to catch it
      console.error("Failed to fetch queries:", err);
    } finally {
      if (reset) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  };

  const loadMoreQueries = async (): Promise<void> => {
    if (!nextLink || loadingMore) return;
    
    setLoadingMore(true);
    setError(null);

    try {
      // Use centralized query handler
      const response: QueriesResponse = await authService.executeQuery(
        () => authService.apiRequestUrl(nextLink),
        'loading more queries',
        (errorMsg) => setError(errorMsg)
      );
      
      setQueries(prev => [...prev, ...(response.value || [])]);
      setNextLink(response.next_link || null);
      setTotalCount(response.count || 0);
    } catch (err: any) {
      // Error is already handled by executeQuery, but we still need to catch it
      console.error("Failed to load more queries:", err);
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

  const getSortValue = (query: Query, column: string): any => {
    switch (column) {
      case 'id':
        return query.id;
      case 'name':
        return query.name || '';
      case 'type':
        return query.type || '';
      case 'category':
        return query.category || '';
      case 'description':
        return query.description || '';
      case 'record_count':
        return query.record_count || 0;
      case 'date_created':
        return query.date_created ? new Date(query.date_created).getTime() : 0;
      case 'date_modified':
        return query.date_modified ? new Date(query.date_modified).getTime() : 0;
      case 'created_by':
        return query.created_by || '';
      case 'modified_by':
        return query.modified_by || '';
      default:
        return '';
    }
  };

  const filteredQueries = React.useMemo(() => {
    return queries.filter(query => {
      const typeMatch = !filters.type || (query.type && query.type.toLowerCase().includes(filters.type.toLowerCase()));
      const categoryMatch = !filters.category || (query.category && query.category.toLowerCase().includes(filters.category.toLowerCase()));
      
      return typeMatch && categoryMatch;
    });
  }, [queries, filters]);

  const sortedQueries = React.useMemo(() => {
    if (!sortColumn || !sortDirection) {
      return filteredQueries;
    }

    return [...filteredQueries].sort((a, b) => {
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
  }, [filteredQueries, sortColumn, sortDirection]);

  const getSortIndicator = (column: string): string => {
    if (sortColumn !== column) return '';
    if (sortDirection === 'asc') return ' ↑';
    if (sortDirection === 'desc') return ' ↓';
    return '';
  };

  const uniqueTypes = React.useMemo(() => {
    const types = queries
      .map(query => query.type)
      .filter(type => type && type.trim() !== '')
      .map(type => type as string);
    return Array.from(new Set(types)).sort();
  }, [queries]);

  const uniqueCategories = React.useMemo(() => {
    const categories = queries
      .map(query => query.category)
      .filter(category => category && category.trim() !== '')
      .map(category => category as string);
    return Array.from(new Set(categories)).sort();
  }, [queries]);

  // Update URL parameters when filters change
  const updateUrlParams = (newFilters: Filters, newSortColumn?: string | null, newSortDirection?: SortDirection) => {
    const params = new URLSearchParams();
    
    // Add filters to URL
    if (newFilters.type) params.set('type', newFilters.type);
    if (newFilters.category) params.set('category', newFilters.category);
    
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
      category: ''
    };
    setFilters(newFilters);
    updateUrlParams(newFilters, sortColumn, sortDirection);
  };

  const toggleRowExpansion = (queryId: string): void => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(queryId)) {
      newExpanded.delete(queryId);
    } else {
      newExpanded.add(queryId);
    }
    setExpandedRows(newExpanded);
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
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
          <p>Loading queries from Blackbaud API...</p>
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
          <h2>🔍 Blackbaud Queries</h2>
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
          <h3>⚠️ Error Loading Queries</h3>
          <p>{error}</p>
          <button
            onClick={() => fetchQueries()}
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
        <h2>🔍 Blackbaud Queries ({sortedQueries.length} of {totalCount.toLocaleString()})</h2>
        <button
          onClick={() => fetchQueries()}
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
          <label style={{ fontWeight: "bold", fontSize: "14px" }}>Category:</label>
          <select
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            style={{
              padding: "6px 10px",
              border: "1px solid #ced4da",
              borderRadius: "4px",
              fontSize: "14px",
              minWidth: "120px"
            }}
          >
            <option value="">All Categories</option>
            {uniqueCategories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>

        {(filters.type || filters.category) && (
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
          {sortedQueries.length !== totalCount && (
            <span>Showing {sortedQueries.length} of {totalCount.toLocaleString()} queries</span>
          )}
        </div>
      </div>

      {queries.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
          <p>No queries found in your Blackbaud account.</p>
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, cursor: 'default' }}>Actions</th>
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
                    onClick={() => handleSort('category')}
                    onMouseEnter={(e) => Object.assign(e.currentTarget.style, thHoverStyle)}
                    onMouseLeave={(e) => Object.assign(e.currentTarget.style, thStyle)}
                  >
                    Category{getSortIndicator('category')}
                  </th>
                  <th 
                    style={thStyle} 
                    onClick={() => handleSort('record_count')}
                    onMouseEnter={(e) => Object.assign(e.currentTarget.style, thHoverStyle)}
                    onMouseLeave={(e) => Object.assign(e.currentTarget.style, thStyle)}
                  >
                    Records{getSortIndicator('record_count')}
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
                {sortedQueries.map((query) => (
                  <React.Fragment key={query.id}>
                    <tr>
                      <td style={tdStyle}>
                        <button
                          style={expandButtonStyle}
                          onClick={() => toggleRowExpansion(query.id)}
                          title="Toggle details"
                        >
                          {expandedRows.has(query.id) ? "▼" : "▶"}
                        </button>
                      </td>
                      <td style={tdStyle}>{query.id}</td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: "bold" }}>
                          {query.name || "N/A"}
                        </div>
                      </td>
                      <td style={tdStyle}>{query.description || "N/A"}</td>
                      <td style={tdStyle}>{query.type || "N/A"}</td>
                      <td style={tdStyle}>{query.category || "N/A"}</td>
                      <td style={tdStyle}>{query.record_count?.toLocaleString() || "N/A"}</td>
                      <td style={tdStyle}>{formatDate(query.date_created)}</td>
                      <td style={tdStyle}>{formatDate(query.date_modified)}</td>
                    </tr>
                    {expandedRows.has(query.id) && (
                      <tr>
                        <td
                          colSpan={9}
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
                              <h4>Query Details</h4>
                              <p>
                                <strong>Created By:</strong>{" "}
                                {query.created_by || "N/A"}
                              </p>
                              <p>
                                <strong>Modified By:</strong>{" "}
                                {query.modified_by || "N/A"}
                              </p>
                              <p>
                                <strong>Date Created:</strong>{" "}
                                {formatDate(query.date_created)}
                              </p>
                              <p>
                                <strong>Date Modified:</strong>{" "}
                                {formatDate(query.date_modified)}
                              </p>
                            </div>
                            <div>
                              <h4>Additional Information</h4>
                              {Object.entries(query)
                                .filter(([key, value]) => 
                                  !['id', 'name', 'description', 'type', 'category', 'record_count', 'date_created', 'date_modified', 'created_by', 'modified_by'].includes(key) &&
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
                onClick={loadMoreQueries}
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
                  "Load More Queries"
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Queries;