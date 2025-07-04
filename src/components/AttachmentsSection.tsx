import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import authService from '../services/authService';
import { getProxiedUrl } from '../utils/corsProxy';

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

interface AttachmentsSectionProps {
  giftId: string;
  isExpanded: boolean;
  onHandlePdfLoaded: (pdfId: string) => void;
  onHandleImageError: (attachmentId: string) => void;
  zoomLevel?: number;
  isScrolling?: boolean;
}

const AttachmentsSection: React.FC<AttachmentsSectionProps> = React.memo(({
  giftId,
  isExpanded,
  onHandlePdfLoaded,
  onHandleImageError,
  zoomLevel = 500,
  isScrolling = false
}) => {
  const { t } = useTranslation();
  const [attachments, setAttachments] = useState<GiftAttachment[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  // Load attachments when component mounts or when expanded, but not during scrolling
  useEffect(() => {
    if (isLoading || isScrolling || attachments) return;

    const loadAttachments = async () => {
      setIsLoading(true);
      try {
        console.log(`📎 Loading attachments for gift ${giftId}`);
        const response = await authService.executeQuery(
          () => authService.getGiftAttachments(giftId),
          `fetching attachments for gift ${giftId}`
        );
        const attachmentList = response.value || [];
        setAttachments(attachmentList);
        console.log(`✅ Loaded ${attachmentList.length} attachments for gift ${giftId}`);
      } catch (error) {
        console.error(`❌ Failed to load attachments for gift ${giftId}:`, error);
        setAttachments(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadAttachments();
  }, [giftId, attachments, isLoading, isScrolling]); // Add isScrolling to dependencies

  // Reset attachments when giftId changes
  useEffect(() => {
    setAttachments(null);
    setIsLoading(false);
    setImageErrors(new Set());
  }, [giftId]);

  const isImageFile = (attachment: GiftAttachment): boolean => {
    if (!attachment.url) return false;
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"];
    const url = attachment.url.toLowerCase();
    const hasImageExtension = imageExtensions.some((ext) => url.includes(ext));
    const isImageType = attachment.type?.toLowerCase().startsWith("image/");
    return hasImageExtension || isImageType || false;
  };

  const isPdfFile = (attachment: GiftAttachment): boolean => {
    const fileName = attachment.file_name || attachment.name || '';
    const contentType = attachment.content_type || '';
    return fileName.toLowerCase().endsWith('.pdf') || contentType.toLowerCase().includes('pdf');
  };

  const getPdfImageUrl = (attachment: GiftAttachment): string => {
    if (!attachment.url) return '';

    // Calculate the width for the image (double the attachment window width for better quality)
    const attachmentWidth = Math.max(200, Math.min(600, zoomLevel * 0.8));
    const imageWidth = Math.round(attachmentWidth * 2);


    // Use the CORS proxy to handle the conversion
    return getProxiedUrl(attachment.url, { convert: 'jpeg', width: imageWidth });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleImageError = (attachmentId: string): void => {
    setImageErrors(prev => new Set([...Array.from(prev), attachmentId]));
  };

  const handleDownload = async (attachment: GiftAttachment): Promise<void> => {
    try {
      const response = await authService.apiRequest(`/constituent/v1/attachments/${attachment.id}/download`);
      if (response && response.url) {
        window.open(response.url, '_blank');
      }
    } catch (error) {
      console.error('Failed to download attachment:', error);
    }
  };

  if (attachments && attachments.length === 0 && !isLoading) {
    return (
      <div className="attachment-section" style={{
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
        </h4>
        <p style={{ fontSize: "12px", color: "#6c757d", margin: 0 }}>
          No attachments available
        </p>
      </div>
    );
  }

  // Compact view when not expanded
  if (!isExpanded) {
    return (
      <div className="attachment-section" style={{
        borderTop: "1px solid #f0f0f0",
        paddingTop: "16px"
      }}>
        <h4 style={{
          margin: "0 0 8px",
          fontSize: "14px",
          color: "#495057",
          display: "flex",
          alignItems: "center",
          gap: "6px"
        }}>
          📎 Attachments ({attachments?.length || 0})
          {isLoading && (
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

        {isLoading ? (
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
            <span style={{ fontSize: "12px", color: "#666" }}>Loading...</span>
          </div>
        ) : (
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px"
          }}>
            {attachments?.map((attachment, index) => (
              <div
                key={attachment.id || index}
                style={{
                  border: "1px solid #e9ecef",
                  borderRadius: "6px",
                  padding: "8px",
                  backgroundColor: "#f8f9fa",
                  fontSize: "12px"
                }}
              >
                {/* File header with type icon and name */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  marginBottom: "6px"
                }}>
                  {/* File type icon */}
                  <div style={{
                    width: "14px",
                    height: "14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "8px",
                    fontWeight: "bold",
                    borderRadius: "2px",
                    color: "white"
                  }}>
                    {isPdfFile(attachment) ? (
                      <span style={{ backgroundColor: "#dc3545" }}>PDF</span>
                    ) : isImageFile(attachment) ? (
                      <span style={{ backgroundColor: "#28a745" }}>IMG</span>
                    ) : (
                      <span style={{ backgroundColor: "#6c757d" }}>FILE</span>
                    )}
                  </div>

                  {/* File name */}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(attachment);
                    }}
                    style={{
                      flex: 1,
                      color: "#007bff",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      cursor: "pointer",
                      textDecoration: "underline",
                      fontWeight: "500",
                      fontSize: "11px"
                    }}
                    title={`Download ${attachment.name || attachment.file_name || 'attachment'}`}
                  >
                    {attachment.name || attachment.file_name || "Unnamed Attachment"}
                  </span>

                  {/* File size */}
                  {attachment.file_size && (
                    <span style={{
                      color: "#6c757d",
                      fontSize: "10px",
                      whiteSpace: "nowrap"
                    }}>
                      {formatFileSize(attachment.file_size)}
                    </span>
                  )}
                </div>

                {/* Image preview for image files */}
                {isImageFile(attachment) && !imageErrors.has(attachment.id || '') && (
                  <div style={{ marginBottom: "4px" }}>
                    <img
                      src={attachment.url}
                      alt={attachment.name || "Attachment"}
                      loading="lazy"
                      style={{
                        width: "100%",
                        height: "475px",
                        objectFit: "cover",
                        borderRadius: "4px",
                        border: "1px solid #dee2e6"
                      }}
                      onError={() => handleImageError(attachment.id || '')}
                    />
                  </div>
                )}

                {/* PDF thumbnail for PDF files */}
                {isPdfFile(attachment) && (
                  <div style={{ marginBottom: "4px" }}>
                    <img
                      src={getPdfImageUrl(attachment)}
                      alt={`PDF Preview: ${attachment.name || attachment.file_name || "PDF Document"}`}
                      loading="lazy"
                      style={{
                        width: "100%",
                        height: "475px",
                        objectFit: "contain",
                        borderRadius: "4px",
                        border: "1px solid #dee2e6",
                        backgroundColor: "#ffffff"
                      }}
                      onError={() => handleImageError(attachment.id || '')}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full view when expanded
  return (
    <div className="attachment-section" style={{
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
        📎 {t('giftList.attachments.title')} ({attachments?.length || 0})
        {isLoading && (
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

      {isLoading ? (
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
          <span style={{ fontSize: "12px", color: "#666" }}>Loading attachments...</span>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "12px",
          maxWidth: "100%"
        }}>
          {attachments?.map((attachment, index) => (
            <div
              key={attachment.id || index}
              style={{
                border: "1px solid #e9ecef",
                borderRadius: "8px",
                padding: "12px",
                backgroundColor: "#f8f9fa",
                width: "100%",
                boxSizing: "border-box"
              }}
            >
              <div style={{ marginBottom: "8px" }}>
                <strong
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(attachment);
                  }}
                  style={{
                    fontSize: "12px",
                    color: "#007bff",
                    wordBreak: "break-word",
                    cursor: "pointer",
                    textDecoration: "underline",
                    fontWeight: "bold"
                  }}
                  title={`Download ${attachment.name || attachment.file_name || 'attachment'}`}
                >
                  {attachment.name || attachment.file_name || "Unnamed Attachment"}
                </strong>
              </div>

              {attachment.file_size && (
                <div style={{ fontSize: "11px", color: "#6c757d", marginBottom: "4px" }}>
                  {formatFileSize(attachment.file_size)}
                </div>
              )}

              {isImageFile(attachment) && !imageErrors.has(attachment.id || '') && (
                <div style={{ marginBottom: "8px" }}>
                  <img
                    src={attachment.url}
                    alt={attachment.name || "Attachment"}
                    loading="lazy"
                    style={{
                      width: "100%",
                      height: "120px",
                      objectFit: "cover",
                      borderRadius: "4px"
                    }}
                    onError={() => handleImageError(attachment.id || '')}
                  />
                </div>
              )}

              {isPdfFile(attachment) && (
                <div style={{ marginBottom: "8px" }}>
                  <img
                    src={getPdfImageUrl(attachment)}
                    alt={`PDF Preview: ${attachment.name || attachment.file_name || "PDF Document"}`}
                    loading="lazy"
                    style={{
                      width: "100%",
                      height: Math.max(200, Math.min(600, zoomLevel * 0.8)),
                      objectFit: "contain",
                      borderRadius: "4px",
                      border: "1px solid #e9ecef",
                      backgroundColor: "#f8f9fa"
                    }}
                    onError={() => handleImageError(attachment.id || '')}
                  />
                </div>
              )}

              {/* Download functionality is now handled by clicking the file name */}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default AttachmentsSection; 