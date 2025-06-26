/**
 * CORS Proxy for Blackbaud API
 * 
 * This utility helps bypass CORS restrictions when accessing Blackbaud file URLs
 */

/**
 * Check if a URL is a Blackbaud file URL that needs CORS proxy
 */
export const isBlackbaudFileUrl = (url: string): boolean => {
  return url.includes('fil-pcan01.app.blackbaud.net') || 
         url.includes('api.sky.blackbaud.com') ||
         url.includes('app.blackbaud.com') ||
         url.includes('blackbaud.net');
};

/**
 * Convert any external URL to use the Blackbaud dynamic proxy
 */
export const getProxiedUrl = (originalUrl: string, options: { convert?: string, width?: number } = {}): string => {
  if (isBlackbaudFileUrl(originalUrl)) {
    // Use the Blackbaud proxy route with dynamic target support
    const encodedUrl = btoa(originalUrl);
    const proxiedUrl = `/blackbaud-proxy?url=${encodedUrl}&convert=${options.convert}&width=${options.width}`;
    console.log('Using dynamic target proxy for URL:', { originalUrl, proxiedUrl });
    return proxiedUrl;
  }
  return originalUrl;
};
