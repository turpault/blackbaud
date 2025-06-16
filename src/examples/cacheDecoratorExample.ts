import { cache, clearCache, getCacheStats, cleanExpiredCache } from '../utils/cacheDecorator';

/**
 * Example class demonstrating different uses of the cache decorator
 */
class ApiService {
  
  // Basic caching with default settings (1 hour expiration)
  @cache()
  async fetchUserData(userId: string): Promise<{ id: string; name: string; email: string }> {
    // Simulate API call
    console.log(`Fetching user data for ${userId} from API...`);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
    
    return {
      id: userId,
      name: `User ${userId}`,
      email: `user${userId}@example.com`
    };
  }

  // Custom cache key generation and shorter expiration
  @cache({
    keyPrefix: 'products',
    expirationMs: 300000, // 5 minutes
    keyGenerator: (category: string, page: number, limit: number) => `${category}_page${page}_limit${limit}`,
    debug: true // Enable debug logging
  })
  async fetchProducts(category: string, page: number = 1, limit: number = 10): Promise<any[]> {
    console.log(`Fetching products: category=${category}, page=${page}, limit=${limit}`);
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Simulate product data
    return Array.from({ length: limit }, (_, i) => ({
      id: `${category}_${page * limit + i}`,
      name: `Product ${i + 1}`,
      category,
      price: Math.random() * 100
    }));
  }

  // Caching with longer expiration for relatively static data
  @cache({
    keyPrefix: 'settings',
    expirationMs: 3600000, // 1 hour
    debug: true
  })
  async fetchAppSettings(): Promise<Record<string, any>> {
    console.log('Fetching app settings from API...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      theme: 'dark',
      language: 'en',
      notifications: true,
      version: '1.0.0'
    };
  }

  // Method that can disable caching conditionally
  @cache({
    keyPrefix: 'weather',
    expirationMs: 600000, // 10 minutes
    useCache: true // This could be dynamic based on conditions
  })
  async fetchWeatherData(city: string, forceRefresh: boolean = false): Promise<any> {
    // Note: The decorator doesn't access method parameters for useCache,
    // but you could create a wrapper method that calls a non-cached version
    console.log(`Fetching weather for ${city}...`);
    await new Promise(resolve => setTimeout(resolve, 600));
    
    return {
      city,
      temperature: Math.round(Math.random() * 30 + 10),
      humidity: Math.round(Math.random() * 100),
      timestamp: new Date().toISOString()
    };
  }

  // For cases where you need to bypass cache conditionally,
  // create a separate non-cached method
  @cache({
    keyPrefix: 'weather',
    expirationMs: 600000
  })
  async fetchWeatherDataCached(city: string): Promise<any> {
    return this.fetchWeatherDataUncached(city);
  }

  async fetchWeatherDataUncached(city: string): Promise<any> {
    console.log(`Fetching weather for ${city} (uncached)...`);
    await new Promise(resolve => setTimeout(resolve, 600));
    
    return {
      city,
      temperature: Math.round(Math.random() * 30 + 10),
      humidity: Math.round(Math.random() * 100),
      timestamp: new Date().toISOString()
    };
  }

  // Public method to get weather data with optional cache bypass
  async getWeatherData(city: string, forceRefresh: boolean = false): Promise<any> {
    if (forceRefresh) {
      return this.fetchWeatherDataUncached(city);
    } else {
      return this.fetchWeatherDataCached(city);
    }
  }
}

/**
 * Example usage and utility functions
 */
export class CacheManager {
  private apiService = new ApiService();

  async demonstrateBasicUsage(): Promise<void> {
    console.log('=== Basic Cache Usage Demo ===');
    
    // First call - will hit the API
    console.log('First call:');
    const user1 = await this.apiService.fetchUserData('123');
    console.log('Result:', user1);
    
    // Second call - will use cache
    console.log('\nSecond call (should use cache):');
    const user2 = await this.apiService.fetchUserData('123');
    console.log('Result:', user2);
    
    // Different parameter - will hit the API
    console.log('\nDifferent user (should hit API):');
    const user3 = await this.apiService.fetchUserData('456');
    console.log('Result:', user3);
  }

  async demonstrateCustomKeyGeneration(): Promise<void> {
    console.log('\n=== Custom Key Generation Demo ===');
    
    // These should create different cache entries
    await this.apiService.fetchProducts('electronics', 1, 5);
    await this.apiService.fetchProducts('books', 1, 5);
    await this.apiService.fetchProducts('electronics', 2, 5);
    
    // This should use cache from the first call
    await this.apiService.fetchProducts('electronics', 1, 5);
  }

  async demonstrateCacheManagement(): Promise<void> {
    console.log('\n=== Cache Management Demo ===');
    
    // Generate some cached data
    await this.apiService.fetchUserData('user1');
    await this.apiService.fetchProducts('electronics', 1, 10);
    await this.apiService.fetchAppSettings();
    
    // Get cache statistics
    const stats = getCacheStats();
    console.log('Cache stats:', stats);
    
    // Get stats for specific prefix
    const productStats = getCacheStats('products');
    console.log('Product cache stats:', productStats);
    
    // Clean expired cache (won't remove anything since we just created them)
    const cleanedCount = cleanExpiredCache();
    console.log('Cleaned expired entries:', cleanedCount);
    
    // Clear specific cache prefix
    const clearedProducts = clearCache('products');
    console.log('Cleared product cache entries:', clearedProducts);
    
    // Clear all cache
    const clearedAll = clearCache();
    console.log('Cleared all cache entries:', clearedAll);
  }

  async demonstrateConditionalCaching(): Promise<void> {
    console.log('\n=== Conditional Caching Demo ===');
    
    // Use cached version
    console.log('Fetching weather (cached):');
    const weather1 = await this.apiService.getWeatherData('New York');
    console.log('Result:', weather1);
    
    // Use cached version again (should use cache)
    console.log('\nFetching weather again (should use cache):');
    const weather2 = await this.apiService.getWeatherData('New York');
    console.log('Result:', weather2);
    
    // Force refresh (bypass cache)
    console.log('\nFetching weather with force refresh:');
    const weather3 = await this.apiService.getWeatherData('New York', true);
    console.log('Result:', weather3);
  }

  async runAllDemos(): Promise<void> {
    try {
      await this.demonstrateBasicUsage();
      await this.demonstrateCustomKeyGeneration();
      await this.demonstrateCacheManagement();
      await this.demonstrateConditionalCaching();
      
      console.log('\n=== All demos completed successfully! ===');
    } catch (error) {
      console.error('Demo failed:', error);
    }
  }
}

// Export for easy testing
export const cacheDemo = new CacheManager();

// Uncomment to run demos when this file is imported
// cacheDemo.runAllDemos(); 