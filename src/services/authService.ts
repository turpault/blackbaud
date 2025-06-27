import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { cache } from '../utils/cacheDecorator';
import { attachmentQueue } from '../utils/concurrentQueue';
import { constituentCacheUtils, giftCacheUtils } from '../utils/database';
import { 
  OAuthSessionResponse, 
  SessionInfo, 
  ApiRequestOptions, 
  ConstituentInfo,
} from '../types/auth';

class AuthService {
  private sessionInfo: SessionInfo | null = null;
  private sessionCheckPromise: Promise<SessionInfo> | null = null;
  private lastSessionCheck: number = 0; // Timestamp of last session check
  private readonly SESSION_CACHE_DURATION = 60000; // 1 minute in milliseconds
  
  // Blackbaud API configuration
  private readonly BLACKBAUD_API_BASE = 'https://api.sky.blackbaud.com';

  // Promise memoization for constituent requests to prevent duplicate API calls
  private constituentPromises: Map<string, Promise<ConstituentInfo | null>> = new Map();

  // Exponential backoff retry utility for 429 errors
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 5,
    baseDelayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a quota/rate limiting error (including Blackbaud's 403 Quota Exceeded)
        const isQuotaError = error.response?.status === 429 || 
                           error.response?.status === 403 ||
                           error.status === 429 || 
                           error.status === 403 ||
                           error.message?.includes('429') ||
                           error.message?.includes('403') ||
                           error.message?.toLowerCase().includes('rate limit') ||
                           error.message?.toLowerCase().includes('too many requests') ||
                           error.message?.toLowerCase().includes('quota exceeded') ||
                           error.message?.toLowerCase().includes('quota limit') ||
                           error.message?.toLowerCase().includes('throttled') ||
                           error.message?.toLowerCase().includes('throttling') ||
                           error.response?.data?.title?.toLowerCase().includes('quota exceeded') ||
                           error.response?.data?.detail?.toLowerCase().includes('quota exceeded') ||
                           error.response?.data?.message?.toLowerCase().includes('quota exceeded') ||
                           error.response?.data?.error?.toLowerCase().includes('quota exceeded') ||
                           error.response?.data?.error_description?.toLowerCase().includes('quota exceeded');
        
        // Check specifically for 403 status (Blackbaud quota exceeded)
        const is403Error = error.response?.status === 403 || error.status === 403;
        
        // Trigger quota notification immediately when rate limit is first encountered
        if (isQuotaError && attempt === 0) {
          const retryAfter = error.response?.headers?.['retry-after'] || 
                            error.response?.headers?.['Retry-After'] ||
                            error.response?.data?.retry_after ||
                            error.response?.data?.retryAfter ||
                            error.retryAfter;
          this.notifyQuotaExceeded(retryAfter);
        }
        
        // Only retry on 429 errors, fail immediately on 403
        if (is403Error) {
          console.warn(`🚫 403 Quota Exceeded - No retry attempted, failing immediately`);
          throw error;
        }
        
        // Only retry on 429 errors, and only if we have attempts left
        if (!isQuotaError || attempt === maxRetries) {
          throw error;
        }
        
        // Get retry-after value from the server response
        const retryAfter = error.response?.headers?.['retry-after'] || 
                          error.response?.headers?.['Retry-After'] ||
                          error.response?.data?.retry_after ||
                          error.response?.data?.retryAfter ||
                          error.retryAfter;
        
        // Calculate exponential backoff delay
        const backoffDelay = baseDelayMs * Math.pow(2, attempt);
        const jitter = Math.random() * 0.1 * backoffDelay; // 10% jitter
        const backoffTotal = backoffDelay + jitter;
        
        let totalDelay: number;
        
        if (retryAfter) {
          // Use the maximum of server retry-after and exponential backoff
          const retrySeconds = parseInt(retryAfter);
          const serverDelay = retrySeconds * 1000;
          totalDelay = Math.max(serverDelay, backoffTotal);
          console.warn(`429 Rate Limited, using max(server: ${retrySeconds}s, backoff: ${Math.round(backoffTotal)}ms) = ${Math.round(totalDelay)}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
        } else {
          // Fall back to exponential backoff if no retry-after provided
          totalDelay = backoffTotal;
          console.warn(`429 Rate Limited, using exponential backoff: ${Math.round(totalDelay)}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, totalDelay));
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
  }

