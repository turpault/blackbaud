import { useState, useCallback } from 'react';
import authService from '../services/authService';
import { SessionInfo } from '../types/auth';

interface UseAuthIframeReturn {
  showAuthIframe: boolean;
  isAuthenticating: boolean;
  authError: string | null;
  initiateIframeAuth: () => Promise<SessionInfo>;
  hideAuthIframe: () => void;
  clearAuthError: () => void;
}

export const useAuthIframe = (): UseAuthIframeReturn => {
  const [showAuthIframe, setShowAuthIframe] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const initiateIframeAuth = useCallback(async (): Promise<SessionInfo> => {
    setIsAuthenticating(true);
    setAuthError(null);
    setShowAuthIframe(true);

    try {
      const session = await authService.initiateLoginInIframe();
      setShowAuthIframe(false);
      setIsAuthenticating(false);
      return session;
    } catch (error: any) {
      setAuthError(error.message || 'Authentication failed');
      setIsAuthenticating(false);
      throw error;
    }
  }, []);

  const hideAuthIframe = useCallback(() => {
    setShowAuthIframe(false);
    setIsAuthenticating(false);
    setAuthError(null);
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  return {
    showAuthIframe,
    isAuthenticating,
    authError,
    initiateIframeAuth,
    hideAuthIframe,
    clearAuthError
  };
}; 