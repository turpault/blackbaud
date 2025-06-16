# Cache Decorator

A TypeScript decorator for memoizing and caching API results to localStorage with configurable expiration times and key generation strategies.

## Features

- **Automatic Caching**: Decorates methods to automatically cache their results
- **Configurable Expiration**: Set custom cache expiration times
- **Custom Key Generation**: Define how cache keys are generated from method parameters
- **Debug Mode**: Optional logging for cache operations
- **Cache Management**: Utilities for clearing and inspecting cache
- **Error Handling**: Graceful handling of localStorage errors and corrupted data
- **TypeScript Support**: Full type safety with TypeScript decorators

## Basic Usage

```typescript
import { cache } from '../utils/cacheDecorator';

class ApiService {
  // Basic caching with default settings (1 hour expiration)
  @cache()
  async fetchUserData(userId: string): Promise<UserData> {
    return this.apiRequest(`/users/${userId}`);
  }

  // Custom expiration time (5 minutes)
  @cache({ expirationMs: 300000 })
  async fetchProducts(): Promise<Product[]> {
    return this.apiRequest('/products');
  }
}
```

## Configuration Options

The `@cache()` decorator accepts an options object with the following properties:

```typescript
interface CacheOptions {
  /** Cache key prefix. If not provided, will use method name */
  keyPrefix?: string;
  
  /** Cache expiration time in milliseconds. Default: 1 hour (3600000ms) */
  expirationMs?: number;
  
  /** Custom key generator function that receives the method arguments */
  keyGenerator?: (...args: any[]) => string;
  
  /** Whether to use cache. Default: true */
  useCache?: boolean;
  
  /** Whether to log cache operations for debugging */
  debug?: boolean;
}
```

## Advanced Examples

### Custom Key Generation

```typescript
class ProductService {
  @cache({
    keyPrefix: 'products',
    expirationMs: 300000, // 5 minutes
    keyGenerator: (category: string, page: number, limit: number) => 
      `${category}_page${page}_limit${limit}`
  })
  async fetchProducts(category: string, page: number = 1, limit: number = 10): Promise<Product[]> {
    return this.apiRequest(`/products?category=${category}&page=${page}&limit=${limit}`);
  }
}
```

### Debug Mode

```typescript
class DebugService {
  @cache({ 
    keyPrefix: 'debug',
    debug: true // Enables console logging
  })
  async fetchData(id: string): Promise<any> {
    return this.apiRequest(`/data/${id}`);
  }
}
```

### Conditional Caching

For scenarios where you need to conditionally bypass cache:

```typescript
class WeatherService {
  @cache({
    keyPrefix: 'weather',
    expirationMs: 600000 // 10 minutes
  })
  async fetchWeatherCached(city: string): Promise<WeatherData> {
    return this.apiRequest(`/weather/${city}`);
  }

  async fetchWeatherUncached(city: string): Promise<WeatherData> {
    return this.apiRequest(`/weather/${city}`);
  }

  // Public method with conditional caching
  async getWeather(city: string, forceRefresh: boolean = false): Promise<WeatherData> {
    if (forceRefresh) {
      return this.fetchWeatherUncached(city);
    } else {
      return this.fetchWeatherCached(city);
    }
  }
}
```

## Cache Management

The decorator comes with utility functions for managing cached data:

### Cache Statistics

```typescript
import { getCacheStats } from '../utils/cacheDecorator';

// Get stats for all cache entries
const allStats = getCacheStats();
console.log(`Total entries: ${allStats.count}, Size: ${allStats.totalSize} bytes`);

// Get stats for specific prefix
const productStats = getCacheStats('products');
console.log(`Product cache entries: ${productStats.count}`);
```

### Clear Cache

```typescript
import { clearCache } from '../utils/cacheDecorator';

// Clear all cache entries with 'products' prefix
const clearedCount = clearCache('products');
console.log(`Cleared ${clearedCount} product cache entries`);

// Clear all cache entries (use with caution!)
const totalCleared = clearCache();
console.log(`Cleared ${totalCleared} total cache entries`);
```

### Clean Expired Entries

```typescript
import { cleanExpiredCache } from '../utils/cacheDecorator';

// Clean only expired entries
const expiredCount = cleanExpiredCache();
console.log(`Cleaned ${expiredCount} expired cache entries`);

// Clean expired entries with specific prefix
const expiredProducts = cleanExpiredCache('products');
console.log(`Cleaned ${expiredProducts} expired product entries`);
```

### Manual Cache Operations

For scenarios where you need to cache data outside of decorated methods:

```typescript
import { manualCache, manualGetCache } from '../utils/cacheDecorator';

// Manually cache a value
manualCache('user_settings', { theme: 'dark', lang: 'en' }, 3600000); // 1 hour

// Manually retrieve a cached value
const settings = manualGetCache('user_settings');
if (settings) {
  console.log('Settings:', settings);
}
```

## Integration with Existing AuthService

The cache decorator has been integrated with the existing `AuthService` for commonly used methods:

```typescript
// These methods now use automatic caching:
authService.getGifts(50, 'list-id');     // 5 minutes cache
authService.getLists(50, 'Gift');        // 10 minutes cache  
authService.getQueries(50);              // 15 minutes cache
```

## Best Practices

1. **Choose Appropriate Expiration Times**: 
   - Fast-changing data: 1-5 minutes
   - Moderate data: 10-30 minutes
   - Relatively static data: 1+ hours

2. **Use Descriptive Key Prefixes**: 
   - Helps with cache management and debugging
   - Allows selective cache clearing

3. **Custom Key Generators for Complex Parameters**:
   - Use when default JSON.stringify isn't suitable
   - Consider parameter order and types

4. **Debug Mode for Development**:
   - Enable `debug: true` during development
   - Disable in production for performance

5. **Error Handling**:
   - Cache failures won't break your application
   - Always implement fallback strategies

6. **Memory Management**:
   - Monitor cache size with `getCacheStats()`
   - Periodically clean expired entries
   - Consider localStorage size limits (5-10MB typically)

## TypeScript Configuration

Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

## Testing

The cache decorator includes comprehensive unit tests covering:
- Basic caching functionality
- Custom key generation
- Cache expiration
- Error handling
- Cache management utilities

Run tests with:
```bash
npm test -- src/utils/__tests__/cacheDecorator.test.ts
``` 