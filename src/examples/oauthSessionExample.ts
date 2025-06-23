// Example usage of the OAuth session response structure
import authService from '../services/authService';
import { OAuthSessionResponse, SessionInfo } from '../types/auth';

// Example OAuth session response from your server
const exampleOAuthResponse: OAuthSessionResponse = {
  authenticated: true,
  provider: "blackbaud",
  timestamp: "2024-01-15T10:30:00Z",
  session: {
    accessToken: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    tokenType: "Bearer",
    scope: "constituent.read gift.read",
    expiresAt: "2024-01-15T11:30:00Z",
    isExpired: false,
    expiresIn: 3600, // 1 hour in seconds
    sessionId: "session_12345"
  }
};

// Example usage with AuthService
async function exampleUsage() {
  try {
    // Check authentication status
    const sessionInfo = await authService.checkAuthentication();
    console.log('Session Info:', sessionInfo);
    
    // Check if token is expired
    const isExpired = authService.isTokenExpired();
    console.log('Token Expired:', isExpired);
    
    // Get detailed session information
    const sessionDetails = authService.getSessionDetails();
    console.log('Session Details:', sessionDetails);
    
    // Check if user is authenticated
    const isAuthenticated = authService.isAuthenticated();
    console.log('Is Authenticated:', isAuthenticated);
    
    if (isAuthenticated && !isExpired) {
      // Make API calls
      const gifts = await authService.getGifts(10);
      console.log('Gifts:', gifts);
    } else {
      console.log('Need to authenticate or refresh token');
      authService.initiateLogin();
    }
    
  } catch (error) {
    console.error('Authentication error:', error);
  }
}

// Example of handling different OAuth session states
function handleOAuthSession(oauthResponse: OAuthSessionResponse) {
  console.log('Provider:', oauthResponse.provider);
  console.log('Authenticated:', oauthResponse.authenticated);
  console.log('Timestamp:', oauthResponse.timestamp);
  
  if (oauthResponse.session) {
    const session = oauthResponse.session;
    console.log('Access Token:', session.accessToken ? 'Present' : 'Missing');
    console.log('Token Type:', session.tokenType);
    console.log('Scope:', session.scope);
    console.log('Expires At:', session.expiresAt);
    console.log('Is Expired:', session.isExpired);
    console.log('Expires In:', session.expiresIn, 'seconds');
    console.log('Session ID:', session.sessionId);
    
    // Check if token is about to expire (within 5 minutes)
    if (session.expiresIn && session.expiresIn < 300) {
      console.log('Warning: Token expires soon!');
    }
  } else {
    console.log('No session data available');
  }
}

// Example of converting OAuth response to SessionInfo
function convertOAuthToSessionInfo(oauthResponse: OAuthSessionResponse): SessionInfo {
  return {
    authenticated: oauthResponse.authenticated,
    provider: oauthResponse.provider,
    timestamp: oauthResponse.timestamp,
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
}

export {
  exampleUsage,
  handleOAuthSession,
  convertOAuthToSessionInfo,
  exampleOAuthResponse
}; 