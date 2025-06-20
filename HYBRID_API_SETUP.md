# Hybrid API Setup Guide

This document explains the hybrid approach where the proxy server handles OAuth authentication but the React application makes direct API calls to Blackbaud using the bearer token provided by the proxy.

## Architecture Overview

```
User → React App → Proxy Server (OAuth) → Blackbaud OAuth
     ↓
React App → Blackbaud API (Direct with Bearer Token)
```

### Benefits of This Approach

✅ **Security**: OAuth credentials stay secure on the proxy server  
✅ **Performance**: Direct API calls reduce proxy load  
✅ **Flexibility**: React app can make any API call without proxy configuration  
✅ **Simplicity**: No complex client-side OAuth flow  

## Setup Steps

### 1. Proxy Server Session Endpoint

The server must return both the access token and subscription key in the `/oauth/session` endpoint response:

```json
{
  "authenticated": true,
  "accessToken": "bearer_token_here",
  "subscriptionKey": "your_subscription_key_here",
  "tokenType": "Bearer",
  "scope": "read write",
  "expiresAt": "2024-01-01T00:00:00Z"
}
```

#### React App Environment Variables
```bash
# No Blackbaud-specific environment variables required
# All credentials are provided by the proxy server
REACT_APP_ENVIRONMENT=development  # Optional
```

## How It Works

### Authentication Flow

1. **User Access**: User navigates to protected route
2. **Proxy Check**: Proxy server checks for valid session
3. **OAuth Redirect**: If not authenticated, proxy redirects to Blackbaud OAuth
4. **Token Exchange**: Proxy exchanges authorization code for access token
5. **Session Storage**: Proxy stores tokens securely (server-side)
6. **React Auth Check**: React app calls `/oauth/session` endpoint
7. **Token Provision**: Proxy returns access token to React app
8. **Direct API Calls**: React app uses token for direct Blackbaud API calls

### API Request Flow

```javascript
// React app gets token from proxy
const session = await authService.checkAuthentication();

// React app makes direct API call to Blackbaud
const response = await axios.get('https://api.sky.blackbaud.com/gift/v1/gifts', {
  headers: {
    'Authorization': `Bearer ${session.accessToken}`,
    'Bb-Api-Subscription-Key': session.subscriptionKey
  }
});
```

## API Usage Examples

### Basic Gift Retrieval
```javascript
import authService from './services/authService';

// Get gifts with default limit (50)
const gifts = await authService.getGifts();

// Get gifts with custom limit
const moreGifts = await authService.getGifts(100);
```

### Direct API Calls
```javascript
// Make any Blackbaud API call
const campaigns = await authService.apiRequest('/fundraising/v1/campaigns');

// POST request with data
const newGift = await authService.apiRequest('/gift/v1/gifts', {
  method: 'POST',
  data: {
    constituent_id: '123',
    amount: { value: 100.00 }
  }
});
```

### Error Handling
```javascript
try {
  const data = await authService.apiRequest('/gift/v1/gifts');
} catch (error) {
  if (error.message.includes('Authentication expired')) {
    // Token expired, user will be redirected to login
    console.log('Please log in again');
  } else {
    // Handle other API errors
    console.error('API Error:', error.message);
  }
}
```

## Security Considerations

### ✅ Secure
- OAuth credentials never exposed to client
- Access tokens transmitted over HTTPS only
- Automatic token refresh handled by proxy
- Bearer tokens have limited lifetime

### ⚠️ Important Notes
- Subscription key is provided by proxy server (not stored in client config)
- Access tokens are stored in browser memory (not localStorage)
- CORS must be configured properly for Blackbaud API calls
- All sensitive credentials remain on the proxy server

## Debugging

### Test API Endpoints
```javascript
// Debug available endpoints
const results = await authService.testApiEndpoints();
console.log('API Test Results:', results);
```

### Check Session Status
```javascript
const session = await authService.checkAuthentication();
console.log('Session:', session);
```

### Monitor Network Requests
1. Open browser DevTools → Network tab
2. Look for calls to `api.sky.blackbaud.com`
3. Check Authorization headers contain Bearer tokens
4. Verify Bb-Api-Subscription-Key header is present (provided by proxy)

## Common Issues

### Issue: "Subscription key not available from proxy server"
**Solution**: Check that proxy server is returning `subscriptionKey` in session response

### Issue: "Not authenticated"
**Solution**: Check that proxy server is returning `accessToken` in session response

### Issue: "CORS error"
**Solution**: Blackbaud API should allow your domain. If testing locally, this might be expected.

### Issue: API returns 401 Unauthorized
**Solutions**: 
- Check that subscription key is valid
- Verify that access token hasn't expired
- Ensure API endpoint permissions match OAuth scopes

## API Endpoints Reference

### Commonly Used Endpoints
- **Gifts**: `/gift/v1/gifts`
- **Constituents**: `/constituent/v1/constituents`
- **Campaigns**: `/fundraising/v1/campaigns`
- **Funds**: `/fundraising/v1/funds`

### Rate Limits
- Blackbaud API has rate limits (typically 5000 requests/hour)
- Monitor usage in Blackbaud developer console
- Implement appropriate caching if needed

## Production Deployment

1. **Proxy Configuration**: Ensure proxy server has all required Blackbaud credentials
2. **HTTPS**: Always use HTTPS in production
3. **Domain Configuration**: Update redirect URIs in Blackbaud app settings
4. **Session Endpoint**: Verify proxy `/oauth/session` returns both `accessToken` and `subscriptionKey`
5. **Monitoring**: Set up logging for API errors and rate limiting
6. **Caching**: Consider implementing client-side caching for frequently accessed data 