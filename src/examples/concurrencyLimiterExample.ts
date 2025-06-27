/**
 * Concurrency Limiter Usage Examples
 * 
 * This file demonstrates different ways to use the concurrency limiter decorator
 * to control API request rates and prevent overwhelming external services.
 */

import { 
  createConcurrencyLimiter, 
  withConcurrencyLimit, 
  limitConcurrency
} from '../utils/concurrencyLimiter';
import ConcurrencyLimiter from '../utils/concurrencyLimiter';

// Example 1: Using the decorator on class methods
class ApiService {
  private concurrencyLimiter: ConcurrencyLimiter;

  constructor() {
    // Create a limiter instance for this service
    this.concurrencyLimiter = createConcurrencyLimiter({
      maxConcurrent: 3,
      timeout: 30000,
      retryAttempts: 2,
      onQueueFull: (functionName) => {
        console.warn(`Queue full for ${functionName}`);
      },
      onError: (functionName, error) => {
        console.error(`Error in ${functionName}:`, error);
      }
    });
  }

  // Method decorator approach
  @withConcurrencyLimit({ maxConcurrent: 2, timeout: 15000 })
  async fetchUserData(userId: string): Promise<any> {
    console.log(`Fetching user data for ${userId}`);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    return { userId, name: `User ${userId}`, timestamp: Date.now() };
  }

  // Using the limiter instance directly
  async fetchMultipleUsers(userIds: string[]): Promise<any[]> {
    const promises = userIds.map(userId => 
      this.concurrencyLimiter.executeWithLimit(
        this.fetchUserData.bind(this),
        'fetchUserData',
        [userId]
      )
    );
    
    return Promise.all(promises);
  }

  // Get current statistics
  getLimiterStats() {
    return this.concurrencyLimiter.getStats();
  }
}

// Example 2: Using function wrapper for standalone functions
const limitedApiCall = limitConcurrency(
  async (endpoint: string, data?: any): Promise<any> => {
    console.log(`Making API call to ${endpoint}`);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    return { endpoint, data, response: 'success', timestamp: Date.now() };
  },
  {
    maxConcurrent: 5,
    timeout: 10000,
    retryAttempts: 1
  }
);

// Example 3: Advanced usage with custom error handling
class AdvancedApiService {
  private limiter: ConcurrencyLimiter;

  constructor() {
    this.limiter = createConcurrencyLimiter({
      maxConcurrent: 4,
      timeout: 45000,
      retryAttempts: 3,
      retryDelay: 2000,
      onQueueFull: (functionName) => {
        console.error(`🚫 Queue overflow for ${functionName} - consider increasing maxConcurrent`);
      },
      onTimeout: (functionName, timeout) => {
        console.error(`⏰ Timeout for ${functionName} after ${timeout}ms`);
      },
      onError: (functionName, error) => {
        console.error(`❌ Error in ${functionName}:`, error.message);
      }
    });
  }

  async processBatch(items: string[]): Promise<any[]> {
    console.log(`Processing batch of ${items.length} items`);
    
    const results = [];
    const batchSize = 10;
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchPromises = batch.map(item => 
        this.limiter.executeWithLimit(
          this.processItem.bind(this),
          'processItem',
          [item]
        )
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Log progress
      console.log(`Completed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}`);
    }
    
    return results;
  }

  private async processItem(item: string): Promise<any> {
    console.log(`Processing item: ${item}`);
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 800));
    return { item, processed: true, timestamp: Date.now() };
  }

  // Monitor the limiter
  getMonitoringData() {
    const stats = this.limiter.getStats();
    return {
      ...stats,
      utilization: (stats.runningCount / stats.maxConcurrent) * 100,
      queueUtilization: stats.queueLength > 0 ? 'Queue has pending items' : 'Queue empty'
    };
  }
}

// Example 4: Dynamic limit adjustment
class AdaptiveApiService {
  private limiter: ConcurrencyLimiter;

  constructor() {
    this.limiter = createConcurrencyLimiter({
      maxConcurrent: 2,
      timeout: 30000
    });
  }

  async adaptiveRequest(endpoint: string): Promise<any> {
    // Check current load and adjust limits
    const stats = this.limiter.getStats();
    
    if (stats.queueLength > 5) {
      // Reduce concurrency under high load
      this.limiter.updateLimits({ maxConcurrent: 1 });
      console.log('🔄 Reduced concurrency due to high queue length');
    } else if (stats.queueLength === 0 && stats.runningCount < 2) {
      // Increase concurrency under low load
      this.limiter.updateLimits({ maxConcurrent: 3 });
      console.log('🚀 Increased concurrency due to low load');
    }

    return this.limiter.executeWithLimit(
      this.makeRequest.bind(this),
      'makeRequest',
      [endpoint]
    );
  }

  private async makeRequest(endpoint: string): Promise<any> {
    console.log(`Making adaptive request to ${endpoint}`);
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    return { endpoint, adaptive: true, timestamp: Date.now() };
  }
}

// Example 5: Integration with existing services
class IntegrationExample {
  private limiter: ConcurrencyLimiter;

  constructor() {
    this.limiter = createConcurrencyLimiter({
      maxConcurrent: 3,
      timeout: 20000,
      retryAttempts: 2
    });
  }

  // Wrap existing async functions
  async callExternalApi(url: string, options?: any): Promise<any> {
    return this.limiter.executeWithLimit(
      async (url: string, options?: any) => {
        // This could be an existing fetch or axios call
        console.log(`Calling external API: ${url}`);
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1500));
        return { url, success: true, data: 'mock response' };
      },
      'callExternalApi',
      [url, options]
    );
  }

  // Batch processing with progress tracking
  async processWithProgress(items: string[]): Promise<any[]> {
    const results = [];
    let completed = 0;

    const promises = items.map(async (item, index) => {
      const result = await this.limiter.executeWithLimit(
        this.processWithDelay.bind(this),
        'processWithDelay',
        [item, index]
      );
      
      completed++;
      console.log(`Progress: ${completed}/${items.length} (${Math.round(completed/items.length*100)}%)`);
      
      return result;
    });

    return Promise.all(promises);
  }

  private async processWithDelay(item: string, index: number): Promise<any> {
    console.log(`Processing item ${index}: ${item}`);
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 700));
    return { item, index, processed: true };
  }
}

// Export examples for testing
export {
  ApiService,
  limitedApiCall,
  AdvancedApiService,
  AdaptiveApiService,
  IntegrationExample
}; 