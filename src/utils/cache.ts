/**
 * Persistent cache utility for API responses
 * This reduces the number of API calls and improves performance
 * This implementation uses file-based storage to persist cache between application restarts
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class PersistentCache {
  private cache: Map<string, CacheEntry<any>>;
  private defaultTTL: number;
  private _enableCaching: boolean;
  private cacheDir: string;
  private cacheFile: string;
  private autoSaveInterval: NodeJS.Timer | null = null;
  private initializing: boolean = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Create a new persistent cache
   * 
   * @param options - Configuration options
   * @param options.defaultTTL - Default time-to-live for cache entries in milliseconds (default: 5 minutes)
   * @param options.enableCaching - Whether caching is enabled (default: true)
   * @param options.cacheDir - Directory to store cache files (default: ~/.kovaaks-api-cache)
   * @param options.cacheFile - Name of the cache file (default: cache.json)
   * @param options.autoSaveInterval - Interval in ms to auto-save cache to disk (default: 5 minutes, 0 to disable)
   */
  constructor(options: {
    defaultTTL?: number;
    enableCaching?: boolean;
    cacheDir?: string;
    cacheFile?: string;
    autoSaveInterval?: number;
  } = {}) {
    this.cache = new Map();
    this.defaultTTL = options.defaultTTL || 5 * 60 * 1000; // 5 minutes
    this._enableCaching = options.enableCaching !== undefined ? options.enableCaching : true;
    
    // Setup cache directory and file path
    this.cacheDir = options.cacheDir || path.join(os.homedir(), '.kovaaks-api-cache');
    this.cacheFile = path.join(this.cacheDir, options.cacheFile || 'cache.json');
    
    // Initialize cache - create directory and load existing cache
    this.initCache();
    
    // Setup auto-save if enabled (default: 5 minutes)
    const autoSaveInterval = options.autoSaveInterval !== undefined ? options.autoSaveInterval : 5 * 60 * 1000;
    if (autoSaveInterval > 0) {
      this.autoSaveInterval = setInterval(() => {
        this.purgeExpired();
        this.saveToDisk();
      }, autoSaveInterval);
    }
    
    // Setup save on process exit
    this.setupExitHandler();
  }

  /**
   * Initialize the cache - create directory and load existing cache
   * This is done asynchronously to avoid blocking the main thread
   */
  private initCache(): Promise<void> {
    if (this.initializing) {
      return this.initPromise!;
    }
    
    this.initializing = true;
    this.initPromise = new Promise<void>((resolve) => {
      // Create cache directory if it doesn't exist
      try {
        if (!fs.existsSync(this.cacheDir)) {
          fs.mkdirSync(this.cacheDir, { recursive: true });
          console.log(`Created cache directory: ${this.cacheDir}`);
        }
      } catch (error) {
        console.warn(`Failed to create cache directory: ${error}`);
      }
      
      // Load cache from disk
      this.loadFromDisk().then(() => {
        this.initializing = false;
        resolve();
      });
    });
    
    return this.initPromise;
  }

  /**
   * Setup handler to save cache when process exits
   */
  private setupExitHandler(): void {
    // Use both exit and SIGINT for better coverage
    process.on('exit', () => {
      this.saveToDisk(true); // Synchronous on exit
    });
    
    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      console.log('Saving cache before exit...');
      this.saveToDisk(true);
      process.exit(0);
    });
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
   * Update configuration options after initialization
   * 
   * @param options - New configuration options
   */
  updateConfig(options: {
    defaultTTL?: number;
    cacheDir?: string;
    cacheFile?: string;
    autoSaveInterval?: number;
  }): void {
    if (options.defaultTTL !== undefined) {
      this.defaultTTL = options.defaultTTL;
    }
    
    if (options.cacheDir !== undefined || options.cacheFile !== undefined) {
      // Update cache file path
      if (options.cacheDir) {
        this.cacheDir = options.cacheDir;
      }
      
      if (options.cacheFile) {
        this.cacheFile = path.join(this.cacheDir, options.cacheFile);
      }
      
      // Create directory if it doesn't exist
      try {
        if (!fs.existsSync(this.cacheDir)) {
          fs.mkdirSync(this.cacheDir, { recursive: true });
          console.log(`Created cache directory: ${this.cacheDir}`);
        }
      } catch (error) {
        console.warn(`Failed to create cache directory: ${error}`);
      }
      
      // Reload from the new location
      this.loadFromDisk().catch(err => 
        console.warn(`Failed to load cache from new location: ${err}`)
      );
    }
    
    // Update auto-save interval if specified
    if (options.autoSaveInterval !== undefined) {
      if (this.autoSaveInterval) {
        clearInterval(this.autoSaveInterval);
        this.autoSaveInterval = null;
      }
      
      if (options.autoSaveInterval > 0) {
        this.autoSaveInterval = setInterval(() => {
          this.purgeExpired();
          this.saveToDisk();
        }, options.autoSaveInterval);
      }
    }
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
      // console.debug(`Cache miss: ${key}`);
      return null;
    }

    // Check if the entry has expired
    if (Date.now() > entry.expiresAt) {
      // console.debug(`Cache expired: ${key}`);
      this.cache.delete(key);
      return null;
    }

    // console.debug(`Cache hit: ${key}`);
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
    
    // console.debug(`Cache set: ${key} (expires in ${ttl/1000}s)`);
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
    this.saveToDisk(); // Save empty cache to disk
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
    
    if (count > 0) {
      // console.debug(`Purged ${count} expired cache entries`);
    }
    
    return count;
  }
  
  /**
   * Save the cache to disk
   * 
   * @param sync - Whether to use synchronous file operations (default: false)
   * @returns Promise that resolves when the cache is saved
   */
  async saveToDisk(sync: boolean = false): Promise<void> {
    if (this.cache.size === 0) {
      // Don't bother writing an empty cache
      if (fs.existsSync(this.cacheFile)) {
        try {
          if (sync) {
            fs.unlinkSync(this.cacheFile);
          } else {
            await fs.promises.unlink(this.cacheFile);
          }
        } catch (error) {
          console.warn(`Failed to delete empty cache file: ${error}`);
        }
      }
      return;
    }
    
    try {
      // Convert cache Map to a serializable object
      const serializable: Record<string, CacheEntry<any>> = {};
      
      for (const [key, entry] of this.cache.entries()) {
        // Only save non-expired entries
        if (Date.now() <= entry.expiresAt) {
          serializable[key] = entry;
        }
      }
      
      const jsonData = JSON.stringify(serializable);
      
      if (sync) {
        fs.writeFileSync(this.cacheFile, jsonData);
      } else {
        await fs.promises.writeFile(this.cacheFile, jsonData);
      }
      
      // console.debug(`Saved ${Object.keys(serializable).length} cache entries to ${this.cacheFile}`);
    } catch (error) {
      console.warn(`Failed to save cache to disk: ${error}`);
    }
  }
  
  /**
   * Load the cache from disk
   * 
   * @returns Promise that resolves when the cache is loaded
   */
  async loadFromDisk(): Promise<void> {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const jsonData = await fs.promises.readFile(this.cacheFile, 'utf8');
        const parsedData: Record<string, CacheEntry<any>> = JSON.parse(jsonData);
        
        let loadedCount = 0;
        let expiredCount = 0;
        const now = Date.now();
        
        // Load entries from file into the cache
        for (const [key, entry] of Object.entries(parsedData)) {
          if (now <= entry.expiresAt) {
            this.cache.set(key, entry);
            loadedCount++;
          } else {
            expiredCount++;
          }
        }
        
        console.log(`Loaded ${loadedCount} cache entries from disk (${expiredCount} expired entries skipped)`);
      } else {
        console.log('No existing cache file found');
      }
    } catch (error) {
      console.warn(`Failed to load cache from disk: ${error}`);
      // Start with an empty cache if loading fails
      this.cache.clear();
    }
  }
  
  /**
   * Get cache statistics
   * 
   * @returns Object with cache statistics
   */
  getStats(): {
    size: number;
    expiringWithin: Record<string, number>;
    oldestEntry: { key: string; age: number } | null;
    newestEntry: { key: string; age: number } | null;
  } {
    const now = Date.now();
    const result = {
      size: this.cache.size,
      expiringWithin: {
        '1min': 0,
        '5min': 0,
        '15min': 0,
        '1hour': 0,
        '1day': 0,
        'later': 0,
      },
      oldestEntry: null as { key: string; age: number } | null,
      newestEntry: null as { key: string; age: number } | null,
    };
    
    // Track oldest and newest entries and expiration buckets
    let oldestTimestamp = now;
    let newestTimestamp = 0;
    let oldestKey = '';
    let newestKey = '';
    
    for (const [key, entry] of this.cache.entries()) {
      // Calculate when this entry expires
      const ttl = entry.expiresAt - now;
      
      // Sort into expiration time buckets
      if (ttl <= 60 * 1000) { // 1 minute
        result.expiringWithin['1min']++;
      } else if (ttl <= 5 * 60 * 1000) { // 5 minutes
        result.expiringWithin['5min']++;
      } else if (ttl <= 15 * 60 * 1000) { // 15 minutes
        result.expiringWithin['15min']++;
      } else if (ttl <= 60 * 60 * 1000) { // 1 hour
        result.expiringWithin['1hour']++;
      } else if (ttl <= 24 * 60 * 60 * 1000) { // 1 day
        result.expiringWithin['1day']++;
      } else {
        result.expiringWithin['later']++;
      }
      
      // Track oldest and newest
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
      
      if (entry.timestamp > newestTimestamp) {
        newestTimestamp = entry.timestamp;
        newestKey = key;
      }
    }
    
    if (oldestKey) {
      result.oldestEntry = {
        key: oldestKey,
        age: now - oldestTimestamp,
      };
    }
    
    if (newestKey) {
      result.newestEntry = {
        key: newestKey,
        age: now - newestTimestamp,
      };
    }
    
    return result;
  }
  
  /**
   * Clean up resources when no longer needed
   * Call this when shutting down to clear intervals and save to disk
   */
  dispose(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
    
    this.saveToDisk(true); // Synchronous save on dispose
  }
}

// Create and export a singleton instance with default options
export const apiCache = new PersistentCache();

// Export the class for advanced usage
export default PersistentCache; 