  // Centralized query handler with consistent 429 handling and error messaging
  async executeQuery<T>(
    queryFn: () => Promise<T>,
    context: string = 'query',
    onError?: (error: any, isRateLimit: boolean) => void
  ): Promise<T> {
    try {
      const result = await this.withRetry(queryFn);
      
      // Clear quota notification on successful request
      this.clearQuotaExceeded();
      
      return result;
    } catch (error: any) {
      // Enhanced rate limiting error detection (including Blackbaud's 403 Quota Exceeded)
      const isRateLimit = error.response?.status === 429 || 
                         error.response?.status === 403 ||
                         error.status === 429 || 
                         error.status === 403 ||
                         error.message?.includes('429') ||
                         error.message?.includes('403') ||
                         error.message?.toLowerCase().includes('rate limit') ||
                         error.message?.toLowerCase().includes('too many requests') ||
                         error.message?.toLowerCase().includes('quota exceeded') ||
                         error.message?.toLowerCase().includes('quota limit') ||
                         error.message?.toLowerCase().includes('throttled') ||
                         error.message?.toLowerCase().includes('throttling') ||
                         error.response?.data?.title?.toLowerCase().includes('quota exceeded') ||
                         error.response?.data?.detail?.toLowerCase().includes('quota exceeded') ||
                         error.response?.data?.message?.toLowerCase().includes('quota exceeded') ||
                         error.response?.data?.error?.toLowerCase().includes('quota exceeded') ||
                         error.response?.data?.error_description?.toLowerCase().includes('quota exceeded');
      
      // Check specifically for 403 vs 429 status
      const is403Error = error.response?.status === 403 || error.status === 403;
      const is429Error = error.response?.status === 429 || error.status === 429;
      
      // Create user-friendly error message
      let errorMessage: string;
      let retryAfter: string | undefined;
      
      if (isRateLimit) {
        console.warn('🚫 Rate limit detected:', {
          status: error.response?.status || error.status,
          message: error.message,
          data: error.response?.data
        });
        
        // Enhanced quota exceeded message
        retryAfter = error.response?.headers?.['retry-after'] || 
                    error.response?.headers?.['Retry-After'] ||
                    error.response?.data?.retry_after ||
                    error.response?.data?.retryAfter ||
                    error.retryAfter;
        
        if (is403Error) {
          // 403 errors are permanent quota exceeded (no retry)
          errorMessage = `🚫 API Quota Exceeded: You've reached the maximum daily/monthly API quota limit. This limit will reset at the next billing cycle.`;
        } else if (is429Error && retryAfter) {
          // 429 errors are temporary rate limits (with retry-after)
          const retrySeconds = parseInt(retryAfter);
          const retryMinutes = Math.ceil(retrySeconds / 60);
          errorMessage = `🚫 API Rate Limited: Too many requests. Please wait ${retryMinutes} minute${retryMinutes > 1 ? 's' : ''} before trying again.`;
        } else {
          // Generic rate limit message
          errorMessage = `🚫 API Rate Limited: Too many requests while ${context}. Please wait before trying again.`;
        }

        // Notify global quota context if available (for both 403 and 429)
        this.notifyQuotaExceeded(retryAfter);
      } else {
        errorMessage = error.message || `Failed to ${context}`;
      }

      // Call custom error handler if provided
      if (onError) {
        onError(errorMessage, isRateLimit);
      }

      // Re-throw with enhanced error message
      const enhancedError: any = new Error(errorMessage);
      enhancedError.originalError = error;
      enhancedError.isRateLimit = isRateLimit;
      enhancedError.retryAfter = retryAfter;
      throw enhancedError;
    }
  }

  // Method to notify quota context (will be set by the app)
  private notifyQuotaExceeded(retryAfter?: string): void {
    console.warn(`🚫 API Quota Exceeded - Retry after: ${retryAfter || 'unknown'} seconds`);
    
    // This will be set by the app when the service is initialized
    if ((window as any).__quotaContext) {
      (window as any).__quotaContext.setQuotaExceeded(true, retryAfter);
      console.log('✅ Quota notification triggered successfully');
    } else {
      console.warn('⚠️ Quota context not available - notification may not display');
      
      // Fallback: try to set up the context if it's not available
      // This can happen if the error occurs before the App component has mounted
      const setupQuotaContext = () => {
        if ((window as any).__quotaContext) {
          (window as any).__quotaContext.setQuotaExceeded(true, retryAfter);
          console.log('✅ Quota notification triggered via fallback mechanism');
          return true;
        }
        return false;
      };
      
      // Try immediately
      if (!setupQuotaContext()) {
        // If not available, try again after a short delay
        setTimeout(() => {
          if (!setupQuotaContext()) {
            console.error('❌ Failed to trigger quota notification - context not available after retry');
          }
        }, 100);
      }
    }
  }

