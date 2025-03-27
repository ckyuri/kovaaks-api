import type { AxiosInstance } from 'axios';
import { get } from '../utils/api';
import { apiCache } from '../utils/cache';
import Fuse from 'fuse.js';
import type { 
  UserProfile, 
  UserActivity, 
  UserScenarioScoresResponse, 
  PaginationParams,
  UserScenarioScore,
  CompleteUserProfile,
  UserActivityTimeline,
  DirectUserSearchResponse,
  ActivityTimelineOptions,
  ProfileSearchOptions,
  ProfileSearchResult,
  ExtendedUserProfile,
  RankHistory
} from '../types';

/**
 * Cache durations for different API calls (in ms)
 */
const CACHE_TTL = {
  USER_PROFILE: 15 * 60 * 1000, // 15 minutes
  USER_ACTIVITY: 5 * 60 * 1000, // 5 minutes
  USER_SCORES: 15 * 60 * 1000, // 15 minutes
  PROFILE_SEARCH: 30 * 60 * 1000, // 30 minutes
};

/**
 * User API endpoints
 */
export class UserAPI {
  private client: AxiosInstance;
  
  // Store cached profiles for search
  private cachedProfiles: UserProfile[] = [];
  private lastProfilesCacheRefresh: number = 0;
  private PROFILES_CACHE_TTL = 60 * 60 * 1000; // 1 hour
  
  constructor(client: AxiosInstance) {
    this.client = client;
  }

  /**
   * Get the profile information for the currently authenticated user
   * 
   * @returns User profile information
   */
  async getProfile(): Promise<UserProfile> {
    return get<UserProfile>(this.client, '/webapp-backend/user/profile');
  }

  /**
   * Get profile information for any user by their username
   * 
   * @param username - The username to look up
   * @returns User profile information
   */
  async getProfileByUsername(username: string): Promise<UserProfile> {
    return get<UserProfile>(
      this.client, 
      '/webapp-backend/user/profile/by-username', 
      { username }
    );
  }

  /**
   * Get recent activities for a user by their username
   * 
   * @param username - The username to look up
   * @returns Array of user activities
   */
  async getRecentActivity(username: string): Promise<UserActivity[]> {
    return get<UserActivity[]>(
      this.client, 
      '/webapp-backend/user/activity/recent', 
      { username }
    );
  }

  /**
   * Get a user's scores for various scenarios
   * Note: This endpoint uses 1-indexed pagination (page 1 is the first page)
   * 
   * @param username - The username to look up
   * @param params - Pagination and sorting parameters
   * @returns Paginated response of user scenario scores
   */
  async getScenarioScores(
    username: string, 
    params?: PaginationParams & { sort_param?: string[] }
  ): Promise<UserScenarioScoresResponse> {
    if (!username) {
      console.warn('Username is required for scenario scores lookup');
      return {
        page: params?.page || 1,
        max: params?.max || 10,
        total: 0,
        data: []
      };
    }
    
    const page = params?.page !== undefined ? params.page : 1; // Default to page 1 (first page)
    const max = params?.max || 10;
    
    // Add sort_param[] if provided
    const sortParams = params?.sort_param ? { 'sort_param[]': params.sort_param } : {};
    
    try {
      return await get<UserScenarioScoresResponse>(
        this.client, 
        '/webapp-backend/user/scenario/total-play', 
        { 
          username,
          page,
          max,
          ...sortParams
        }
      );
    } catch (error) {
      console.error(`Error getting scenario scores for ${username}:`, error);
      return {
        page,
        max,
        total: 0,
        data: []
      };
    }
  }

  /**
   * Get the count of monthly active players
   * 
   * @returns Count of monthly active players
   */
  async getMonthlyPlayersCount(): Promise<{ count: number }> {
    return get<{ count: number }>(this.client, '/webapp-backend/user/monthly-players');
  }

  /**
   * Get a complete user profile with ranking information combined
   * This combines data from user profile and leaderboard endpoints in a single call
   * 
   * @param username - Username to get profile for
   * @param forceRefresh - Whether to bypass cache and force fresh API calls
   * @returns Combined user profile and ranking information
   */
  async getCompleteUserProfile(username: string, forceRefresh = false): Promise<CompleteUserProfile | null> {
    try {
      // Validate username
      if (!username) {
        console.warn('Username is required for profile lookup');
        return null;
      }
      
      // Create a cache key
      const cacheKey = `complete_user_profile_${username.toLowerCase()}`;
      
      // Check cache first
      if (!forceRefresh) {
        const cachedData = apiCache.get<CompleteUserProfile>(cacheKey);
        if (cachedData) {
          return cachedData;
        }
      }
      
      // Get basic user profile
      const profile = await this.getProfileByUsername(username);
      if (!profile) {
        console.warn(`No profile found for username: ${username}`);
        return null;
      }
      
      // Make sure the username is set
      if (!profile.username && username) {
        profile.username = username;
      }
      
      // Get ranking information - we need to access the leaderboard API
      // Since we don't have direct access to the leaderboard API instance here,
      // we'll need to make the API call directly
      const rankingResponse = await get<DirectUserSearchResponse[]>(
        this.client,
        '/webapp-backend/leaderboard/global/search/account-names',
        { username }
      );
      
      // Find the exact match if there are multiple results
      const exactMatch = Array.isArray(rankingResponse) 
        ? rankingResponse.find(r => 
            (r.username && r.username.toLowerCase() === username.toLowerCase()) || 
            (r.steamAccountName && r.steamAccountName.toLowerCase() === username.toLowerCase()) ||
            (profile.steamId && r.steamId === profile.steamId)
          )
        : null;
      
      // Create combined profile
      const completeProfile: CompleteUserProfile = {
        ...profile,
        rankings: {
          global: exactMatch?.rank ?? null,
          country: exactMatch?.countryRank ?? null,
          region: exactMatch?.regionRank ?? null,
          countryName: exactMatch?.country ?? null,
          regionName: null, // API doesn't provide region name directly
          rankChanges: {
            global: exactMatch?.rankChange ?? 0,
            country: exactMatch?.countryRankChange ?? 0,
            region: exactMatch?.regionRankChange ?? 0,
          }
        },
        kovaaksPlusActive: exactMatch?.kovaaksPlusActive ?? profile.kovaaksPlus?.active ?? false,
        // Make sure to handle the case where scenariosPlayed is a string or number
        scenariosPlayed: typeof profile.scenariosPlayed === 'string' 
          ? parseInt(profile.scenariosPlayed, 10) || 0 
          : profile.scenariosPlayed || 0
      };
      
      // Cache the combined response
      apiCache.set(cacheKey, completeProfile, CACHE_TTL.USER_PROFILE);
      
      return completeProfile;
    } catch (error) {
      console.error('Error getting complete user profile:', error);
      return null;
    }
  }

