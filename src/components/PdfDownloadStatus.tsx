import React, { useState, useEffect } from 'react';
import PdfDownloadManager from '../utils/pdfDownloadManager';

interface PdfDownloadStatusProps {
  showDetails?: boolean;
}

const PdfDownloadStatus: React.FC<PdfDownloadStatusProps> = ({
  showDetails = false
}) => {
  const [status, setStatus] = useState({
    queueLength: 0,
    activeDownloads: 0,
    maxConcurrent: 3
  });

  useEffect(() => {
    const updateStatus = () => {
      const downloadManager = PdfDownloadManager.getInstance();
      setStatus(downloadManager.getStatus());
    };

    // Update status immediately
    updateStatus();

    // Update status every second
    const interval = setInterval(updateStatus, 1000);

    return () => clearInterval(interval);
  }, []);

  // Don't show if no downloads are happening
  if (status.queueLength === 0 && status.activeDownloads === 0) {
    return null;
  }

  const queuePercentage = status.activeDownloads / status.maxConcurrent * 100;

  return (
    <div style={{
      position: 'fixed',
      bottom: '80px',
      right: '20px',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '12px 16px',
      borderRadius: '8px',
      fontSize: '12px',
      zIndex: 1000,
      cursor: 'pointer',
      transition: 'opacity 0.3s ease',
      minWidth: '200px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div style={{ fontSize: '16px' }}>📥</div>
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
            PDF Downloads
          </div>
          {showDetails && (
            <div style={{ fontSize: '10px', opacity: 0.8 }}>
              {status.activeDownloads} active / {status.maxConcurrent} max
              {status.queueLength > 0 && ` • ${status.queueLength} queued`}
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        width: '100%',
        height: '4px',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: '2px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${queuePercentage}%`,
          height: '100%',
          backgroundColor: status.activeDownloads >= status.maxConcurrent ? '#ffc107' : '#28a745',
          transition: 'width 0.3s ease, background-color 0.3s ease'
        }} />
      </div>

      {/* Status indicators */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '8px',
        fontSize: '10px',
        opacity: 0.8
      }}>
        <span>
          {status.activeDownloads > 0 && (
            <span style={{ color: '#28a745' }}>
              ⚡ {status.activeDownloads} downloading
            </span>
          )}
        </span>
        <span>
          {status.queueLength > 0 && (
            <span style={{ color: '#ffc107' }}>
              ⏳ {status.queueLength} waiting
            </span>
          )}
        </span>
      </div>
    </div>
  );
};

export default PdfDownloadStatus; 