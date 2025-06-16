import { cache, clearCache, getCacheStats, cleanExpiredCache, manualCache, manualGetCache } from '../cacheDecorator';

// Mock localStorage for testing
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    key: jest.fn((index: number) => Object.keys(store)[index] || null),
    get length() {
      return Object.keys(store).length;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Test class using cache decorator
class TestService {
  callCount = 0;

  @cache({ keyPrefix: 'test', expirationMs: 1000 })
  async fetchData(id: string): Promise<{ id: string; data: string; callTime: number }> {
    this.callCount++;
    return {
      id,
      data: `data-${id}`,
      callTime: Date.now()
    };
  }

  @cache({ 
    keyPrefix: 'custom',
    keyGenerator: (a: number, b: string) => `${a}_${b}`,
    expirationMs: 2000
  })
  async fetchCustomKey(a: number, b: string): Promise<string> {
    this.callCount++;
    return `result-${a}-${b}`;
  }

  @cache({ keyPrefix: 'debug', debug: true })
  async fetchWithDebug(value: string): Promise<string> {
    this.callCount++;
    return `debug-${value}`;
  }

  @cache({ useCache: false })
  async fetchNoCache(value: string): Promise<string> {
    this.callCount++;
    return `nocache-${value}`;
  }

  // Non-cached method for comparison
  async fetchUncached(id: string): Promise<{ id: string; data: string; callTime: number }> {
    this.callCount++;
    return {
      id,
      data: `data-${id}`,
      callTime: Date.now()
    };
  }
}

describe('Cache Decorator', () => {
  let testService: TestService;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    testService = new TestService();
    localStorageMock.clear();
    jest.clearAllMocks();
    testService.callCount = 0;
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Basic Caching', () => {
    it('should cache results and return cached data on subsequent calls', async () => {
      // First call should hit the method
      const result1 = await testService.fetchData('123');
      expect(testService.callCount).toBe(1);
      expect(result1.id).toBe('123');
      expect(result1.data).toBe('data-123');

      // Second call should use cache
      const result2 = await testService.fetchData('123');
      expect(testService.callCount).toBe(1); // Still 1, not incremented
      expect(result2).toEqual(result1); // Same result

      // Different parameter should hit the method again
      const result3 = await testService.fetchData('456');
      expect(testService.callCount).toBe(2);
      expect(result3.id).toBe('456');
    });

    it('should store data in localStorage with correct structure', async () => {
      await testService.fetchData('123');
      
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const setItemCall = (localStorageMock.setItem as jest.Mock).mock.calls[0];
      const [key, value] = setItemCall;
      
      expect(key).toMatch(/^test_/);
      
      const parsed = JSON.parse(value);
      expect(parsed).toHaveProperty('data');
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('expiresAt');
      expect(parsed.data.id).toBe('123');
    });
  });

  describe('Custom Key Generation', () => {
    it('should use custom key generator', async () => {
      await testService.fetchCustomKey(42, 'hello');
      
      const setItemCall = (localStorageMock.setItem as jest.Mock).mock.calls[0];
      const [key] = setItemCall;
      
      expect(key).toBe('custom_42_hello');
    });

    it('should create different cache entries for different parameters', async () => {
      await testService.fetchCustomKey(1, 'a');
      await testService.fetchCustomKey(2, 'b');
      
      expect(testService.callCount).toBe(2);
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cache Expiration', () => {
    it('should expire cache after expiration time', async () => {
      // Mock Date.now to control time
      const originalNow = Date.now;
      const mockTime = 1000000000;
      Date.now = jest.fn(() => mockTime);

      await testService.fetchData('123');
      expect(testService.callCount).toBe(1);

      // Move time forward past expiration (1000ms)
      Date.now = jest.fn(() => mockTime + 1500);

      await testService.fetchData('123');
      expect(testService.callCount).toBe(2); // Should call again due to expiration

      // Restore Date.now
      Date.now = originalNow;
    });
  });

  describe('Debug Mode', () => {
    it('should log debug messages when debug is enabled', async () => {
      await testService.fetchWithDebug('test');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Cache] Checking cache for key:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Cache] Cache miss for key:')
      );
    });
  });

  describe('Cache Disabled', () => {
    it('should not use cache when useCache is false', async () => {
      await testService.fetchNoCache('test');
      await testService.fetchNoCache('test');
      
      expect(testService.callCount).toBe(2); // Both calls should hit the method
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle localStorage errors gracefully', async () => {
      // Mock localStorage to throw error
      (localStorageMock.setItem as jest.Mock).mockImplementationOnce(() => {
        throw new Error('localStorage full');
      });

      // Should still work but not cache
      const result = await testService.fetchData('123');
      expect(result.id).toBe('123');
      expect(testService.callCount).toBe(1);
    });

    it('should handle corrupted cache data', async () => {
      // Set corrupted data in localStorage
      (localStorageMock.getItem as jest.Mock).mockReturnValueOnce('invalid json');
      
      // Should ignore corrupted cache and call method
      const result = await testService.fetchData('123');
      expect(result.id).toBe('123');
      expect(testService.callCount).toBe(1);
      expect(localStorageMock.removeItem).toHaveBeenCalled();
    });
  });

  describe('Cache Management Functions', () => {
    beforeEach(async () => {
      // Create some test cache entries
      await testService.fetchData('1');
      await testService.fetchData('2');
      await testService.fetchCustomKey(1, 'a');
      await testService.fetchCustomKey(2, 'b');
    });

    it('should get cache statistics', () => {
      const stats = getCacheStats();
      expect(stats.count).toBeGreaterThan(0);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.oldestEntry).toBeInstanceOf(Date);
      expect(stats.newestEntry).toBeInstanceOf(Date);
    });

    it('should get cache statistics for specific prefix', () => {
      const testStats = getCacheStats('test');
      const customStats = getCacheStats('custom');
      
      expect(testStats.count).toBe(2); // Two test_ entries
      expect(customStats.count).toBe(2); // Two custom_ entries
    });

    it('should clear cache by prefix', () => {
      const clearedCount = clearCache('test');
      expect(clearedCount).toBe(2); // Should clear 2 test_ entries
      
      const stats = getCacheStats('test');
      expect(stats.count).toBe(0);
      
      const customStats = getCacheStats('custom');
      expect(customStats.count).toBe(2); // custom_ entries should remain
    });

    it('should clean expired cache entries', () => {
      // Mock Date.now to make entries expired
      const originalNow = Date.now;
      Date.now = jest.fn(() => Date.now() + 10000); // Far in the future
      
      const cleanedCount = cleanExpiredCache();
      expect(cleanedCount).toBeGreaterThan(0);
      
      Date.now = originalNow;
    });
  });

  describe('Manual Cache Functions', () => {
    it('should manually cache and retrieve values', () => {
      const testData = { test: 'data' };
      
      manualCache('manual_test', testData, 1000);
      const retrieved = manualGetCache('manual_test');
      
      expect(retrieved).toEqual(testData);
    });

    it('should return null for non-existent manual cache', () => {
      const retrieved = manualGetCache('non_existent');
      expect(retrieved).toBeNull();
    });
  });
});

describe('Cache Decorator Error Cases', () => {
  it('should handle method errors properly', async () => {
    class ErrorService {
      @cache({ keyPrefix: 'error' })
      async throwError(): Promise<string> {
        throw new Error('Test error');
      }
    }

    const service = new ErrorService();
    await expect(service.throwError()).rejects.toThrow('Test error');
  });
}); 