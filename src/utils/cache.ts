/**
 * Simple in-memory cache utility for API responses
 * This reduces the number of API calls and improves performance
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class ApiCache {
  private cache: Map<string, CacheEntry<any>>;
  private defaultTTL: number;
  private _enableCaching: boolean;

  /**
   * Create a new API cache
   * 
   * @param defaultTTL Default time-to-live for cache entries in milliseconds (default: 5 minutes)
   * @param enableCaching Whether caching is enabled (default: true)
   */
  constructor(defaultTTL: number = 5 * 60 * 1000, enableCaching: boolean = true) {
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
    this._enableCaching = enableCaching;
  }

  /**
   * Enable or disable caching globally
   */
  set enableCaching(value: boolean) {
    this._enableCaching = value;
    if (!value) {
      // Clear the cache when disabling
      this.clear();
    }
  }

  /**
   * Get whether caching is enabled
   */
  get enableCaching(): boolean {
    return this._enableCaching;
  }

  /**
   * Get an item from the cache
   * 
   * @param key Cache key
   * @returns The cached data or null if not found or expired
   */
  get<T>(key: string): T | null {
    // If caching is disabled, always return null
    if (!this._enableCaching) {
      return null;
    }

    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if the entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Store an item in the cache
   * 
   * @param key Cache key
   * @param data Data to cache
   * @param ttl Time-to-live in milliseconds (optional, defaults to the constructor value)
   */
  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    // If caching is disabled, don't store anything
    if (!this._enableCaching) {
      return;
    }

    const timestamp = Date.now();
    const expiresAt = timestamp + ttl;

    this.cache.set(key, {
      data,
      timestamp,
      expiresAt
    });
  }

  /**
   * Remove an item from the cache
   * 
   * @param key Cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all items from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Check if a key exists and is not expired
   * 
   * @param key Cache key
   * @returns Whether the key exists and is not expired
   */
  has(key: string): boolean {
    // If caching is disabled, always return false
    if (!this._enableCaching) {
      return false;
    }

    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get the number of items in the cache
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Clean expired items from the cache
   * 
   * @returns Number of items removed
   */
  purgeExpired(): number {
    const now = Date.now();
    let count = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        count++;
      }
    }
    
    return count;
  }
}

// Create and export a singleton instance
export const apiCache = new ApiCache();

// Export the class for advanced usage
export default ApiCache; 