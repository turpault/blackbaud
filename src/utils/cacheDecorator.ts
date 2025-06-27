import { cacheUtils } from './database';

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
        const cachedResult = await getCachedResult<T>(cacheKey, debug);
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
          await setCachedResult(cacheKey, result, expirationMs, debug);
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
 * Get cached result from IndexedDB
 */
async function getCachedResult<T>(cacheKey: string, debug: boolean = false): Promise<T | null> {
  try {
    const cachedData = await cacheUtils.get(cacheKey);
    if (!cachedData) {
      return null;
    }

    if (debug) {
      console.log(`[Cache] Cache hit for key: ${cacheKey}`);
    }

    return cachedData;
  } catch (error) {
    if (debug) {
      console.warn(`[Cache] Error reading from cache for key ${cacheKey}:`, error);
    }
    return null;
  }
}

/**
 * Set cached result in IndexedDB
 */
async function setCachedResult<T>(
  cacheKey: string, 
  data: T, 
  expirationMs: number, 
  debug: boolean = false
): Promise<void> {
  try {
    await cacheUtils.set(cacheKey, data, expirationMs);
    
    if (debug) {
      console.log(`[Cache] Cached result for key: ${cacheKey}, expires in: ${expirationMs}ms`);
    }
  } catch (error) {
    if (debug) {
      console.warn(`[Cache] Failed to set cache for key ${cacheKey}:`, error);
    }
    // IndexedDB might be unavailable
    throw error;
  }
}

/**
 * Clear cache entries by key prefix
 */
export async function clearCache(keyPrefix?: string): Promise<number> {
  if (!keyPrefix) {
    // Clear all cache entries
    await cacheUtils.clear();
    return 0; // We don't have a count, but the operation is complete
  } else {
    // For now, we'll clear all cache since IndexedDB doesn't have prefix-based queries
    // In a more sophisticated implementation, we could add a prefix field to the database
    await cacheUtils.clear();
    return 0;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(keyPrefix?: string): Promise<{
  count: number;
  totalSize: number;
  oldestEntry?: Date;
  newestEntry?: Date;
  expiredCount: number;
}> {
  const stats = await cacheUtils.getStats();
  
  // For now, we'll return basic stats since we don't track expired count separately
  // The expired items are automatically cleaned up by the database utilities
  return {
    count: stats.count,
    totalSize: stats.totalSize,
    oldestEntry: stats.oldestEntry,
    newestEntry: stats.oldestEntry, // We don't track newest separately
    expiredCount: 0 // Expired items are automatically removed
  };
}

/**
 * Clean up expired cache entries
 */
export async function cleanExpiredCache(keyPrefix?: string): Promise<number> {
  return await cacheUtils.cleanExpired();
}

/**
 * Utility function to manually cache a value (for use outside of decorators)
 */
export async function manualCache<T>(
  key: string, 
  value: T, 
  expirationMs: number = 3600000
): Promise<void> {
  await setCachedResult(key, value, expirationMs);
}

/**
 * Utility function to manually get a cached value (for use outside of decorators)
 */
export async function manualGetCache<T>(key: string): Promise<T | null> {
  return await getCachedResult<T>(key);
} 