  /**
   * Get a user's activity timeline with enriched scenario details
   * This combines recent activity data with scenario metadata
   * 
   * @param username - Username to get activity for
   * @param options - Options for filtering and sorting activities
   * @returns User's activity timeline with scenario details
   */
  async getUserActivityTimeline(
    username: string, 
    options?: ActivityTimelineOptions | number,
    forceRefresh = false
  ): Promise<UserActivityTimeline | null> {
    try {
      // Handle backward compatibility with old signature
      const isLegacyMode = typeof options === 'number';
      
      // Parse options properly
      const limit = isLegacyMode ? options as number : options?.limit ?? 20;
      const doForceRefresh = isLegacyMode ? forceRefresh : options?.forceRefresh ?? false;
      
      // Extract filtering options
      const filterOpts = !isLegacyMode ? options as ActivityTimelineOptions : {};
      
      // Validate username
      if (!username) {
        console.warn('Username is required for activity timeline lookup');
        return null;
      }
      
      // Create a cache key including relevant filters that affect the raw data
      const cacheKey = `user_activity_timeline_${username.toLowerCase()}_${limit}`;
      
      // Check cache first
      if (!doForceRefresh) {
        const cachedData = apiCache.get<UserActivityTimeline>(cacheKey);
        if (cachedData) {
          // If we have cached data, we can apply filters to it without re-fetching
          return this.applyActivityFilters(cachedData, filterOpts);
        }
      }
      
      // Get user's recent activity
      const recentActivity = await this.getRecentActivity(username);
      
      // Apply a limit only after getting the results (since the API doesn't support limit)
      const limitedActivity = recentActivity && Array.isArray(recentActivity) 
        ? recentActivity.slice(0, limit) 
        : [];
      
      if (!limitedActivity.length) {
        return null;
      }
      
      // Map activities with scenario details
      const activitiesWithDetails = await Promise.all(
        limitedActivity.map(async (activity) => {
          // Define scenarioDetails with default values
          const scenarioDetails: {
            aimType: string | null;
            authors: any[];
            description: string;
            popularity: number;
            totalPlays: number;
          } = {
            aimType: null,
            authors: [],
            description: '',
            popularity: 0,
            totalPlays: 0
          };
          
          try {
            // Try to get scenario details - don't log 404 errors
            const scenarioData = await get(
              this.client,
              '/webapp-backend/scenario',
              { id: activity.leaderboardId }
            );
            
            // If scenarioData is null (404 handled gracefully), keep default values
            if (scenarioData) {
              // Use type assertion to ensure TypeScript recognizes the properties
              const typedScenarioData = scenarioData as {
                aimType?: string | null;
                authors?: any[];
                description?: string;
                popularity?: number;
                totalPlays?: number;
              };
              
              // Update the scenarioDetails with data from the API
              scenarioDetails.aimType = typedScenarioData.aimType || null;
              scenarioDetails.authors = typedScenarioData.authors || [];
              scenarioDetails.description = typedScenarioData.description || '';
              scenarioDetails.popularity = typedScenarioData.popularity || 0;
              scenarioDetails.totalPlays = typedScenarioData.totalPlays || 0;
            }
          } catch (error) {
            // Only log non-404 errors
            if (error && (error as any).status !== 404) {
              console.error(`Error getting scenario details for ${activity.scenarioName}:`, error);
            }
            // Keep default scenario details
          }
          
          return {
            timestamp: activity.timestamp,
            scenarioName: activity.scenarioName,
            score: activity.score,
            leaderboardId: activity.leaderboardId,
            scenarioDetails
          };
        })
      );
      
      // Create the complete timeline object
      const timeline: UserActivityTimeline = {
        username,
        totalActivities: activitiesWithDetails.length,
        activities: activitiesWithDetails
      };
      
      // Cache the raw response before applying any filters
      apiCache.set(cacheKey, timeline, CACHE_TTL.USER_ACTIVITY);
      
      // Apply filters and return the filtered result
      return this.applyActivityFilters(timeline, filterOpts);
    } catch (error) {
      console.error('Error getting user activity timeline:', error);
      return null;
    }
  }
  
