import type { AxiosInstance } from 'axios';
import { createApiClient, setAuthToken } from './utils/api';
import type { KovaaksClientConfig } from './types';
import { apiCache } from './utils/cache';
import {
  AuthAPI,
  UserAPI,
  BenchmarkAPI,
  ScenarioAPI,
  LeaderboardAPI,
  GameSettingsAPI
} from './endpoints';
import { CombinedUserAPI } from './user-endpoints';

/**
 * Kovaaks API Client
 * A comprehensive wrapper for the Kovaaks API
 */
export class KovaaksClient {
  private client: AxiosInstance;
  
  public auth: AuthAPI;
  public user: UserAPI;
  public benchmarks: BenchmarkAPI;
  public scenarios: ScenarioAPI;
  public leaderboards: LeaderboardAPI;
  public gameSettings: GameSettingsAPI;
  public combined: CombinedUserAPI;

  /**
   * Create a new Kovaaks API client
   * 
   * @param config - Optional configuration options
   */
  constructor(config: KovaaksClientConfig = {}) {
    // Create the axios client with the provided config
    this.client = createApiClient(config);

    // Configure caching (enabled by default)
    if (config.enableCaching !== undefined) {
      apiCache.enableCaching = config.enableCaching;
    }

    // Initialize API endpoints
    this.auth = new AuthAPI(this.client);
    this.user = new UserAPI(this.client);
    this.benchmarks = new BenchmarkAPI(this.client);
    this.scenarios = new ScenarioAPI(this.client);
    this.leaderboards = new LeaderboardAPI(this.client);
    this.gameSettings = new GameSettingsAPI(this.client);
    
    // Initialize combined API endpoints
    this.combined = new CombinedUserAPI(this);
  }

  /**
   * Set an authentication token directly
   * 
   * @param token - JWT token to use for authentication
   */
  setToken(token: string): void {
    setAuthToken(this.client, token);
  }

  /**
   * Enable or disable caching globally
   * 
   * @param enabled - Whether to enable caching
   */
  setCaching(enabled: boolean): void {
    apiCache.enableCaching = enabled;
  }

  /**
   * Check if caching is currently enabled
   * 
   * @returns Whether caching is enabled
   */
  isCachingEnabled(): boolean {
    return apiCache.enableCaching;
  }
}

// Export individual API classes for advanced usage
export * from './endpoints';
export * from './types';
export * from './user-endpoints';

// Default export
export default KovaaksClient; 