export interface CacheOptions {
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

export interface CachedResult<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Decorator function for memoizing and caching method results to localStorage
 * 
 * @param options Cache configuration options
 * @returns Method decorator
 * 
 * @example
 * ```typescript
 * class ApiService {
 *   @cache({ expirationMs: 300000, keyPrefix: 'api' }) // 5 minutes
 *   async fetchData(id: string): Promise<DataType> {
 *     // API call logic
 *   }
 * }
 * ```
 */
export function cache<T>(options: CacheOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor {
    const originalMethod = descriptor.value;
    
    if (typeof originalMethod !== 'function') {
      throw new Error('Cache decorator can only be applied to methods');
    }

    const {
      keyPrefix = propertyKey,
      expirationMs = 3600000, // 1 hour default
      keyGenerator,
      useCache = true,
      debug = false
    } = options;

    descriptor.value = async function (...args: any[]): Promise<T> {
      // If caching is disabled, just call the original method
      if (!useCache) {
        return originalMethod.apply(this, args);
      }

      // Generate cache key
      const cacheKey = keyGenerator 
        ? `${keyPrefix}_${keyGenerator(...args)}`
        : `${keyPrefix}_${JSON.stringify(args)}`;

      if (debug) {
        console.log(`[Cache] Checking cache for key: ${cacheKey}`);
      }

      // Try to get from cache first
      try {
        const cachedResult = getCachedResult<T>(cacheKey, debug);
        if (cachedResult) {
          if (debug) {
            console.log(`[Cache] Cache hit for key: ${cacheKey}`);
          }
          return cachedResult;
        }
      } catch (error) {
        if (debug) {
          console.warn(`[Cache] Error reading from cache for key ${cacheKey}:`, error);
        }
        // Continue to fetch fresh data
      }

      if (debug) {
        console.log(`[Cache] Cache miss for key: ${cacheKey}, fetching fresh data`);
      }

      // Cache miss or expired - fetch fresh data
      try {
        const result: T = await originalMethod.apply(this, args);
        
        // Cache the result
        try {
          setCachedResult(cacheKey, result, expirationMs, debug);
        } catch (cacheError) {
          if (debug) {
            console.warn(`[Cache] Failed to cache result for key ${cacheKey}:`, cacheError);
          }
          // Don't fail the request if caching fails
        }
        
        return result;
      } catch (error) {
        if (debug) {
          console.error(`[Cache] Method execution failed for key ${cacheKey}:`, error);
        }
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Get cached result from localStorage
 */
function getCachedResult<T>(cacheKey: string, debug: boolean = false): T | null {
  try {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) {
      return null;
    }

    const cachedData: CachedResult<T> = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is expired
    if (now > cachedData.expiresAt) {
      if (debug) {
        console.log(`[Cache] Cache expired for key: ${cacheKey}`);
      }
      localStorage.removeItem(cacheKey);
      return null;
    }

    return cachedData.data;
  } catch (error) {
    // Invalid cache entry, remove it
    localStorage.removeItem(cacheKey);
    return null;
  }
}

/**
 * Set cached result in localStorage
 */
function setCachedResult<T>(
  cacheKey: string, 
  data: T, 
  expirationMs: number, 
  debug: boolean = false
): void {
  try {
    const now = Date.now();
    const cachedResult: CachedResult<T> = {
      data,
      timestamp: now,
      expiresAt: now + expirationMs
    };

    localStorage.setItem(cacheKey, JSON.stringify(cachedResult));
    
    if (debug) {
      console.log(`[Cache] Cached result for key: ${cacheKey}, expires at: ${new Date(cachedResult.expiresAt).toISOString()}`);
    }
  } catch (error) {
    if (debug) {
      console.warn(`[Cache] Failed to set cache for key ${cacheKey}:`, error);
    }
    // localStorage might be full or unavailable
    throw error;
  }
}

/**
 * Clear cache entries by key prefix
 */
export function clearCache(keyPrefix?: string): number {
  if (!keyPrefix) {
    // Clear all cache entries (dangerous - only clear localStorage items that look like cache)
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter(key => {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '');
        return data && typeof data === 'object' && 'timestamp' in data && 'expiresAt' in data && 'data' in data;
      } catch {
        return false;
      }
    });
    
    cacheKeys.forEach(key => localStorage.removeItem(key));
    return cacheKeys.length;
  } else {
    // Clear cache entries with specific prefix
    const keys = Object.keys(localStorage);
    const prefixKeys = keys.filter(key => key.startsWith(keyPrefix));
    prefixKeys.forEach(key => localStorage.removeItem(key));
    return prefixKeys.length;
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(keyPrefix?: string): {
  count: number;
  totalSize: number;
  oldestEntry?: Date;
  newestEntry?: Date;
  expiredCount: number;
} {
  const keys = Object.keys(localStorage);
  const relevantKeys = keyPrefix 
    ? keys.filter(key => key.startsWith(keyPrefix))
    : keys.filter(key => {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '');
          return data && typeof data === 'object' && 'timestamp' in data && 'expiresAt' in data && 'data' in data;
        } catch {
          return false;
        }
      });

  let totalSize = 0;
  let oldestTimestamp = Date.now();
  let newestTimestamp = 0;
  let expiredCount = 0;
  const now = Date.now();

  relevantKeys.forEach(key => {
    const data = localStorage.getItem(key);
    if (data) {
      totalSize += data.length;
      try {
        const parsed: CachedResult<any> = JSON.parse(data);
        if (parsed.timestamp < oldestTimestamp) {
          oldestTimestamp = parsed.timestamp;
        }
        if (parsed.timestamp > newestTimestamp) {
          newestTimestamp = parsed.timestamp;
        }
        if (now > parsed.expiresAt) {
          expiredCount++;
        }
      } catch (error) {
        // Invalid cache entry
        localStorage.removeItem(key);
      }
    }
  });

  return {
    count: relevantKeys.length,
    totalSize,
    oldestEntry: relevantKeys.length > 0 ? new Date(oldestTimestamp) : undefined,
    newestEntry: relevantKeys.length > 0 ? new Date(newestTimestamp) : undefined,
    expiredCount
  };
}

/**
 * Clean up expired cache entries
 */
export function cleanExpiredCache(keyPrefix?: string): number {
  const keys = Object.keys(localStorage);
  const relevantKeys = keyPrefix 
    ? keys.filter(key => key.startsWith(keyPrefix))
    : keys;

  let removedCount = 0;
  const now = Date.now();

  relevantKeys.forEach(key => {
    try {
      const data = localStorage.getItem(key);
      if (data) {
        const parsed: CachedResult<any> = JSON.parse(data);
        if (parsed.expiresAt && now > parsed.expiresAt) {
          localStorage.removeItem(key);
          removedCount++;
        }
      }
    } catch (error) {
      // Invalid cache entry, remove it
      localStorage.removeItem(key);
      removedCount++;
    }
  });

  return removedCount;
}

/**
 * Utility function to manually cache a value (for use outside of decorators)
 */
export function manualCache<T>(
  key: string, 
  value: T, 
  expirationMs: number = 3600000
): void {
  setCachedResult(key, value, expirationMs);
}

/**
 * Utility function to manually get a cached value (for use outside of decorators)
 */
export function manualGetCache<T>(key: string): T | null {
  return getCachedResult<T>(key);
} 