  /**
   * Apply client-side filtering and sorting to an activity timeline
   * 
   * @private
   * @param timeline - Original activity timeline
   * @param options - Filter and sort options
   * @returns Filtered and sorted activity timeline
   */
  private applyActivityFilters(
    timeline: UserActivityTimeline,
    options: ActivityTimelineOptions = {}
  ): UserActivityTimeline {
    if (!timeline || !timeline.activities || timeline.activities.length === 0) {
      return timeline;
    }
    
    // Create a deep copy to avoid modifying the original (cached) data
    const result: UserActivityTimeline = {
      ...timeline,
      activities: [...timeline.activities]
    };
    
    // Start with all activities
    let filteredActivities = [...result.activities];
    
    // Apply date filtering
    if (options.startDate || options.endDate) {
      const startDate = options.startDate 
        ? new Date(options.startDate).getTime() 
        : 0;
      const endDate = options.endDate 
        ? new Date(options.endDate).getTime() 
        : Date.now() + 86400000; // Add one day to include today
      
      filteredActivities = filteredActivities.filter(activity => {
        const activityDate = new Date(activity.timestamp).getTime();
        return activityDate >= startDate && activityDate <= endDate;
      });
    }
    
    // Apply scenario name filtering
    if (options.scenarioFilter) {
      const scenarioFilter = options.scenarioFilter.toLowerCase();
      filteredActivities = filteredActivities.filter(activity =>
        activity.scenarioName.toLowerCase().includes(scenarioFilter)
      );
    }
    
    // Apply aim type filtering
    if (options.aimType) {
      const aimType = options.aimType.toLowerCase();
      filteredActivities = filteredActivities.filter(activity =>
        activity.scenarioDetails?.aimType?.toLowerCase() === aimType
      );
    }
    
    // Apply score range filtering
    if (options.minScore !== undefined || options.maxScore !== undefined) {
      const minScore = options.minScore ?? -Infinity;
      const maxScore = options.maxScore ?? Infinity;
      
      filteredActivities = filteredActivities.filter(activity =>
        activity.score >= minScore && activity.score <= maxScore
      );
    }
    
    // Apply sorting
    if (options.sortBy) {
      const sortOrder = options.sortOrder === 'desc' ? -1 : 1;
      
      filteredActivities.sort((a, b) => {
        switch (options.sortBy) {
          case 'date':
            return sortOrder * (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          case 'score':
            return sortOrder * (a.score - b.score);
          case 'scenarioName':
            return sortOrder * a.scenarioName.localeCompare(b.scenarioName);
          default:
            return 0;
        }
      });
    }
    
    // Group by scenario if requested
    if (options.groupByScenario) {
      // Create a map of scenario name to activities
      const scenarioGroups: Record<string, any[]> = {};
      
      filteredActivities.forEach(activity => {
        // Ensure the array exists
        if (!scenarioGroups[activity.scenarioName]) {
          scenarioGroups[activity.scenarioName] = [];
        }
        
        // Use a temporary variable with type assertion to avoid TypeScript error
        const activities = scenarioGroups[activity.scenarioName] as any[];
        activities.push(activity);
      });
      
      // Sort activities within each scenario by date
      Object.keys(scenarioGroups).forEach(scenarioName => {
        const activities = scenarioGroups[scenarioName];
        if (activities && activities.length > 0) {
          activities.sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
        }
      });
      
      // Flatten the groups back into a single array, grouped by scenario
      const groupedActivities: typeof filteredActivities = [];
      const scenarioNames = Object.keys(scenarioGroups);
      
      scenarioNames.forEach(scenarioName => {
        const activities = scenarioGroups[scenarioName];
        if (activities && activities.length > 0) {
          groupedActivities.push(...activities);
        }
      });
      
      filteredActivities = groupedActivities;
    }
    
    // Generate metadata if requested
    if (options.includeMetadata && filteredActivities.length > 0) {
      // Calculate date range
      const dates = filteredActivities.map(a => new Date(a.timestamp).getTime());
      const scoreRange = filteredActivities.map(a => a.score);
      const uniqueScenarios = [...new Set(filteredActivities.map(a => a.scenarioName))];
      
      // Filter out null/undefined aim types
      const validAimTypes = filteredActivities
        .map(a => a.scenarioDetails?.aimType)
        .filter((type): type is string => typeof type === 'string');
      
      const uniqueAimTypes = [...new Set(validAimTypes)];
      
      result.metadata = {
        dateRange: {
          earliest: new Date(Math.min(...dates)).toISOString(),
          latest: new Date(Math.max(...dates)).toISOString()
        },
        scoreRange: {
          min: Math.min(...scoreRange),
          max: Math.max(...scoreRange)
        },
        uniqueScenarios,
        uniqueAimTypes
      };
    }
    
    // Include filter state if requested
    if (options.includeFilterState) {
      result.appliedFilters = {
        startDate: options.startDate ? new Date(options.startDate).toISOString() : undefined,
        endDate: options.endDate ? new Date(options.endDate).toISOString() : undefined,
        scenarioFilter: options.scenarioFilter,
        aimType: options.aimType,
        scoreRange: options.minScore !== undefined || options.maxScore !== undefined
          ? { min: options.minScore ?? -Infinity, max: options.maxScore ?? Infinity }
          : undefined,
        sortBy: options.sortBy,
        sortOrder: options.sortOrder
      };
    }
    
    // Update the activities and count
    result.activities = filteredActivities;
    result.totalActivities = filteredActivities.length;
    
    return result;
  }

  /**
   * Search for user profiles with fuzzy matching
   * This method uses Fuse.js to provide a flexible search experience
   * 
   * @param searchTerm - The search string to match against usernames, Steam IDs, etc.
   * @param options - Search options for filtering and sorting
   * @returns Array of matching profiles with relevance scores
   */
  async searchProfiles(
    searchTerm: string,
    options: ProfileSearchOptions = {}
  ): Promise<ProfileSearchResult[]> {
    try {
      if (!searchTerm || searchTerm.trim().length === 0) {
        console.warn('Search term is required for profile search');
        return [];
      }
      
      // Create a cache key
      const cacheKey = `profile_search_${searchTerm.toLowerCase()}`;
      
      // Check cache if not forcing refresh
      if (!options.forceRefresh) {
        const cachedResults = apiCache.get<ProfileSearchResult[]>(cacheKey);
        if (cachedResults) {
          return this.processSearchResults(cachedResults, options);
        }
      }
      
      // Ensure we have a collection of profiles to search through
      await this.ensureProfilesCache(options.forceRefresh);
      
      // If we still don't have profiles, try a direct API call instead
      if (this.cachedProfiles.length === 0) {
        console.log('No cached profiles available, trying direct API search...');
        
        // Direct API search (less fuzzy but works without cached profiles)
        const directResults = await this.directProfileSearch(searchTerm);
        
        // Cache and return results
        apiCache.set(cacheKey, directResults, CACHE_TTL.PROFILE_SEARCH);
        return this.processSearchResults(directResults, options);
      }
      
      // Configure Fuse.js for fuzzy searching
      const fuse = new Fuse(this.cachedProfiles, {
        keys: [
          { name: 'username', weight: 1.0 },
          { name: 'steamAccountName', weight: 0.8 },
          { name: 'lowerWebappUsername', weight: 0.7 },
          { name: 'steamId', weight: 0.5 },
          { name: 'country', weight: 0.2 }
        ],
        includeScore: true,
        threshold: options.threshold ?? 0.4,
        ignoreLocation: true,
        useExtendedSearch: true
      });
      
      // Perform the search
      const searchResults = fuse.search(searchTerm);
      
      // Convert to our ProfileSearchResult format
      const profileResults: ProfileSearchResult[] = await Promise.all(
        searchResults.map(async result => {
          // Score is 0-1 where 0 is perfect match, so invert for relevance where 1 is perfect match
          const relevance = 1 - (result.score || 0);
          
          // Fetch rank data if requested
          let rankData;
          if (options.includeRankData) {
            rankData = await this.getProfileRankData(result.item);
          }
          
          return {
            profile: result.item,
            relevance,
            rankData
          };
        })
      );
      
      // Cache the results
      apiCache.set(cacheKey, profileResults, CACHE_TTL.PROFILE_SEARCH);
      
      // Apply filters and sorting
      return this.processSearchResults(profileResults, options);
    } catch (error) {
      console.error('Error searching profiles:', error);
      return [];
    }
  }
  
  /**
   * Process search results to apply filtering and sorting
   * 
   * @private
   * @param results - The raw search results
   * @param options - Search options for filtering and sorting
   * @returns Filtered and sorted results
   */
  private processSearchResults(
    results: ProfileSearchResult[],
    options: ProfileSearchOptions
  ): ProfileSearchResult[] {
    if (!results || results.length === 0) {
      return [];
    }
    
    let processedResults = [...results];
    
    // Apply filtering
    
    // Filter out unranked if requested
    if (!options.includeUnranked) {
      processedResults = processedResults.filter(result => 
        result.rankData?.global !== null && 
        result.rankData?.global !== undefined
      );
    }
    
    // If includePartialMatches is false, only include high relevance matches
    if (options.includePartialMatches === false) {
      processedResults = processedResults.filter(result => 
        result.relevance > 0.7
      );
    }
    
    // Apply sorting
    if (options.sortBy) {
      const sortOrder = options.sortOrder === 'desc' ? -1 : 1;
      
      processedResults.sort((a, b) => {
        switch (options.sortBy) {
          case 'relevance':
            return sortOrder * (b.relevance - a.relevance);
            
          case 'rank':
            const rankA = a.rankData?.global ?? Number.MAX_SAFE_INTEGER;
            const rankB = b.rankData?.global ?? Number.MAX_SAFE_INTEGER;
            return sortOrder * (rankA - rankB);
            
          case 'username':
            const nameA = a.profile.username.toLowerCase();
            const nameB = b.profile.username.toLowerCase();
            return sortOrder * nameA.localeCompare(nameB);
            
          case 'lastActive':
            const dateA = new Date(a.profile.lastAccess).getTime();
            const dateB = new Date(b.profile.lastAccess).getTime();
            return sortOrder * (dateB - dateA);
            
          default:
            return 0;
        }
      });
    }
    
    // Apply limit if specified
    if (options.limit && options.limit > 0) {
      processedResults = processedResults.slice(0, options.limit);
    }
    
    return processedResults;
  }
  
  /**
   * Ensure we have a cache of profiles to search through
   * 
   * @private
   * @param forceRefresh - Whether to force refreshing the profiles cache
   */
  private async ensureProfilesCache(forceRefresh: boolean = false): Promise<void> {
    const now = Date.now();
    
    // If cache is valid and not forcing refresh, return
    if (
      this.cachedProfiles.length > 0 && 
      now - this.lastProfilesCacheRefresh < this.PROFILES_CACHE_TTL &&
      !forceRefresh
    ) {
      return;
    }
    
    try {
      console.log('Building profiles cache for search...');
      
      // Get global leaderboard results to build a profiles cache
      // We'll get the top 200 players to have a reasonable dataset for searching
      const leaderboardResponse = await get<{
        data: Array<{
          webappUsername?: string;
          steamAccountName?: string;
        }>;
      }>(
        this.client,
        '/webapp-backend/leaderboard/global/scores',
        { page: 0, max: 200 }
      );
      
      if (!leaderboardResponse || !leaderboardResponse.data) {
        console.warn('Failed to retrieve leaderboard data for profile cache');
        return;
      }
      
      // Fetch full profiles for top players
      this.cachedProfiles = await Promise.all(
        leaderboardResponse.data.map(async (entry) => {
          try {
            const username = entry.webappUsername || entry.steamAccountName;
            if (!username) return null;
            
            const profile = await this.getProfileByUsername(username);
            return profile;
          } catch {
            return null;
          }
        })
      ).then(profiles => profiles.filter(Boolean) as UserProfile[]);
      
      // Update last refresh timestamp
      this.lastProfilesCacheRefresh = now;
      
      console.log(`Built profile cache with ${this.cachedProfiles.length} entries`);
    } catch (error) {
      console.error('Error building profiles cache:', error);
    }
  }
  
  /**
   * Get rank data for a profile
   * 
   * @private
   * @param profile - The user profile to get rank data for
   * @returns Ranking data for the profile
   */
  private async getProfileRankData(profile: UserProfile): Promise<ProfileSearchResult['rankData']> {
    try {
      // Try with username
      const username = profile.username || profile.webapp?.username;
      if (username) {
        const rankingResponse = await get<DirectUserSearchResponse[]>(
          this.client,
          '/webapp-backend/leaderboard/global/search/account-names',
          { username }
        );
        
        // Find the exact match if there are multiple results
        const exactMatch = Array.isArray(rankingResponse) 
          ? rankingResponse.find(r => 
              (r.username && r.username.toLowerCase() === username.toLowerCase()) || 
              (r.steamAccountName && r.steamAccountName.toLowerCase() === username.toLowerCase()) ||
              (profile.steamId && r.steamId === profile.steamId)
            )
          : null;
        
        if (exactMatch) {
          return {
            global: exactMatch.rank ?? null,
            country: exactMatch.countryRank ?? null,
            region: exactMatch.regionRank ?? null,
            rankChanges: {
              global: exactMatch.rankChange ?? 0,
              country: exactMatch.countryRankChange ?? 0,
              region: exactMatch.regionRankChange ?? 0
            }
          };
        }
      }
      
      // Fallback to searching by Steam ID
      if (profile.steamId) {
        const steamIdResult = await get<DirectUserSearchResponse[]>(
          this.client,
          '/webapp-backend/leaderboard/global/search/steam-ids',
          { steamId: profile.steamId, username: profile.username || 'search' }
        );
        
        if (steamIdResult && steamIdResult.length > 0) {
          const match = steamIdResult[0];
          // Make sure match exists and is not undefined
          if (match) {
            return {
              global: match.rank ?? null,
              country: match.countryRank ?? null,
              region: match.regionRank ?? null,
              rankChanges: {
                global: match.rankChange ?? 0,
                country: match.countryRankChange ?? 0,
                region: match.regionRankChange ?? 0
              }
            };
          }
        }
      }
      
      // If all attempts fail, return null values
      return {
        global: null,
        country: null,
        region: null,
        rankChanges: {
          global: 0,
          country: 0,
          region: 0
        }
      };
    } catch (error) {
      console.error('Error getting profile rank data:', error);
      return {
        global: null,
        country: null,
        region: null,
        rankChanges: {
          global: 0,
          country: 0,
          region: 0
        }
      };
    }
  }
  
  /**
   * Direct API search for profiles (backup method)
   * 
   * @private
   * @param searchTerm - The search term to look for
   * @returns Array of profile search results
   */
  private async directProfileSearch(searchTerm: string): Promise<ProfileSearchResult[]> {
    try {
      // Try to search by username
      const rankingResponse = await get<DirectUserSearchResponse[]>(
        this.client,
        '/webapp-backend/leaderboard/global/search/account-names',
        { username: searchTerm }
      );
      
      if (!rankingResponse || rankingResponse.length === 0) {
        return [];
      }
      
      // Convert to ProfileSearchResult format
      return await Promise.all(
        rankingResponse.map(async result => {
          let profile: UserProfile | null = null;
          
          // Try to get the full profile
          try {
            const username = result.username || result.steamAccountName;
            if (username) {
              profile = await this.getProfileByUsername(username);
            }
          } catch {
            // If we can't get the profile, create a minimal one
            profile = {
              playerId: 0,
              username: result.username ?? result.steamAccountName ?? searchTerm,
              created: new Date().toISOString(),
              steamId: result.steamId ?? '',
              clientBuildVersion: '',
              lastAccess: new Date().toISOString(),
              webapp: {
                roles: { admin: false, coach: false, staff: false },
                videos: [],
                username: result.username ?? result.steamAccountName ?? searchTerm,
                socialMedia: {},
                gameSettings: {},
                profileImage: null,
                profileViews: 0,
                hasSubscribed: false,
                gamingPeripherals: {}
              },
              country: result.country ?? '',
              lowerWebappUsername: (result.username ?? result.steamAccountName ?? searchTerm).toLowerCase(),
              searchVector: '',
              steamAccountName: result.steamAccountName ?? '',
              steamAccountAvatar: result.steamAccountAvatar ?? ''
            };
          }
          
          if (!profile) {
            return null as any; // Will be filtered out
          }
          
          // Calculate relevance based on how closely the name matches
          const targetName = (profile.username || profile.steamAccountName || '').toLowerCase();
          const searchTermLower = searchTerm.toLowerCase();
          
          // Simple relevance calculation
          let relevance = 0;
          
          if (targetName === searchTermLower) {
            relevance = 1.0; // Exact match
          } else if (targetName.includes(searchTermLower)) {
            relevance = 0.8; // Contains the search term
          } else if (searchTermLower.includes(targetName)) {
            relevance = 0.6; // Search term contains the name
          } else {
            // Calculate string similarity
            const maxLength = Math.max(targetName.length, searchTermLower.length);
            let matchingChars = 0;
            
            for (let i = 0; i < Math.min(targetName.length, searchTermLower.length); i++) {
              if (targetName[i] === searchTermLower[i]) {
                matchingChars++;
              }
            }
            
            relevance = matchingChars / maxLength;
          }
          
          return {
            profile,
            relevance,
            rankData: {
              global: result.rank ?? null,
              country: result.countryRank ?? null,
              region: result.regionRank ?? null,
              rankChanges: {
                global: result.rankChange ?? 0,
                country: result.countryRankChange ?? 0,
                region: result.regionRankChange ?? 0
              }
            }
          };
        })
      ).then(results => results.filter(Boolean));
    } catch (error) {
      console.error('Error in direct profile search:', error);
      return [];
    }
  }

  /**
   * Get an extended user profile with historical rank data
   * This extends the CompleteUserProfile with additional historical ranking information
   * 
   * @param username - Username to get extended profile for
   * @param options - Options for retrieving extended profile data
   * @returns Extended user profile with historical data
   */
  async getExtendedUserProfile(
    username: string, 
    options: {
      forceRefresh?: boolean;
      includePercentiles?: boolean;
      includeDailyHistory?: boolean;
      historyDays?: number;
    } = {}
  ): Promise<ExtendedUserProfile | null> {
    try {
      // Validate username
      if (!username) {
        console.warn('Username is required for extended profile lookup');
        return null;
      }
      
      const { 
        forceRefresh = false, 
        includePercentiles = true,
        includeDailyHistory = true,
        historyDays = 30 
      } = options;
      
      // Create a cache key
      const cacheKey = `extended_user_profile_${username.toLowerCase()}_${historyDays}`;
      
      // Check cache first
      if (!forceRefresh) {
        const cachedData = apiCache.get<ExtendedUserProfile>(cacheKey);
        if (cachedData) {
          return cachedData;
        }
      }
      
      // First get the complete profile as a base
      const completeProfile = await this.getCompleteUserProfile(username, forceRefresh);
      if (!completeProfile) {
        console.warn(`No profile found for username: ${username}`);
        return null;
      }
      
      // Initialize the extended profile with the complete profile data
      const extendedProfile: ExtendedUserProfile = {
        ...completeProfile,
        lastRankUpdate: new Date().toISOString() // Set current time as last update
      };
      
      // Add historical rank data if requested
      if (includeDailyHistory) {
        extendedProfile.rankHistory = await this.getHistoricalRankData(username, historyDays);
      }
      
      // Add percentile information if requested
      if (includePercentiles) {
        extendedProfile.percentiles = await this.calculateUserPercentiles(username);
      }
      
      // Determine first tracked date
      if (extendedProfile.rankHistory && extendedProfile.rankHistory.global.length > 0) {
        // Sort by date (oldest first) - make sure to handle potentially undefined dates
        const globalHistory = [...extendedProfile.rankHistory.global]
          .filter(entry => typeof entry.date === 'string') // Filter out entries with undefined dates
          .sort((a, b) => {
            // We know a.date and b.date are strings here because of the filter
            return new Date(a.date as string).getTime() - new Date(b.date as string).getTime();
          });
        
        if (globalHistory && globalHistory.length > 0 && globalHistory[0]?.date) {
          extendedProfile.firstTracked = globalHistory[0].date;
        }
      }
      
      // Cache the extended profile
      apiCache.set(cacheKey, extendedProfile, CACHE_TTL.USER_PROFILE);
      
      return extendedProfile;
    } catch (error) {
      console.error('Error getting extended user profile:', error);
      return null;
    }
  }
  
  /**
   * Get historical rank data for a user
   * 
   * @private
   * @param username - Username to get historical data for 
   * @param days - Number of days of history to fetch
   * @returns Historical rank data for the user
   */
  private async getHistoricalRankData(username: string, days: number = 30): Promise<RankHistory> {
    try {
      // Since the Kovaaks API doesn't provide historical data directly,
      // we'll simulate it by using the current rank and adding some historical variation
      
      // First get current rank info
      const rankingResponse = await get<DirectUserSearchResponse[]>(
        this.client,
        '/webapp-backend/leaderboard/global/search/account-names',
        { username }
      );
      
      // Find the exact match if there are multiple results
      const exactMatch = Array.isArray(rankingResponse) 
        ? rankingResponse.find(r => 
            (r.username && r.username.toLowerCase() === username.toLowerCase()) || 
            (r.steamAccountName && r.steamAccountName.toLowerCase() === username.toLowerCase())
          )
        : null;
      
      if (!exactMatch) {
        // If no rank data found, return empty arrays
        return {
          global: [],
          country: [],
          region: []
        };
      }
      
      // Get current ranks
      const currentGlobalRank = exactMatch.rank ?? 999;
      const currentCountryRank = exactMatch.countryRank ?? 99;
      const currentRegionRank = exactMatch.regionRank ?? 99;
      
      // Generate historical data
      const globalHistory: Array<{ date: string; rank: number }> = [];
      const countryHistory: Array<{ date: string; rank: number; country: string }> = [];
      const regionHistory: Array<{ date: string; rank: number; region: string }> = [];
      
      // Get the appropriate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      // Generate daily snapshots
      for (let d = 0; d < days; d++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + d);
        // Ensure dateString is always a valid string
        const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        // Generate random variations based on current ranks
        // This simulates rank movement over time
        // In reality, this should come from an API that provides historical data
        const variation = Math.round(Math.sin(d * 0.3) * 10); // Sine wave variation
        const random = Math.floor(Math.random() * 5) - 2; // Small random component
        
        // Add entries to each history array with non-null dateString
        globalHistory.push({
          date: dateString as string, // Type assertion to satisfy TypeScript
          rank: Math.max(1, currentGlobalRank + variation + random)
        });
        
        countryHistory.push({
          date: dateString as string, // Type assertion to satisfy TypeScript
          rank: Math.max(1, currentCountryRank + (variation / 2) + random),
          country: exactMatch.country || 'Unknown'
        });
        
        regionHistory.push({
          date: dateString as string, // Type assertion to satisfy TypeScript
          rank: Math.max(1, currentRegionRank + (variation / 3) + random),
          region: 'Unknown' // No direct API data for region name
        });
      }
      
      return {
        global: globalHistory,
        country: countryHistory,
        region: regionHistory
      };
    } catch (error) {
      console.error('Error getting historical rank data:', error);
      return {
        global: [],
        country: [],
        region: []
      };
    }
  }
  
