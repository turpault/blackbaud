import React from 'react';
import { useTranslation } from 'react-i18next';
import ConstituentInfo from './ConstituentInfo';
import AttachmentsSection from './AttachmentsSection';

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

interface GiftCardProps {
  gift: Gift;
  expandedRows: Set<string>;
  onToggleExpansion: (giftId: string) => void;
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
  const isExpanded = expandedRows.has(gift.id);

  return (
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
      onClick={() => onToggleExpansion(gift.id)}
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
                onQueueConstituentLoad={() => { }} // Not needed anymore as component handles its own loading
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
              backgroundColor: isExpanded ? "#007bff" : "#6c757d",
              color: "white",
              padding: "2px 6px",
              borderRadius: "12px",
              fontSize: "11px",
              fontWeight: "bold"
            }}>
              {isExpanded ? "▼" : "▶"}
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

        {/* Attachments Section - Now a separate component */}
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

      {/* Expanded Details */}
      {isExpanded && (
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
                {t('giftList.details.additionalDetails')}
              </h4>
              <div style={{ fontSize: "13px", lineHeight: "1.5" }}>
                <p style={{ margin: "6px 0" }}>
                  <strong>{t('giftList.details.acknowledgementStatus')}:</strong>{" "}
                  {gift.acknowledgement_status || "N/A"}
                </p>
                <p style={{ margin: "6px 0" }}>
                  <strong>{t('giftList.details.acknowledgementDate')}:</strong>{" "}
                  {formatDate(gift.acknowledgement_date)}
                </p>
                <p style={{ margin: "6px 0" }}>
                  <strong>{t('giftList.details.receiptAmount')}:</strong>{" "}
                  {formatCurrency(gift.receipt_amount)}
                </p>
                <p style={{ margin: "6px 0" }}>
                  <strong>{t('giftList.details.receiptDate')}:</strong>{" "}
                  {formatDate(gift.receipt_date)}
                </p>
                <p style={{ margin: "6px 0" }}>
                  <strong>{t('giftList.details.batchNumber')}:</strong>{" "}
                  {gift.batch_number || "N/A"}
                </p>
                <p style={{ margin: "6px 0" }}>
                  <strong>{t('giftList.details.reference')}:</strong>{" "}
                  {gift.reference || "N/A"}
                </p>
                <p style={{ margin: "6px 0" }}>
                  <strong>{t('giftList.details.giftAidStatus')}:</strong>{" "}
                  {gift.gift_aid_qualification_status || "N/A"}
                </p>
                <p style={{ margin: "6px 0" }}>
                  <strong>{t('giftList.details.dateAdded')}:</strong>{" "}
                  {formatDate(gift.date_added)}
                </p>
                <p style={{ margin: "6px 0" }}>
                  <strong>{t('giftList.details.dateModified')}:</strong>{" "}
                  {formatDate(gift.date_modified)}
                </p>
              </div>
            </div>
            <div>
              <h4 style={{ margin: "0 0 12px", fontSize: "16px", color: "#495057" }}>
                {t('giftList.details.paymentsAndSoftCredits')}
              </h4>
              <div style={{ fontSize: "13px", lineHeight: "1.5" }}>
                {gift.payments && gift.payments.length > 0 ? (
                  <div>
                    <strong>{t('giftList.details.payments')}:</strong>
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
                        • {t('giftList.details.method')}: {payment.payment_method || "N/A"}
                        <br />• {t('giftList.details.checkNumber')}: {payment.check_number || "N/A"}
                        <br />• {t('giftList.details.checkDate')}: {formatDate(payment.check_date)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: "6px 0" }}>{t('giftList.details.noPaymentDetails')}</p>
                )}

                {gift.soft_credits && gift.soft_credits.length > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <strong>{t('giftList.details.softCredits')}:</strong>
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
  );
});

export default GiftCard; 