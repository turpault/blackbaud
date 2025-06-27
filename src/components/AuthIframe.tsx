import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface AuthIframeProps {
  onSuccess: () => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

const AuthIframe: React.FC<AuthIframeProps> = ({ onSuccess, onError, onCancel }) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Listen for messages from iframe
    const messageHandler = (event: MessageEvent) => {
      // Only accept messages from our domain
      if (event.origin !== window.location.origin) return;

      if (event.data.type === 'OAUTH_SUCCESS') {
        setIsLoading(false);
        onSuccess();
      } else if (event.data.type === 'OAUTH_ERROR') {
        setIsLoading(false);
        const errorMessage = event.data.error || 'OAuth authentication failed';
        setError(errorMessage);
        onError(errorMessage);
      }
    };

    window.addEventListener('message', messageHandler);

    // Timeout after 5 minutes
    const timeoutId = setTimeout(() => {
      setIsLoading(false);
      const timeoutError = 'OAuth authentication timed out';
      setError(timeoutError);
      onError(timeoutError);
    }, 5 * 60 * 1000);

    return () => {
      window.removeEventListener('message', messageHandler);
      clearTimeout(timeoutId);
    };
  }, [onSuccess, onError]);

  const handleCancel = () => {
    onCancel();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {/* Close button */}
      <button
        onClick={handleCancel}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: '#dc3545',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          fontSize: '20px',
          cursor: 'pointer',
          zIndex: 10000
        }}
        title="Cancel authentication"
      >
        ✕
      </button>

      {/* Loading overlay */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: 'white',
          zIndex: 10001
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }} />
          <h3 style={{ margin: '0 0 10px 0' }}>🔐 Re-authenticating...</h3>
          <p style={{ margin: 0, opacity: 0.8 }}>
            Please complete the authentication process in the window below
          </p>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: 'white',
          zIndex: 10001,
          backgroundColor: 'rgba(220, 53, 69, 0.9)',
          padding: '20px',
          borderRadius: '8px',
          maxWidth: '400px'
        }}>
          <h3 style={{ margin: '0 0 10px 0' }}>❌ Authentication Failed</h3>
          <p style={{ margin: '0 0 20px 0' }}>{error}</p>
          <button
            onClick={handleCancel}
            style={{
              background: '#dc3545',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      )}

      {/* Iframe */}
      <iframe
        src="/blackbaud/oauth/login?iframe=true"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          opacity: isLoading ? 0.3 : 1,
          transition: 'opacity 0.3s ease'
        }}
        title="OAuth Authentication"
      />

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AuthIframe; 