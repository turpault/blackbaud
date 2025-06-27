# Iframe-Based Re-authentication

This document explains the iframe-based re-authentication implementation that provides a seamless user experience without full page redirects when authentication expires.

## Overview

When the API returns a 401 error (authentication expired), instead of redirecting the entire page to the login screen, the application now opens an iframe overlay that handles the OAuth re-authentication process. This preserves the user's current state and provides a much better user experience.

## Architecture

```
User Action → API Call → 401 Error → Iframe Auth → Success → Continue
     ↓
Current State Preserved Throughout Process
```

### Benefits

✅ **No Page Reload**: User stays on the same page  
✅ **State Preservation**: All current data and scroll position maintained  
✅ **Seamless UX**: Minimal disruption to user workflow  
✅ **Fallback Support**: Falls back to full page redirect if iframe fails  
✅ **Timeout Protection**: 5-minute timeout prevents hanging  

## Implementation

### 1. **AuthService Integration**

The `authService.ts` includes iframe-based re-authentication methods:

```typescript
// Initiate login using iframe for seamless re-authentication
initiateLoginInIframe(): Promise<SessionInfo> {
  return new Promise((resolve, reject) => {
    // Create iframe for OAuth flow
    const iframe = document.createElement('iframe');
    iframe.src = '/blackbaud/oauth/login?iframe=true';
    
    // Listen for messages from iframe
    const messageHandler = async (event: MessageEvent) => {
      if (event.data.type === 'OAUTH_SUCCESS') {
        const session = await this.checkAuthentication();
        resolve(session);
      } else if (event.data.type === 'OAUTH_ERROR') {
        reject(new Error(event.data.error));
      }
    };
    
    window.addEventListener('message', messageHandler);
  });
}
```

### 2. **401 Error Handling**

Both `apiRequest` and `apiRequestUrl` methods now use iframe re-authentication:

```typescript
if (error.response?.status === 401) {
  // Authentication failed - try iframe-based re-authentication
  try {
    const newSession = await this.initiateLoginInIframe();
    // Retry the request with fresh token
    return await axios(axiosConfig);
  } catch (iframeError) {
    // Fallback to full page redirect
    this.saveCurrentStateToUrl();
    throw new Error('Authentication expired - please log in again');
  }
}
```

### 3. **AuthIframe Component**

A React component provides the iframe overlay with loading states and error handling:

```typescript
const AuthIframe: React.FC<AuthIframeProps> = ({ onSuccess, onError, onCancel }) => {
  // Handles iframe display, loading states, and user interaction
};
```

### 4. **useAuthIframe Hook**

A custom hook provides easy access to iframe authentication throughout the app:

```typescript
const { showAuthIframe, initiateIframeAuth, hideAuthIframe } = useAuthIframe();
```

## Proxy Server Requirements

The proxy server must support iframe-based OAuth by:

1. **Detecting iframe requests**: Check for `?iframe=true` parameter
2. **PostMessage communication**: Send success/error messages to parent window
3. **Proper redirect handling**: Handle OAuth flow within iframe context

### Expected Proxy Endpoints

```
GET /blackbaud/oauth/login?iframe=true
```

The proxy should:
- Handle OAuth flow normally
- Send `postMessage` to parent window on completion
- Handle iframe-specific redirects

### PostMessage Format

**Success:**
```javascript
window.parent.postMessage({
  type: 'OAUTH_SUCCESS',
  data: { /* session data */ }
}, window.location.origin);
```

**Error:**
```javascript
window.parent.postMessage({
  type: 'OAUTH_ERROR',
  error: 'Error message'
}, window.location.origin);
```

## User Experience Flow

### 1. **Normal Operation**
- User is working with the application
- API calls work normally with valid authentication

### 2. **Authentication Expires**
- API call returns 401 error
- Application detects authentication failure
- Iframe overlay appears with loading spinner

### 3. **Re-authentication Process**
- User sees "Re-authenticating..." message
- OAuth flow happens in iframe
- User completes authentication in iframe
- Loading spinner shows during process

### 4. **Success**
- Iframe closes automatically
- Original API call retries with new token
- User continues working seamlessly

### 5. **Error/Fallback**
- If iframe fails, fallback to full page redirect
- State is preserved for restoration after login
- User sees appropriate error message

## Security Considerations

### 1. **Origin Validation**
```typescript
// Only accept messages from our domain
if (event.origin !== window.location.origin) return;
```

### 2. **Timeout Protection**
```typescript
// Timeout after 5 minutes
setTimeout(() => {
  reject(new Error('OAuth authentication timed out'));
}, 5 * 60 * 1000);
```

### 3. **User Cancellation**
- Close button allows users to cancel authentication
- Proper cleanup of event listeners and iframe

### 4. **Fallback Security**
- If iframe fails, falls back to secure full page redirect
- State preservation ensures no data loss

## Configuration Options

### 1. **Timeout Duration**
```typescript
// Configurable timeout (default: 5 minutes)
const AUTH_TIMEOUT = 5 * 60 * 1000;
```

### 2. **Iframe Styling**
```typescript
// Customizable iframe appearance
iframe.style.zIndex = '9999';
iframe.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
```

### 3. **Message Types**
```typescript
// Extensible message types
type AuthMessage = 
  | { type: 'OAUTH_SUCCESS'; data?: any }
  | { type: 'OAUTH_ERROR'; error: string }
  | { type: 'OAUTH_PROGRESS'; message: string };
```

## Browser Compatibility

### Supported Browsers
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Requirements
- `postMessage` API support
- Iframe support
- Same-origin policy compliance

## Testing

### Manual Testing
1. **Trigger 401**: Let authentication expire or manually trigger 401
2. **Iframe Display**: Verify iframe overlay appears
3. **OAuth Flow**: Complete authentication in iframe
4. **Success**: Verify iframe closes and app continues
5. **Error Handling**: Test timeout and cancellation scenarios

### Automated Testing
```typescript
// Test iframe authentication
it('should handle iframe re-authentication', async () => {
  const session = await authService.initiateLoginInIframe();
  expect(session.authenticated).toBe(true);
});
```

## Troubleshooting

### Common Issues

**Iframe not loading:**
- Check proxy server supports iframe parameter
- Verify CORS configuration allows iframe embedding

**PostMessage not working:**
- Ensure origin validation is correct
- Check proxy server sends proper message format

**Timeout issues:**
- Verify timeout duration is appropriate
- Check network connectivity during OAuth flow

**Fallback not working:**
- Ensure state preservation is working
- Verify full page redirect logic

## Future Enhancements

### 1. **Progressive Enhancement**
- Start with iframe, fallback to popup, then full page
- Detect browser capabilities and choose best method

### 2. **Silent Refresh**
- Attempt token refresh before showing iframe
- Only show iframe if refresh fails

### 3. **Background Authentication**
- Pre-emptively refresh tokens before they expire
- Maintain seamless experience without user interaction

### 4. **Multi-tab Support**
- Coordinate authentication across multiple tabs
- Share authentication state between tabs

## Conclusion

Iframe-based re-authentication provides a significantly better user experience by:

- **Preserving application state** during re-authentication
- **Eliminating page reloads** and navigation disruption
- **Maintaining user context** and workflow continuity
- **Providing graceful fallbacks** for edge cases

This implementation ensures users can continue their work seamlessly even when authentication expires, making the application feel more responsive and professional. 