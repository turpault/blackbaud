import Dexie, { Table } from 'dexie';

// Define the structure of our cached data
export interface CachedItem {
  id?: number;
  key: string;
  data: any;
  timestamp: number;
  expiresAt?: number;
}

// Define the structure for constituent data
export interface CachedConstituent {
  id?: number;
  constituentId: string;
  data: any;
  timestamp: number;
  expiresAt?: number;
}

// Define the structure for gift data
export interface CachedGift {
  id?: number;
  cacheKey: string;
  data: any;
  timestamp: number;
  expiresAt?: number;
  filters?: string;
}

// Extend Dexie to add our tables
export class BlackbaudDatabase extends Dexie {
  // Define tables
  cache!: Table<CachedItem>;
  constituents!: Table<CachedConstituent>;
  gifts!: Table<CachedGift>;

  constructor() {
    super('BlackbaudDatabase');
    
    // Define the database schema
    this.version(1).stores({
      cache: '++id, key, timestamp, expiresAt',
      constituents: '++id, constituentId, timestamp, expiresAt',
      gifts: '++id, cacheKey, timestamp, expiresAt, filters'
    });
  }
}

// Create and export the database instance
export const db = new BlackbaudDatabase();

// Utility functions for cache operations
export const cacheUtils = {
  // Set a cached item with expiration
  async set(key: string, data: any, ttlMs: number = 3600000): Promise<void> {
    const expiresAt = Date.now() + ttlMs;
    await db.cache.put({
      key,
      data,
      timestamp: Date.now(),
      expiresAt
    });
  },

  // Get a cached item
  async get(key: string): Promise<any | null> {
    const item = await db.cache.where('key').equals(key).first();
    if (!item) return null;
    
    // Check if expired
    if (item.expiresAt && Date.now() > item.expiresAt) {
      await db.cache.where('key').equals(key).delete();
      return null;
    }
    
    return item.data;
  },

  // Delete a cached item
  async delete(key: string): Promise<void> {
    await db.cache.where('key').equals(key).delete();
  },

  // Clear all cache
  async clear(): Promise<void> {
    await db.cache.clear();
  },

  // Get cache statistics
  async getStats(): Promise<{ count: number; totalSize: number; oldestEntry?: Date }> {
    const items = await db.cache.toArray();
    const totalSize = JSON.stringify(items).length;
    const oldestTimestamp = items.length > 0 ? Math.min(...items.map(item => item.timestamp)) : Date.now();
    
    return {
      count: items.length,
      totalSize,
      oldestEntry: items.length > 0 ? new Date(oldestTimestamp) : undefined
    };
  },

  // Clean expired items
  async cleanExpired(): Promise<number> {
    const now = Date.now();
    const expiredItems = await db.cache.where('expiresAt').belowOrEqual(now).toArray();
    const expiredKeys = expiredItems.map(item => item.key);
    
    if (expiredKeys.length > 0) {
      await db.cache.where('key').anyOf(expiredKeys).delete();
    }
    
    return expiredKeys.length;
  }
};

// Utility functions for constituent cache
export const constituentCacheUtils = {
  // Set constituent data
  async set(constituentId: string, data: any, ttlMs: number = 3600000): Promise<void> {
    const expiresAt = Date.now() + ttlMs;
    await db.constituents.put({
      constituentId,
      data,
      timestamp: Date.now(),
      expiresAt
    });
  },

  // Get constituent data
  async get(constituentId: string): Promise<any | null> {
    const item = await db.constituents.where('constituentId').equals(constituentId).first();
    if (!item) return null;
    
    // Check if expired
    if (item.expiresAt && Date.now() > item.expiresAt) {
      await db.constituents.where('constituentId').equals(constituentId).delete();
      return null;
    }
    
    return item.data;
  },

  // Delete constituent data
  async delete(constituentId?: string): Promise<void> {
    if (constituentId) {
      await db.constituents.where('constituentId').equals(constituentId).delete();
    } else {
      await db.constituents.clear();
    }
  },

  // Get constituent cache statistics
  async getStats(): Promise<{ count: number; totalSize: number; oldestEntry?: Date }> {
    const items = await db.constituents.toArray();
    const totalSize = JSON.stringify(items).length;
    const oldestTimestamp = items.length > 0 ? Math.min(...items.map(item => item.timestamp)) : Date.now();
    
    return {
      count: items.length,
      totalSize,
      oldestEntry: items.length > 0 ? new Date(oldestTimestamp) : undefined
    };
  }
};

// Utility functions for gift cache
export const giftCacheUtils = {
  // Set gift data
  async set(cacheKey: string, data: any, filters?: any, ttlMs: number = 3600000): Promise<void> {
    const expiresAt = Date.now() + ttlMs;
    await db.gifts.put({
      cacheKey,
      data,
      filters: filters ? JSON.stringify(filters) : undefined,
      timestamp: Date.now(),
      expiresAt
    });
  },

  // Get gift data
  async get(cacheKey: string): Promise<any | null> {
    const item = await db.gifts.where('cacheKey').equals(cacheKey).first();
    if (!item) return null;
    
    // Check if expired
    if (item.expiresAt && Date.now() > item.expiresAt) {
      await db.gifts.where('cacheKey').equals(cacheKey).delete();
      return null;
    }
    
    return item.data;
  },

  // Delete gift data
  async delete(filters?: any): Promise<void> {
    if (filters) {
      const filterString = JSON.stringify(filters);
      await db.gifts.where('filters').equals(filterString).delete();
    } else {
      await db.gifts.clear();
    }
  },

  // Get gift cache statistics
  async getStats(): Promise<{ count: number; totalSize: number; filterCombinations: number }> {
    const items = await db.gifts.toArray();
    const totalSize = JSON.stringify(items).length;
    const filterCombinations = new Set(items.map(item => item.filters).filter(Boolean)).size;
    
    return {
      count: items.length,
      totalSize,
      filterCombinations
    };
  }
}; 