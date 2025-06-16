import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

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
  }

  // Convenience method for making Blackbaud Gift API calls
  async getGifts(limit: number = 50, listId?: string): Promise<any> {
    let url = `/gift/v1/gifts?limit=${limit}`;
    if (listId) {
      url += `&list_id=${encodeURIComponent(listId)}`;
    }
    return this.apiRequest(url);
  }

  // Get gift attachments for a specific gift
  async getGiftAttachments(giftId: string): Promise<any> {
    return this.apiRequest(`/gift/v1/gifts/${giftId}/attachments`);
  }

  // Get lists from the List API
  async getLists(limit: number = 50, listType?: string): Promise<any> {
    let url = `/list/v1/lists?limit=${limit}`;
    if (listType) {
      url += `&list_type=${encodeURIComponent(listType)}`;
    }
    return this.apiRequest(url);
  }

  // Get queries from the Query API
  async getQueries(limit: number = 50): Promise<any> {
    const url = `/query/queries?product=RE&module=None&limit=${limit}`;
    return this.apiRequest(url);
  }

  // Get constituent information by ID with caching
  async getConstituent(constituentId: string, useCache: boolean = true): Promise<ConstituentInfo | null> {
    const cacheKey = `constituent_${constituentId}`;
    const promiseKey = `${constituentId}_${useCache}`;
    
    // Check if there's already a pending request for this constituent
    if (this.constituentPromises.has(promiseKey)) {
      console.log(`Using memoized promise for constituent ID: ${constituentId}`);
      return this.constituentPromises.get(promiseKey)!;
    }

    // Create and memoize the promise
    const promise = this.fetchConstituentData(constituentId, useCache, cacheKey);
    this.constituentPromises.set(promiseKey, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      // Clean up the memoized promise after completion (success or failure)
      this.constituentPromises.delete(promiseKey);
    }
  }

  // Extracted constituent fetching logic for better separation of concerns
  private async fetchConstituentData(constituentId: string, useCache: boolean, cacheKey: string): Promise<ConstituentInfo | null> {
    // Check cache first if enabled
    if (useCache) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const cachedData = JSON.parse(cached);
          const now = Date.now();
          
          // Cache valid for 1 week (604800000 ms)
          if (cachedData.timestamp && (now - cachedData.timestamp) < 604800000) {
            console.log(`Using cached constituent data for ID: ${constituentId}`);
            return cachedData.data;
          } else {
            // Remove expired cache
            localStorage.removeItem(cacheKey);
          }
        }
      } catch (error) {
        console.warn('Failed to read constituent from cache:', error);
        localStorage.removeItem(cacheKey);
      }
    }

    // Fetch from API
    try {
      console.log(`Fetching constituent data from API for ID: ${constituentId}`);
      const constituentData: ConstituentInfo = await this.apiRequest(`/constituent/v1/constituents/${constituentId}`);
      
      // Cache the result if caching is enabled
      if (useCache) {
        try {
          const cacheData = {
            data: constituentData,
            timestamp: Date.now()
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
          console.log(`Cached constituent data for ID: ${constituentId}`);
        } catch (error) {
          console.warn('Failed to cache constituent data:', error);
        }
      }
      
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
      const constituent = await this.getConstituent(id, false); // Don't double-cache
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