import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface QuotaNotificationProps {
  retryAfter?: string;
  onDismiss?: () => void;
  isVisible: boolean;
}

const QuotaNotification: React.FC<QuotaNotificationProps> = ({
  retryAfter,
  onDismiss,
  isVisible
}) => {
  const { t } = useTranslation();
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    if (!retryAfter || !isVisible) {
      setTimeRemaining(0);
      return;
    }

    const retrySeconds = parseInt(retryAfter);
    setTimeRemaining(retrySeconds);

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          if (onDismiss) {
            onDismiss();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [retryAfter, isVisible, onDismiss]);

  if (!isVisible) {
    return null;
  }

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${remainingSeconds}s`;
  };

  const getProgressPercentage = (): number => {
    if (!retryAfter) return 0;
    const totalSeconds = parseInt(retryAfter);
    return ((totalSeconds - timeRemaining) / totalSeconds) * 100;
  };

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 9999,
      maxWidth: '400px',
      backgroundColor: '#fff3cd',
      border: '2px solid #ffc107',
      borderRadius: '8px',
      padding: '16px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      animation: 'slideInRight 0.3s ease-out'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px'
      }}>
        <div style={{
          fontSize: '24px',
          lineHeight: 1
        }}>
          🚫
        </div>

        <div style={{ flex: 1 }}>
          <h4 style={{
            margin: '0 0 8px',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#856404'
          }}>
            {t('quota.title')}
          </h4>

          <p style={{
            margin: '0 0 12px',
            fontSize: '14px',
            color: '#856404',
            lineHeight: 1.4
          }}>
            {t('quota.message')}
          </p>

          {timeRemaining > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px'
              }}>
                <span style={{
                  fontSize: '12px',
                  color: '#856404',
                  fontWeight: 'bold'
                }}>
                  {t('quota.timeRemaining')}
                </span>
                <span style={{
                  fontSize: '14px',
                  color: '#856404',
                  fontWeight: 'bold',
                  fontFamily: 'monospace'
                }}>
                  {formatTime(timeRemaining)}
                </span>
              </div>

              <div style={{
                width: '100%',
                height: '4px',
                backgroundColor: '#ffeaa7',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${getProgressPercentage()}%`,
                  height: '100%',
                  backgroundColor: '#f39c12',
                  transition: 'width 1s linear'
                }} />
              </div>
            </div>
          )}

          <div style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}>
            <button
              onClick={onDismiss}
              style={{
                padding: '6px 12px',
                backgroundColor: '#856404',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              {t('quota.dismiss')}
            </button>

            <span style={{
              fontSize: '11px',
              color: '#856404',
              fontStyle: 'italic'
            }}>
              {t('quota.autoHide')}
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default QuotaNotification; 