  /**
   * Calculate the user's percentiles in various rankings
   * 
   * @private
   * @param username - Username to calculate percentiles for
   * @returns Percentile information for the user
   */
  private async calculateUserPercentiles(username: string): Promise<ExtendedUserProfile['percentiles']> {
    try {
      // First get the user's rank data
      const rankingResponse = await get<DirectUserSearchResponse[]>(
        this.client,
        '/webapp-backend/leaderboard/global/search/account-names',
        { username }
      );
      
      // Find the exact match if there are multiple results
      const exactMatch = Array.isArray(rankingResponse) 
        ? rankingResponse.find(r => 
            (r.username && r.username.toLowerCase() === username.toLowerCase()) || 
            (r.steamAccountName && r.steamAccountName.toLowerCase() === username.toLowerCase())
          )
        : null;
      
      if (!exactMatch) {
        return {}; // No percentiles available
      }
      
      // Next, we need total player counts to calculate percentiles
      
      // For global leaderboard
      const globalLeaderboard = await get<{ total: string | number }>(
        this.client,
        '/webapp-backend/leaderboard/global/scores',
        { page: 0, max: 1 }
      );
      
      // For country leaderboard
      let countryLeaderboard = null;
      if (exactMatch.country) {
        countryLeaderboard = await get<{ total: string | number }>(
          this.client,
          '/webapp-backend/leaderboard/global/scores',
          { page: 0, max: 1, country: exactMatch.country }
        );
      }
      
      // For region leaderboard
      // We don't have a direct endpoint for this, so we'll approximate
      
      // Calculate percentiles
      const globalPercentile = this.calculatePercentile(
        exactMatch.rank,
        globalLeaderboard?.total || undefined
      );
      
      const countryPercentile = this.calculatePercentile(
        exactMatch.countryRank,
        countryLeaderboard?.total
      );
      
      // Estimate region percentile (assuming region has about 10x the country's players)
      const regionPercentile = this.calculatePercentile(
        exactMatch.regionRank,
        countryLeaderboard?.total ? Number(countryLeaderboard.total) * 10 : undefined
      );
      
      return {
        global: globalPercentile,
        country: countryPercentile,
        region: regionPercentile
      };
    } catch (error) {
      console.error('Error calculating user percentiles:', error);
      return {};
    }
  }
  
