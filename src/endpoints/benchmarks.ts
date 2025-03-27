import type { AxiosInstance } from 'axios';
import { get } from '../utils/api';
import { apiCache } from '../utils/cache';
import type { 
  BenchmarkProgress, 
  BenchmarkSearchItem, 
  BenchmarkSearchResponse,
  PaginationParams,
  UserBenchmarkProgress
} from '../types';

/**
 * Cache durations for different API calls (in ms)
 */
const CACHE_TTL = {
  BENCHMARK_PROGRESS: 60 * 60 * 1000, // 1 hour
  BENCHMARK_SEARCH: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * Benchmark API endpoints
 */
export class BenchmarkAPI {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  /**
   * Get benchmark progress data for a specific user
   * Note: This endpoint requires both benchmarkId and steamId parameters
   * 
   * @param benchmarkId - The ID of the benchmark
   * @param steamId - The Steam ID of the user
   * @param params - Pagination parameters
   * @returns Benchmark progress data or null if parameters are invalid
   */
  async getPlayerProgress(
    benchmarkId: number, 
    steamId: string, 
    params?: PaginationParams
  ): Promise<BenchmarkProgress | null> {
    // Validate required parameters
    if (!benchmarkId || !steamId) {
      console.warn('Both benchmarkId and steamId are required for player progress');
      return null;
    }
    
    try {
      // Default to page 1 (1-indexed pagination)
      const page = params?.page !== undefined ? params.page : 1;
      const max = params?.max || 10;
      
      // Create a cache key for better performance
      const cacheKey = `player_progress_${benchmarkId}_${steamId}_${page}_${max}`;
      
      // Check cache first
      const cachedData = apiCache.get<BenchmarkProgress>(cacheKey);
      if (cachedData) {
        return cachedData;
      }
      
      // Make the API call
      const response = await get<BenchmarkProgress>(
        this.client, 
        '/webapp-backend/benchmarks/player-progress-rank-benchmark', 
        {
          benchmarkId,
          steamId,
          page,
          max
        }
      );
      
      // Cache the response
      apiCache.set(cacheKey, response, CACHE_TTL.BENCHMARK_PROGRESS);
      
      return response;
    } catch (error) {
      console.error(`Error getting player progress for benchmark ${benchmarkId} and Steam ID ${steamId}:`, error);
      return null;
    }
  }

  /**
   * Search for benchmarks that a user has participated in
   * Note: This endpoint uses 1-indexed pagination (page 1 is the first page)
   * 
   * @param username - The username to search for
   * @param params - Pagination parameters
   * @returns Paginated response of benchmark search results
   */
  async searchPlayerBenchmarks(
    username: string, 
    params?: PaginationParams
  ): Promise<BenchmarkSearchResponse> {
    try {
      if (!username) {
        console.warn('Username parameter is required for benchmark search');
        // Return empty response instead of throwing
        return { 
          data: [], 
          page: params?.page || 1,
          max: params?.max || 10,
          total: 0 
        };
      }
      
      // Default to page 1 (1-indexed pagination)
      const page = params?.page !== undefined ? params.page : 1;
      const max = params?.max || 10;
      
      // Create a cache key for better performance
      const cacheKey = `player_benchmarks_${username.toLowerCase()}_${page}_${max}`;
      
      // Check cache first
      const cachedData = apiCache.get<BenchmarkSearchResponse>(cacheKey);
      if (cachedData) {
        return cachedData;
      }
      
      // Make the API call
      const response = await get<BenchmarkSearchResponse>(
        this.client, 
        '/webapp-backend/benchmarks/player-progress-rank', 
        {
          username,
          page,
          max
        }
      );
      
      // Cache the response
      apiCache.set(cacheKey, response, CACHE_TTL.BENCHMARK_SEARCH);
      
      return response;
    } catch (error) {
      console.error(`Error searching for player benchmarks for ${username}:`, error);
      // Return empty response instead of throwing
      return { 
        data: [], 
        page: params?.page || 1,
        max: params?.max || 10,
        total: 0 
      };
    }
  }

  /**
   * Search for benchmarks
   * Note: This endpoint uses 1-indexed pagination (page 1 is the first page)
   * 
   * @param params - Pagination parameters
   * @returns Paginated response of benchmark search results
   */
  async search(params?: PaginationParams): Promise<BenchmarkSearchResponse> {
    try {
      // Default to page 1 (1-indexed pagination)
      const page = params?.page !== undefined ? params.page : 1;
      const max = params?.max || 10;
      
      // Create a cache key for better performance
      const cacheKey = `benchmarks_search_${page}_${max}`;
      
      // Check cache first
      const cachedData = apiCache.get<BenchmarkSearchResponse>(cacheKey);
      if (cachedData) {
        return cachedData;
      }
      
      // Make the API call
      const response = await get<BenchmarkSearchResponse>(
        this.client, 
        '/webapp-backend/benchmarks/search', 
        {
          page,
          max
        }
      );
      
      // Cache the response
      apiCache.set(cacheKey, response, CACHE_TTL.BENCHMARK_SEARCH);
      
      return response;
    } catch (error) {
      console.error('Error searching for benchmarks:', error);
      // Return empty response instead of throwing
      return { 
        data: [], 
        page: params?.page || 1,
        max: params?.max || 10,
        total: 0 
      };
    }
  }

  /**
   * Get a user's complete benchmark progress with category details
   * This combines benchmark progress with benchmark list data
   * 
   * @param username - Username to get benchmark progress for
   * @param steamId - The Steam ID of the user (required by the API)
   * @param benchmarkId - The ID of the benchmark to get progress for
   * @param forceRefresh - Whether to bypass cache and force fresh API calls
   * @returns Combined benchmark progress with category details
   */
  async getUserBenchmarkProgress(
    username: string, 
    steamId: string,
    benchmarkId: number,
    forceRefresh = false
  ): Promise<UserBenchmarkProgress | null> {
    try {
      // Ensure username is provided
      if (!username) {
        console.error('Username is required for benchmark progress');
        return null;
      }
      
      // Ensure steamId is provided
      if (!steamId) {
        console.error('Steam ID is required for benchmark progress');
        return null;
      }
      
      // Ensure benchmarkId is provided and valid
      if (!benchmarkId || benchmarkId <= 0) {
        console.error('Benchmark ID is required for benchmark progress and must be a positive number');
        return null;
      }
      
      // Create a cache key
      const cacheKey = `user_benchmark_progress_${username.toLowerCase()}_${steamId}_${benchmarkId}`;
      
      // Check cache first
      if (!forceRefresh) {
        const cachedData = apiCache.get<UserBenchmarkProgress>(cacheKey);
        if (cachedData) {
          return cachedData;
        }
      }
      
      // Get basic benchmark progress
      try {
        const progressResponse = await get<BenchmarkProgress>(
          this.client,
          '/webapp-backend/benchmarks/player-progress-rank-benchmark',
          { 
            username,
            steamId,
            benchmarkId,
            page: 1,
            max: 20
          }
        );
        
        if (!progressResponse) {
          console.error(`No benchmark progress found for user ${username} with benchmark ID ${benchmarkId}`);
          return null;
        }
        
        // Get all benchmarks for additional metadata
        const benchmarkList = await this.search({ max: 100 });
        
        // Create categories object
        const categories: Record<string, {
          progress: number;
          rank: number | null;
          scenarios: Record<string, {
            score: number;
            leaderboardRank: number | null;
            scenarioRank: number | null;
          }>;
        }> = {};
        
        // Process categories from the progress response
        Object.entries(progressResponse.categories || {}).forEach(([categoryName, category]) => {
          // Skip if category is undefined or doesn't have necessary properties
          if (!category) return;

          categories[categoryName] = {
            progress: category.benchmark_progress,
            rank: category.category_rank,
            scenarios: {}
          };
          
          // Add scenarios to the category
          if (category.scenarios) {
            Object.entries(category.scenarios).forEach(([scenarioName, scenario]) => {
              // Skip if scenario is undefined
              if (!scenario) return;
              
              // Ensure we have both the category and its scenarios object defined
              if (categories[categoryName] && categories[categoryName].scenarios) {
                categories[categoryName].scenarios[scenarioName] = {
                  score: scenario.score,
                  leaderboardRank: scenario.leaderboard_rank,
                  scenarioRank: scenario.scenario_rank
                };
              }
            });
          }
        });
        
        // Map benchmarks for the response
        const benchmarks = benchmarkList?.data?.map((benchmark: BenchmarkSearchItem) => ({
          benchmarkName: benchmark.benchmarkName,
          benchmarkId: benchmark.benchmarkId,
          benchmarkIcon: benchmark.benchmarkIcon,
          progress: 0 // Default value, will update below if we have data
        })) || [];
        
        // Complete benchmark progress data
        const userBenchmarkProgress: UserBenchmarkProgress = {
          username,
          overallProgress: progressResponse.benchmark_progress,
          overallRank: progressResponse.overall_rank,
          categories,
          benchmarks
        };
        
        // Cache the combined response
        apiCache.set(cacheKey, userBenchmarkProgress, CACHE_TTL.BENCHMARK_PROGRESS);
        
        return userBenchmarkProgress;
      } catch (specificError) {
        console.error(`API error retrieving benchmark progress: ${specificError}`);
        // Let it fall through to the general error handler
        throw specificError;
      }
    } catch (error) {
      console.error('Error getting user benchmark progress:', error);
      return null;
    }
  }
} 