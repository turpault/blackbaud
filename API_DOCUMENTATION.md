# API Documentation

This document describes the API service implementation for the Blackbaud OAuth React Application.

## Overview

The application uses a proxy-based authentication system where all API calls are routed through a proxy server that handles OAuth2 authentication with Blackbaud's APIs. The main API service is implemented in `src/services/authService.ts`.

## Authentication Service (`authService.ts`)

### Core Features

- **Proxy-based OAuth2**: All authentication handled by proxy server
- **Session Management**: Automatic session checking and token management
- **Rate Limiting**: Built-in retry logic with exponential backoff for 429 errors
- **Caching**: Advanced caching system with localStorage persistence
- **Error Handling**: Comprehensive error handling with user-friendly messages

### Key Interfaces

#### SessionInfo
```typescript
interface SessionInfo {
  authenticated: boolean;
  tokenType?: string;
  scope?: string;
  expiresAt?: string;
  accessToken?: string;
  subscriptionKey?: string;
  user?: any;
}
```

#### ApiRequestOptions
```typescript
interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  data?: any;
  params?: any;
  retries?: boolean;
}
```

#### ConstituentInfo
```typescript
interface ConstituentInfo {
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
```

## API Methods

### Authentication Methods

#### `checkAuthentication(): Promise<SessionInfo>`
Checks the current authentication status with the proxy server.

```typescript
const session = await authService.checkAuthentication();
if (session.authenticated) {
  // User is authenticated
}
```

#### `isAuthenticated(): boolean`
Returns the cached authentication status.

```typescript
if (authService.isAuthenticated()) {
  // User is authenticated
}
```

#### `getSessionInfo(): SessionInfo | null`
Returns cached session information.

```typescript
const session = authService.getSessionInfo();
```

#### `initiateLogin(): void`
Initiates the login process by redirecting to the proxy server.

```typescript
authService.initiateLogin();
```

#### `logout(): Promise<void>`
Logs out the user by calling the proxy server logout endpoint.

```typescript
await authService.logout();
```

### API Request Methods

#### `apiRequest<T>(url: string, options?: ApiRequestOptions): Promise<T>`
Makes authenticated API requests to Blackbaud APIs through the proxy server.

```typescript
// GET request
const gifts = await authService.apiRequest('/gift/v1/gifts', {
  params: { limit: 50 }
});

// POST request
const result = await authService.apiRequest('/some/endpoint', {
  method: 'POST',
  data: { key: 'value' }
});
```

#### `apiRequestUrl<T>(fullUrl: string, options?: ApiRequestOptions): Promise<T>`
Makes authenticated API requests to full URLs (useful for pagination links).

```typescript
const nextPage = await authService.apiRequestUrl(
  'https://api.sky.blackbaud.com/gift/v1/gifts?limit=50&offset=50'
);
```

### Data Retrieval Methods

#### `getGifts(limit?: number, listId?: string): Promise<any>`
Retrieves gift data with optional filtering.

```typescript
const gifts = await authService.getGifts(50);
const listGifts = await authService.getGifts(50, 'list-id');
```

#### `getGiftAttachments(giftId: string): Promise<any>`
Retrieves attachments for a specific gift.

```typescript
const attachments = await authService.getGiftAttachments('gift-id');
```

#### `getLists(limit?: number, listType?: string): Promise<any>`
Retrieves Blackbaud lists.

```typescript
const lists = await authService.getLists(50);
const constituentLists = await authService.getLists(50, 'constituent');
```

#### `getQueries(limit?: number): Promise<any>`
Retrieves Blackbaud queries.

```typescript
const queries = await authService.getQueries(50);
```

#### `getConstituent(constituentId: string): Promise<ConstituentInfo | null>`
Retrieves constituent information with caching.

```typescript
const constituent = await authService.getConstituent('constituent-id');
```

#### `getConstituents(constituentIds: string[], useCache?: boolean): Promise<Record<string, ConstituentInfo | null>>`
Retrieves multiple constituents with batch caching.

```typescript
const constituents = await authService.getConstituents(['id1', 'id2', 'id3']);
```

#### `getUserProfile(): Promise<any>`
Retrieves the current user's profile information.

```typescript
const profile = await authService.getUserProfile();
```

### Cache Management Methods

#### `clearConstituentCache(constituentId?: string): void`
Clears constituent cache entries.