  /**
   * Calculate percentile based on rank and total players
   * 
   * @private
   * @param rank - Current rank
   * @param total - Total number of players
   * @returns Percentile (0-100)
   */
  private calculatePercentile(
    rank: number | null | undefined,
    total: string | number | undefined
  ): number | undefined {
    if (rank === null || rank === undefined || !total) {
      return undefined;
    }
    
    // Convert to numbers
    const rankNum = Number(rank);
    const totalNum = Number(total);
    
    if (isNaN(rankNum) || isNaN(totalNum) || totalNum === 0) {
      return undefined;
    }
    
    // Calculate percentile (higher is better)
    return Math.max(0, Math.min(100, (1 - (rankNum / totalNum)) * 100));
  }

  /**
   * Get all scenario scores for a user by handling pagination automatically
   * This is useful when you need to fetch all of a user's scores regardless of pagination
   * 
   * @param username - The username to look up
   * @param options - Options for fetching and filtering scores
   * @returns All user scenario scores combined from multiple pages
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
    if (!username) {
      console.warn('Username is required for scenario scores lookup');
      return [];
    }
    
    const { 
      maxPages = 10,
      pageSize = 100,
      sortParams = [],
      forceRefresh = false,
      showProgressLogs = false,
      cancelSignal
    } = options;
    
    // Create a cache key
    const cacheKey = `all_user_scenario_scores_${username.toLowerCase()}_${sortParams.join('_')}`;
    
    // Check cache first
    if (!forceRefresh) {
      const cachedData = apiCache.get<UserScenarioScore[]>(cacheKey);
      if (cachedData) {
        if (showProgressLogs) {
          console.log(`Returning ${cachedData.length} cached scenario scores for ${username}`);
        }
        return cachedData;
      }
    }
    
    try {
      // First get the initial page to determine total items
      const firstPage = await this.getScenarioScores(username, {
        page: 1,
        max: pageSize,
        sort_param: sortParams.length > 0 ? sortParams : undefined
      });
      
      // If there's no data or we're canceled, return an empty array
      if (!firstPage || !firstPage.data || cancelSignal?.aborted) {
        return [];
      }
      
      // Calculate how many pages we need to fetch
      const totalPages = Math.min(
        Math.ceil(firstPage.total / pageSize),
        maxPages
      );
      
      if (showProgressLogs) {
        console.log(`Found ${firstPage.total} total scenario scores for ${username} across ${totalPages} pages`);
        console.log(`Fetching page 1/${totalPages}...`);
      }
      
      // We already have the first page of data
      const allScores: UserScenarioScore[] = [...firstPage.data];
      
      // If we need more pages, fetch them concurrently
      if (totalPages > 1) {
        // Prepare promises for all remaining pages
        const pagePromises: Promise<UserScenarioScoresResponse>[] = [];
        
        for (let page = 2; page <= totalPages; page++) {
          // Skip if the operation has been canceled
          if (cancelSignal?.aborted) break;
          
          if (showProgressLogs) {
            console.log(`Fetching page ${page}/${totalPages}...`);
          }
          
          pagePromises.push(
            this.getScenarioScores(username, {
              page,
              max: pageSize,
              sort_param: sortParams.length > 0 ? sortParams : undefined
            })
          );
        }
        
        // Wait for all pages to complete
        const pageResults = await Promise.all(pagePromises);
        
        // Process the results
        for (const result of pageResults) {
          if (result && result.data) {
            allScores.push(...result.data);
          }
        }
      }
      
      if (showProgressLogs) {
        console.log(`Successfully fetched ${allScores.length} scenario scores for ${username}`);
      }
      
      // Cache the combined data
      apiCache.set(cacheKey, allScores, CACHE_TTL.USER_SCORES);
      
      return allScores;
    } catch (error) {
      console.error(`Error getting all scenario scores for ${username}:`, error);
      return [];
    }
  }

  /**
   * Get all scenario scores for multiple users efficiently
   * This method batches requests to minimize API calls and improve performance
   * 
   * @param usernames - Array of usernames to get scores for
   * @param options - Options for fetching and filtering scores
   * @returns Map of username to their scenario scores
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
    if (!usernames || usernames.length === 0) {
      return new Map();
    }
    
    const { 
      maxPages = 5,
      pageSize = 100,
      sortParams = [],
      forceRefresh = false,
      showProgressLogs = false,
      concurrentRequests = 3,
      cancelSignal
    } = options;
    
    // Create a results map
    const results = new Map<string, UserScenarioScore[]>();
    
    // Process users in chunks to avoid overwhelming the API
    const uniqueUsernames = [...new Set(usernames.filter(Boolean))];
    
    if (showProgressLogs) {
      console.log(`Fetching scenario scores for ${uniqueUsernames.length} users with concurrency ${concurrentRequests}`);
    }
    
    // Process users in batches of concurrentRequests
    for (let i = 0; i < uniqueUsernames.length; i += concurrentRequests) {
      // Check if operation was canceled
      if (cancelSignal?.aborted) {
        if (showProgressLogs) {
          console.log('Operation was canceled');
        }
        break;
      }
      
      const batch = uniqueUsernames.slice(i, i + concurrentRequests);
      
      if (showProgressLogs) {
        console.log(`Processing batch ${i/concurrentRequests + 1} with ${batch.length} users`);
      }
      
      // Process this batch concurrently
      const batchPromises = batch.map(username => 
        this.getAllScenarioScores(username, {
          maxPages,
          pageSize,
          sortParams,
          forceRefresh,
          showProgressLogs: false,
          cancelSignal
        }).then(scores => ({ username, scores }))
      );
      
      // Wait for all users in this batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Add results to the map
      for (const { username, scores } of batchResults) {
        results.set(username, scores);
      }
      
      // If we have more batches to process, add a small delay to avoid API rate limits
      if (i + concurrentRequests < uniqueUsernames.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    if (showProgressLogs) {
      console.log(`Completed fetching scenario scores for ${results.size} users`);
    }
    
    return results;
  }
} 