import React, { useEffect, useRef, useState, useCallback } from 'react';
import { isBlackbaudFileUrl, getProxiedUrl, fetchThroughProxy } from '../utils/corsProxy';

// Import PDF.js - using require to avoid TypeScript issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfjsLib = require('pdfjs-dist');

// Set up the worker - using a more reliable CDN URL
if (typeof window !== 'undefined') {
  // Use jsDelivr CDN which is more reliable than cdnjs for PDF.js worker files
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

interface PdfViewerProps {
  url: string;
  name?: string;
  height?: number;
  width?: string;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ 
  url, 
  name = 'PDF Document',
  height = 300,
  width = '100%'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pageNum, setPageNum] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [pdfDoc, setPdfDoc] = useState<any>(null); // Using any to avoid TypeScript issues
  const [scale, setScale] = useState<number>(1.0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const loadPdf = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Clean up previous blob URL
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }

      let pdfUrl = url;

      // If it's a Blackbaud file URL, use our authenticated CORS proxy
      if (isBlackbaudFileUrl(url)) {
        try {
          console.log('Fetching PDF through authenticated CORS proxy:', url);
          
          const response = await fetchThroughProxy(url);
          const blob = await response.blob();
          const newBlobUrl = URL.createObjectURL(blob);
          setBlobUrl(newBlobUrl);
          pdfUrl = newBlobUrl;
          console.log('Successfully fetched PDF through authenticated proxy, created blob URL:', newBlobUrl);
        } catch (fetchError: any) {
          console.error('Failed to fetch PDF through authenticated proxy:', fetchError);
          
          // Check if it's an authentication error
          if (fetchError.message?.includes('Not authenticated') || 
              fetchError.message?.includes('authentication required')) {
            throw new Error('Authentication required: Please log in to view this PDF file.');
          }
          
          // For other errors, provide a more helpful message
          throw new Error(`Failed to load PDF: ${fetchError.message}`);
        }
      }
      
      const loadingTask = pdfjsLib.getDocument(pdfUrl);
      const pdf = await loadingTask.promise;
      
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      setPageNum(1);
      setLoading(false);
    } catch (err: any) {
      console.error('Error loading PDF:', err);
      setError(err.message || `Failed to load PDF: ${err.message}`);
      setLoading(false);
    }
  }, [url, blobUrl]);

  const renderPage = useCallback(async (num: number) => {
    if (!pdfDoc || !canvasRef.current) return;

    try {
      const page = await pdfDoc.getPage(num);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (!context) return;

      const viewport = page.getViewport({ scale });
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
    } catch (err: any) {
      console.error('Error rendering page:', err);
      setError(`Failed to render page: ${err.message}`);
    }
  }, [pdfDoc, scale]);

  useEffect(() => {
    loadPdf();
    
    // Cleanup blob URL on unmount or URL change
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [url, loadPdf, blobUrl]);

  useEffect(() => {
    if (pdfDoc) {
      renderPage(pageNum);
    }
  }, [pdfDoc, pageNum, scale, renderPage]);

  const goToNextPage = () => {
    if (pageNum < totalPages) {
      setPageNum(pageNum + 1);
    }
  };

  const goToPrevPage = () => {
    if (pageNum > 1) {
      setPageNum(pageNum - 1);
    }
  };

  const zoomIn = () => {
    setScale(prevScale => Math.min(prevScale + 0.25, 3.0));
  };

  const zoomOut = () => {
    setScale(prevScale => Math.max(prevScale - 0.25, 0.5));
  };

  const resetZoom = () => {
    setScale(1.0);
  };

  if (loading) {
    return (
      <div style={{ 
        width, 
        height: `${height}px`, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        border: '1px solid #ddd',
        borderRadius: '4px',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '24px',
            height: '24px',
            border: '2px solid #f3f3f3',
            borderTop: '2px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 8px'
          }} />
          <span style={{ color: '#666', fontSize: '14px' }}>Loading PDF...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        width, 
        height: `${height}px`, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        border: '1px solid #dc3545',
        borderRadius: '4px',
        backgroundColor: '#f8d7da',
        color: '#721c24',
        padding: '16px',
        textAlign: 'center'
      }}>
        <div>
          <div style={{ fontSize: '16px', marginBottom: '8px' }}>⚠️</div>
          <div style={{ fontSize: '14px' }}>{error}</div>
          <button
            onClick={loadPdf}
            style={{
              marginTop: '8px',
              padding: '4px 8px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width, border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
      {/* PDF Controls */}
      <div style={{
        padding: '8px 12px',
        backgroundColor: '#f8f9fa',
        borderBottom: '1px solid #ddd',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={goToPrevPage}
            disabled={pageNum <= 1}
            style={{
              padding: '4px 8px',
              backgroundColor: pageNum <= 1 ? '#e9ecef' : '#007bff',
              color: pageNum <= 1 ? '#6c757d' : 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: pageNum <= 1 ? 'not-allowed' : 'pointer',
              fontSize: '12px'
            }}
          >
            ← Prev
          </button>
          
          <span style={{ fontSize: '14px', color: '#333' }}>
            Page {pageNum} of {totalPages}
          </span>
          
          <button
            onClick={goToNextPage}
            disabled={pageNum >= totalPages}
            style={{
              padding: '4px 8px',
              backgroundColor: pageNum >= totalPages ? '#e9ecef' : '#007bff',
              color: pageNum >= totalPages ? '#6c757d' : 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: pageNum >= totalPages ? 'not-allowed' : 'pointer',
              fontSize: '12px'
            }}
          >
            Next →
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={zoomOut}
            disabled={scale <= 0.5}
            style={{
              padding: '4px 8px',
              backgroundColor: scale <= 0.5 ? '#e9ecef' : '#6c757d',
              color: scale <= 0.5 ? '#6c757d' : 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: scale <= 0.5 ? 'not-allowed' : 'pointer',
              fontSize: '12px'
            }}
          >
            🔍−
          </button>
          
          <span style={{ fontSize: '12px', color: '#666', minWidth: '40px', textAlign: 'center' }}>
            {Math.round(scale * 100)}%
          </span>
          
          <button
            onClick={zoomIn}
            disabled={scale >= 3.0}
            style={{
              padding: '4px 8px',
              backgroundColor: scale >= 3.0 ? '#e9ecef' : '#6c757d',
              color: scale >= 3.0 ? '#6c757d' : 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: scale >= 3.0 ? 'not-allowed' : 'pointer',
              fontSize: '12px'
            }}
          >
            🔍+
          </button>
          
          <button
            onClick={resetZoom}
            style={{
              padding: '4px 8px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Reset
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <a
            href={isBlackbaudFileUrl(url) ? getProxiedUrl(url) : url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '4px 8px',
              backgroundColor: '#17a2b8',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '3px',
              fontSize: '12px'
            }}
          >
            📄 Open
          </a>
          <a
            href={isBlackbaudFileUrl(url) ? getProxiedUrl(url) : url}
            download={name}
            style={{
              padding: '4px 8px',
              backgroundColor: '#28a745',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '3px',
              fontSize: '12px'
            }}
          >
            💾 Download
          </a>
        </div>
      </div>

      {/* PDF Canvas */}
      <div style={{ 
        height: `${height}px`, 
        overflow: 'auto', 
        backgroundColor: '#f5f5f5',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '16px'
      }}>
        <canvas
          ref={canvasRef}
          style={{
            maxWidth: '100%',
            height: 'auto',
            backgroundColor: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
        />
      </div>
    </div>
  );
};

export default PdfViewer; 