```typescript
// Clear specific constituent
authService.clearConstituentCache('constituent-id');

// Clear all constituent cache
authService.clearConstituentCache();
```

#### `getCacheStats(): { count: number; totalSize: number; oldestEntry?: Date; pendingPromises: number }`
Returns cache statistics.

```typescript
const stats = authService.getCacheStats();
console.log(`Cache entries: ${stats.count}`);
console.log(`Total size: ${stats.totalSize} bytes`);
```

### Utility Methods

#### `refresh(): Promise<SessionInfo>`
Refreshes the session information.

```typescript
const session = await authService.refresh();
```

#### `testApiEndpoints(): Promise<any>`
Tests various API endpoints for connectivity.

```typescript
const results = await authService.testApiEndpoints();
```

#### `getSessionDetails(): any`
Returns detailed session information.

```typescript
const details = authService.getSessionDetails();
```

## Rate Limiting & Error Handling

### Automatic Retry Logic

The service includes built-in retry logic for 429 (rate limit) errors:

- **Exponential backoff**: Delay increases exponentially with each retry
- **Jitter**: Random delay variation to prevent thundering herd
- **Maximum retries**: Configurable retry limit (default: 5)
- **User-friendly messages**: Clear error messages for rate limiting

### Error Handling

```typescript
try {
  const data = await authService.apiRequest('/endpoint');
} catch (error) {
  if (error.isRateLimit) {
    // Handle rate limiting
    console.log('Rate limited, retrying automatically...');
  } else {
    // Handle other errors
    console.error('API error:', error.message);
  }
}
```

## Caching System

### Decorator-based Caching

The service uses a sophisticated caching system with decorators:

```typescript
class AuthService {
  @cache({ expirationMs: 300000, keyPrefix: 'constituent' }) // 5 minutes
  async getConstituent(id: string): Promise<ConstituentInfo | null> {
    // API call logic
  }
}
```

### Cache Features

- **localStorage persistence**: Cached data survives page reloads
- **Automatic expiration**: Configurable TTL for cache entries
- **Key generation**: Custom key generation for complex parameters
- **Cache statistics**: Monitoring and debugging capabilities
- **Batch operations**: Efficient handling of multiple requests

## Usage Examples

### Basic Authentication Flow

```typescript
import authService from './services/authService';

// Check authentication status
const session = await authService.checkAuthentication();

if (!session.authenticated) {
  // Redirect to login
  authService.initiateLogin();
} else {
  // User is authenticated, proceed with API calls
  const gifts = await authService.getGifts(50);
}
```

### Working with Gifts and Attachments

```typescript
// Get gifts with pagination
const gifts = await authService.getGifts(50);

// Get attachments for a specific gift
if (gifts.data && gifts.data.length > 0) {
  const attachments = await authService.getGiftAttachments(gifts.data[0].id);
}
```

### Constituent Management

```typescript
// Get constituent information
const constituent = await authService.getConstituent('constituent-id');

// Get multiple constituents efficiently
const constituentIds = ['id1', 'id2', 'id3'];
const constituents = await authService.getConstituents(constituentIds);
```

### Error Handling Best Practices

```typescript
try {
  const data = await authService.apiRequest('/endpoint', {
    params: { limit: 50 }
  });
} catch (error) {
  if (error.isRateLimit) {
    // Show user-friendly rate limit message
    console.log('Rate limit reached, please wait...');
  } else {
    // Handle other errors
    console.error('API error:', error.message);
  }
}
```

## Configuration

### Environment Variables

The service relies on the proxy server for configuration. No direct environment variables are needed in the React application.

### Proxy Server Requirements

The proxy server should provide the following endpoints:

- `GET /blackbaud/oauth/session` - Session information
- `POST /blackbaud/oauth/logout` - Logout endpoint
- `GET /blackbaud/api/*` - API proxy endpoints

## Security Considerations

- **No credentials in frontend**: All OAuth credentials handled by proxy
- **Secure token storage**: Tokens managed by proxy server
- **CORS handling**: Proper CORS configuration via proxy
- **Session management**: Secure session handling
- **Rate limiting**: Built-in protection against API abuse

## Performance Optimization

- **Lazy loading**: Components loaded on demand
- **Caching**: Intelligent caching reduces API calls
- **Batch requests**: Efficient handling of multiple constituents
- **Error recovery**: Graceful handling of network issues
- **Memory management**: Proper cleanup of cached data 