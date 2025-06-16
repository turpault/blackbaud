import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { cache } from '../utils/cacheDecorator';

export interface SessionInfo {
  authenticated: boolean;
  tokenType?: string;
  scope?: string;
  expiresAt?: string;
  accessToken?: string;
  subscriptionKey?: string;
  user?: any;
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  data?: any;
  params?: any;
  retries?: boolean;
}

export interface ConstituentInfo {
  id: string;
  name?: string;
  first?: string;
  last?: string;
  middle?: string;
  former_name?: string;
  preferred_name?: string;
  suffix?: string;
  title?: string;
  lookup_id?: string;
  email?: {
    address: string;
    type?: string;
    primary?: boolean;
  };
  phone?: {
    number: string;
    type?: string;
    primary?: boolean;
  };
  address?: {
    address_lines?: string[];
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    type?: string;
    primary?: boolean;
  };
  birthdate?: {
    d?: number;
    m?: number;
    y?: number;
  };
  gender?: string;
  marital_status?: string;
  deceased?: boolean;
  date_added?: string;
  date_modified?: string;
  [key: string]: any;
}

class AuthService {
  private sessionInfo: SessionInfo | null = null;
  private sessionCheckPromise: Promise<SessionInfo> | null = null;
  
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
        
        // Check if it's a 429 error
        const is429Error = error.response?.status === 429 || 
                           error.status === 429 || 
                           error.message?.includes('429') ||
                           error.message?.toLowerCase().includes('rate limit') ||
                           error.message?.toLowerCase().includes('too many requests');
        
        // Only retry on 429 errors, and only if we have attempts left
        if (!is429Error || attempt === maxRetries) {
          throw error;
        }
        
        // Calculate delay with exponential backoff and jitter
        const backoffDelay = baseDelayMs * Math.pow(2, attempt);
        const jitter = Math.random() * 0.1 * backoffDelay; // 10% jitter
        const totalDelay = backoffDelay + jitter;
        
