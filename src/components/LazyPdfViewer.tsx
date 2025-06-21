import React from 'react';
import PdfViewer from './PdfViewer';
import { useLazyLoading } from '../hooks/useLazyLoading';

interface LazyPdfViewerProps {
  url: string;
  name?: string;
  height?: number;
  width?: string;
  threshold?: number;
  rootMargin?: string;
  onLoad?: () => void;
}

const LazyPdfViewer: React.FC<LazyPdfViewerProps> = ({
  url,
  name = 'PDF Document',
  height = 300,
  width = '100%',
  threshold = 0.1,
  rootMargin = '50px',
  onLoad
}) => {
  const { isVisible, hasIntersectionObserver, containerRef, forceLoad } = useLazyLoading({
    threshold,
    rootMargin,
    fallback: true
  });

  // Call onLoad when PDF becomes visible
  React.useEffect(() => {
    if (isVisible && onLoad) {
      onLoad();
    }
  }, [isVisible, onLoad]);

  // If Intersection Observer is not supported, load immediately
  if (!hasIntersectionObserver) {
    return (
      <PdfViewer
        url={url}
        name={name}
        height={height}
        width={width}
      />
    );
  }

  return (
    <div ref={containerRef} style={{ width }}>
      {isVisible ? (
        <PdfViewer
          url={url}
          name={name}
          height={height}
          width="100%"
        />
      ) : (
        <div style={{
          width: '100%',
          height: `${height}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #ddd',
          borderRadius: '4px',
          backgroundColor: '#f8f9fa',
          cursor: 'pointer',
          transition: 'background-color 0.2s ease'
        }}
          onClick={forceLoad}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#e9ecef';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#f8f9fa';
          }}
          title="Click to load PDF"
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '24px',
              marginBottom: '8px',
              color: '#6c757d'
            }}>
              📄
            </div>
            <div style={{
              color: '#666',
              fontSize: '14px',
              marginBottom: '4px'
            }}>
              {name || 'PDF Document'}
            </div>
            <div style={{
              color: '#999',
              fontSize: '12px',
              fontStyle: 'italic'
            }}>
              Click to load PDF
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LazyPdfViewer; 