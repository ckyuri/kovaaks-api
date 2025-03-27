import type { AxiosInstance } from 'axios';
import { get } from '../utils/api';
import { apiCache } from '../utils/cache';

/**
 * Game Settings API endpoints
 */
export class GameSettingsAPI {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  /**
   * Get available game settings information
   * This includes sensitivity conversion parameters and other game-related settings
   * 
   * @returns Game settings information
   */
  async getGameSettings(): Promise<any> {
    try {
      // Create a cache key
      const cacheKey = 'game_settings';
      
      // Check cache first (cache for a day - settings don't change often)
      const cachedData = apiCache.get(cacheKey);
      if (cachedData) {
        return cachedData;
      }
      
      // Make the API call
      const response = await get(this.client, '/webapp-backend/game-settings');
      
      // Cache the response for 24 hours
      const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
      apiCache.set(cacheKey, response, CACHE_TTL);
      
      return response;
    } catch (error) {
      console.error('Error getting game settings:', error);
      return null;
    }
  }
} 