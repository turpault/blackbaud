/**
 * CORS Proxy Utilities for Blackbaud API
 * 
 * This utility helps bypass CORS restrictions when accessing external files
 * by routing requests through the proxy server's dynamic target endpoints.
 */

import authService from '../services/authService';

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
export const getProxiedUrl = (originalUrl: string): string => {
  if (isBlackbaudFileUrl(originalUrl)) {
    // Use the Blackbaud proxy route with dynamic target support
    const encodedUrl = btoa(originalUrl);
    const proxiedUrl = `/blackbaud-proxy?url=${encodedUrl}`;
    console.log('Using dynamic target proxy for URL:', { originalUrl, proxiedUrl });
    return proxiedUrl;
  }
  return originalUrl;
};

/**
 * Fetch any external file through the dynamic target proxy with authentication
 */
export const fetchThroughProxy = async (url: string, options: RequestInit = {}): Promise<Response> => {
  // For Blackbaud URLs, we need to check if authentication is required
  if (isBlackbaudFileUrl(url)) {
    try {
      // Check authentication status and get session info
      const session = await authService.checkAuthentication();
      
      if (session.authenticated && session.accessToken && session.subscriptionKey) {
        // Use authenticated request through the proxy with proper headers
        const proxiedUrl = getProxiedUrl(url);
        
        const enhancedOptions = {
          ...options,
          headers: {
            'Accept': 'application/pdf,application/octet-stream,*/*',
            'Authorization': `${session.tokenType || 'Bearer'} ${session.accessToken}`,
            'Bb-Api-Subscription-Key': session.subscriptionKey,
            ...options.headers,
          },
        };

        console.log('Making authenticated request through proxy for Blackbaud URL');
        const response = await fetch(proxiedUrl, enhancedOptions);

        if (!response.ok) {
          throw new Error(`Failed to fetch file through authenticated proxy: ${response.status} ${response.statusText}`);
        }

        return response;
      } else {
        throw new Error('Not authenticated - authentication required for Blackbaud URLs');
      }
    } catch (error: any) {
      console.error('Authenticated proxy request failed:', error);
      throw error;
    }
  } else {
    // For non-Blackbaud URLs, use regular fetch
    const enhancedOptions = {
      ...options,
      headers: {
        'Accept': 'application/pdf,application/octet-stream,*/*',
        ...options.headers,
      },
    };

    const response = await fetch(url, enhancedOptions);

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }

    return response;
  }
};
