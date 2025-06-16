import authService from '../authService';
import { OAUTH_CONFIG } from '../../config/oauth';

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

describe('AuthService', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  describe('isAuthenticated', () => {
    it('should return false when no access token exists', () => {
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
}); 