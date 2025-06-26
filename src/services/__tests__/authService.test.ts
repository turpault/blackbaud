import authService from '../authService';
import axios from 'axios';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: '',
  },
  writable: true,
});

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('checkAuthentication', () => {
    it('should return authenticated session when valid session exists', async () => {
      const mockResponse = {
        data: {
          authenticated: true,
          provider: 'blackbaud',
          timestamp: new Date().toISOString(),
          subscriptionKey: 'test-subscription-key',
          session: {
            accessToken: 'test-access-token',
            tokenType: 'Bearer',
            scope: 'test-scope',
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
            isExpired: false,
            expiresIn: 3600,
            sessionId: 'test-session-id'
          }
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await authService.checkAuthentication();

      expect(result.authenticated).toBe(true);
      expect(result.accessToken).toBe('test-access-token');
      expect(result.subscriptionKey).toBe('test-subscription-key');
      expect(mockedAxios.get).toHaveBeenCalledWith('/blackbaud/oauth/session', {
        timeout: 10000,
        withCredentials: true
      });
    });

    it('should return unauthenticated session when no valid session exists', async () => {
      const mockResponse = {
        data: {
          authenticated: false,
          provider: 'blackbaud',
          timestamp: new Date().toISOString()
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await authService.checkAuthentication();

      expect(result.authenticated).toBe(false);
      expect(result.accessToken).toBeUndefined();
    });

    it('should handle errors and return unauthenticated session', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const result = await authService.checkAuthentication();

      expect(result.authenticated).toBe(false);
    });
  });

  describe('quota exceeded handling', () => {
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
        expect.stringContaining('Quota exceeded (429), retrying in')
      );
      expect(result).toEqual(mockSuccessResponse.data);
    });

    it('should retry API requests on 403 Quota Exceeded errors with exponential backoff', async () => {
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

      // First call returns 403 Quota Exceeded, second call succeeds
      (axios.request as jest.Mock)
        .mockRejectedValueOnce({
          response: { 
            status: 403,
            data: {
              title: 'Quota Exceeded',
              detail: 'API quota has been exceeded'
            },
            headers: {
              'retry-after': '60'
            }
          },
          message: 'Quota Exceeded'
        })
        .mockResolvedValueOnce(mockSuccessResponse);

      const resultPromise = authService.getQueries(50);

      // Fast-forward through the retry delay
      jest.advanceTimersByTime(2000);

      const result = await resultPromise;

      expect(axios.request).toHaveBeenCalledTimes(2);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Quota exceeded (403), retrying in')
      );
      expect(result).toEqual(mockSuccessResponse.data);
    });

    it('should fail after max retries on persistent quota errors', async () => {
      const mockAuthResponse = {
        authenticated: true,
        accessToken: 'test-token',
        subscriptionKey: 'test-key',
        tokenType: 'Bearer'
      };

      jest.spyOn(authService, 'checkAuthentication').mockResolvedValue(mockAuthResponse);

      // All calls return 403 Quota Exceeded
      (axios.request as jest.Mock).mockRejectedValue({
        response: { 
          status: 403,
          data: {
            title: 'Quota Exceeded',
            detail: 'API quota has been exceeded'
          }
        },
        message: 'Quota Exceeded'
      });

      const resultPromise = authService.getQueries(50);

      // Fast-forward through all retry delays
      for (let i = 0; i < 6; i++) {
        jest.advanceTimersByTime(10000);
      }

      await expect(resultPromise).rejects.toThrow('Quota Exceeded');
      expect(axios.request).toHaveBeenCalledTimes(6); // Initial + 5 retries
    });

    it('should not retry on non-quota errors', async () => {
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

      // Return 403 Quota Exceeded error
      (axios.request as jest.Mock).mockRejectedValue({
        response: { 
          status: 403,
          data: {
            title: 'Quota Exceeded',
            detail: 'API quota has been exceeded'
          }
        },
        message: 'Quota Exceeded'
      });

      await expect(
        authService.apiRequest('/test', { retries: false })
      ).rejects.toThrow('Quota Exceeded');
      
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

    it('should call error handler on 403 quota errors with rate limit message', async () => {
      const mockError = {
        response: { 
          status: 403,
          data: {
            title: 'Quota Exceeded',
            detail: 'API quota has been exceeded'
          },
          headers: {
            'retry-after': '120'
          }
        },
        message: 'Quota Exceeded'
      };
      const mockQueryFn = jest.fn().mockRejectedValue(mockError);
      const mockErrorHandler = jest.fn();

      await expect(
        authService.executeQuery(mockQueryFn, 'test operation', mockErrorHandler)
      ).rejects.toThrow();

      expect(mockErrorHandler).toHaveBeenCalledWith(
        expect.stringContaining('🚫 API Quota Exceeded: You\'ve reached the maximum number of API calls allowed. Please wait 2 minutes before trying again.'),
        true
      );
    });

    it('should call error handler on non-quota errors with generic message', async () => {
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