import React, { useState, useEffect } from "react";
import authService from "../services/authService";

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
  date?: string;
  [key: string]: any;
}

interface GiftListResponse {
  count: number;
  value: Gift[];
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

const GiftList: React.FC = () => {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  useEffect(() => {
    fetchGifts();
  }, []);

  const fetchGifts = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // Use the convenience method from auth service
      const response = await authService.getGifts(50);
      setGifts(response.value || []);
    } catch (err: any) {
      console.error("Failed to fetch gifts:", err);
      setError(
        err.message || "Failed to fetch gifts from Blackbaud API"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (column: string): void => {
    if (sortColumn === column) {
      // Same column clicked - cycle through asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortColumn(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      // New column clicked
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortValue = (gift: Gift, column: string): any => {
    switch (column) {
      case 'id':
        return gift.id;
      case 'constituent':
        return gift.constituent?.name || '';
      case 'amount':
        return gift.amount?.value || 0;
      case 'date':
        return gift.date ? new Date(gift.date).getTime() : 0;
      case 'type':
        return gift.type || '';
      case 'status':
        return gift.gift_status || '';
      case 'fund':
        return gift.fund?.description || '';
      case 'campaign':
        return gift.campaign?.description || '';
      case 'appeal':
        return gift.appeal?.description || '';
      case 'receipt_amount':
        return gift.receipt_amount?.value || 0;
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
  };

  const sortedGifts = React.useMemo(() => {
    if (!sortColumn || !sortDirection) {
      return gifts;
    }

    return [...gifts].sort((a, b) => {
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
  }, [gifts, sortColumn, sortDirection]);

  const getSortIndicator = (column: string): string => {
    if (sortColumn !== column) return '';
    if (sortDirection === 'asc') return ' ↑';
    if (sortDirection === 'desc') return ' ↓';
    return '';
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

  const handleImageError = (attachmentId: string): void => {
    setImageErrors((prev) => new Set(Array.from(prev).concat(attachmentId)));
  };

  const renderAttachments = (attachments?: GiftAttachment[]): JSX.Element => {
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
                {attachment.name}
              </div>

              {attachment.type && (
                <div style={{ color: "#666", marginBottom: "4px" }}>
                  Type: {attachment.type}
                </div>
              )}

              {attachment.date && (
                <div style={{ color: "#666", marginBottom: "4px" }}>
                  Date: {formatDate(attachment.date)}
                </div>
              )}

              {shouldShowAsImage ? (
                <div style={{ marginTop: "6px" }}>
                  <img
                    src={attachment.url}
                    alt={attachment.name}
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
            onClick={fetchGifts}
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
        <h2>🎁 Blackbaud Gifts ({gifts.length})</h2>
        <button
          onClick={fetchGifts}
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

      {gifts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
          <p>No gifts found in your Blackbaud account.</p>
        </div>
      ) : (
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
                  onClick={() => handleSort('constituent')}
                  onMouseEnter={(e) => Object.assign(e.currentTarget.style, thHoverStyle)}
                  onMouseLeave={(e) => Object.assign(e.currentTarget.style, thStyle)}
                >
                  Constituent{getSortIndicator('constituent')}
                </th>
                <th 
                  style={thStyle} 
                  onClick={() => handleSort('amount')}
                  onMouseEnter={(e) => Object.assign(e.currentTarget.style, thHoverStyle)}
                  onMouseLeave={(e) => Object.assign(e.currentTarget.style, thStyle)}
                >
                  Amount{getSortIndicator('amount')}
                </th>
                <th 
                  style={thStyle} 
                  onClick={() => handleSort('date')}
                  onMouseEnter={(e) => Object.assign(e.currentTarget.style, thHoverStyle)}
                  onMouseLeave={(e) => Object.assign(e.currentTarget.style, thStyle)}
                >
                  Date{getSortIndicator('date')}
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
                  onClick={() => handleSort('fund')}
                  onMouseEnter={(e) => Object.assign(e.currentTarget.style, thHoverStyle)}
                  onMouseLeave={(e) => Object.assign(e.currentTarget.style, thStyle)}
                >
                  Fund{getSortIndicator('fund')}
                </th>
                <th 
                  style={thStyle} 
                  onClick={() => handleSort('campaign')}
                  onMouseEnter={(e) => Object.assign(e.currentTarget.style, thHoverStyle)}
                  onMouseLeave={(e) => Object.assign(e.currentTarget.style, thStyle)}
                >
                  Campaign{getSortIndicator('campaign')}
                </th>
                <th 
                  style={thStyle} 
                  onClick={() => handleSort('appeal')}
                  onMouseEnter={(e) => Object.assign(e.currentTarget.style, thHoverStyle)}
                  onMouseLeave={(e) => Object.assign(e.currentTarget.style, thStyle)}
                >
                  Appeal{getSortIndicator('appeal')}
                </th>
                <th 
                  style={thStyle} 
                  onClick={() => handleSort('receipt_amount')}
                  onMouseEnter={(e) => Object.assign(e.currentTarget.style, thHoverStyle)}
                  onMouseLeave={(e) => Object.assign(e.currentTarget.style, thStyle)}
                >
                  Receipt Amount{getSortIndicator('receipt_amount')}
                </th>
                <th 
                  style={thStyle} 
                  onClick={() => handleSort('receipt_date')}
                  onMouseEnter={(e) => Object.assign(e.currentTarget.style, thHoverStyle)}
                  onMouseLeave={(e) => Object.assign(e.currentTarget.style, thStyle)}
                >
                  Receipt Date{getSortIndicator('receipt_date')}
                </th>
                <th 
                  style={thStyle} 
                  onClick={() => handleSort('batch_number')}
                  onMouseEnter={(e) => Object.assign(e.currentTarget.style, thHoverStyle)}
                  onMouseLeave={(e) => Object.assign(e.currentTarget.style, thStyle)}
                >
                  Batch #{getSortIndicator('batch_number')}
                </th>
                <th 
                  style={thStyle} 
                  onClick={() => handleSort('reference')}
                  onMouseEnter={(e) => Object.assign(e.currentTarget.style, thHoverStyle)}
                  onMouseLeave={(e) => Object.assign(e.currentTarget.style, thStyle)}
                >
                  Reference{getSortIndicator('reference')}
                </th>
                <th 
                  style={thStyle} 
                  onClick={() => handleSort('anonymous')}
                  onMouseEnter={(e) => Object.assign(e.currentTarget.style, thHoverStyle)}
                  onMouseLeave={(e) => Object.assign(e.currentTarget.style, thStyle)}
                >
                  Anonymous{getSortIndicator('anonymous')}
                </th>
                <th 
                  style={thStyle} 
                  onClick={() => handleSort('attachments')}
                  onMouseEnter={(e) => Object.assign(e.currentTarget.style, thHoverStyle)}
                  onMouseLeave={(e) => Object.assign(e.currentTarget.style, thStyle)}
                >
                  Attachments{getSortIndicator('attachments')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedGifts.map((gift) => (
                <React.Fragment key={gift.id}>
                  <tr>
                    <td style={tdStyle}>
                      <button
                        style={expandButtonStyle}
                        onClick={() => toggleRowExpansion(gift.id)}
                        title="Toggle details"
                      >
                        {expandedRows.has(gift.id) ? "▼" : "▶"}
                      </button>
                    </td>
                    <td style={tdStyle}>{gift.id}</td>
                    <td style={tdStyle}>
                      {gift.constituent ? (
                        <div>
                          <div style={{ fontWeight: "bold" }}>
                            {gift.constituent.name}
                          </div>
                          {gift.constituent.lookup_id && (
                            <div style={{ fontSize: "12px", color: "#666" }}>
                              ID: {gift.constituent.lookup_id}
                            </div>
                          )}
                        </div>
                      ) : (
                        "N/A"
                      )}
                    </td>
                    <td style={tdStyle}>{formatCurrency(gift.amount)}</td>
                    <td style={tdStyle}>{formatDate(gift.date)}</td>
                    <td style={tdStyle}>
                      <div>{gift.type || "N/A"}</div>
                      {gift.subtype && (
                        <div style={{ fontSize: "12px", color: "#666" }}>
                          {gift.subtype}
                        </div>
                      )}
                    </td>
                    <td style={tdStyle}>{gift.gift_status || "N/A"}</td>
                    <td style={tdStyle}>{gift.fund?.description || "N/A"}</td>
                    <td style={tdStyle}>
                      {gift.campaign?.description || "N/A"}
                    </td>
                    <td style={tdStyle}>{gift.appeal?.description || "N/A"}</td>
                    <td style={tdStyle}>
                      {formatCurrency(gift.receipt_amount)}
                    </td>
                    <td style={tdStyle}>{formatDate(gift.receipt_date)}</td>
                    <td style={tdStyle}>{gift.batch_number || "N/A"}</td>
                    <td style={tdStyle}>{gift.reference || "N/A"}</td>
                    <td style={tdStyle}>{gift.is_anonymous ? "Yes" : "No"}</td>
                    <td style={tdStyle}>
                      {renderAttachments(gift.attachments)}
                    </td>
                  </tr>
                  {expandedRows.has(gift.id) && (
                    <tr>
                      <td
                        colSpan={16}
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
                            <h4>Additional Details</h4>
                            <p>
                              <strong>Acknowledgement Status:</strong>{" "}
                              {gift.acknowledgement_status || "N/A"}
                            </p>
                            <p>
                              <strong>Acknowledgement Date:</strong>{" "}
                              {formatDate(gift.acknowledgement_date)}
                            </p>
                            <p>
                              <strong>Gift Aid Status:</strong>{" "}
                              {gift.gift_aid_qualification_status || "N/A"}
                            </p>
                            <p>
                              <strong>Date Added:</strong>{" "}
                              {formatDate(gift.date_added)}
                            </p>
                            <p>
                              <strong>Date Modified:</strong>{" "}
                              {formatDate(gift.date_modified)}
                            </p>
                          </div>
                          <div>
                            <h4>Payments & Soft Credits</h4>
                            {gift.payments && gift.payments.length > 0 ? (
                              <div>
                                <strong>Payments:</strong>
                                {gift.payments.map((payment: GiftPayment, index: number) => (
                                  <div
                                    key={index}
                                    style={{
                                      marginLeft: "10px",
                                      fontSize: "12px",
                                    }}
                                  >
                                    • Method: {payment.payment_method || "N/A"}
                                    <br />• Check #:{" "}
                                    {payment.check_number || "N/A"}
                                    <br />• Date:{" "}
                                    {formatDate(payment.check_date)}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p>No payment details available</p>
                            )}

                            {gift.soft_credits &&
                              gift.soft_credits.length > 0 && (
                                <div style={{ marginTop: "10px" }}>
                                  <strong>Soft Credits:</strong>
                                  {gift.soft_credits.map((credit: SoftCredit, index: number) => (
                                    <div
                                      key={index}
                                      style={{
                                        marginLeft: "10px",
                                        fontSize: "12px",
                                      }}
                                    >
                                      • {credit.constituent.name}:{" "}
                                      {formatCurrency(credit.amount)}
                                    </div>
                                  ))}
                                </div>
                              )}
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
      )}
    </div>
  );
};

export default GiftList;
