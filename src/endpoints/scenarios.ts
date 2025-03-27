import type { AxiosInstance } from 'axios';
import { get } from '../utils/api';
import { apiCache } from '../utils/cache';
import type { 
  PopularScenariosResponse, 
  TrendingScenario, 
  PaginationParams,
  UserScenarioPerformance,
  UserScenarioScoresResponse
} from '../types';

/**
 * Cache durations for different API calls (in ms)
 */
const CACHE_TTL = {
  POPULAR_SCENARIOS: 24 * 60 * 60 * 1000, // 24 hours
  TRENDING_SCENARIOS: 6 * 60 * 60 * 1000, // 6 hours
  USER_SCENARIOS: 30 * 60 * 1000, // 30 minutes
};

/**
 * Scenario API endpoints
 */
export class ScenarioAPI {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  /**
   * Get popular scenarios
   * Note: This endpoint uses 1-indexed pagination (page 1 is the first page)
   * 
   * @param params - Pagination parameters and optional scenario name search
   * @returns Paginated response of popular scenarios
   */
  async getPopularScenarios(params?: PaginationParams & { scenarioNameSearch?: string }): Promise<PopularScenariosResponse> {
    const page = params?.page !== undefined ? params.page : 1; // Default to page 1 (first page)
    const max = params?.max || 10;
    
    // Create a cache key
    const cacheKey = `popular_scenarios_${page}_${max}_${params?.scenarioNameSearch || ''}`;
    
    // Check cache first
    const cachedData = apiCache.get<PopularScenariosResponse>(cacheKey);
    if (cachedData) {
      return cachedData;
    }
    
    // Build query parameters
    const queryParams: Record<string, any> = {
      page,
      max
    };
    
    // Add optional scenario name search
    if (params?.scenarioNameSearch) {
      queryParams.scenarioNameSearch = params.scenarioNameSearch;
    }
    
    // If not cached, make the API call
    const response = await get<PopularScenariosResponse>(
      this.client, 
      '/webapp-backend/scenario/popular', 
      queryParams
    );
    
    // Cache the response
    apiCache.set(cacheKey, response, CACHE_TTL.POPULAR_SCENARIOS);
    
    return response;
  }

  /**
   * Get trending scenarios
   * 
   * @returns Array of trending scenarios
   */
  async getTrendingScenarios(): Promise<TrendingScenario[]> {
    // Create a cache key
    const cacheKey = 'trending_scenarios';
    
    // Check cache first
    const cachedData = apiCache.get<TrendingScenario[]>(cacheKey);
    if (cachedData) {
      return cachedData;
    }
    
    // If not cached, make the API call
    const response = await get<TrendingScenario[]>(
      this.client, 
      '/webapp-backend/scenario/trending'
    );
    
    // Cache the response
    apiCache.set(cacheKey, response, CACHE_TTL.TRENDING_SCENARIOS);
    
    return response;
  }

  /**
   * Get detailed scenario performance for a specific user
   * This combines the user's scenario play data with scenario metadata
   * Note: This endpoint uses 1-indexed pagination (page 1 is the first page)
   * 
   * @param username - Username to get scenario performance for
   * @param params - Pagination parameters
   * @param forceRefresh - Whether to bypass cache and force fresh API calls
   * @returns Combined user scenario performance with metadata
   */
  async getUserScenarioPerformance(
    username: string, 
    params?: PaginationParams,
    forceRefresh = false
  ): Promise<UserScenarioPerformance | null> {
    try {
      // Validate username
      if (!username) {
        console.warn('Username is required for scenario performance lookup');
        return null;
      }
      
      // Ensure params is defined with defaults
      const validParams = params || {};
      const page = validParams.page !== undefined ? validParams.page : 1; // Default to page 1
      const max = validParams.max || 10;
      
      // Create a cache key
      const cacheKey = `user_scenario_performance_${username.toLowerCase()}_${page}_${max}`;
      
      // Check cache first
      if (!forceRefresh) {
        const cachedData = apiCache.get<UserScenarioPerformance>(cacheKey);
        if (cachedData) {
          return cachedData;
        }
      }
      
      // Get user's played scenarios - ensure required pagination parameters
      const userScenariosResponse = await get<UserScenarioScoresResponse>(
        this.client,
        '/webapp-backend/user/scenario/total-play',
        { 
          username,
          page,
          max
        }
      );
      
      if (!userScenariosResponse || !userScenariosResponse.data || !Array.isArray(userScenariosResponse.data)) {
        return null;
      }
      
      // Get popular scenarios for metadata
      const popularScenarios = await this.getPopularScenarios({ max: 100 });
      
      // Map to combine data
      const scenarioDetails = await Promise.all(
        userScenariosResponse.data.map(async (scenario: any) => {
          // Find matching metadata from popular scenarios
          const metadata = popularScenarios.data.find(s => 
            s.scenarioName === scenario.scenarioName || 
            s.leaderboardId === scenario.leaderboardId
          );
          
          // If no metadata found in popular, try to get it directly
          let scenarioMeta = metadata?.scenario || null;
          
          if (!scenarioMeta) {
            try {
              // Try to get scenario details directly
              const details = await get(
                this.client,
                '/webapp-backend/scenario',
                { id: scenario.leaderboardId }
              );
              
              // If details is null (404 handled gracefully), use default values
              if (!details) {
                scenarioMeta = {
                  aimType: null,
                  authors: [],
                  description: ''
                };
              } else {
                // Add type assertion
                scenarioMeta = details as { 
                  aimType: string | null; 
                  authors: any[]; 
                  description: string 
                };
              }
            } catch (error) {
              console.error(`Error getting scenario details for ${scenario.scenarioName}:`, error);
              scenarioMeta = {
                aimType: null,
                authors: [],
                description: ''
              };
            }
          }
          
          return {
            leaderboardId: scenario.leaderboardId,
            scenarioName: scenario.scenarioName,
            plays: scenario.counts?.plays || 0,
            bestScore: scenario.score,
            rank: scenario.rank,
            dateLastPlayed: scenario.dateLastPlayed || new Date().toISOString(),
            metadata: {
              popularity: metadata?.counts?.plays || 0,
              totalPlays: metadata?.counts?.entries || 0,
              aimType: scenarioMeta?.aimType || null,
              authors: scenarioMeta?.authors || [],
              description: scenarioMeta?.description || ''
            }
          };
        })
      );
      
      // Create the complete performance object
      const performance: UserScenarioPerformance = {
        username,
        totalScenarios: scenarioDetails.length,
        scenarioDetails
      };
      
      // Cache the response
      apiCache.set(cacheKey, performance, CACHE_TTL.USER_SCENARIOS);
      
      return performance;
    } catch (error) {
      console.error('Error getting user scenario performance:', error);
      return null;
    }
  }
} 