        console.warn(`Rate limited (429), retrying in ${Math.round(totalDelay)}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
        
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
      return await this.withRetry(queryFn);
    } catch (error: any) {
      // Check if it's a rate limiting error
      const isRateLimit = error.response?.status === 429 || 
                         error.status === 429 || 
                         error.message?.includes('429') ||
                         error.message?.toLowerCase().includes('rate limit') ||
                         error.message?.toLowerCase().includes('too many requests');
      
      // Create user-friendly error message
      let errorMessage: string;
      if (isRateLimit) {
        errorMessage = `⚠️ Rate limit reached while ${context}. The request is being retried automatically with exponential backoff. If this persists, please wait a few minutes before trying again.`;
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
      throw enhancedError;
    }
  }

  // Check authentication status with the proxy server
  async checkAuthentication(): Promise<SessionInfo> {
    // Avoid multiple simultaneous requests
    if (this.sessionCheckPromise) {
      return this.sessionCheckPromise;
    }

    this.sessionCheckPromise = this.fetchSessionInfo();
    
    try {
      this.sessionInfo = await this.sessionCheckPromise;
      return this.sessionInfo;
    } finally {
      this.sessionCheckPromise = null;
    }
  }

  // Fetch session info and bearer token from proxy server
  private async fetchSessionInfo(): Promise<SessionInfo> {
    try {
      const response = await axios.get<SessionInfo>('/blackbaud/oauth/session', {
        timeout: 10000,
        withCredentials: true, // Include cookies for proxy authentication
      });
      
      return response.data;
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

  // Initiate login by redirecting to the protected route
  // The proxy server will handle OAuth2 redirect automatically
  initiateLogin(): void {
    // Simply redirect to the app root - proxy server will handle OAuth2
    window.location.href = '/blackbaud/';
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
          // Token might be expired - clear cached session and retry once
          this.sessionInfo = null;
          
          try {
            const newSession = await this.checkAuthentication();
            if (newSession.authenticated && newSession.accessToken && newSession.subscriptionKey) {
              // Retry the request with fresh token and subscription key
              axiosConfig.headers!['Authorization'] = `${newSession.tokenType || 'Bearer'} ${newSession.accessToken}`;
              axiosConfig.headers!['Bb-Api-Subscription-Key'] = newSession.subscriptionKey;
              const retryResponse: AxiosResponse<T> = await axios(axiosConfig);
              return retryResponse.data;
            }
          } catch (retryError) {
            console.error('Failed to refresh session and retry request:', retryError);
          }
          
          // Authentication failed - redirect to login
          throw new Error('Authentication expired - please log in again');
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

  // Convenience method for making Blackbaud Gift API calls
  @cache({ 
    keyPrefix: 'gifts', 
    expirationMs: 300000, // 5 minutes
    keyGenerator: (limit: number, listId?: string) => `limit_${limit}_listId_${listId || 'none'}`
  })
  async getGifts(limit: number = 50, listId?: string): Promise<any> {
    let url = `/gift/v1/gifts?limit=${limit}`;
    if (listId) {
      url += `&list_id=${encodeURIComponent(listId)}`;
    }
    return this.apiRequest(url);
  }

  // Get gift attachments for a specific gift
  @cache({ 
    keyPrefix: 'getGiftAttachments', 
    expirationMs: 24*60*60*1000, // 24 hours
    keyGenerator: (giftId: string) => `${giftId}`
  })
  async getGiftAttachments(giftId: string): Promise<any> {
    return this.apiRequest(`/gift/v1/gifts/${giftId}/attachments`);
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
    expirationMs: 24*60*60*1000, // 1 day
    keyGenerator: (constituentId: string) => `${constituentId}`
  })
  async getConstituent(constituentId: string): Promise<ConstituentInfo | null> {
    try {
      console.log(`Fetching constituent data from API for ID: ${constituentId}`);
      const constituentData: ConstituentInfo = await this.apiRequest(`/constituent/v1/constituents/${constituentId}`);
      return constituentData;
    } catch (error: any) {
      console.error(`Failed to fetch constituent ${constituentId}:`, error);
      return null;
    }
  }

  // Get multiple constituents with batch caching
  async getConstituents(constituentIds: string[], useCache: boolean = true): Promise<Record<string, ConstituentInfo | null>> {
    const results: Record<string, ConstituentInfo | null> = {};
    const uncachedIds: string[] = [];

    // Check cache for each constituent if caching is enabled
    if (useCache) {
      for (const id of constituentIds) {
        const cacheKey = `constituent_${id}`;
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const cachedData = JSON.parse(cached);
            const now = Date.now();
            
            // Cache valid for 1 hour
            if (cachedData.timestamp && (now - cachedData.timestamp) < 3600000) {
              results[id] = cachedData.data;
              continue;
            } else {
              localStorage.removeItem(cacheKey);
            }
          }
        } catch (error) {
          console.warn(`Failed to read constituent ${id} from cache:`, error);
          localStorage.removeItem(cacheKey);
        }
        uncachedIds.push(id);
      }
    } else {
      uncachedIds.push(...constituentIds);
    }

    // Fetch uncached constituents from API
    const fetchPromises = uncachedIds.map(async (id) => {
      const constituent = await this.getConstituent(id);
      results[id] = constituent;
    });

    await Promise.all(fetchPromises);
    return results;
  }

  // Clear constituent cache
  clearConstituentCache(constituentId?: string): void {
    if (constituentId) {
      const cacheKey = `constituent_${constituentId}`;
      localStorage.removeItem(cacheKey);
      
      // Clear memoized promises for this constituent
      const promiseKeysToDelete = Array.from(this.constituentPromises.keys())
        .filter(key => key.startsWith(`${constituentId}_`));
      promiseKeysToDelete.forEach(key => this.constituentPromises.delete(key));
      
      console.log(`Cleared cache and ${promiseKeysToDelete.length} memoized promises for constituent ${constituentId}`);
    } else {
      // Clear all constituent cache
      const keys = Object.keys(localStorage);
      const constituentKeys = keys.filter(key => key.startsWith('constituent_'));
      constituentKeys.forEach(key => localStorage.removeItem(key));
      
      // Clear all memoized promises
      const promiseCount = this.constituentPromises.size;
      this.constituentPromises.clear();
      
      console.log(`Cleared cache for ${constituentKeys.length} constituents and ${promiseCount} memoized promises`);
    }
  }

  // Get cache statistics including memoized promises
  getCacheStats(): { count: number; totalSize: number; oldestEntry?: Date; pendingPromises: number } {
    const keys = Object.keys(localStorage);
    const constituentKeys = keys.filter(key => key.startsWith('constituent_'));
    let totalSize = 0;
    let oldestTimestamp = Date.now();

    constituentKeys.forEach(key => {
      const data = localStorage.getItem(key);
      if (data) {
        totalSize += data.length;
        try {
          const parsed = JSON.parse(data);
          if (parsed.timestamp && parsed.timestamp < oldestTimestamp) {
            oldestTimestamp = parsed.timestamp;
          }
        } catch (error) {
          // Invalid cache entry, remove it
          localStorage.removeItem(key);
        }
      }
    });

    return {
      count: constituentKeys.length,
      totalSize,
      oldestEntry: constituentKeys.length > 0 ? new Date(oldestTimestamp) : undefined,
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
          // Token might be expired - clear cached session and retry once
          this.sessionInfo = null;
          
          try {
            const newSession = await this.checkAuthentication();
            if (newSession.authenticated && newSession.accessToken && newSession.subscriptionKey) {
              // Retry the request with fresh token and subscription key
              axiosConfig.headers!['Authorization'] = `${newSession.tokenType || 'Bearer'} ${newSession.accessToken}`;
              axiosConfig.headers!['Bb-Api-Subscription-Key'] = newSession.subscriptionKey;
              const retryResponse: AxiosResponse<T> = await axios(axiosConfig);
              return retryResponse.data;
            }
          } catch (retryError) {
            console.error('Failed to refresh session and retry request:', retryError);
          }
          
          // Authentication failed - redirect to login
          throw new Error('Authentication expired - please log in again');
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

  // Helper method to get current session details (for debugging)
  getSessionDetails(): any {
    if (!this.sessionInfo) {
      return { error: 'No session information available' };
    }

    return {
      authenticated: this.sessionInfo.authenticated,
      tokenType: this.sessionInfo.tokenType,
      scope: this.sessionInfo.scope,
      expiresAt: this.sessionInfo.expiresAt,
      hasAccessToken: !!this.sessionInfo.accessToken,
      hasSubscriptionKey: !!this.sessionInfo.subscriptionKey,
      accessTokenLength: this.sessionInfo.accessToken?.length || 0,
      subscriptionKeyLength: this.sessionInfo.subscriptionKey?.length || 0,
    };
  }
}

// Export singleton instance
const authService = new AuthService();
export default authService; 