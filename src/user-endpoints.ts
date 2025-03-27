import { KovaaksClient } from './index';
import type { 
  CompleteUserProfile, 
  UserScenarioPerformance,
  UserBenchmarkProgress,
  UserActivityTimeline,
  UserRegionalContext,
  ActivityTimelineOptions,
  ProfileSearchOptions,
  ProfileSearchResult,
  ExtendedUserProfile,
  UserScenarioScore,
  UserActivity,
  UserProfile
} from './types';
import { apiCache } from './utils/cache';

/**
 * Cache durations for different API calls (in ms)
 */
const CACHE_TTL = {
  USER_PROFILE: 15 * 60 * 1000, // 15 minutes
  SCENARIO_SCORES: 15 * 60 * 1000, // 15 minutes
  PERCENTILE_DATA: 60 * 60 * 1000, // 1 hour
  RANK_HISTORY: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * Interface for performance trends over time
 */
export interface PerformanceTrend {
  scenarioName: string;
  scoreHistory: Array<{
    date: string;
    score: number;
    percentile?: number;
    rank?: number;
  }>;
  trends: {
    overall: {
      firstScore: number;
      latestScore: number;
      highestScore: number;
      percentImprovement: number;
      improvementRate: number; // Points per day
    };
    timeWindows: {
      last7Days?: {
        startScore: number;
        endScore: number;
        percentChange: number;
      };
      last30Days?: {
        startScore: number;
        endScore: number;
        percentChange: number;
      };
      last90Days?: {
        startScore: number;
        endScore: number;
        percentChange: number;
      };
    };
    // Additional statistics
    movingAverages: {
      last3Scores: number;
      last5Scores: number;
    };
    consistency: number; // Standard deviation / mean (lower is better)
  };
}

/**
 * Interface for user comparison results
 */
export interface UserComparison {
  userProfile: {
    username: string;
    kovaaksPlusActive: boolean;
    ranking?: {
      global: number | null;
      country: number | null;
    };
  };
  comparedToProfile: {
    username: string;
    kovaaksPlusActive: boolean;
    ranking?: {
      global: number | null;
      country: number | null;
    };
  };
  summary: {
    globalRankDifference: number | null;
    countryRankDifference: number | null;
    totalScenarioCount: number;
    betterScenarios: number;
    worseScenarios: number;
    similarScenarios: number;
    averageScoreDifference: number;
    medianScoreDifference: number;
  };
  scenarioComparisons: Array<{
    scenarioName: string;
    userScore: number;
    comparedScore: number;
    difference: number;
    percentDifference: number;
    userRank: number | null;
    comparedRank: number | null;
    rankDifference: number | null;
  }>;
  strengthsAndWeaknesses: {
    userStrengths: string[];
    userWeaknesses: string[];
  };
  recommendations: string[];
}

/**
 * Combined API endpoints for comprehensive user data
 * This class provides easy access to combined data from multiple endpoints
 */
export class CombinedUserAPI {
  private client: KovaaksClient;
  
  constructor(client: KovaaksClient) {
    this.client = client;
  }
  
  /**
   * Get a complete user profile with all related information
   * 
   * @param username - Username to get complete profile for
   * @param forceRefresh - Whether to bypass cache
   * @returns Complete user profile with related information
   */
  async getCompleteProfile(
    username: string,
    forceRefresh = false
  ): Promise<ExtendedUserProfile | null> {
    try {
      // Create a cache key
      const cacheKey = `complete_profile_${username.toLowerCase()}`;
      
      // Check cache first
      if (!forceRefresh) {
        const cachedData = apiCache.get<ExtendedUserProfile>(cacheKey);
        if (cachedData) {
          return cachedData;
        }
      }
      
      // First try leaderboard lookup to get more information, especially for Steam usernames
      console.log(`Looking up user "${username}" in leaderboards...`);
      
      let steamId: string | null = null;
      let steamAccountName: string | null = null;
      let webappUsername: string | null = null;
      
      // Search in leaderboards first to get SteamID and webapp username if available
      try {
        const leaderboardResults = await this.client.leaderboards.searchUserByUsername(username, { forceRefresh });
        
        if (leaderboardResults && leaderboardResults.length > 0 && leaderboardResults[0]) {
          // Found in leaderboard - extract identifiers
          steamId = leaderboardResults[0].steamId || null;
          steamAccountName = leaderboardResults[0].steamAccountName || null;
          webappUsername = leaderboardResults[0].username || null;
          
          console.log(`Found in leaderboard: ${username} (SteamID: ${steamId || 'unknown'}, SteamName: ${steamAccountName || 'unknown'}, WebappName: ${webappUsername || 'unknown'})`);
        }
      } catch (error) {
        console.warn(`Leaderboard lookup failed for ${username}:`, error);
        // Continue with direct profile lookup
      }
      
      // Attempt profile lookup strategies in order of reliability
      let userProfile: UserProfile | null = null;
      
      // Strategy 1: Direct username lookup (most common case)
      try {
        userProfile = await this.client.user.getProfileByUsername(username);
        if (userProfile) {
          console.log(`Found profile using direct username lookup for ${username}`);
        }
      } catch (error) {
        console.log(`Direct username lookup failed for ${username}, trying alternatives...`);
      }
      
      // Strategy 2: If we have steamAccountName from leaderboard and it differs from search username
      if (!userProfile && steamAccountName && steamAccountName !== username) {
        try {
          console.log(`Trying with Steam account name: ${steamAccountName}`);
          userProfile = await this.client.user.getProfileByUsername(steamAccountName);
          if (userProfile) {
            console.log(`Found profile using Steam account name for ${steamAccountName}`);
          }
        } catch (steamNameError) {
          console.log(`Steam account name lookup failed for ${steamAccountName}`);
        }
      }
      
      // Strategy 3: If we have webapp username from leaderboard and it differs from search username
      if (!userProfile && webappUsername && webappUsername !== username && webappUsername !== steamAccountName) {
        try {
          console.log(`Trying with webapp username: ${webappUsername}`);
          userProfile = await this.client.user.getProfileByUsername(webappUsername);
          if (userProfile) {
            console.log(`Found profile using webapp username for ${webappUsername}`);
          }
        } catch (webappNameError) {
          console.log(`Webapp username lookup failed for ${webappUsername}`);
        }
      }
      
      // If all strategies failed, return null
      if (!userProfile) {
        console.warn(`Could not find profile for ${username} after trying all lookup methods`);
        return null;
      }
      
      // Get extended profile
      const extendedProfile = await this.client.user.getExtendedUserProfile(userProfile.username || username, {
        includeDailyHistory: true,
        includePercentiles: true,
        forceRefresh
      });
      
      if (!extendedProfile) {
        console.warn(`Could not get extended profile for ${username}`);
        return null;
      }
      
      // Create final combined profile with all metadata
      const completeProfile: ExtendedUserProfile = {
        ...extendedProfile,
        // Ensure we have all relevant IDs
        steamId: userProfile.steamId || extendedProfile.steamId,
        steamAccountName: userProfile.steamAccountName || extendedProfile.steamAccountName,
        username: userProfile.username || extendedProfile.username
      };
      
      // Cache the combined response
      apiCache.set(cacheKey, completeProfile, CACHE_TTL.USER_PROFILE);
      
      return completeProfile;
    } catch (error) {
      console.error(`Error getting complete profile for ${username}:`, error);
      return null;
    }
  }
  
  /**
   * Get a user's scenario performance with detailed metadata
   * 
   * @param username - Username to get scenario performance for
   * @param forceRefresh - Whether to bypass cache
   * @returns User's scenario performance with metadata
   */
  async getScenarioPerformance(username: string, forceRefresh = false): Promise<UserScenarioPerformance | null> {
    // Convert the boolean forceRefresh into pagination params format expected by the method
    const params = {}; // Default empty pagination params
    return this.client.scenarios.getUserScenarioPerformance(username, params, forceRefresh);
  }
  
  /**
   * Get a user's benchmark progress with category details
   * Note: This method requires all three parameters to function correctly.
   * If you don't have steamId and benchmarkId, use findBenchmarkProgress instead.
   * 
   * @param username - Username to get benchmark progress for
   * @param steamId - Steam ID of the user (required by the API)
   * @param benchmarkId - ID of the benchmark to get progress for
   * @param forceRefresh - Whether to bypass cache
   * @returns User's benchmark progress with category details
   */
  async getBenchmarkProgress(
    username: string, 
    steamId: string, 
    benchmarkId: number, 
    forceRefresh = false
  ): Promise<UserBenchmarkProgress | null> {
    // Validate all required parameters
    if (!username || !steamId || !benchmarkId) {
      console.warn('All parameters (username, steamId, benchmarkId) are required for benchmark progress');
      return null;
    }
    
    return this.client.benchmarks.getUserBenchmarkProgress(username, steamId, benchmarkId, forceRefresh);
  }
  
  /**
   * Find benchmark progress for a specific user
   * This handles the complexity of finding the correct benchmark ID
   * 
   * @param username - Username to find benchmark progress for
   * @param forceRefresh - Whether to bypass cache
   * @returns User's benchmark progress
   */
  async findBenchmarkProgress(
    username: string,
    forceRefresh = false
  ): Promise<UserBenchmarkProgress | null> {
    try {
      // First get the user profile to find their Steam ID
      const userProfile = await this.getCompleteProfile(username, forceRefresh);
      if (!userProfile) {
        return null;
      }
      
      const steamId = userProfile.steamId;
      if (!steamId) {
        return null;
      }
      
      // Search for benchmarks the user has participated in
      const benchmarks = await this.client.benchmarks.searchPlayerBenchmarks(username);
      
      if (!benchmarks || !benchmarks.data || benchmarks.data.length === 0) {
        return null;
      }
      
      // Find the main benchmark (usually the first one)
      const benchmark = benchmarks.data[0];
      if (!benchmark || !benchmark.benchmarkId) {
        return null;
      }
      
      const benchmarkId = benchmark.benchmarkId;
      
      // Get detailed benchmark progress
      const progress = await this.client.benchmarks.getUserBenchmarkProgress(
        username,
        steamId, 
        benchmarkId, 
        forceRefresh
      );
      
      if (!progress) {
        return null;
      }

      // Normalize progress to a range of 0-100%
      progress.overallProgress = this.normalizeBenchmarkProgress(progress.overallProgress);
      
      // Normalize category progress values
      if (progress.categories) {
        for (const categoryKey in progress.categories) {
          const category = progress.categories[categoryKey];
          if (category) {
            category.progress = this.normalizeBenchmarkProgress(category.progress);
          }
        }
      }
      
      return progress;
    } catch (error) {
      console.error('Error finding benchmark progress:', error);
      return null;
    }
  }
  
  /**
   * Normalize benchmark progress to a range of 0-100%
   * Handles various formats of progress values
   * 
   * @param value - Raw progress value
   * @returns Normalized progress value between 0 and 1 (representing 0-100%)
   */
  private normalizeBenchmarkProgress(value: number): number {
    if (value <= 0) {
      return 0;
    }
    
    // If progress is already between 0-1, it's correctly formatted (percentage as decimal)
    if (value > 0 && value <= 1) {
      return value;
    }
    
    // If progress is between 1-100, it's a percentage value
    if (value > 1 && value <= 100) {
      return value / 100;
    }
    
    // If progress is between 100-1000, divide by 1000
    if (value > 100 && value <= 1000) {
      return value / 1000;
    }
    
    // If progress is between 1000-10000, divide by 10000
    if (value > 1000 && value <= 10000) {
      return value / 10000;
    }
    
    // For extremely large values (like 70400), normalize more aggressively
    if (value > 10000) {
      // Try to determine the magnitude by counting digits
      const magnitude = Math.floor(Math.log10(value));
      
      // Adjust divisor based on magnitude
      if (magnitude >= 4) {
        // For values like 70400
        return value / Math.pow(10, magnitude + 2);
      } else {
        // For other large values
        return value / 100000;
      }
    }
    
    // Fallback - ensure the value is in the 0-1 range
    return Math.min(1, Math.max(0, value / 10000));
  }
  
  /**
   * Get a user's activity timeline with scenario details
   * 
   * @param username - Username to get activity for
   * @param options - Options for customizing the activity timeline (or limit for backward compatibility)
   * @param forceRefresh - Whether to bypass cache (only used if options is a number for backward compatibility)
   * @returns User's activity timeline with scenario details
   */
  async getActivityTimeline(
    username: string, 
    options?: ActivityTimelineOptions | number,
    forceRefresh = false
  ): Promise<UserActivityTimeline | null> {
    // Handle backward compatibility
    if (typeof options === 'number') {
      return this.client.user.getUserActivityTimeline(username, options, forceRefresh);
    }
    
    // Use the new options approach
    return this.client.user.getUserActivityTimeline(username, options);
  }
  
  /**
   * Get a user's regional positioning context
   * 
   * @param username - Username to get regional context for
   * @param forceRefresh - Whether to bypass cache
   * @returns User's regional positioning context
   */
  async getRegionalContext(username: string, forceRefresh = false): Promise<UserRegionalContext | null> {
    return this.client.leaderboards.getUserRegionalContext(username, forceRefresh);
  }
  
  /**
   * Get ALL possible user data in a single comprehensive call
   * This method combines every single data point available about a user
   * 
   * @param username - Username to get data for
   * @param options - Optional settings to customize the data retrieval
   * @returns Object containing absolutely all available user data
   */
  async getAllUserData(
    username: string | undefined, 
    options: {
      forceRefresh?: boolean;
      includeScenarioDetails?: boolean;
      includeActivityLimit?: number;
      includeBenchmarkDetails?: boolean;
      includeAllBenchmarks?: boolean;
      includeMonthlyStats?: boolean;       // Include monthly player count statistics
      includeGameSettings?: boolean;       // Include user's game settings
      includeScenarioHistory?: boolean;    // Include detailed scenario history
      includeAllScenarios?: boolean;       // Include ALL scenarios, not just summary
      includeTrendingScenarios?: boolean;  // Include trending scenarios the user has played
      includePopularScenarios?: boolean;   // Include popular scenarios data
      includeSystemStats?: boolean;        // Include system performance data
      includeAuthStatus?: boolean;         // Check if user is authenticated
      maxPaginationDepth?: number;         // Maximum pages to fetch for paginated data
      compareWithTopPlayers?: boolean;     // Compare user with top players
      compareWithSimilarPlayers?: boolean; // Compare with players of similar rank
      includeComparisonLimit?: number;     // Number of players to compare with
      skipAuthRequiredCalls?: boolean;     // Skip any API calls that require authentication
    } = {}
  ): Promise<{
    // Basic profile information
    profile: CompleteUserProfile | null;
    
    // Authentication and account status
    authStatus?: { authenticated: boolean; tokenExpiry?: Date | null };
    
    // Performance data
    scenarioPerformance: UserScenarioPerformance | null;
    benchmarkProgress: UserBenchmarkProgress | null;
    allBenchmarks?: any[]; // All benchmarks the user has participated in
    
    // Activity and timeline
    activityTimeline: UserActivityTimeline | null;
    
    // Community and rankings
    regionalContext: UserRegionalContext | null;
    followData?: { following: number; followers: number } | null;
    
    // Additional metadata
    badges?: any[] | null;
    socialMedia?: Record<string, string> | null;
    peripherals?: Record<string, any> | null;
    kovaaksPlusDetails?: { active: boolean; expiration: string | null } | null;
    steamIdSearchData?: any | null;
    
    // Global statistics
    monthlyActiveUsers?: number;
    
    // Game settings
    userGameSettings?: Record<string, any> | null;
    gameSettingsGlobal?: any; // Global game settings
    
    // Detailed scenario data
    scenarioHistory?: any[];
    allScenarios?: any[];
    trendingScenarios?: any[]; // Trending scenarios
    popularScenarios?: any[];  // Popular scenarios
    
    // System performance data
    systemStats?: {
      averageFps?: number;
      resolutions?: string[];
      hardwareInfo?: any;
    };
    
    // Comparisons
    topPlayerComparisons?: any[];    // Comparison with top players
    similarRankComparisons?: any[];  // Comparison with similar rank players
    
    // Calculated metrics
    globalPercentile?: number;   // User's percentile in global rankings
    countryPercentile?: number;  // User's percentile in country rankings
    regionPercentile?: number;   // User's percentile in region rankings
    scenarioPercentiles?: Record<string, number>; // Percentiles for top scenarios
    
    // Historical data
    rankHistory?: {
      global?: { date: string; rank: number }[];
      country?: { date: string; rank: number }[];
      region?: { date: string; rank: number }[];
    };

    // Additional API-specific data that might be available
    extra?: Record<string, any>;
  }> {
    // Default options
    const {
      forceRefresh = false,
      includeScenarioDetails = true,
      includeActivityLimit = 20,
      includeBenchmarkDetails = true,
      includeAllBenchmarks = false,
      includeMonthlyStats = false,
      includeGameSettings = false,
      includeScenarioHistory = false,
      includeAllScenarios = false,
      includeTrendingScenarios = false,
      includePopularScenarios = false,
      includeSystemStats = false,
      includeAuthStatus = false,
      maxPaginationDepth = 1,
      compareWithTopPlayers = false,
      compareWithSimilarPlayers = false,
      includeComparisonLimit = 10,
      skipAuthRequiredCalls = true // Default to skipping auth-required calls for safety
    } = options;
    
    // Validate username
    if (!username) {
      console.warn('Username is required to get user data');
      return {
        profile: null,
        scenarioPerformance: null,
        benchmarkProgress: null,
        activityTimeline: null,
        regionalContext: null
      };
    }
    
    // Ensure we have a string
    const validUsername = username.toString();

    // Execute core requests in parallel for maximum efficiency
    const [
      profile,
      scenarioPerformance,
      benchmarkProgress,
      activityTimeline,
      regionalContext
    ] = await Promise.all([
      this.getCompleteProfile(validUsername, forceRefresh),
      includeScenarioDetails ? this.getScenarioPerformance(validUsername, forceRefresh) : null,
      includeBenchmarkDetails ? this.findBenchmarkProgress(validUsername, forceRefresh) : null,
      this.getActivityTimeline(validUsername, {
        limit: includeActivityLimit,
        forceRefresh,
        // Include metadata for UI options
        includeMetadata: true,
        // Sort by date descending (most recent first)
        sortBy: 'date',
        sortOrder: 'desc'
      }),
      this.getRegionalContext(validUsername, forceRefresh)
    ]);
    
    // Prepare the response object with the core data
    const response: any = {
      profile,
      scenarioPerformance,
      benchmarkProgress,
      activityTimeline,
      regionalContext
    };
    
    // Check authentication status if requested and not skipping auth calls
    if (includeAuthStatus && !skipAuthRequiredCalls) {
      try {
        const isAuthenticated = await this.client.auth.verifyToken();
        response.authStatus = {
          authenticated: isAuthenticated
        };
      } catch (error) {
        console.error('Error checking authentication status (requires login):', error);
        response.authStatus = { authenticated: false };
      }
    } else if (includeAuthStatus) {
      // If skipping auth calls, just set to false without making the API call
      response.authStatus = { authenticated: false };
      console.log('Authentication status check skipped (requires login)');
    }
    
    // Extract additional data from profile if available
    if (profile) {
      // Add badges if available
      if (profile.badges) {
        response.badges = profile.badges;
      }
      
      // Handle both potential locations of followCounts with type safety
      if (profile.webapp && 'followCounts' in profile.webapp) {
        response.followData = (profile.webapp as any).followCounts;
      } else if ('followCounts' in profile) {
        response.followData = (profile as any).followCounts;
      }
      
      // Add social media links if available
      if (profile.webapp?.socialMedia) {
        response.socialMedia = profile.webapp.socialMedia;
      }
      
      // Add gaming peripherals if available
      if (profile.webapp?.gamingPeripherals) {
        response.peripherals = profile.webapp.gamingPeripherals;
      }
      
      // Add Kovaak's+ details if available
      if (profile.kovaaksPlus) {
        response.kovaaksPlusDetails = profile.kovaaksPlus;
      }
      
      // Add game settings if available and requested
      if (includeGameSettings && profile.webapp?.gameSettings) {
        response.userGameSettings = profile.webapp.gameSettings;
      }
      
      // If we have both username and steamId available, try a Steam ID search with the username
      if (profile.steamId) {
        const steamIdData = await this.client.leaderboards.searchUserBySteamId(
          profile.steamId,
          validUsername,
          forceRefresh
        );
        
        if (steamIdData) {
          // If successful, enhance the response with Steam ID search data
          response.steamIdSearchData = steamIdData;
        }
      }
      
      // Calculate percentiles if we have the rankings
      if (profile.rankings && includeMonthlyStats) {
        try {
          // Get monthly active players count - this endpoint doesn't require auth
          const monthlyStats = await this.client.user.getMonthlyPlayersCount();
          if (monthlyStats && typeof monthlyStats.count === 'number') {
            response.monthlyActiveUsers = monthlyStats.count;
            
            // Calculate global percentile
            if (profile.rankings.global && profile.rankings.global > 0) {
              response.globalPercentile = 100 - ((profile.rankings.global / monthlyStats.count) * 100);
            }
          }
          
          // Calculate country percentile if we have country rank and country total
          if (profile.rankings.country && regionalContext?.countryContext?.totalPlayers) {
            response.countryPercentile = 100 - ((profile.rankings.country / regionalContext.countryContext.totalPlayers) * 100);
          }
          
          // Calculate region percentile if we have region rank and region total
          if (profile.rankings.region && regionalContext?.regionContext?.totalPlayers) {
            response.regionPercentile = 100 - ((profile.rankings.region / regionalContext.regionContext.totalPlayers) * 100);
          }
        } catch (error) {
          console.error('Error fetching monthly stats or calculating percentiles:', error);
        }
      }
      
      // Calculate scenario percentiles if we have scenario performance data
      if (scenarioPerformance && scenarioPerformance.scenarioDetails.length > 0) {
        const scenarioPercentiles: Record<string, number> = {};
        
        scenarioPerformance.scenarioDetails.forEach(scenario => {
          if (scenario.rank && scenario.metadata.totalPlays) {
            scenarioPercentiles[scenario.scenarioName] = 100 - ((scenario.rank / scenario.metadata.totalPlays) * 100);
          }
        });
        
        if (Object.keys(scenarioPercentiles).length > 0) {
          response.scenarioPercentiles = scenarioPercentiles;
        }
      }
      
      // Extract system stats if available and requested
      if (includeSystemStats && profile) {
        const systemStats: any = {};
        
        // Attempt to get average FPS from scenario data
        if (scenarioPerformance && scenarioPerformance.scenarioDetails.length > 0) {
          const fpsValues = scenarioPerformance.scenarioDetails
            .map(s => {
              // Try to extract FPS from different possible locations in the data structure
              const metadataFps = s.metadata && 'averageFps' in s.metadata ? 
                (s.metadata as any).averageFps : null;
              
              // Some APIs might have this in an attributes field which isn't in our type definitions
              const attributesFps = s as any;
              const attrFps = attributesFps.attributes && 'avg_fps' in attributesFps.attributes ? 
                attributesFps.attributes.avg_fps : null;
                
              return metadataFps || attrFps || null;
            })
            .filter(fps => typeof fps === 'number' && fps > 0);
          
          if (fpsValues.length > 0) {
            systemStats.averageFps = fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length;
          }
        }
        
        // Get resolutions used
        if (scenarioPerformance && scenarioPerformance.scenarioDetails.length > 0) {
          const resolutions = new Set<string>();
          scenarioPerformance.scenarioDetails.forEach(s => {
            // Access potentially missing attributes with safe type casting
            const scenarioExtended = s as any;
            if (scenarioExtended.attributes && scenarioExtended.attributes.resolution) {
              resolutions.add(scenarioExtended.attributes.resolution as string);
            }
          });
          
          if (resolutions.size > 0) {
            systemStats.resolutions = Array.from(resolutions);
          }
        }
        
        // Extract hardware info if available
        const profileExtended = profile as any;
        if (
          (profile.webapp && 'systemInfo' in profile.webapp) || 
          ('hardware' in profileExtended)
        ) {
          systemStats.hardwareInfo = 
            (profile.webapp && 'systemInfo' in profile.webapp ? 
              (profile.webapp as any).systemInfo : null) || 
            profileExtended.hardware || 
            {};
        }
        
        if (Object.keys(systemStats).length > 0) {
          response.systemStats = systemStats;
        }
      }
    }
    
    // Fetch global game settings if requested
    if (includeGameSettings) {
      try {
        // This endpoint doesn't require authentication
        const gameSettings = await this.client.gameSettings.getGameSettings();
        if (gameSettings) {
          response.gameSettingsGlobal = gameSettings;
        }
      } catch (error) {
        console.error('Error fetching global game settings:', error);
      }
    }
    
    // Fetch all benchmarks if requested
    if (includeAllBenchmarks) {
      try {
        // This endpoint doesn't require authentication
        const benchmarkSearch = await this.client.benchmarks.searchPlayerBenchmarks(validUsername);
        if (benchmarkSearch?.data) {
          response.allBenchmarks = benchmarkSearch.data;
        }
      } catch (error) {
        console.error('Error fetching all benchmarks:', error);
      }
    }
    
    // Fetch detailed scenario history if requested
    if (includeScenarioHistory && profile) {
      try {
        // This endpoint doesn't require authentication
        const recentActivities = await this.client.user.getRecentActivity(validUsername);
        if (recentActivities) {
          response.scenarioHistory = recentActivities;
        }
      } catch (error) {
        console.error('Error fetching scenario history:', error);
      }
    }
    
    // Fetch trending scenarios if requested
    if (includeTrendingScenarios) {
      try {
        // This endpoint doesn't require authentication
        const trendingScenarios = await this.client.scenarios.getTrendingScenarios();
        if (trendingScenarios) {
          response.trendingScenarios = trendingScenarios;
        }
      } catch (error) {
        console.error('Error fetching trending scenarios:', error);
      }
    }
    
    // Fetch popular scenarios if requested
    if (includePopularScenarios) {
      try {
        // This endpoint doesn't require authentication
        const popularScenarios = await this.client.scenarios.getPopularScenarios({
          page: 1,
          max: 50
        });
        if (popularScenarios && popularScenarios.data) {
          response.popularScenarios = popularScenarios.data;
        }
      } catch (error) {
        console.error('Error fetching popular scenarios:', error);
      }
    }
    
    // For includeAllScenarios, use the new pagination method instead of manual pagination
    if (includeAllScenarios && profile) {
      try {
        // Use the new method that handles pagination automatically
        const allScenarios = await this.getAllScenarioScores(validUsername, {
          maxPages: maxPaginationDepth,
          pageSize: 100,
          forceRefresh
        });
        
        if (allScenarios && allScenarios.length > 0) {
          response.allScenarios = allScenarios;
        }
      } catch (error) {
        console.error('Error fetching all scenarios:', error);
      }
    }
    
    // Add comparisons with top players if requested
    if (compareWithTopPlayers && profile && profile.rankings && profile.rankings.global) {
      try {
        // Get global leaderboard to compare with top players - doesn't require auth
        const globalLeaderboard = await this.client.leaderboards.getGlobalLeaderboard({
          page: 0,
          max: includeComparisonLimit
        });
        
        if (globalLeaderboard && globalLeaderboard.data && globalLeaderboard.data.length > 0) {
          // Create comparison metrics
          const comparisons = globalLeaderboard.data.map(player => {
            // Calculate point difference
            const playerPoints = typeof player.points === 'number' 
              ? player.points 
              : parseInt(String(player.points), 10);
            
            // Extract points safely - might be in different locations depending on API version
            const profileExtended = profile as any;
            const userPoints = profileExtended.points || 
              (profile.rankings && 'points' in profile.rankings ? 
                (profile.rankings as any).points : 0);
            
            return {
              username: player.steamAccountName,
              rank: player.rank,
              country: player.country,
              points: playerPoints,
              pointsDifference: playerPoints - userPoints,
              percentageDifference: userPoints > 0 ? ((playerPoints - userPoints) / userPoints) * 100 : null
            };
          });
          
          response.topPlayerComparisons = comparisons;
        }
      } catch (error) {
        console.error('Error comparing with top players:', error);
      }
    }
    
    // Add comparisons with similar rank players if requested
    if (compareWithSimilarPlayers && profile && profile.rankings && profile.rankings.global) {
      try {
        // Calculate rank range for similar players (e.g., ±20 ranks)
        const userRank = profile.rankings.global;
        const lowerRank = Math.max(1, userRank - 10);
        const upperRank = userRank + 10;
        
        // This is a simplification - the actual implementation would need to find players
        // with similar ranks, which might require custom endpoint access or filtering
        // through a larger result set
        
        // For demonstration, we'll just get a page that might contain similar ranked players
        const similarRankPage = Math.floor(lowerRank / 100);
        
        // This endpoint doesn't require authentication
        const leaderboardPage = await this.client.leaderboards.getGlobalLeaderboard({
          page: similarRankPage,
          max: 100
        });
        
        if (leaderboardPage && leaderboardPage.data && leaderboardPage.data.length > 0) {
          // Filter to similar ranked players
          const similarPlayers = leaderboardPage.data
            .filter(player => player.rank >= lowerRank && player.rank <= upperRank && player.rank !== userRank)
            .slice(0, includeComparisonLimit);
          
          // Create comparison metrics
          const comparisons = similarPlayers.map(player => {
            // Calculate point difference
            const playerPoints = typeof player.points === 'number' 
              ? player.points 
              : parseInt(String(player.points), 10);
            
            // Extract points safely - might be in different locations depending on API version
            const profileExtended = profile as any;
            const userPoints = profileExtended.points || 
              (profile.rankings && 'points' in profile.rankings ? 
                (profile.rankings as any).points : 0);
            
            return {
              username: player.steamAccountName,
              rank: player.rank,
              country: player.country,
              points: playerPoints,
              pointsDifference: playerPoints - userPoints,
              percentageDifference: userPoints > 0 ? ((playerPoints - userPoints) / userPoints) * 100 : null,
              rankDifference: player.rank - userRank
            };
          });
          
          response.similarRankComparisons = comparisons;
        }
      } catch (error) {
        console.error('Error comparing with similar rank players:', error);
      }
    }
    
    // Try to extract rank history data from rank changes
    if (profile && profile.rankings && profile.rankings.rankChanges) {
      const currentDate = new Date().toISOString().split('T')[0];
      const rankHistory: any = {};
      
      // Global rank history (using current rank and rank change)
      if (profile.rankings.global !== null && profile.rankings.rankChanges.global !== undefined) {
        const previousRank = profile.rankings.global + profile.rankings.rankChanges.global;
        
        rankHistory.global = [
          { date: currentDate, rank: profile.rankings.global },
          // Estimated previous rank from a day/week ago (depending on the API's rank change period)
          { date: '(previous period)', rank: previousRank }
        ];
      }
      
      // Country rank history
      if (profile.rankings.country !== null && profile.rankings.rankChanges.country !== undefined) {
        const previousCountryRank = profile.rankings.country + profile.rankings.rankChanges.country;
        
        rankHistory.country = [
          { date: currentDate, rank: profile.rankings.country },
          { date: '(previous period)', rank: previousCountryRank }
        ];
      }
      
      // Region rank history
      if (profile.rankings.region !== null && profile.rankings.rankChanges.region !== undefined) {
        const previousRegionRank = profile.rankings.region + profile.rankings.rankChanges.region;
        
        rankHistory.region = [
          { date: currentDate, rank: profile.rankings.region },
          { date: '(previous period)', rank: previousRegionRank }
        ];
      }
      
      if (Object.keys(rankHistory).length > 0) {
        response.rankHistory = rankHistory;
      }
    }
    
    return response;
  }
  
  /**
   * Get all scenario scores for a user by handling pagination automatically
   * This is useful when you need all of a user's scores without worrying about pagination
   * 
   * @param username - Username to get scores for
   * @param options - Options for controlling the pagination and request behavior
   * @returns Array of all scenario scores across all pages
   */
  async getAllScenarioScores(
    username: string,
    options: {
      maxPages?: number;
      pageSize?: number;
      sortParams?: string[];
      forceRefresh?: boolean;
      showProgressLogs?: boolean;
      cancelSignal?: AbortSignal;
    } = {}
  ): Promise<UserScenarioScore[]> {
    return this.client.user.getAllScenarioScores(username, options);
  }
  
  /**
   * Get scenario scores for multiple users in an efficient batched manner
   * This method is optimized for retrieving data for many users at once
   * 
   * @param usernames - Array of usernames to get scores for
   * @param options - Options for controlling batch size and pagination
   * @returns Map of username to array of scenario scores
   */
  async getScenarioScoresForMultipleUsers(
    usernames: string[],
    options: {
      maxPages?: number;
      pageSize?: number;
      sortParams?: string[];
      forceRefresh?: boolean;
      showProgressLogs?: boolean;
      concurrentRequests?: number;
      cancelSignal?: AbortSignal;
    } = {}
  ): Promise<Map<string, UserScenarioScore[]>> {
    return this.client.user.getScenarioScoresForMultipleUsers(usernames, options);
  }
  
  /**
   * Search for user profiles with fuzzy matching
   * This provides more flexible and powerful search capabilities than the standard API endpoints
   * 
   * @param searchTerm - The search string to match against usernames, Steam IDs, etc.
   * @param options - Options for filtering and sorting results
   * @returns Array of matching profiles with relevance scores
   */
  async searchProfiles(
    searchTerm: string,
    options: ProfileSearchOptions = {}
  ): Promise<ProfileSearchResult[]> {
    return this.client.user.searchProfiles(searchTerm, options);
  }
  
  /**
   * Find profiles that are similar to or related to the given username
   * This is useful for finding alternate accounts or similarly named players
   * 
   * @param username - Username to find similar profiles for
   * @param options - Search options
   * @returns Array of similar profiles sorted by relevance
   */
  async findSimilarProfiles(
    username: string,
    options: ProfileSearchOptions = {}
  ): Promise<ProfileSearchResult[]> {
    try {
      // First get the user's profile
      const profile = await this.client.user.getProfileByUsername(username);
      if (!profile) {
        console.warn(`Profile not found for username: ${username}`);
        return [];
      }
      
      // Prepare search options with defaults
      const searchOptions: ProfileSearchOptions = {
        includePartialMatches: true,
        threshold: 0.6,
        sortBy: 'relevance',
        limit: options.limit || 10,
        ...options
      };
      
      // Build a search query combining username and steam ID
      const searchQuery = [
        profile.username,
        profile.steamAccountName,
        profile.steamId
      ].filter(Boolean).join(' ');
      
      // Search profiles with the combined query
      const results = await this.client.user.searchProfiles(searchQuery, searchOptions);
      
      // Filter out the exact match (the original profile)
      return results.filter(result => 
        result.profile.steamId !== profile.steamId && 
        result.profile.username.toLowerCase() !== username.toLowerCase()
      );
    } catch (error) {
      console.error('Error finding similar profiles:', error);
      return [];
    }
  }
  
  /**
   * Calculate a percentile value given a rank and total count
   * This ensures the percentile is always within the valid 0-100 range
   * 
   * @param rank - User's rank (1-indexed)
   * @param totalCount - Total number of players
   * @returns Percentile value (0-100)
   */
  private calculatePercentile(rank: number | null, totalCount: number): number {
    // If rank is null or invalid, or there are no players, return 0
    if (!rank || rank <= 0 || totalCount <= 0) {
      return 0;
    }
    
    // Calculate percentile: higher rank = lower percentile
    // The formula ensures that rank 1 is 100% and the last rank is close to 0%
    const rawPercentile = 100 * (1 - (rank - 1) / totalCount);
    
    // Ensure the percentile is within 0-100 range
    return Math.max(0, Math.min(100, rawPercentile));
  }

  /**
   * Get extended profile with additional data such as percentiles and rank history
   * 
   * @param username - Username to get extended profile for
   * @param options - Options for retrieving the extended profile
   * @returns Extended user profile with additional data
   */
  async getExtendedProfile(
    username: string,
    options: {
      forceRefresh?: boolean;
      includePercentiles?: boolean;
      includeDailyHistory?: boolean;
      historyDays?: number;
    } = {}
  ): Promise<ExtendedUserProfile | null> {
    const extendedProfile = await this.client.user.getExtendedUserProfile(username, options);
    
    // If profile doesn't exist, return null
    if (!extendedProfile) {
      return null;
    }

    // Calculate percentiles if requested
    if (options.includePercentiles) {
      try {
        // Get regional context for percentile calculations
        const regionalContext = await this.client.leaderboards.getUserRegionalContext(username, options.forceRefresh);
        
        if (regionalContext) {
          // Initialize percentiles object if it doesn't exist
          if (!extendedProfile.percentiles) {
            extendedProfile.percentiles = {};
          }
          
          // Global percentile - using total players in the global leaderboard
          if (extendedProfile.rankings && 
              extendedProfile.rankings.global !== null) {
            // Use playerCount from globalContext or a reasonable default
            const globalTotal = 1000000; // Fallback to a reasonable number of global players
            extendedProfile.percentiles.global = this.calculatePercentile(
              extendedProfile.rankings.global, 
              globalTotal
            );
          }
          
          // Country percentile
          if (extendedProfile.rankings && 
              extendedProfile.rankings.country !== null && 
              regionalContext.countryContext && 
              regionalContext.countryContext.totalPlayers > 0) {
            const countryTotal = regionalContext.countryContext.totalPlayers;
            extendedProfile.percentiles.country = this.calculatePercentile(
              extendedProfile.rankings.country, 
              countryTotal
            );
          }
          
          // Region percentile
          if (extendedProfile.rankings && 
              extendedProfile.rankings.region !== null && 
              regionalContext.regionContext && 
              regionalContext.regionContext.totalPlayers > 0) {
            const regionTotal = regionalContext.regionContext.totalPlayers;
            extendedProfile.percentiles.region = this.calculatePercentile(
              extendedProfile.rankings.region, 
              regionTotal
            );
          }
        }
      } catch (error) {
        console.error('Error calculating percentiles:', error);
        // Don't fail the whole profile if percentiles can't be calculated
      }
    }

    return extendedProfile;
  }
  
  /**
   * Calculate a user's performance trends over time for specific scenarios
   * This analyzes historical activity data to detect improvements and trends
   * 
   * @param username - Username to analyze trends for
   * @param options - Options for trend calculation
   * @returns Performance trends for each scenario
   */
  async calculatePerformanceTrends(
    username: string,
    options: {
      scenarioNames?: string[];
      timeRange?: { startDate?: Date | string; endDate?: Date | string };
      minSamples?: number;
      includeBenchmarkScenarios?: boolean;
      forceRefresh?: boolean;
    } = {}
  ): Promise<PerformanceTrend[]> {
    const {
      minSamples = 3,
      includeBenchmarkScenarios = true,
      forceRefresh = false
    } = options;
    
    try {
      // Get extended timeline data with more samples
      const timeline = await this.getActivityTimeline(username, {
        limit: 200, // Get a large number of activities to ensure we have enough data
        forceRefresh,
        includeMetadata: true,
        includeFilterState: true
      });
      
      if (!timeline || !timeline.activities || timeline.activities.length === 0) {
        return [];
      }
      
      // Get all activities
      let activities = [...timeline.activities];
      
      // Apply date filtering if specified
      if (options.timeRange) {
        const startDate = options.timeRange.startDate 
          ? new Date(options.timeRange.startDate).getTime() 
          : 0;
        
        const endDate = options.timeRange.endDate 
          ? new Date(options.timeRange.endDate).getTime() 
          : Date.now();
        
        activities = activities.filter(activity => {
          const activityDate = new Date(activity.timestamp).getTime();
          return activityDate >= startDate && activityDate <= endDate;
        });
      }
      
      // Filter to requested scenarios if specified
      if (options.scenarioNames && options.scenarioNames.length > 0) {
        activities = activities.filter(activity => 
          options.scenarioNames?.includes(activity.scenarioName)
        );
      }
      
      // Get benchmark scenarios if requested
      let benchmarkScenarios: string[] = [];
      if (includeBenchmarkScenarios) {
        const benchmarkProgress = await this.findBenchmarkProgress(username, forceRefresh);
        if (benchmarkProgress && benchmarkProgress.categories) {
          // Extract all benchmark scenarios
          Object.values(benchmarkProgress.categories).forEach(category => {
            if (category.scenarios) {
              benchmarkScenarios = [
                ...benchmarkScenarios,
                ...Object.keys(category.scenarios)
              ];
            }
          });
        }
      }
      
      // Group activities by scenario
      const scenarioMap = new Map<string, typeof activities>();
      
      activities.forEach(activity => {
        const existing = scenarioMap.get(activity.scenarioName) || [];
        scenarioMap.set(activity.scenarioName, [...existing, activity]);
      });
      
      // Generate trends for each scenario with sufficient data
      const trends: PerformanceTrend[] = [];
      
      for (const [scenarioName, scenarioActivities] of scenarioMap.entries()) {
        // Skip if we don't have enough samples
        if (scenarioActivities.length < minSamples) {
          continue;
        }
        
        // Sort activities by date (oldest first)
        const sortedActivities = [...scenarioActivities].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        
        // Create score history
        const scoreHistory = sortedActivities.map(activity => ({
          date: activity.timestamp,
          score: activity.score,
          // Include rank if available as a number or undefined, not null
          rank: undefined as number | undefined
        }));
        
        // Calculate basic statistics - add safety checks
        // Since we checked scenarioActivities.length < minSamples earlier, 
        // scoreHistory should never be empty, but we'll add safety checks anyway
        if (scoreHistory.length === 0) {
          continue; // Skip this scenario if somehow we have no score history
        }
        
        const firstScore = scoreHistory[0]?.score ?? 0;
        const latestScore = scoreHistory[scoreHistory.length - 1]?.score ?? 0;
        const highestScore = Math.max(...scoreHistory.map(s => s.score));
        
        // Calculate percent improvement
        const percentImprovement = firstScore > 0 ? ((latestScore - firstScore) / firstScore) * 100 : 0;
        
        // Calculate improvement rate (points per day)
        const firstDate = new Date(scoreHistory[0]?.date ?? new Date()).getTime();
        const lastDate = new Date(scoreHistory[scoreHistory.length - 1]?.date ?? new Date()).getTime();
        const daysDifference = (lastDate - firstDate) / (1000 * 60 * 60 * 24);
        const improvementRate = daysDifference > 0 
          ? (latestScore - firstScore) / daysDifference 
          : 0;
        
        // Calculate time window improvements
        const timeWindows: PerformanceTrend['trends']['timeWindows'] = {};
        
        // Helper to calculate time window changes
        const calculateTimeWindow = (daysAgo: number) => {
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
          const cutoffTime = cutoffDate.getTime();
          
          // Find scores within this window
          const windowScores = scoreHistory.filter(
            s => new Date(s.date).getTime() >= cutoffTime
          );
          
          if (windowScores.length >= 2) {
            const startScore = windowScores[0]?.score ?? 0;
            const endScore = windowScores[windowScores.length - 1]?.score ?? 0;
            const percentChange = startScore > 0 ? ((endScore - startScore) / startScore) * 100 : 0;
            
            return { startScore, endScore, percentChange };
          }
          
          return undefined;
        };
        
        // Calculate for different time windows
        timeWindows.last7Days = calculateTimeWindow(7);
        timeWindows.last30Days = calculateTimeWindow(30);
        timeWindows.last90Days = calculateTimeWindow(90);
        
        // Calculate moving averages
        const last3Scores = scoreHistory.slice(-3).map(s => s.score);
        const last5Scores = scoreHistory.slice(-5).map(s => s.score);
        
        const movingAverages = {
          last3Scores: last3Scores.reduce((sum, score) => sum + score, 0) / last3Scores.length,
          last5Scores: last5Scores.length >= 5 
            ? last5Scores.reduce((sum, score) => sum + score, 0) / last5Scores.length 
            : 0
        };
        
        // Calculate consistency (coefficient of variation - lower means more consistent)
        const scores = scoreHistory.map(s => s.score);
        const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        const squaredDiffs = scores.map(score => Math.pow(score - mean, 2));
        const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / scores.length;
        const stdDev = Math.sqrt(variance);
        const consistency = mean > 0 ? (stdDev / mean) : 0;
        
        // Create the trend object
        const trend: PerformanceTrend = {
          scenarioName,
          scoreHistory,
          trends: {
            overall: {
              firstScore,
              latestScore,
              highestScore,
              percentImprovement,
              improvementRate
            },
            timeWindows,
            movingAverages,
            consistency
          }
        };
        
        // Add to results
        trends.push(trend);
      }
      
      // Sort by either most improvement or by benchmark scenarios
      const isBenchmark = (name: string) => benchmarkScenarios.includes(name);
      
      trends.sort((a, b) => {
        // Prioritize benchmark scenarios if requested
        if (includeBenchmarkScenarios) {
          if (isBenchmark(a.scenarioName) && !isBenchmark(b.scenarioName)) {
            return -1;
          }
          if (!isBenchmark(a.scenarioName) && isBenchmark(b.scenarioName)) {
            return 1;
          }
        }
        
        // If both are the same category, sort by improvement
        return Math.abs(b.trends.overall.percentImprovement) - Math.abs(a.trends.overall.percentImprovement);
      });
      
      return trends;
    } catch (error) {
      console.error('Error calculating performance trends:', error);
      return [];
    }
  }
  
  /**
   * Compare two users' performance across scenarios
   * This provides a detailed comparison of scores, ranks, and skill differences
   * 
   * @param username - Primary username to compare
   * @param comparedToUsername - Username to compare against
   * @param options - Options for the comparison
   * @returns Detailed comparison of the two users
   */
  async compareUsers(
    username: string,
    comparedToUsername: string,
    options: {
      forceRefresh?: boolean;
      limitToCommonScenarios?: boolean;
      minScenarios?: number;
      includeRecommendations?: boolean;
      fallbackToSimilarRank?: boolean;
    } = {}
  ): Promise<UserComparison | null> {
    const {
      forceRefresh = false,
      limitToCommonScenarios = true,
      minScenarios = 5,
      includeRecommendations = true,
      fallbackToSimilarRank = true
    } = options;
    
    try {
      let userProfile: ExtendedUserProfile | null = null;
      let comparedProfile: ExtendedUserProfile | null = null;
      
      // Try to find primary user profile
      try {
        userProfile = await this.getCompleteProfile(username, forceRefresh);
      } catch (error) {
        console.error(`Error getting profile for ${username}:`, error);
        return null;
      }
      
      if (!userProfile) {
        console.warn(`Could not find profile for ${username}`);
        return null;
      }
      
      // Try to find compared user by first checking the global leaderboard
      try {
        console.log(`Looking up comparison user "${comparedToUsername}" in leaderboards...`);
        
        // First search in the leaderboard to identify the user correctly
        const leaderboardResults = await this.client.leaderboards.searchUserByUsername(
          comparedToUsername,
          { forceRefresh }
        );
        
        if (leaderboardResults && leaderboardResults.length > 0 && leaderboardResults[0]) {
          // Log both the Kovaaks webapp username and Steam username if they exist
          const kovaaksUsername = leaderboardResults[0].username || null;
          const steamUsername = leaderboardResults[0].steamAccountName || null;
          
          console.log(`Found user in leaderboard:
  - Search term: ${comparedToUsername}
  - Kovaaks username: ${kovaaksUsername || 'unknown'}
  - Steam username: ${steamUsername || 'unknown'}`);
          
          // PRIORITIZE Kovaaks webapp username if available
          // We'll try this first as it's more reliable for profile lookups
          if (kovaaksUsername && kovaaksUsername !== comparedToUsername) {
            try {
              console.log(`Trying with Kovaaks webapp username: ${kovaaksUsername}`);
              comparedProfile = await this.getCompleteProfile(kovaaksUsername, forceRefresh);
              
              if (comparedProfile) {
                console.log(`Successfully retrieved profile using Kovaaks webapp username`);
                // Update the comparison username to the one that worked
                comparedToUsername = kovaaksUsername;
              }
            } catch (webappError) {
              console.error(`Error getting profile with Kovaaks webapp username:`, webappError);
            }
          }
          
          // Only try Steam username if Kovaaks username failed AND Steam username is different
          if (!comparedProfile && steamUsername && steamUsername !== comparedToUsername && 
              (!kovaaksUsername || steamUsername !== kovaaksUsername)) {
            try {
              console.log(`Trying with Steam username: ${steamUsername}`);
              comparedProfile = await this.getCompleteProfile(steamUsername, forceRefresh);
              
              if (comparedProfile) {
                console.log(`Successfully retrieved profile using Steam username`);
                // Update the comparison username to the one that worked
                comparedToUsername = steamUsername;
              }
            } catch (steamError) {
              console.error(`Error getting profile with Steam username:`, steamError);
            }
          }
        }
        
        // If we still don't have a profile, try direct lookup as fallback
        if (!comparedProfile) {
          try {
            console.log(`Trying direct username lookup for: ${comparedToUsername}`);
            comparedProfile = await this.getCompleteProfile(comparedToUsername, forceRefresh);
          } catch (error) {
            console.error(`Error getting profile for ${comparedToUsername}:`, error);
          }
        }
      } catch (leaderboardError) {
        console.error(`Error searching user in leaderboard:`, leaderboardError);
        
        // Fall back to direct profile lookup if leaderboard search fails
        try {
          comparedProfile = await this.getCompleteProfile(comparedToUsername, forceRefresh);
        } catch (profileError) {
          console.error(`Error getting profile for ${comparedToUsername}:`, profileError);
        }
      }
      
      // If still no profile and fallback is enabled, try to find someone of similar rank
      if (!comparedProfile && fallbackToSimilarRank && userProfile.rankings && userProfile.rankings.global) {
        console.log(`Attempting to find a similar rank player to compare with instead of ${comparedToUsername}...`);
        
        try {
          // Get global leaderboard around the user's rank
          const targetRank = userProfile.rankings.global;
          const rankRange = 10; // Look for players ±10 ranks
          const startPage = Math.max(0, Math.floor((targetRank - rankRange) / 100));
          
          const leaderboard = await this.client.leaderboards.getGlobalLeaderboard({
            page: startPage,
            max: 100
          });
          
          if (leaderboard && leaderboard.data && leaderboard.data.length > 0) {
            // Find a player with similar rank, but not the user themselves
            const similarPlayers = leaderboard.data.filter(player => 
              player.rank !== targetRank && // Not the same player
              Math.abs(player.rank - targetRank) <= rankRange && // Within rank range
              (player.webappUsername || player.steamAccountName) // Has a name
            );
            
            if (similarPlayers.length > 0) {
              // Pick a random player from the similar rank players
              const randomIndex = Math.floor(Math.random() * similarPlayers.length);
              const similarPlayer = similarPlayers[randomIndex];
              
              // Check if similarPlayer exists before accessing its properties
              if (similarPlayer) {
                // PRIORITIZE the webapp username for consistency
                const similarUsername = similarPlayer.webappUsername || similarPlayer.steamAccountName || '';
                
                if (similarUsername) {
                  console.log(`Found similar rank player: ${similarUsername} (Rank: ${similarPlayer.rank})`);
                  
                  try {
                    // CRITICAL FIX: Use the similarUsername variable, not comparedToUsername
                    // which might still contain the original username that failed
                    comparedProfile = await this.getCompleteProfile(similarUsername, false);
                    
                    // Only update comparedToUsername if we successfully got a profile
                    if (comparedProfile) {
                      console.log(`Successfully retrieved profile for similar rank player: ${similarUsername}`);
                      comparedToUsername = similarUsername;
                    }
                  } catch (similarPlayerError) {
                    console.error(`Error getting profile for similar rank player ${similarUsername}:`, similarPlayerError);
                  }
                }
              }
            }
          }
        } catch (fallbackError) {
          console.error('Error finding fallback player:', fallbackError);
        }
      }
      
      if (!comparedProfile) {
        console.warn(`Could not find profile for ${comparedToUsername}`);
        return null;
      }
      
      console.log(`Comparing ${username} with ${comparedToUsername}...`);
      
      // Get all scenario scores for both users
      const [userScores, comparedScores] = await Promise.all([
        this.getAllScenarioScores(username, { forceRefresh }),
        this.getAllScenarioScores(comparedToUsername, { forceRefresh })
      ]);
      
      // Map scores by scenario name for easy lookup
      const userScoreMap = new Map<string, UserScenarioScore>();
      const comparedScoreMap = new Map<string, UserScenarioScore>();
      
      userScores.forEach(score => userScoreMap.set(score.scenarioName, score));
      comparedScores.forEach(score => comparedScoreMap.set(score.scenarioName, score));
      
      // Find common scenarios
      let commonScenarios: string[] = [];
      
      if (limitToCommonScenarios) {
        // Only include scenarios that both users have played
        commonScenarios = [...userScoreMap.keys()].filter(
          scenarioName => comparedScoreMap.has(scenarioName)
        );
      } else {
        // Include all scenarios from both users
        commonScenarios = [...new Set([
          ...userScoreMap.keys(),
          ...comparedScoreMap.keys()
        ])];
      }
      
      // Check if we have enough data
      if (commonScenarios.length < minScenarios) {
        console.warn(`Not enough common scenarios (${commonScenarios.length}) to compare users`);
        return null;
      }
      
      // Compare individual scenarios
      const scenarioComparisons = commonScenarios.map(scenarioName => {
        const userScore = userScoreMap.get(scenarioName);
        const comparedScore = comparedScoreMap.get(scenarioName);
        
        // Get the scores
        const userScoreValue = userScore?.score || 0;
        const comparedScoreValue = comparedScore?.score || 0;
        
        // Calculate differences
        const difference = userScoreValue - comparedScoreValue;
        const percentDifference = comparedScoreValue > 0 
          ? (difference / comparedScoreValue) * 100 
          : 0;
        
        // Get ranks
        const userRank = userScore?.rank || null;
        const comparedRank = comparedScore?.rank || null;
        
        // Calculate rank difference
        let rankDifference: number | null = null;
        
        if (
          userRank !== null && 
          comparedRank !== null && 
          typeof userRank === 'number' && 
          typeof comparedRank === 'number'
        ) {
          rankDifference = comparedRank - userRank;
        }
        
        return {
          scenarioName,
          userScore: userScoreValue,
          comparedScore: comparedScoreValue,
          difference,
          percentDifference,
          userRank,
          comparedRank,
          rankDifference
        };
      }).filter(comparison => 
        // Remove any comparisons where one of the users doesn't have a score
        (comparison.userScore > 0 || comparison.comparedScore > 0)
      );
      
      // Calculate summary statistics
      const scoreDifferences = scenarioComparisons.map(c => c.percentDifference);
      
      // Sort differences for median calculation
      const sortedDiffs = [...scoreDifferences].sort((a, b) => a - b);
      
      // Calculate median score difference safely
      let medianScoreDifference = 0;
      if (sortedDiffs.length > 0) {
        const medianIndex = Math.floor(sortedDiffs.length / 2);
        if (typeof sortedDiffs[medianIndex] === 'number') {
          medianScoreDifference = sortedDiffs[medianIndex];
        }
      }
      
      // Calculate average difference
      const averageScoreDifference = scoreDifferences.length > 0
        ? scoreDifferences.reduce((sum, diff) => sum + diff, 0) / scoreDifferences.length
        : 0;
      
      // Count scenarios where user is better/worse
      const betterScenarios = scenarioComparisons.filter(c => c.difference > 0).length;
      const worseScenarios = scenarioComparisons.filter(c => c.difference < 0).length;
      const similarScenarios = scenarioComparisons.filter(c => 
        Math.abs(c.percentDifference) < 5 // Within 5%
      ).length;
      
      // Calculate rank differences
      let globalRankDifference: number | null = null;
      let countryRankDifference: number | null = null;
      
      if (
        userProfile?.rankings && 
        comparedProfile?.rankings && 
        typeof userProfile.rankings?.global === 'number' && 
        typeof comparedProfile.rankings?.global === 'number'
      ) {
        globalRankDifference = comparedProfile.rankings.global - userProfile.rankings.global;
      }
      
      if (
        userProfile?.rankings && 
        comparedProfile?.rankings && 
        typeof userProfile.rankings?.country === 'number' && 
        typeof comparedProfile.rankings?.country === 'number'
      ) {
        countryRankDifference = comparedProfile.rankings.country - userProfile.rankings.country;
      }
      
      // Identify strengths and weaknesses
      // We'll use optional chaining to safely access properties
      const strengthsAndWeaknesses = Object.entries(scenarioComparisons)
        .filter(([_, comparison]) => comparison?.percentDifference !== null)
        .sort((a, b) => {
          const aPercentDiff = a[1]?.percentDifference ?? 0;
          const bPercentDiff = b[1]?.percentDifference ?? 0;
          return aPercentDiff - bPercentDiff;
        });
      
      // Generate recommendations if requested
      let recommendations: string[] = [];
      
      if (includeRecommendations) {
        // Add general recommendations based on the comparison
        if (averageScoreDifference < 0) {
          recommendations.push(
            `Focus on practicing scenarios where you're weaker, particularly ${strengthsAndWeaknesses.slice(0, 3).map(c => c[0]).join(', ')}`
          );
        }
        
        // Recommend based on aim types
        const aimTypeWeaknesses = new Map<string, number>();
        
        scenarioComparisons.forEach(comparison => {
          if (comparison.percentDifference < 0) {
            const scenario = userScoreMap.get(comparison.scenarioName);
            const aimType = scenario?.scenario?.aimType || 'unknown';
            
            const count = aimTypeWeaknesses.get(aimType) || 0;
            aimTypeWeaknesses.set(aimType, count + 1);
          }
        });
        
        // Find most common weak aim type
        let weakestAimType = '';
        let highestCount = 0;
        
        for (const [aimType, count] of aimTypeWeaknesses.entries()) {
          if (count > highestCount && aimType !== 'unknown') {
            weakestAimType = aimType;
            highestCount = count;
          }
        }
        
        if (weakestAimType) {
          recommendations.push(
            `Your ${weakestAimType} scenarios show the largest gap - consider focusing more on these types of aiming tasks`
          );
        }
      }
      
      // Create the comparison result
      const comparison: UserComparison = {
        userProfile: {
          username: userProfile.username,
          kovaaksPlusActive: userProfile.kovaaksPlusActive,
          ranking: {
            global: userProfile.rankings.global,
            country: userProfile.rankings.country
          }
        },
        comparedToProfile: {
          username: comparedProfile.username,
          kovaaksPlusActive: comparedProfile.kovaaksPlusActive,
          ranking: {
            global: comparedProfile.rankings.global,
            country: comparedProfile.rankings.country
          }
        },
        summary: {
          globalRankDifference,
          countryRankDifference,
          totalScenarioCount: scenarioComparisons.length,
          betterScenarios,
          worseScenarios,
          similarScenarios,
          averageScoreDifference,
          medianScoreDifference
        },
        scenarioComparisons,
        strengthsAndWeaknesses: {
          userStrengths: strengthsAndWeaknesses.map(c => c[0]),
          userWeaknesses: strengthsAndWeaknesses.map(c => c[0])
        },
        recommendations
      };
      
      return comparison;
    } catch (error) {
      console.error('Error comparing users:', error);
      return null;
    }
  }
}

/**
 * Helper function to normalize progress percentages
 * Handles values that may be stored as raw percentages (e.g. 70400)
 * and converts them to proper decimal percentages (0.704 or 70.4%)
 */
function normalizePercentage(value: number): number {
  if (value > 100) {
    // If value is like 70400, convert to proper percentage
    if (value > 1000) {
      return value / 100000; // Extreme values (70400 -> 0.704)
    } else {
      return value / 100; // Normal percentage values (704 -> 7.04)
    }
  }
  return value; // Already in proper range
} 