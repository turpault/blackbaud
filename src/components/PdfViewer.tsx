import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getProxiedUrl, isBlackbaudFileUrl } from '../utils/corsProxy';
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

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

interface PageCanvas {
  pageNum: number;
  canvas: HTMLCanvasElement;
  loading: boolean;
  error?: string;
}

const PdfViewer: React.FC<PdfViewerProps> = ({
  url,
  name = 'PDF Document',
  height = 300,
  width = '100%'
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [pdfDoc, setPdfDoc] = useState<any>(null); // Using any to avoid TypeScript issues
  const [pageCanvases, setPageCanvases] = useState<PageCanvas[]>([]);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection observer to detect when PDF viewer becomes visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isVisible) {
            console.log(`📄 PDF viewer became visible: ${name}`);
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [isVisible, name]);

  // Add CSS for spinner animation
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);

  const loadPdf = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let pdfUrl = url;

      // If it's a Blackbaud file URL, use our authenticated CORS proxy
      if (isBlackbaudFileUrl(url)) {
        try {
          console.log('Fetching PDF through authenticated CORS proxy:', url);

          const proxiedUrl = getProxiedUrl(url);

          pdfUrl = proxiedUrl;
        } catch (fetchError: any) {
          console.error('Failed to fetch PDF through authenticated proxy:', fetchError);

          // Check if it's an authentication error
          if (fetchError.message?.includes('Not authenticated') ||
            fetchError.message?.includes('authentication required')) {
            throw new Error(t('pdfViewer.authenticationRequired'));
          }

          // For other errors, provide a more helpful message
          throw new Error(`${t('pdfViewer.failed')}: ${fetchError.message}`);
        }
      }

      console.log(`📄 Loading PDF: ${name} from URL: ${pdfUrl}`);

      // Load PDF directly without the queue for now to debug the issue
      const loadingTask = pdfjsLib.getDocument(pdfUrl);
      const pdf = await loadingTask.promise;

      console.log(`✅ PDF loaded successfully: ${name}, pages: ${pdf.numPages}`);

      // Set the PDF document - THIS IS THE CRITICAL LINE THAT WAS MISSING
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      setLoading(false);

      // Initialize page canvases
      const canvases: PageCanvas[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        canvases.push({
          pageNum: i,
          canvas: document.createElement('canvas'),
          loading: true
        });
      }
      setPageCanvases(canvases);

    } catch (err: any) {
      console.error('Error loading PDF:', err);
      setError(err.message || `Failed to load PDF: ${err.message}`);
      setLoading(false);
    }
  }, [url, name, t]);

  // Load PDF immediately when component mounts, regardless of visibility
  // This ensures PDFs are displayed even when cards are collapsed
  useEffect(() => {
    console.log(`🚀 Component mounted, checking if PDF should load:`, {
      hasPdfDoc: !!pdfDoc,
      loading,
      error,
      name
    });

    if (!pdfDoc && !error) {
      console.log(`🚀 Loading PDF immediately on mount: ${name}`);
      loadPdf();
    }
  }, [pdfDoc, loading, error, name, loadPdf]);

  const renderAllPages = useCallback(async () => {
    if (!pdfDoc || totalPages === 0) return;

    console.log(`🚀 Starting to render all ${totalPages} pages...`);

    // Render pages directly without queue for debugging
    for (let i = 1; i <= totalPages; i++) {
      const pageNum = i;

      try {
        console.log(`🎨 Rendering page ${pageNum} of PDF: ${name}`);
        const page = await pdfDoc.getPage(pageNum);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error('Failed to get canvas context');
        }

        const viewport = page.getViewport({ scale: 1.0 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        console.log(`✅ Page ${pageNum} rendered successfully`);

        // Verify canvas has content before updating
        try {
          const dataUrl = canvas.toDataURL();
          console.log(`🎨 Page ${pageNum} canvas data URL length: ${dataUrl.length}`);

          // Update the page canvas
          setPageCanvases(prev => prev.map(pc =>
            pc.pageNum === pageNum
              ? { ...pc, canvas: canvas, loading: false }
              : pc
          ));
        } catch (canvasError: any) {
          console.error(`❌ Canvas data URL error for page ${pageNum}:`, canvasError);
          setPageCanvases(prev => prev.map(pc =>
            pc.pageNum === pageNum
              ? { ...pc, loading: false, error: `Canvas error: ${canvasError.message}` }
              : pc
          ));
        }

      } catch (error: any) {
        console.error(`❌ Failed to render page ${pageNum}:`, error);
        setPageCanvases(prev => prev.map(pc =>
          pc.pageNum === pageNum
            ? { ...pc, loading: false, error: `Failed to render page: ${error.message}` }
            : pc
        ));
      }
    }

    console.log(`📋 All ${totalPages} pages processed`);
  }, [pdfDoc, totalPages, name]);

  useEffect(() => {
    if (pdfDoc && totalPages > 0) {
      renderAllPages();
    }
  }, [pdfDoc, totalPages, renderAllPages]);

  // Debug effect to monitor PDF document state
  useEffect(() => {
    console.log(`📊 PDF state changed:`, {
      hasPdfDoc: !!pdfDoc,
      totalPages,
      name,
      loading,
      error,
      pageCanvasesCount: pageCanvases.length,
      renderedPages: pageCanvases.filter(pc => !pc.loading && !pc.error).length,
      loadingPages: pageCanvases.filter(pc => pc.loading).length,
      errorPages: pageCanvases.filter(pc => pc.error).length
    });
  }, [pdfDoc, totalPages, name, loading, error, pageCanvases]);

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
        backgroundColor: '#f8f9fa',
        position: 'sticky',
        top: '0',
        zIndex: 1002,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
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
          <span style={{ color: '#666', fontSize: '14px' }}>{t('pdfViewer.loading')}</span>
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
            {t('pdfViewer.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width, border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
      {/* PDF Pages Container */}
      <div style={{
        height: `${height}px`,
        overflow: 'auto',
        backgroundColor: '#f5f5f5',
        padding: '16px'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          {pageCanvases.length === 0 ? (
            // Fallback: Show PDF in iframe if no canvases are available
            <div style={{
              width: '100%',
              height: '400px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              {pdfDoc ? (
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f8f9fa',
                  padding: '20px'
                }}>
                  <div style={{ fontSize: '16px', marginBottom: '10px' }}>📄 {name}</div>
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
                    {totalPages} {t('common.pages')} • {t('common.loading')}...
                  </div>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid #f3f3f3',
                    borderTop: '2px solid #007bff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                </div>
              ) : (
                <iframe
                  src={isBlackbaudFileUrl(url) ? getProxiedUrl(url) : url}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none'
                  }}
                  title={name}
                />
              )}
            </div>
          ) : (
            pageCanvases.map((pageCanvas) => (
              <div key={pageCanvas.pageNum} style={{
                position: 'relative',
                backgroundColor: 'white',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                borderRadius: '4px',
                overflow: 'hidden',
                width: '100%',
                maxWidth: '100%'
              }}>
                {/* Page Header */}
                <div style={{
                  padding: '8px 12px',
                  backgroundColor: '#f8f9fa',
                  borderBottom: '1px solid #e9ecef',
                  fontSize: '12px',
                  color: '#666',
                  fontWeight: 'bold'
                }}>
                  {t('pdfViewer.page')} {pageCanvas.pageNum}
                </div>

                {/* Page Content */}
                <div style={{ position: 'relative' }}>
                  {pageCanvas.loading ? (
                    <div style={{
                      width: '100%',
                      height: '200px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#f8f9fa'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          width: '20px',
                          height: '20px',
                          border: '2px solid #f3f3f3',
                          borderTop: '2px solid #007bff',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                          margin: '0 auto 8px'
                        }} />
                        <span style={{ fontSize: '12px', color: '#666' }}>{t('common.rendering')}...</span>
                      </div>
                    </div>
                  ) : pageCanvas.error ? (
                    <div style={{
                      width: '100%',
                      height: '200px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#f8d7da',
                      color: '#721c24',
                      padding: '16px',
                      textAlign: 'center'
                    }}>
                      <div>
                        <div style={{ fontSize: '14px', marginBottom: '4px' }}>⚠️</div>
                        <div style={{ fontSize: '12px' }}>{pageCanvas.error}</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      padding: '8px',
                      width: '100%'
                    }}>
                      <img
                        src={pageCanvas.canvas.toDataURL()}
                        alt={`${t('pdfViewer.page')} ${pageCanvas.pageNum}`}
                        style={{
                          maxWidth: '100%',
                          height: 'auto',
                          display: 'block'
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PdfViewer; 