  // Method to clear quota notification
  private clearQuotaExceeded(): void {
    console.log('✅ Quota notification cleared');
    
    // This will be set by the app when the service is initialized
    if ((window as any).__quotaContext) {
      (window as any).__quotaContext.clearQuotaExceeded();
      console.log('✅ Quota notification cleared successfully');
    } else {
      console.warn('⚠️ Quota context not available - notification may not clear');
      
      // Fallback: try to set up the context if it's not available
      const setupQuotaContext = () => {
        if ((window as any).__quotaContext) {
          (window as any).__quotaContext.clearQuotaExceeded();
          console.log('✅ Quota notification cleared via fallback mechanism');
          return true;
        }
        return false;
      };
      
      // Try immediately
      if (!setupQuotaContext()) {
        // If not available, try again after a short delay
        setTimeout(() => {
          if (!setupQuotaContext()) {
            console.error('❌ Failed to clear quota notification - context not available after retry');
          }
        }, 100);
      }
    }
  }

  // Check authentication status with the proxy server
  async checkAuthentication(): Promise<SessionInfo> {
    const now = Date.now();
    
    // If we have cached session info and it's within the cache duration, return it
    if (this.sessionInfo && (now - this.lastSessionCheck) < this.SESSION_CACHE_DURATION) {
      console.log('📋 Using cached session info (debounced)');
      return this.sessionInfo;
    }

    // Avoid multiple simultaneous requests
    if (this.sessionCheckPromise) {
      return this.sessionCheckPromise;
    }

    console.log('🔄 Fetching fresh session info from /blackbaud/oauth/session');
    this.sessionCheckPromise = this.fetchSessionInfo();
    
    try {
      this.sessionInfo = await this.sessionCheckPromise;
      this.lastSessionCheck = now;
      return this.sessionInfo;
    } finally {
      this.sessionCheckPromise = null;
    }
  }

  // Fetch session info and bearer token from proxy server
  private async fetchSessionInfo(): Promise<SessionInfo> {
    try {
      const response = await axios.get<OAuthSessionResponse>('/blackbaud/oauth/session', {
        timeout: 10000,
        withCredentials: true, // Include cookies for proxy authentication
      });
      
      const oauthResponse = response.data;
      
      // Convert OAuthSessionResponse to SessionInfo for backward compatibility
      const sessionInfo: SessionInfo = {
        authenticated: oauthResponse.authenticated,
        provider: oauthResponse.provider,
        timestamp: oauthResponse.timestamp,
        subscriptionKey: oauthResponse.subscriptionKey,
        subscriptionKeyHeader: oauthResponse.subscriptionKeyHeader,
        // Extract session data if available
        ...(oauthResponse.session && {
          accessToken: oauthResponse.session.accessToken,
          tokenType: oauthResponse.session.tokenType,
          scope: oauthResponse.session.scope,
          expiresAt: oauthResponse.session.expiresAt,
          isExpired: oauthResponse.session.isExpired,
          expiresIn: oauthResponse.session.expiresIn,
          sessionId: oauthResponse.session.sessionId,
        })
      };
      
      return sessionInfo;
    } catch (error: any) {
      console.error('Failed to check authentication status:', error);
      return { authenticated: false };
    }
  }

  // Check if user is authenticated (cached)
  isAuthenticated(): boolean {
    return this.sessionInfo?.authenticated ?? false;
  }

  // Get cached session info
  getSessionInfo(): SessionInfo | null {
    return this.sessionInfo;
  }

  // Check if the current session token is expired
  isTokenExpired(): boolean {
    if (!this.sessionInfo?.accessToken) {
      return true;
    }
    
    // Check if we have explicit expiration info
    if (this.sessionInfo.isExpired !== undefined) {
      return this.sessionInfo.isExpired;
    }
    
    // Check expiresAt timestamp
    if (this.sessionInfo.expiresAt) {
      const expiresAt = new Date(this.sessionInfo.expiresAt);
      return expiresAt <= new Date();
    }
    
    // Check expiresIn (seconds from now)
    if (this.sessionInfo.expiresIn !== null && this.sessionInfo.expiresIn !== undefined) {
      return this.sessionInfo.expiresIn <= 0;
    }
    
    // If we can't determine expiration, assume it's valid
    return false;
  }

  // Get session details for debugging/logging
  getSessionDetails(): {
    authenticated: boolean;
    provider?: string;
    tokenType?: string;
    scope?: string;
    expiresAt?: string;
    isExpired?: boolean;
    expiresIn?: number | null;
    sessionId?: string;
    timestamp?: string;
  } {
    if (!this.sessionInfo) {
      return { authenticated: false };
    }
    
    return {
      authenticated: this.sessionInfo.authenticated,
      provider: this.sessionInfo.provider,
      tokenType: this.sessionInfo.tokenType,
      scope: this.sessionInfo.scope,
      expiresAt: this.sessionInfo.expiresAt,
      isExpired: this.sessionInfo.isExpired,
      expiresIn: this.sessionInfo.expiresIn,
      sessionId: this.sessionInfo.sessionId,
      timestamp: this.sessionInfo.timestamp,
    };
  }

