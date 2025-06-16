/**
 * CORS Proxy Utilities for Blackbaud API
 * 
 * This utility helps bypass CORS restrictions when accessing Blackbaud files
 * by routing requests through the proxy server's CORS bypass endpoint.
 */

/**
 * Check if a URL is a Blackbaud file URL that needs CORS proxy
 */
export const isBlackbaudFileUrl = (url: string): boolean => {
  return url.includes('fil-pcan01.app.blackbaud.net') || url.includes('blackbaud.net');
};

/**
 * Convert a Blackbaud URL to use the CORS proxy
 */
export const getProxiedUrl = (originalUrl: string): string => {
  if (isBlackbaudFileUrl(originalUrl)) {
    // Replace the Blackbaud domain with our proxy path
    const proxiedUrl = originalUrl.replace(
      'https://fil-pcan01.app.blackbaud.net',
      '/blackbaud-proxy'
    );
    console.log('Using CORS proxy for Blackbaud URL:', { originalUrl, proxiedUrl });
    return proxiedUrl;
  }
  return originalUrl;
};

/**
 * Fetch a Blackbaud file through the CORS proxy
 */
export const fetchBlackbaudFile = async (url: string): Promise<Response> => {
  const proxiedUrl = getProxiedUrl(url);
  
  const response = await fetch(proxiedUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/pdf,application/octet-stream,*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch file through proxy: ${response.status} ${response.statusText}`);
  }

  return response;
};

/**
 * Download a Blackbaud file through the CORS proxy
 */
export const downloadBlackbaudFile = async (url: string, filename?: string): Promise<void> => {
  try {
    const response = await fetchBlackbaudFile(url);
    const blob = await response.blob();
    
    // Create a blob URL and trigger download
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename || 'download';
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up blob URL
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Error downloading Blackbaud file:', error);
    throw error;
  }
};

/**
 * Open a Blackbaud file in a new tab through the CORS proxy
 */
export const openBlackbaudFile = (url: string): void => {
  const proxiedUrl = getProxiedUrl(url);
  window.open(proxiedUrl, '_blank', 'noopener,noreferrer');
}; 