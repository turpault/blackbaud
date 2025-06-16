import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

export interface SessionInfo {
  authenticated: boolean;
  tokenType?: string;
  scope?: string;
  expiresAt?: string;
  user?: any;
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  data?: any;
  params?: any;
}

class AuthService {
  private sessionInfo: SessionInfo | null = null;
  private sessionCheckPromise: Promise<SessionInfo> | null = null;

  constructor() {
    // No localStorage management needed - server handles all authentication
  }

  // Check authentication status with the server
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

  // Fetch session info from server
  private async fetchSessionInfo(): Promise<SessionInfo> {
    try {
      const response = await axios.get<SessionInfo>('/blackbaud/oauth/session', {
        timeout: 10000,
        withCredentials: true, // Include cookies
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

  // Logout by calling the server logout endpoint
  async logout(): Promise<void> {
    try {
      // Call server logout endpoint
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

  // Make authenticated API request to Blackbaud APIs
  async apiRequest<T = any>(url: string, options: ApiRequestOptions = {}): Promise<T> {
    // Check authentication status first
    const session = await this.checkAuthentication();
    
    if (!session.authenticated) {
      throw new Error('Not authenticated - please log in');
    }

    // For Blackbaud API calls, we need to use a proxy endpoint that adds the access token
    // The proxy server has the actual access token and can make authenticated calls
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const axiosConfig: AxiosRequestConfig = {
      url: `/blackbaud/api/proxy${url}`, // Proxy endpoint for Blackbaud API calls
      method: options.method || 'GET',
      headers,
      data: options.data,
      params: options.params,
      timeout: 30000,
      withCredentials: true, // Include authentication cookies
    };

    try {
      const response: AxiosResponse<T> = await axios(axiosConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        // Authentication failed - clear cached session and redirect to login
        this.sessionInfo = { authenticated: false };
        throw new Error('Authentication expired - please log in again');
      }
      
      // Re-throw other errors
      throw error;
    }
  }

  // Convenience method for making Blackbaud Gift API calls
  async getGifts(limit: number = 50): Promise<any> {
    return this.apiRequest(`/gift/v1/gifts?limit=${limit}`);
  }

  // Get user profile information
  async getUserProfile(): Promise<any> {
    // This would require implementing a user info endpoint on the proxy server
    // that calls the appropriate Blackbaud user API
    return this.apiRequest('/user/v1/user');
  }

  // Refresh authentication status
  async refresh(): Promise<SessionInfo> {
    this.sessionInfo = null; // Clear cache
    return this.checkAuthentication();
  }
}

// Export singleton instance
const authService = new AuthService();
export default authService; 