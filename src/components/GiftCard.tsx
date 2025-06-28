import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import ConstituentInfo from "./ConstituentInfo";
import AttachmentsSection from "./AttachmentsSection";

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
  attachments?: any[];
  is_anonymous?: boolean;
  [key: string]: any;
}

interface GiftCardProps {
  gift: Gift;
  expandedRows?: Set<string>;
  onToggleExpansion?: (giftId: string) => void;
  onHandlePdfLoaded: (pdfId: string) => void;
  onHandleImageError: (attachmentId: string) => void;
  formatCurrency: (amount?: { value: number; currency?: string }) => string;
  formatDate: (dateString?: string) => string;
  zoomLevel?: number;
  cardNumber?: number;
  totalCount?: number;
  isScrolling?: boolean;
}

const GiftCard: React.FC<GiftCardProps> = React.memo(({
  gift,
  expandedRows,
  onToggleExpansion,
  onHandlePdfLoaded,
  onHandleImageError,
  formatCurrency,
  formatDate,
  zoomLevel = 500,
  cardNumber,
  totalCount,
  isScrolling = false
}) => {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);

  const handleCardClick = () => {
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <>
      <div
        key={gift.id}
        data-gift-id={gift.id}
        className="gift-card"
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
          border: "1px solid #e9ecef",
          overflow: "hidden",
          cursor: "pointer",
          minHeight: "200px",
          width: "100%",
          maxWidth: "100%"
        }}
        onClick={handleCardClick}
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
              <h3 className="constituent-name" style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: "bold",
                color: "#2c3e50",
                marginBottom: "4px",
                height: "24px",
                lineHeight: "24px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}>
                <ConstituentInfo
                  constituentId={gift.constituent_id}
                  isScrolling={isScrolling}
                />
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
              {/* Card Number Badge */}
              {cardNumber && totalCount && (
                <span style={{
                  backgroundColor: "#17a2b8",
                  color: "white",
                  padding: "3px 6px",
                  borderRadius: "10px",
                  fontSize: "10px",
                  fontWeight: "bold",
                  minWidth: "40px",
                  textAlign: "center"
                }}>
                  #{cardNumber}/{totalCount}
                </span>
              )}
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
              <span style={{
                backgroundColor: "#6c757d",
                color: "white",
                padding: "2px 6px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: "bold"
              }}>
                ▶
              </span>
            </div>
          </div>
        </div>

        {/* Card Content */}
        <div style={{ padding: "16px 20px" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
            marginBottom: "16px"
          }}>
            <div>
              <p style={{ margin: "0 0 8px", fontSize: "14px", color: "#666" }}>
                <strong>{t('giftList.columns.amount')}:</strong> {formatCurrency(gift.amount)}
              </p>
              <p style={{ margin: "0 0 8px", fontSize: "14px", color: "#666" }}>
                <strong>{t('giftList.columns.date')}:</strong> {formatDate(gift.date)}
              </p>
              <p style={{ margin: "0 0 8px", fontSize: "14px", color: "#666" }}>
                <strong>{t('giftList.columns.type')}:</strong> {gift.type || "N/A"}
              </p>
            </div>
            <div>
              <p style={{ margin: "0 0 8px", fontSize: "14px", color: "#666" }}>
                <strong>{t('giftList.columns.status')}:</strong> {gift.gift_status || "N/A"}
              </p>
              <p style={{ margin: "0 0 8px", fontSize: "14px", color: "#666" }}>
                <strong>{t('giftList.columns.subtype')}:</strong> {gift.subtype || "N/A"}
              </p>
              <p style={{ margin: "0 0 8px", fontSize: "14px", color: "#666" }}>
                <strong>{t('giftList.columns.designation')}:</strong> {gift.designation || "N/A"}
              </p>
            </div>
          </div>

          {/* Attachments Section - Compact view */}
          <div onClick={(e) => e.stopPropagation()}>
            <AttachmentsSection
              giftId={gift.id}
              isExpanded={true}
              onHandlePdfLoaded={onHandlePdfLoaded}
              onHandleImageError={onHandleImageError}
              zoomLevel={zoomLevel}
              isScrolling={isScrolling}
            />
          </div>
        </div>
      </div>

      {/* Full Window Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          onClick={handleCloseModal}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              maxWidth: "90vw",
              maxHeight: "90vh",
              width: "100%",
              overflow: "auto",
              position: "relative",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)"
            }}
            onClick={handleModalClick}
          >
            {/* Modal Header */}
            <div style={{
              padding: "24px 32px 16px",
              borderBottom: "2px solid #f0f0f0",
              backgroundColor: "#f8f9fa",
              position: "sticky",
              top: 0,
              zIndex: 1
            }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start"
              }}>
                <div style={{ flex: 1 }}>
                  <h2 style={{
                    margin: 0,
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "#2c3e50",
                    marginBottom: "8px"
                  }}>
                    <ConstituentInfo
                      constituentId={gift.constituent_id}
                      isScrolling={false}
                    />
                  </h2>
                  <p style={{
                    margin: "4px 0 0",
                    fontSize: "14px",
                    color: "#6c757d",
                    fontFamily: "monospace"
                  }}>
                    Gift ID: {gift.id}
                  </p>
                </div>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px"
                }}>
                  {/* Card Number Badge */}
                  {cardNumber && totalCount && (
                    <span style={{
                      backgroundColor: "#17a2b8",
                      color: "white",
                      padding: "6px 12px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      minWidth: "60px",
                      textAlign: "center"
                    }}>
                      #{cardNumber}/{totalCount}
                    </span>
                  )}
                  {gift.is_anonymous && (
                    <span style={{
                      backgroundColor: "#ffc107",
                      color: "#212529",
                      padding: "4px 8px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: "bold"
                    }}>
                      ANONYMOUS
                    </span>
                  )}
                  <button
                    onClick={handleCloseModal}
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: "24px",
                      cursor: "pointer",
                      color: "#6c757d",
                      padding: "4px",
                      borderRadius: "4px",
                      transition: "background-color 0.2s"
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#e9ecef"}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                    title="Close"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div style={{ padding: "32px" }}>
              {/* Basic Information */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "32px",
                marginBottom: "32px"
              }}>
                <div>
                  <h3 style={{ margin: "0 0 16px", fontSize: "18px", color: "#495057" }}>
                    Basic Information
                  </h3>
                  <div style={{ fontSize: "16px", lineHeight: "1.6" }}>
                    <p style={{ margin: "8px 0" }}>
                      <strong>{t('giftList.columns.amount')}:</strong> {formatCurrency(gift.amount)}
                    </p>
                    <p style={{ margin: "8px 0" }}>
                      <strong>{t('giftList.columns.date')}:</strong> {formatDate(gift.date)}
                    </p>
                    <p style={{ margin: "8px 0" }}>
                      <strong>{t('giftList.columns.type')}:</strong> {gift.type || "N/A"}
                    </p>
                    <p style={{ margin: "8px 0" }}>
                      <strong>{t('giftList.columns.status')}:</strong> {gift.gift_status || "N/A"}
                    </p>
                    <p style={{ margin: "8px 0" }}>
                      <strong>{t('giftList.columns.subtype')}:</strong> {gift.subtype || "N/A"}
                    </p>
                    <p style={{ margin: "8px 0" }}>
                      <strong>{t('giftList.columns.designation')}:</strong> {gift.designation || "N/A"}
                    </p>
                  </div>
                </div>
                <div>
                  <h3 style={{ margin: "0 0 16px", fontSize: "18px", color: "#495057" }}>
                    Additional Details
                  </h3>
                  <div style={{ fontSize: "16px", lineHeight: "1.6" }}>
                    <p style={{ margin: "8px 0" }}>
                      <strong>{t('giftList.details.acknowledgementStatus')}:</strong>{" "}
                      {gift.acknowledgement_status || "N/A"}
                    </p>
                    <p style={{ margin: "8px 0" }}>
                      <strong>{t('giftList.details.acknowledgementDate')}:</strong>{" "}
                      {formatDate(gift.acknowledgement_date)}
                    </p>
                    <p style={{ margin: "8px 0" }}>
                      <strong>{t('giftList.details.receiptAmount')}:</strong>{" "}
                      {formatCurrency(gift.receipt_amount)}
                    </p>
                    <p style={{ margin: "8px 0" }}>
                      <strong>{t('giftList.details.receiptDate')}:</strong>{" "}
                      {formatDate(gift.receipt_date)}
                    </p>
                    <p style={{ margin: "8px 0" }}>
                      <strong>{t('giftList.details.batchNumber')}:</strong>{" "}
                      {gift.batch_number || "N/A"}
                    </p>
                    <p style={{ margin: "8px 0" }}>
                      <strong>{t('giftList.details.reference')}:</strong>{" "}
                      {gift.reference || "N/A"}
                    </p>
                    <p style={{ margin: "8px 0" }}>
                      <strong>{t('giftList.details.giftAidStatus')}:</strong>{" "}
                      {gift.gift_aid_qualification_status || "N/A"}
                    </p>
                    <p style={{ margin: "8px 0" }}>
                      <strong>{t('giftList.details.dateAdded')}:</strong>{" "}
                      {formatDate(gift.date_added)}
                    </p>
                    <p style={{ margin: "8px 0" }}>
                      <strong>{t('giftList.details.dateModified')}:</strong>{" "}
                      {formatDate(gift.date_modified)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Attachments Section - Full view */}
              <div style={{ borderTop: "2px solid #f0f0f0", paddingTop: "32px" }}>
                <AttachmentsSection
                  giftId={gift.id}
                  isExpanded={true}
                  onHandlePdfLoaded={onHandlePdfLoaded}
                  onHandleImageError={onHandleImageError}
                  zoomLevel={zoomLevel}
                  isScrolling={false}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default GiftCard; 