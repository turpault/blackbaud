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
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10000,
      maxWidth: '500px',
      width: '90%',
      backgroundColor: '#fff3cd',
      border: '3px solid #ffc107',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      animation: 'slideInDown 0.4s ease-out',
      backdropFilter: 'blur(10px)',
      borderLeft: '8px solid #dc3545'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px'
      }}>
        <div style={{
          fontSize: '32px',
          lineHeight: 1,
          animation: 'pulse 2s infinite'
        }}>
          🚫
        </div>

        <div style={{ flex: 1 }}>
          <h3 style={{
            margin: '0 0 12px',
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#856404',
            textAlign: 'center'
          }}>
            {t('quota.title')}
          </h3>

          <p style={{
            margin: '0 0 16px',
            fontSize: '16px',
            color: '#856404',
            lineHeight: 1.5,
            textAlign: 'center',
            fontWeight: '500'
          }}>
            {t('quota.message')}
          </p>

          {timeRemaining > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <span style={{
                  fontSize: '14px',
                  color: '#856404',
                  fontWeight: 'bold'
                }}>
                  {t('quota.timeRemaining')}
                </span>
                <span style={{
                  fontSize: '18px',
                  color: '#dc3545',
                  fontWeight: 'bold',
                  fontFamily: 'monospace',
                  backgroundColor: '#f8f9fa',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '2px solid #dc3545'
                }}>
                  {formatTime(timeRemaining)}
                </span>
              </div>

              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#ffeaa7',
                borderRadius: '4px',
                overflow: 'hidden',
                border: '1px solid #fdcb6e'
              }}>
                <div style={{
                  width: `${getProgressPercentage()}%`,
                  height: '100%',
                  backgroundColor: '#dc3545',
                  transition: 'width 1s linear',
                  borderRadius: '4px'
                }} />
              </div>
            </div>
          )}

          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '12px',
            alignItems: 'center'
          }}>
            <button
              onClick={onDismiss}
              style={{
                padding: '10px 20px',
                backgroundColor: '#856404',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                transition: 'background-color 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#6c5ce7'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#856404'}
            >
              {t('quota.dismiss')}
            </button>

            <span style={{
              fontSize: '12px',
              color: '#856404',
              fontStyle: 'italic'
            }}>
              {t('quota.autoHide')}
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideInDown {
          from {
            transform: translateX(-50%) translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }
        }
        
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
        }
      `}</style>
    </div>
  );
};

export default QuotaNotification; 