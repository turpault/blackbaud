import authService from '../authService';
import axios from 'axios';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock window.location
delete (window as any).location;
window.location = { href: '' } as any;

// Mock setTimeout for testing retry logic
jest.useFakeTimers();

describe('AuthService', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  describe('isAuthenticated', () => {
    it('should return false when session info is not available', () => {
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should return true when valid access token exists', () => {
      const futureTime = Date.now() + 3600000; // 1 hour from now
      localStorageMock.setItem('blackbaud_access_token', 'test-token');
      localStorageMock.setItem('blackbaud_token_expires', futureTime.toString());
      
      expect(authService.isAuthenticated()).toBe(true);
    });

    it('should return false when token is expired', () => {
      const pastTime = Date.now() - 3600000; // 1 hour ago
      localStorageMock.setItem('blackbaud_access_token', 'test-token');
      localStorageMock.setItem('blackbaud_token_expires', pastTime.toString());
      
      expect(authService.isAuthenticated()).toBe(false);
    });
  });

  describe('getAccessToken', () => {
    it('should return null when no token exists', () => {
      expect(authService.getAccessToken()).toBeNull();
    });

    it('should return the access token when it exists', () => {
      localStorageMock.setItem('blackbaud_access_token', 'test-token');
      
      expect(authService.getAccessToken()).toBe('test-token');
    });
  });

  describe('logout', () => {
    it('should clear all stored tokens and state', () => {
      localStorageMock.setItem('blackbaud_access_token', 'test-token');
      localStorageMock.setItem('blackbaud_refresh_token', 'refresh-token');
      localStorageMock.setItem('blackbaud_token_expires', '123456789');
      localStorageMock.setItem('oauth_state', 'test-state');

      authService.logout();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('blackbaud_access_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('blackbaud_refresh_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('blackbaud_token_expires');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('oauth_state');
    });
  });

  describe('initiateLogin', () => {
    it('should redirect to the authorization endpoint with correct parameters', () => {
      authService.initiateLogin();

      expect(localStorageMock.setItem).toHaveBeenCalledWith('oauth_state', expect.any(String));
      expect(window.location.href).toContain(OAUTH_CONFIG.authorizationEndpoint);
      expect(window.location.href).toContain(`client_id=${OAUTH_CONFIG.clientId}`);
      expect(window.location.href).toContain(`redirect_uri=${encodeURIComponent(OAUTH_CONFIG.redirectUri)}`);
      expect(window.location.href).toContain(`scope=${encodeURIComponent(OAUTH_CONFIG.scope)}`);
      expect(window.location.href).toContain('response_type=code');
    });
  });

  describe('429 rate limiting handling', () => {
    beforeEach(() => {
      // Mock axios for API tests
      jest.spyOn(axios, 'request').mockImplementation();
      
      // Mock console.warn to avoid noise in tests
      jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should retry API requests on 429 errors with exponential backoff', async () => {
      const mockAuthResponse = {
        authenticated: true,
        accessToken: 'test-token',
        subscriptionKey: 'test-key',
        tokenType: 'Bearer'
      };

      const mockSuccessResponse = {
        data: {
          count: 1,
          value: [{ id: '1', name: 'Test Query' }]
        }
      };

      // Mock the authentication check
      jest.spyOn(authService, 'checkAuthentication').mockResolvedValue(mockAuthResponse);

      // First call returns 429, second call succeeds
      (axios.request as jest.Mock)
        .mockRejectedValueOnce({
          response: { status: 429 },
          message: 'Rate limit exceeded'
        })
        .mockResolvedValueOnce(mockSuccessResponse);

      const resultPromise = authService.getQueries(50);

      // Fast-forward through the retry delay
      jest.advanceTimersByTime(2000);

      const result = await resultPromise;

      expect(axios.request).toHaveBeenCalledTimes(2);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Rate limited (429), retrying in')
      );
      expect(result).toEqual(mockSuccessResponse.data);
    });

    it('should fail after max retries on persistent 429 errors', async () => {
      const mockAuthResponse = {
        authenticated: true,
        accessToken: 'test-token',
        subscriptionKey: 'test-key',
        tokenType: 'Bearer'
      };

      jest.spyOn(authService, 'checkAuthentication').mockResolvedValue(mockAuthResponse);

      // All calls return 429
      (axios.request as jest.Mock).mockRejectedValue({
        response: { status: 429 },
        message: 'Rate limit exceeded'
      });

      const resultPromise = authService.getQueries(50);

      // Fast-forward through all retry delays
      for (let i = 0; i < 6; i++) {
        jest.advanceTimersByTime(10000);
      }

      await expect(resultPromise).rejects.toThrow('Rate limit exceeded');
      expect(axios.request).toHaveBeenCalledTimes(6); // Initial + 5 retries
    });

    it('should not retry on non-429 errors', async () => {
      const mockAuthResponse = {
        authenticated: true,
        accessToken: 'test-token',
        subscriptionKey: 'test-key',
        tokenType: 'Bearer'
      };

      jest.spyOn(authService, 'checkAuthentication').mockResolvedValue(mockAuthResponse);

      // Return 500 error (should not retry)
      (axios.request as jest.Mock).mockRejectedValue({
        response: { status: 500 },
        message: 'Internal server error'
      });

      await expect(authService.getQueries(50)).rejects.toThrow('Internal server error');
      expect(axios.request).toHaveBeenCalledTimes(1); // No retries
    });

    it('should allow disabling retries via options', async () => {
      const mockAuthResponse = {
        authenticated: true,
        accessToken: 'test-token',
        subscriptionKey: 'test-key',
        tokenType: 'Bearer'
      };

      jest.spyOn(authService, 'checkAuthentication').mockResolvedValue(mockAuthResponse);

      // Return 429 error
      (axios.request as jest.Mock).mockRejectedValue({
        response: { status: 429 },
        message: 'Rate limit exceeded'
      });

      await expect(
        authService.apiRequest('/test', { retries: false })
      ).rejects.toThrow('Rate limit exceeded');
      
      expect(axios.request).toHaveBeenCalledTimes(1); // No retries when disabled
    });
  });

  describe('centralized executeQuery handler', () => {
    beforeEach(() => {
      // Mock axios for API tests
      jest.spyOn(axios, 'request').mockImplementation();
      
      // Mock console.warn to avoid noise in tests
      jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should execute query successfully and return result', async () => {
      const mockResult = { data: 'test data' };
      const mockQueryFn = jest.fn().mockResolvedValue(mockResult);

      const result = await authService.executeQuery(mockQueryFn, 'test operation');

      expect(mockQueryFn).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResult);
    });

    it('should call error handler on 429 errors with rate limit message', async () => {
      const mockError = {
        response: { status: 429 },
        message: 'Rate limit exceeded'
      };
      const mockQueryFn = jest.fn().mockRejectedValue(mockError);
      const mockErrorHandler = jest.fn();

      await expect(
        authService.executeQuery(mockQueryFn, 'test operation', mockErrorHandler)
      ).rejects.toThrow();

      expect(mockErrorHandler).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Rate limit reached while test operation'),
        true
      );
    });

    it('should call error handler on non-429 errors with generic message', async () => {
      const mockError = {
        response: { status: 500 },
        message: 'Server error'
      };
      const mockQueryFn = jest.fn().mockRejectedValue(mockError);
      const mockErrorHandler = jest.fn();

      await expect(
        authService.executeQuery(mockQueryFn, 'test operation', mockErrorHandler)
      ).rejects.toThrow();

      expect(mockErrorHandler).toHaveBeenCalledWith(
        'Server error',
        false
      );
    });

    it('should enhance error with additional properties', async () => {
      const mockError = new Error('Test error');
      const mockQueryFn = jest.fn().mockRejectedValue(mockError);

      await expect(
        authService.executeQuery(mockQueryFn, 'test operation')
      ).rejects.toMatchObject({
        originalError: mockError,
        isRateLimit: false
      });
    });
  });

  describe('getQueries', () => {
    beforeEach(() => {
      // Mock axios for API tests
      jest.spyOn(axios, 'request').mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should call the correct API endpoint for queries', async () => {
      const mockResponse = {
        data: {
          count: 2,
          value: [
            { id: '1', name: 'Test Query 1', type: 'Constituent' },
            { id: '2', name: 'Test Query 2', type: 'Gift' }
          ]
        }
      };

      (axios.request as jest.Mock).mockResolvedValue(mockResponse);

      // Mock the authentication check
      jest.spyOn(authService, 'checkAuthentication').mockResolvedValue({
        authenticated: true,
        accessToken: 'test-token',
        subscriptionKey: 'test-key',
        tokenType: 'Bearer'
      });

      const result = await authService.getQueries(50);

      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/query/queries?product=RE&module=None&limit=50')
        })
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('should use default limit when none provided', async () => {
      const mockResponse = { data: { count: 0, value: [] } };
      (axios.request as jest.Mock).mockResolvedValue(mockResponse);

      jest.spyOn(authService, 'checkAuthentication').mockResolvedValue({
        authenticated: true,
        accessToken: 'test-token',
        subscriptionKey: 'test-key',
        tokenType: 'Bearer'
      });

      await authService.getQueries();

      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/query/queries?product=RE&module=None&limit=50')
        })
      );
    });
  });
}); 