  // Initiate login by redirecting to the protected route
  // The proxy server will handle OAuth2 redirect automatically
  initiateLogin(): void {
    // Save current application state to URL before redirecting
    this.saveCurrentStateToUrl();
    
    // Simply redirect to the app root - proxy server will handle OAuth2
    window.location.href = '/blackbaud/';
  }

  // Initiate login using iframe for seamless re-authentication
  initiateLoginInIframe(): Promise<SessionInfo> {
    return new Promise((resolve, reject) => {
      // Create iframe for OAuth flow
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '0';
      iframe.style.left = '0';
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      iframe.style.zIndex = '9999';
      iframe.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      iframe.src = '/blackbaud/oauth/login?iframe=true';
      
      // Add iframe to page
      document.body.appendChild(iframe);
      
      // Listen for messages from iframe
      const messageHandler = async (event: MessageEvent) => {
        // Only accept messages from our domain
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'OAUTH_SUCCESS') {
          // Remove iframe and event listener
          document.body.removeChild(iframe);
          window.removeEventListener('message', messageHandler);
          
          // Check authentication status
          try {
            const session = await this.checkAuthentication();
            resolve(session);
          } catch (error) {
            reject(error);
          }
        } else if (event.data.type === 'OAUTH_ERROR') {
          // Remove iframe and event listener
          document.body.removeChild(iframe);
          window.removeEventListener('message', messageHandler);
          reject(new Error(event.data.error || 'OAuth authentication failed'));
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      // Add close button to iframe
      const closeButton = document.createElement('button');
      closeButton.textContent = '✕';
      closeButton.style.position = 'fixed';
      closeButton.style.top = '20px';
      closeButton.style.right = '20px';
      closeButton.style.zIndex = '10000';
      closeButton.style.background = '#dc3545';
      closeButton.style.color = 'white';
      closeButton.style.border = 'none';
      closeButton.style.borderRadius = '50%';
      closeButton.style.width = '40px';
      closeButton.style.height = '40px';
      closeButton.style.fontSize = '20px';
      closeButton.style.cursor = 'pointer';
      closeButton.onclick = () => {
        document.body.removeChild(iframe);
        document.body.removeChild(closeButton);
        window.removeEventListener('message', messageHandler);
        reject(new Error('OAuth authentication cancelled by user'));
      };
      
      document.body.appendChild(closeButton);
      
      // Timeout after 5 minutes
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
          document.body.removeChild(closeButton);
          window.removeEventListener('message', messageHandler);
          reject(new Error('OAuth authentication timed out'));
        }
      }, 5 * 60 * 1000);
    });
  }

  // Save current application state to URL for restoration after re-authentication
  private saveCurrentStateToUrl(): void {
    try {
      const currentState = {
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        timestamp: Date.now()
      };
      
      // Store state in sessionStorage for restoration
      sessionStorage.setItem('blackbaud_pre_auth_state', JSON.stringify(currentState));
      console.log('💾 Saved pre-authentication state:', currentState);
    } catch (error) {
      console.warn('Failed to save pre-authentication state:', error);
    }
  }

  // Restore application state after successful re-authentication
  restoreStateAfterAuth(): void {
    try {
      const savedState = sessionStorage.getItem('blackbaud_pre_auth_state');
      if (savedState) {
        const state = JSON.parse(savedState);
        const stateAge = Date.now() - state.timestamp;
        
        // Only restore state if it's less than 30 minutes old
        if (stateAge < 30 * 60 * 1000) {
          const targetUrl = `${state.pathname}${state.search}${state.hash}`;
          console.log('🔄 Restoring pre-authentication state:', targetUrl);
          
          // Clear the saved state
          sessionStorage.removeItem('blackbaud_pre_auth_state');
          
          // Navigate to the saved state
          window.location.href = targetUrl;
          return;
        } else {
          console.log('⏰ Pre-authentication state expired, not restoring');
          sessionStorage.removeItem('blackbaud_pre_auth_state');
        }
      }
    } catch (error) {
      console.warn('Failed to restore pre-authentication state:', error);
      sessionStorage.removeItem('blackbaud_pre_auth_state');
    }
  }

  // Logout by calling the proxy server logout endpoint
  async logout(): Promise<void> {
    try {
      // Call proxy server logout endpoint
      await axios.get('/blackbaud/oauth/logout', {
        timeout: 5000,
        withCredentials: true,
      });
    } catch (error) {
      console.error('Logout request failed:', error);
      // Continue with logout even if server request fails
    }
    
    // Clear cached session info
    this.sessionInfo = { authenticated: false };
    
    // Redirect to home page
    window.location.href = '/blackbaud/';
  }

  // Make authenticated API request directly to Blackbaud APIs using tokens from proxy
  async apiRequest<T = any>(url: string, options: ApiRequestOptions = {}): Promise<T> {
    const executeRequest = async (): Promise<T> => {
      // Check authentication status first to get the latest bearer token and subscription key
      const session = await this.checkAuthentication();
      
      if (!session.authenticated || !session.accessToken) {
        throw new Error('Not authenticated - please log in');
      }

      if (!session.subscriptionKey) {
        throw new Error('Subscription key not available from proxy server. Please check proxy configuration.');
      }

      // Prepare headers with authentication and subscription key from proxy
      const headers: Record<string, string> = {
        'Authorization': `${session.tokenType || 'Bearer'} ${session.accessToken}`,
        'Bb-Api-Subscription-Key': session.subscriptionKey,
        'Content-Type': 'application/json',
        ...options.headers,
      };

      const axiosConfig: AxiosRequestConfig = {
        url: `${this.BLACKBAUD_API_BASE}${url}`,
        method: options.method || 'GET',
        headers,
        data: options.data,
        params: options.params,
        timeout: 30000,
      };

      try {
        const response: AxiosResponse<T> = await axios(axiosConfig);
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 401) {
          // Authentication failed - try iframe-based re-authentication
          console.log('🔐 Authentication failed, attempting iframe-based re-authentication');
          try {
            const newSession = await this.initiateLoginInIframe();
            if (newSession.authenticated && newSession.accessToken && newSession.subscriptionKey) {
              // Retry the request with fresh token and subscription key
              axiosConfig.headers!['Authorization'] = `${newSession.tokenType || 'Bearer'} ${newSession.accessToken}`;
              axiosConfig.headers!['Bb-Api-Subscription-Key'] = newSession.subscriptionKey;
              const retryResponse: AxiosResponse<T> = await axios(axiosConfig);
              return retryResponse.data;
            }
          } catch (iframeError) {
            console.error('Iframe re-authentication failed, falling back to full page redirect:', iframeError);
            // Fallback to full page redirect
            this.saveCurrentStateToUrl();
            throw new Error('Authentication expired - please log in again');
          }
        }
        
        // Re-throw other errors with more context
        const errorMessage = error.response?.data?.message || 
                             error.response?.data?.error_description || 
                             error.response?.data?.error || 
                             error.message;
        throw new Error(`API request failed: ${errorMessage}`);
      }
    };

    // Use retry logic unless explicitly disabled
    if (options.retries !== false) {
      return this.withRetry(executeRequest);
    } else {
      return executeRequest();
    }
  }

  // Get gifts with comprehensive filtering and caching
  @cache({ 
    keyPrefix: 'gifts', 
    expirationMs: 24*60*60*1000, // 24 hours
    keyGenerator: (limit: number, offset: number, filters: any) => {
      const filterString = filters ? JSON.stringify(filters) : 'no-filters';
      return `limit_${limit}_offset_${offset}_filters_${filterString}`;
    }
  })
  async getGifts(
    limit: number = 1000, 
    offset: number = 0, 
    filters?: {
      listId?: string;
      giftType?: string;
      giftStatus?: string;
      dateFrom?: string;
      dateTo?: string;
      amountFrom?: number;
      amountTo?: number;
      constituentId?: string;
      designation?: string;
      campaign?: string;
      appeal?: string;
      subtype?: string;
      acknowledgmentStatus?: string;
      receiptStatus?: string;
      isAnonymous?: boolean;
      sortBy?: string;
      sortDirection?: 'asc' | 'desc';
    }
  ): Promise<any> {
    let url = `/gift/v1/gifts?limit=${limit}&offset=${offset}`;
    
    // Add filter parameters
    if (filters) {
      if (filters.listId) {
        url += `&list_id=${encodeURIComponent(filters.listId)}`;
      }
      if (filters.giftType) {
        url += `&gift_type=${encodeURIComponent(filters.giftType)}`;
      }
      if (filters.giftStatus) {
        url += `&gift_status=${encodeURIComponent(filters.giftStatus)}`;
      }
      if (filters.dateFrom) {
        url += `&date_from=${encodeURIComponent(filters.dateFrom)}`;
      }
      if (filters.dateTo) {
        url += `&date_to=${encodeURIComponent(filters.dateTo)}`;
      }
      if (filters.amountFrom !== undefined) {
        url += `&amount_from=${filters.amountFrom}`;
      }
      if (filters.amountTo !== undefined) {
        url += `&amount_to=${filters.amountTo}`;
      }
      if (filters.constituentId) {
        url += `&constituent_id=${encodeURIComponent(filters.constituentId)}`;
      }
      if (filters.designation) {
        url += `&designation=${encodeURIComponent(filters.designation)}`;
      }
      if (filters.campaign) {
        url += `&campaign=${encodeURIComponent(filters.campaign)}`;
      }
      if (filters.appeal) {
        url += `&appeal=${encodeURIComponent(filters.appeal)}`;
      }
      if (filters.subtype) {
        url += `&subtype=${encodeURIComponent(filters.subtype)}`;
      }
      if (filters.acknowledgmentStatus) {
        url += `&acknowledgment_status=${encodeURIComponent(filters.acknowledgmentStatus)}`;
      }
      if (filters.receiptStatus) {
        url += `&receipt_status=${encodeURIComponent(filters.receiptStatus)}`;
      }
      if (filters.isAnonymous !== undefined) {
        url += `&is_anonymous=${filters.isAnonymous}`;
      }
      if (filters.sortBy) {
        url += `&sort_by=${encodeURIComponent(filters.sortBy)}`;
        if (filters.sortDirection) {
          url += `&sort_direction=${filters.sortDirection}`;
        }
      }
    }
    
    return this.apiRequest(url);
  }

  // Get gift attachments for a specific gift
  @cache({ 
    keyPrefix: 'getGiftAttachments', 
    expirationMs: 30*60*1000, // 30 minutes
    keyGenerator: (giftId: string) => `${giftId}`
  })
  async getGiftAttachments(giftId: string): Promise<any> {
    const taskId = `gift-attachments-${giftId}-${Date.now()}`;
    
    return new Promise((resolve, reject) => {
      attachmentQueue.add({
        id: taskId,
        type: 'gift-attachments',
        execute: async () => {
          return await this.apiRequest(`/gift/v1/gifts/${giftId}/attachments`);
        },
        onSuccess: (result) => {
          console.log(`✅ Gift attachments for ${giftId} completed via queue`);
          resolve(result);
        },
        onError: (error) => {
          console.error(`❌ Gift attachments for ${giftId} failed via queue:`, error);
          reject(error);
        }
      });
    });
  }

  // Get lists from the List API
  @cache({ 
    keyPrefix: 'lists', 
    expirationMs: 6000000, // 100 minutes
    keyGenerator: (limit: number, listType?: string) => `limit_${limit}_type_${listType || 'none'}`
  })
  async getLists(limit: number = 50, listType?: string): Promise<any> {
    let url = `/list/v1/lists?limit=${limit}`;
    if (listType) {
      url += `&list_type=${encodeURIComponent(listType)}`;
    }
    return this.apiRequest(url);
  }

  // Get a single list by ID
  @cache({ 
    keyPrefix: 'getList', 
    expirationMs: 24*60*60*1000, // 1 day
    keyGenerator: (listId: string) => `${listId}`
  })
  async getList(listId: string): Promise<any> {
    const url = `/list/v1/lists/${listId}`;
    return this.apiRequest(url);
  }

  // Get queries from the Query API
  @cache({ 
    keyPrefix: 'queries', 
    expirationMs: 900000, // 15 minutes
    keyGenerator: (limit: number) => `limit_${limit}`
  })
  async getQueries(limit: number = 50): Promise<any> {
    const url = `/query/queries?product=RE&module=None&limit=${limit}`;
    return this.apiRequest(url);
  }

  // Get constituent information by ID with caching
  @cache({ 
    keyPrefix: 'getConstituent', 
    expirationMs: 30*24*60*60*1000, // 30 days
    keyGenerator: (constituentId: string) => `${constituentId}`
  })
  async getConstituent(constituentId: string): Promise<ConstituentInfo | null> {
    // Check if there's already a pending request for this constituent
    const promiseKey = `constituent_${constituentId}`;
    let constituentPromise = this.constituentPromises.get(promiseKey);
    
    if (constituentPromise) {
      console.log(`⏳ Reusing existing request for constituent ${constituentId}`);
      return constituentPromise;
    }
    
    console.log(`🔍 getConstituent called for ID: ${constituentId}`);
    
    // Create new promise for this constituent
    constituentPromise = (async () => {
      try {
        const response = await this.apiRequest(`/constituent/v1/constituents/${constituentId}`);
        console.log(`📡 Raw API response for ${constituentId}:`, response);
        
        // Handle different possible response formats
        let constituentData: ConstituentInfo;
        if (response && typeof response === 'object') {
          if (response.value && Array.isArray(response.value)) {
            // Response might be wrapped in a value array
            constituentData = response.value[0] as ConstituentInfo;
          } else if (response.id) {
            // Direct constituent object
            constituentData = response as ConstituentInfo;
          } else {
            console.error(`❌ Unexpected response format for ${constituentId}:`, response);
            return null;
          }
        } else {
          console.error(`❌ Invalid response for ${constituentId}:`, response);
          return null;
        }
        
        console.log(`✅ getConstituent success for ${constituentId}:`, constituentData);
        
        // Validate that we have at least an ID and some identifying information
        if (!constituentData.id) {
          console.error(`❌ Constituent ${constituentId} missing ID in response`);
          return null;
        }
        
        return constituentData;
      } catch (error: any) {
        console.error(`❌ getConstituent failed for ${constituentId}:`, error);
        return null;
      } finally {
        // Remove from pending promises
        this.constituentPromises.delete(promiseKey);
        console.log(`📝 Removed constituent ${constituentId} from pending promises (total: ${this.constituentPromises.size})`);
      }
    })();
    
    // Store the promise for memoization
    this.constituentPromises.set(promiseKey, constituentPromise);
    console.log(`📝 Added constituent ${constituentId} to pending promises (total: ${this.constituentPromises.size})`);
    
    return constituentPromise;
  }

  // Get multiple constituents with batch caching
  async getConstituents(constituentIds: string[], useCache: boolean = true): Promise<Record<string, ConstituentInfo | null>> {
    console.log(`🔍 getConstituents called with ${constituentIds.length} IDs, useCache: ${useCache}:`, constituentIds);
    
    const results: Record<string, ConstituentInfo | null> = {};

    // If caching is disabled, fetch all constituents directly
    if (!useCache) {
      console.log(`📡 Fetching all ${constituentIds.length} constituents from API (cache disabled)`);
      const fetchPromises = constituentIds.map(async (id) => {
        console.log(`🔄 Fetching constituent ${id} from API`);
        const constituent = await this.getConstituent(id);
        results[id] = constituent;
        console.log(`✅ Fetched constituent ${id}:`, constituent);
      });

      await Promise.all(fetchPromises);
      console.log(`🎯 Final results:`, results);
      return results;
    }

    // If caching is enabled, check individual constituent cache first
    const uncachedIds: string[] = [];

    for (const id of constituentIds) {
      try {
        const cachedData = await constituentCacheUtils.get(id);
        if (cachedData) {
          results[id] = cachedData;
          console.log(`💾 Found cached data for constituent ${id}:`, cachedData);
          continue;
        }
      } catch (error) {
        console.warn(`Failed to read constituent ${id} from cache:`, error);
      }
      uncachedIds.push(id);
    }

    console.log(`📡 Need to fetch ${uncachedIds.length} uncached constituents:`, uncachedIds);

    // Fetch uncached constituents from API with memoization
    const fetchPromises = uncachedIds.map(async (id) => {
      // Check if there's already a pending request for this constituent
      const promiseKey = `constituent_${id}`;
      let constituentPromise = this.constituentPromises.get(promiseKey);
      
      if (!constituentPromise) {
        console.log(`🔄 Creating new API request for constituent ${id}`);
        constituentPromise = this.getConstituent(id).then(constituent => {
          // Cache the result
          if (constituent) {
            constituentCacheUtils.set(id, constituent);
            console.log(`💾 Cached constituent ${id}:`, constituent);
          }
          
          // Remove from pending promises
          this.constituentPromises.delete(promiseKey);
          return constituent;
        }).catch(error => {
          // Remove from pending promises on error
          this.constituentPromises.delete(promiseKey);
          console.error(`❌ Failed to fetch constituent ${id}:`, error);
          return null;
        });
        
        // Store the promise for memoization
        this.constituentPromises.set(promiseKey, constituentPromise);
        console.log(`📝 Added constituent ${id} to pending promises (total: ${this.constituentPromises.size})`);
      } else {
        console.log(`⏳ Reusing existing request for constituent ${id}`);
      }
      
      const constituent = await constituentPromise;
      results[id] = constituent;
      console.log(`✅ Fetched constituent ${id}:`, constituent);
    });

    await Promise.all(fetchPromises);
    console.log(`🎯 Final results:`, results);
    return results;
  }

  // Clear constituent cache
  clearConstituentCache(constituentId?: string): void {
    // Clear from IndexedDB
    constituentCacheUtils.delete(constituentId);
    
    // Clear memoized promises for this constituent
    if (constituentId) {
      const promiseKeysToDelete = Array.from(this.constituentPromises.keys())
        .filter(key => key.startsWith(`${constituentId}_`));
      promiseKeysToDelete.forEach(key => this.constituentPromises.delete(key));
      
      console.log(`Cleared cache and ${promiseKeysToDelete.length} memoized promises for constituent ${constituentId}`);
    } else {
      // Clear all memoized promises
      const promiseCount = this.constituentPromises.size;
      this.constituentPromises.clear();
      
      console.log(`Cleared cache for all constituents and ${promiseCount} memoized promises`);
    }
  }

  // Get cache statistics including memoized promises
  async getCacheStats(): Promise<{ count: number; totalSize: number; oldestEntry?: Date; pendingPromises: number }> {
    const stats = await constituentCacheUtils.getStats();
    
    return {
      count: stats.count,
      totalSize: stats.totalSize,
      oldestEntry: stats.oldestEntry,
      pendingPromises: this.constituentPromises.size
    };
  }

  // Make API request using a full URL (for pagination next_link)
  async apiRequestUrl<T = any>(fullUrl: string, options: ApiRequestOptions = {}): Promise<T> {
    const executeRequest = async (): Promise<T> => {
      // Check authentication status first to get the latest bearer token and subscription key
      const session = await this.checkAuthentication();
      
      if (!session.authenticated || !session.accessToken) {
        throw new Error('Not authenticated - please log in');
      }

      if (!session.subscriptionKey) {
        throw new Error('Subscription key not available from proxy server. Please check proxy configuration.');
      }

      // Prepare headers with authentication and subscription key from proxy
      const headers: Record<string, string> = {
        'Authorization': `${session.tokenType || 'Bearer'} ${session.accessToken}`,
        'Bb-Api-Subscription-Key': session.subscriptionKey,
        'Content-Type': 'application/json',
        ...options.headers,
      };

      const axiosConfig: AxiosRequestConfig = {
        url: fullUrl,
        method: options.method || 'GET',
        headers,
        data: options.data,
        params: options.params,
        timeout: 30000,
      };

      try {
        const response: AxiosResponse<T> = await axios(axiosConfig);
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 401) {
          // Authentication failed - try iframe-based re-authentication
          console.log('🔐 Authentication failed, attempting iframe-based re-authentication');
          try {
            const newSession = await this.initiateLoginInIframe();
            if (newSession.authenticated && newSession.accessToken && newSession.subscriptionKey) {
              // Retry the request with fresh token and subscription key
              axiosConfig.headers!['Authorization'] = `${newSession.tokenType || 'Bearer'} ${newSession.accessToken}`;
              axiosConfig.headers!['Bb-Api-Subscription-Key'] = newSession.subscriptionKey;
              const retryResponse: AxiosResponse<T> = await axios(axiosConfig);
              return retryResponse.data;
            }
          } catch (iframeError) {
            console.error('Iframe re-authentication failed, falling back to full page redirect:', iframeError);
            // Fallback to full page redirect
            this.saveCurrentStateToUrl();
            throw new Error('Authentication expired - please log in again');
          }
        }
        
        // Re-throw other errors with more context
        const errorMessage = error.response?.data?.message || 
                             error.response?.data?.error_description || 
                             error.response?.data?.error || 
                             error.message;
        throw new Error(`API request failed: ${errorMessage}`);
      }
    };

    // Use retry logic unless explicitly disabled
    if (options.retries !== false) {
      return this.withRetry(executeRequest);
    } else {
      return executeRequest();
    }
  }

  // Get user profile information
  async getUserProfile(): Promise<any> {
    try {
      // Try different potential user endpoints
      return await this.apiRequest('/constituent/v1/constituents/me');
    } catch (error) {
      console.error('Failed to get user profile:', error);
      try {
        // Fallback to a different endpoint if available
        return await this.apiRequest('/user/v1/user');
      } catch (fallbackError) {
        console.error('Fallback user profile request also failed:', fallbackError);
        return { name: 'User', email: 'Not available' };
      }
    }
  }

  // Refresh authentication status
  async refresh(): Promise<SessionInfo> {
    this.sessionInfo = null; // Clear cache
    return this.checkAuthentication();
  }

  // Helper method to get available API endpoints (for debugging)
  async testApiEndpoints(): Promise<any> {
    const endpoints = [
      '/gift/v1/gifts?limit=1',
      '/constituent/v1/constituents?limit=1',
      '/fundraising/v1/campaigns?limit=1',
      '/fundraising/v1/funds?limit=1',
    ];

    const results: Record<string, any> = {};

    for (const endpoint of endpoints) {
      try {
        const data = await this.apiRequest(endpoint);
        results[endpoint] = { success: true, data };
      } catch (error: any) {
        results[endpoint] = { success: false, error: error.message };
      }
    }

    return results;
  }

  // Force refresh session info (bypasses cache)
  async forceRefreshSession(): Promise<SessionInfo> {
    console.log('🔄 Force refreshing session info');
    this.sessionInfo = null;
    this.lastSessionCheck = 0;
    this.sessionCheckPromise = null;
    return this.checkAuthentication();
  }

  // Clear gift cache
  clearGiftCache(filters?: any): void {
    giftCacheUtils.delete(filters);
    console.log(`Cleared gift cache${filters ? ' for specific filters' : ' for all gifts'}`);
  }

  // Get gift cache statistics
  async getGiftCacheStats(): Promise<{ count: number; totalSize: number; filterCombinations: number }> {
    return await giftCacheUtils.getStats();
  }
}

// Export singleton instance
const authService = new AuthService();
export default authService; 