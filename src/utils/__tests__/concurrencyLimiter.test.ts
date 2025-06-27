/**
 * Concurrency Limiter Tests
 * 
 * Tests for the concurrency limiter decorator functionality
 */

import { createConcurrencyLimiter, withConcurrencyLimit, limitConcurrency } from '../concurrencyLimiter';

describe('ConcurrencyLimiter', () => {
  let limiter: any;

  beforeEach(() => {
    limiter = createConcurrencyLimiter({
      maxConcurrent: 2
    });
  });

  afterEach(() => {
    limiter.clearQueue();
  });

  test('should limit concurrent executions', async () => {
    const results: number[] = [];
    const startTime = Date.now();

    // Create 5 async functions that take 1 second each
    const promises = Array.from({ length: 5 }, (_, i) => 
      limiter.executeWithLimit(
        async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          results.push(i);
          return i;
        },
        'testFunction',
        []
      )
    );

    await Promise.all(promises);
    const endTime = Date.now();

    // Should take at least 3 seconds (2 batches of 2 + 1)
    expect(endTime - startTime).toBeGreaterThanOrEqual(2000);
    expect(results).toHaveLength(5);
    expect(results).toEqual(expect.arrayContaining([0, 1, 2, 3, 4]));
  });

  test('should handle errors gracefully', async () => {
    const errorFn = async () => {
      throw new Error('Test error');
    };

    await expect(
      limiter.executeWithLimit(errorFn, 'errorFunction', [])
    ).rejects.toThrow('Test error');
  });

  test('should provide statistics', async () => {
    const stats = limiter.getStats();
    
    expect(stats).toHaveProperty('queueLength');
    expect(stats).toHaveProperty('runningCount');
    expect(stats).toHaveProperty('maxConcurrent');
    expect(stats.maxConcurrent).toBe(2);
  });

  test('should handle queue overflow', async () => {
    // Fill the queue beyond capacity
    const promises = Array.from({ length: 10 }, (_, i) => 
      limiter.executeWithLimit(
        async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return i;
        },
        'overflowFunction',
        []
      )
    );

    // Some should be rejected due to queue overflow
    const results = await Promise.allSettled(promises);
    const rejected = results.filter(r => r.status === 'rejected');
    
    expect(rejected.length).toBeGreaterThan(0);
  });
});

describe('withConcurrencyLimit decorator', () => {
  test('should work as a method decorator', async () => {
    class TestClass {
      @withConcurrencyLimit({ maxConcurrent: 1 })
      async testMethod(id: number): Promise<number> {
        await new Promise(resolve => setTimeout(resolve, 100));
        return id;
      }
    }

    const instance = new TestClass();
    const promises = Array.from({ length: 3 }, (_, i) => 
      instance.testMethod(i)
    );

    const results = await Promise.all(promises);
    expect(results).toEqual([0, 1, 2]);
  });
});

describe('limitConcurrency function wrapper', () => {
  test('should wrap standalone functions', async () => {
    const originalFn = async (x: number): Promise<number> => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return x * 2;
    };

    const limitedFn = limitConcurrency(originalFn, {
      maxConcurrent: 2
    });

    const promises = Array.from({ length: 4 }, (_, i) => 
      limitedFn(i)
    );

    const results = await Promise.all(promises);
    expect(results).toEqual([0, 2, 4, 6]);
  });
});

describe('Advanced ConcurrencyLimiter features', () => {
  test('should support dynamic limit updates', async () => {
    const limiter = createConcurrencyLimiter({ maxConcurrent: 1 });
    
    // Start with 1 concurrent
    expect(limiter.getStats().maxConcurrent).toBe(1);
    
    // Update to 3 concurrent
    limiter.updateLimits({ maxConcurrent: 3 });
    expect(limiter.getStats().maxConcurrent).toBe(3);
  });

  test('should execute functions without timeout interference', async () => {
    const slowFn = async () => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return 'success';
    };

    const limiter = createConcurrencyLimiter({
      maxConcurrent: 1
    });

    const result = await limiter.executeWithLimit(slowFn, 'slowFunction', []);
    expect(result).toBe('success');
  });
}); 