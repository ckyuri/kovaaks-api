import type { AxiosInstance } from 'axios';
import { get, getUserByUsername } from '../utils/api';
import { apiCache } from '../utils/cache';
import type { 
  GlobalLeaderboardResponse, 
  GroupLeaderboardResponse, 
  PaginationParams,
  LeaderboardEntry,
  GroupLeaderboardEntry,
  UserProfile,
  DirectUserSearchResponse,
  UserSearchOptions,
  GetUserRanksParams,
  UserRegionalContext
} from '../types';

/**
 * Cache durations for different API calls (in ms)
 */
const CACHE_TTL = {
  GLOBAL_LEADERBOARD: 60 * 60 * 1000, // 1 hour
  COUNTRY_LEADERBOARD: 60 * 60 * 1000, // 1 hour
  REGION_LEADERBOARD: 60 * 60 * 1000, // 1 hour
  USER_SEARCH: 15 * 60 * 1000, // 15 minutes
};

/**
 * Leaderboard API endpoints
 */
export class LeaderboardAPI {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  /**
   * Get global player rankings
   * Note: This endpoint uses 0-indexed pagination (unlike most other endpoints which use 1-indexed pagination)
   * 
   * @param params - Pagination parameters and optional country filter
   * @returns Paginated response of global leaderboard entries
   */
  async getGlobalLeaderboard(params?: PaginationParams & { country?: string }): Promise<GlobalLeaderboardResponse> {
    // Page 0 is the first page in the Kovaaks API (not page 1)
    const page = params?.page !== undefined ? params.page : 0;
    const max = params?.max || 20;
    const country = params?.country;
    
    // Create a cache key
    const cacheKey = `global_leaderboard_${page}_${max}_${country || 'all'}`;
    
    // Check cache first
    const cachedData = apiCache.get<GlobalLeaderboardResponse>(cacheKey);
    if (cachedData) {
      return cachedData;
    }
    
    // If not cached, make the API call
    const response = await get<GlobalLeaderboardResponse>(
      this.client, 
      '/webapp-backend/leaderboard/global/scores', 
      {
        page,
        max,
        ...(country ? { 
          filter_country: country.toUpperCase()
        } : {})
      }
    );
    
    // Debug log to show country values (only when a country filter is applied)
    if (country && response && response.data && Array.isArray(response.data)) {
      console.log(`Received ${response.data.length} players for country filter '${country.toUpperCase()}'`);
      
      // Log countries present in the response to help diagnose issues
      const countriesInResponse = new Set<string>();
      response.data.forEach(player => {
        if (player.country) {
          countriesInResponse.add(player.country);
        }
      });
      
      if (countriesInResponse.size > 0) {
        console.log(`Countries in response: ${Array.from(countriesInResponse).join(', ')}`);
      } else {
        console.log('No country information found in response');
      }
      
      // No additional filtering required - the API should already filter by country
    }
    
    // Cache the response
    apiCache.set(cacheKey, response, CACHE_TTL.GLOBAL_LEADERBOARD);
    
    return response;
  }

  /**
   * Get rankings by country
   * Note: This endpoint uses 1-indexed pagination (page 1 is the first page)
   * 
   * @param params - Pagination parameters
   * @returns Paginated response of country leaderboard entries
   */
  async getCountryLeaderboard(params?: PaginationParams): Promise<GroupLeaderboardResponse> {
    const page = params?.page !== undefined ? params.page : 1; // Default to page 1 (first page)
    const max = params?.max || 10;
    
    // Create a cache key
    const cacheKey = `country_leaderboard_${page}_${max}`;
    
    // Check cache first
    const cachedData = apiCache.get<GroupLeaderboardResponse>(cacheKey);
    if (cachedData) {
      return cachedData;
    }
    
    // If not cached, make the API call
    const response = await get<GroupLeaderboardResponse>(
      this.client, 
      '/webapp-backend/leaderboard/global/scores', 
      {
        page,
        max,
        group: 'country'
      }
    );
    
    // Cache the response
    apiCache.set(cacheKey, response, CACHE_TTL.COUNTRY_LEADERBOARD);
    
    return response;
  }

  /**
   * Get rankings by region
   * Note: This endpoint uses 1-indexed pagination (page 1 is the first page)
   * 
   * @param params - Pagination parameters
   * @returns Paginated response of region leaderboard entries
   */
  async getRegionLeaderboard(params?: PaginationParams): Promise<GroupLeaderboardResponse> {
    const page = params?.page !== undefined ? params.page : 1; // Default to page 1 (first page)
    const max = params?.max || 10;
    
    // Create a cache key
    const cacheKey = `region_leaderboard_${page}_${max}`;
    
    // Check cache first
    const cachedData = apiCache.get<GroupLeaderboardResponse>(cacheKey);
    if (cachedData) {
      return cachedData;
    }
    
    // If not cached, make the API call
    const response = await get<GroupLeaderboardResponse>(
      this.client, 
      '/webapp-backend/leaderboard/global/scores', 
      {
        page,
        max,
        group: 'region'
      }
    );
    
    // Cache the response
    apiCache.set(cacheKey, response, CACHE_TTL.REGION_LEADERBOARD);
    
    return response;
  }

  /**
   * Direct username search - returns all players matching the username
   * This method uses a dedicated endpoint to search for users by their username
   * and returns their global, country, and region ranks in a single API call
   * 
   * @param username - Username to search for
   * @param options - Optional search options for sorting, filtering, and caching behavior
   * @returns Array of matching users, sorted and filtered according to options
   */
  async searchUserByUsername(
    username: string, 
    options?: UserSearchOptions | boolean
  ): Promise<DirectUserSearchResponse[] | null> {
    // Handle the case where options is a boolean (backward compatibility)
    const forceRefresh = typeof options === 'boolean' ? options : options?.forceRefresh || false;
    const searchOptions = typeof options === 'object' ? options : {};
    
    // Create a cache key using lowercase username for case-insensitive matching
    const cacheKey = `user_search_${username.toLowerCase()}`;
    
    // Check cache first (unless force refresh is specified)
    let results: DirectUserSearchResponse[] | null = null;
    
    if (!forceRefresh) {
      const cachedData = apiCache.get<DirectUserSearchResponse[]>(cacheKey);
      if (cachedData) {
        results = cachedData;
      }
    }
    
    // If not cached or force refresh, make the API call
    if (!results) {
      try {
        // Log the original username for debugging
        console.log(`Searching for user '${username}' (this may take some time)...`);
        
        // Use the new getUserByUsername wrapper that handles problematic usernames
        const response = await getUserByUsername<DirectUserSearchResponse[]>(
          this.client,
          '/webapp-backend/leaderboard/global/search/account-names',
          username
        );
        
        // Cache the response only if it contains data
        if (response && response.length > 0) {
          apiCache.set(cacheKey, response, CACHE_TTL.USER_SEARCH);
          console.log(`Found ${response.length} results for '${username}', caching for future use`);
        } else {
          console.log(`No results found for '${username}'`);
        }
        
        results = response && response.length > 0 ? response : null;
      } catch (error) {
        console.error('Error searching for user:', error);
        return null;
      }
    }
    
    // If no results, return null
    if (!results || results.length === 0) {
      return null;
    }
    
    // Prioritize profiles with non-null values before applying filtering
    results = this.prioritizeValidProfiles(results, username);
    
    // Apply filtering
    let filteredResults = [...results];
    
    // Filter by country if specified
    if (searchOptions.filterByCountry) {
      const country = searchOptions.filterByCountry.toUpperCase();
      filteredResults = filteredResults.filter(user => 
        user.country && user.country.toUpperCase() === country
      );
    }
    
    // Filter by players with a defined country
    if (searchOptions.onlyWithCountry) {
      filteredResults = filteredResults.filter(user => !!user.country);
    }
    
    // Filter by players with a rank
    if (searchOptions.onlyRanked) {
      filteredResults = filteredResults.filter(user => 
        user.rank !== null && user.rank !== undefined
      );
    }
    
    // Apply sorting
    if (searchOptions.sortBy) {
      const sortBy = searchOptions.sortBy;
      const sortOrder = searchOptions.sortOrder || 'asc';
      
      filteredResults.sort((a, b) => {
        let comparison = 0;
        
        switch (sortBy) {
          case 'rank':
            // Handle null/undefined ranks
            if (a.rank === undefined || a.rank === null) return 1;
            if (b.rank === undefined || b.rank === null) return -1;
            comparison = a.rank - b.rank;
            break;
          case 'username':
            const nameA = (a.username || a.steamAccountName || '').toLowerCase();
            const nameB = (b.username || b.steamAccountName || '').toLowerCase();
            comparison = nameA.localeCompare(nameB);
            break;
          case 'country':
            const countryA = (a.country || '').toLowerCase();
            const countryB = (b.country || '').toLowerCase();
            comparison = countryA.localeCompare(countryB);
            break;
        }
        
        // Reverse the comparison if sort order is descending
        return sortOrder === 'desc' ? -comparison : comparison;
      });
    }
    
    // Apply limit if specified
    if (searchOptions.limit && searchOptions.limit > 0 && searchOptions.limit < filteredResults.length) {
      filteredResults = filteredResults.slice(0, searchOptions.limit);
    }
    
    return filteredResults;
  }
  
  /**
   * Sanitize username for API calls to handle special characters and length limitations
   * 
   * @param username - Original username to sanitize
   * @returns Sanitized username safe for API calls
   */
  private sanitizeUsername(username: string): string {
    if (!username) return '';
    
    // Trim whitespace
    let sanitized = username.trim();
    
    // Keep only ASCII and common Unicode characters, remove unusual symbols and control chars
    // This is a simplified approach that keeps letters, numbers, and common symbols
    sanitized = sanitized.replace(/[\u0000-\u001F\u007F-\u00A0\u2000-\u200F\u2028-\u202F\uFFF0-\uFFFF]/g, '');
    
    // Check for URL-encoded length - API has a 32 character limit after encoding
    // First check if it would exceed when encoded
    const encoded = encodeURIComponent(sanitized);
    const MAX_LENGTH = 32;
    
    if (encoded.length > MAX_LENGTH) {
      console.log(`Username '${sanitized}' exceeds max encoded length of ${MAX_LENGTH} chars when URL-encoded (${encoded.length} chars), simplifying...`);
      
      // If it contains non-ASCII chars, try to simplify further by keeping only alphanumeric chars
      if (/[^\x00-\x7F]/.test(sanitized)) {
        console.log(`Username contains non-ASCII characters, converting to simplified version`);
        // For usernames with Unicode characters, create a simplified alphanumeric version
        const simplified = sanitized.replace(/[^\w\s]/g, '')  // Remove non-alphanumeric chars
                                   .replace(/\s+/g, '_')      // Replace spaces with underscores
                                   .substring(0, 20);         // Keep it well under the limit
        
        if (simplified && simplified.length > 0) {
          console.log(`Simplified username to '${simplified}'`);
          return simplified;
        }
      } else {
        // For ASCII usernames that are still too long when encoded, just truncate
        sanitized = sanitized.substring(0, MAX_LENGTH - 5); // Leave room for encoding overhead
        console.log(`Truncated username to '${sanitized}'`);
      }
    }
    
    // Ensure it's not empty after sanitization
    if (!sanitized) {
      console.log(`Username '${username}' became empty after sanitization, using safe fallback`);
      // Use a simple alphanumeric representation as fallback
      sanitized = 'user_' + username.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
    }
    
    return sanitized;
  }

  /**
   * Helper function to prioritize profiles with more complete information
   * 
   * @param profiles - Array of profile results to prioritize
   * @param searchName - Original search name for exact matching
   * @returns Reordered array with more complete profiles first
   */
  private prioritizeValidProfiles(
    profiles: DirectUserSearchResponse[] | null,
    searchName: string
  ): DirectUserSearchResponse[] {
    if (!profiles || profiles.length <= 1) {
      return profiles || [];
    }
    
    // Function to calculate profile completeness score (higher is better)
    const getProfileScore = (profile: DirectUserSearchResponse): number => {
      let score = 0;
      
      // Prioritize profiles with username match
      const nameMatches = profile.username?.toLowerCase() === searchName.toLowerCase() || 
                         profile.steamAccountName?.toLowerCase() === searchName.toLowerCase();
      if (nameMatches) score += 50;
      
      // Give points for having important fields
      if (profile.rank !== null && profile.rank !== undefined) score += 10;
      if (profile.countryRank !== null && profile.countryRank !== undefined) score += 10;
      if (profile.regionRank !== null && profile.regionRank !== undefined) score += 10;
      if (profile.country) score += 5;
      if (profile.steamId) score += 5;
      if (profile.steamAccountName) score += 3;
      if (profile.username) score += 3;
      
      return score;
    };
    
    // Sort profiles by completeness score (descending)
    return [...profiles].sort((a, b) => getProfileScore(b) - getProfileScore(a));
  }

  /**
   * Search for a user by their Steam ID
   * This is the most precise way to find a specific user
   * 
   * @param steamId - Steam ID to search for
   * @param username - Optional username to help with search (API requires this parameter)
   * @param forceRefresh - Whether to bypass cache and force a fresh API call
   * @returns User's ranking information if found, null if not found
   */
  async searchUserBySteamId(
    steamId: string, 
    username?: string,
    forceRefresh = false
  ): Promise<DirectUserSearchResponse | null> {
    // Create a cache key specifically for steam ID lookups
    const cacheKey = `steamid_search_${steamId}`;
    
    // Check cache first
    if (!forceRefresh) {
      const cachedData = apiCache.get<DirectUserSearchResponse>(cacheKey);
      if (cachedData) {
        return cachedData;
      }
    }
    
    try {
      console.log(`Searching for user with Steam ID: ${steamId}...`);
      
      // If no username is provided, use a default placeholder 
      // (API requires username parameter even when searching by Steam ID)
      const searchUsername = username || "steamid-search";
      
      // Direct search endpoint that supports Steam ID
      const response = await get<DirectUserSearchResponse[]>(
        this.client,
        '/webapp-backend/leaderboard/global/search/steam-ids',
        { 
          steamId,
          username: searchUsername
        }
      );
      
      // If the direct steam-ids endpoint fails, fall back to account-names search
      // which might return results that include our Steam ID
      if (!response || response.length === 0) {
        console.log(`No direct results found for Steam ID: ${steamId}, trying alternative lookup...`);
        
        // Try the global leaderboard search
        const usernameResponse = await get<DirectUserSearchResponse[]>(
          this.client,
          '/webapp-backend/leaderboard/global/search/account-names',
          { 
            steamId,
            username: searchUsername
          }
        );
        
        const matchingUser = usernameResponse?.find(user => user.steamId === steamId);
        if (matchingUser) {
          apiCache.set(cacheKey, matchingUser, CACHE_TTL.USER_SEARCH);
          return matchingUser;
        }
        
        // If still not found, try a more comprehensive approach - get the global leaderboard
        // and filter for the specific Steam ID
        const globalLeaderboard = await this.getGlobalLeaderboard({ page: 0, max: 100 });
        if (globalLeaderboard && globalLeaderboard.data) {
          const matchFromGlobal = globalLeaderboard.data.find(player => player.steamId === steamId);
          if (matchFromGlobal) {
            // Convert to the expected response format
            const convertedResponse: DirectUserSearchResponse = {
              steamId: matchFromGlobal.steamId,
              steamAccountName: matchFromGlobal.steamAccountName,
              username: matchFromGlobal.webappUsername || matchFromGlobal.steamAccountName,
              rank: matchFromGlobal.rank,
              // We may not have country/region information from this source
              country: matchFromGlobal.country || null,
              // Only set known values
              kovaaksPlusActive: matchFromGlobal.kovaaksPlusActive,
              rankChange: matchFromGlobal.rankChange
            };
            
            apiCache.set(cacheKey, convertedResponse, CACHE_TTL.USER_SEARCH);
            return convertedResponse;
          }
        }
        
        console.log(`No user found with Steam ID: ${steamId}`);
        return null;
      }
      
      // Handle successful direct response
      const matchingUser = response[0]; // Get the first (and hopefully only) result
      if (matchingUser) {
        // Cache the result
        apiCache.set(cacheKey, matchingUser, CACHE_TTL.USER_SEARCH);
        console.log(`Found user with Steam ID: ${steamId}`);
        return matchingUser;
      }
      
      console.log(`No user found with Steam ID: ${steamId}`);
      return null;
      
    } catch (error) {
      console.error('Error searching for user by Steam ID:', error);
      return null;
    }
  }

  /**
   * Get a user's complete ranking information in a single API call
   * This is the recommended method for finding a user's ranks as it's
   * the most efficient and provides the most comprehensive information
   * 
   * @param params - Either a username string (backward compatibility) or an object with search parameters
   * @returns Object containing the user's global, country, and region ranks along with all matching players
   */
  async getUserRanks(
    params: string | GetUserRanksParams,
    forceRefresh = false
  ): Promise<{
    found: boolean;
    globalRank: number | null;
    countryRank: number | null;
    regionRank: number | null;
    country: string | null;
    steamId: string | null;
    steamAccountName: string | null;
    steamAccountAvatar: string | null;
    kovaaksPlusActive: boolean;
    rankChanges: {
      global: number;
      country: number;
      region: number;
    } | null;
    // New field: All matching players
    allMatches: DirectUserSearchResponse[] | null;
  }> {
    // Handle both string and object parameter formats
    let username: string | undefined;
    let steamId: string | undefined;
    let searchOptions: UserSearchOptions | undefined;
    
    if (typeof params === 'string') {
      // Backward compatibility - handle the old string parameter
      username = params;
      searchOptions = { forceRefresh };
    } else {
      // New parameter object format
      username = params.username;
      steamId = params.steamId;
      searchOptions = {
        ...params.searchOptions,
        forceRefresh: params.searchOptions?.forceRefresh || forceRefresh
      };
    }
    
    // Validate that at least one search parameter is provided
    if (!username && !steamId) {
      throw new Error('Either username or steamId must be provided');
    }
    
    let searchResults: DirectUserSearchResponse[] | null = null;
    
    // If steamId is provided, use that for the search
    if (steamId) {
      const result = await this.searchUserBySteamId(steamId, username, searchOptions?.forceRefresh);
      searchResults = result ? [result] : null;
    } else if (username) {
      // Otherwise search by username
      searchResults = await this.searchUserByUsername(username, searchOptions);
    }
    
    // If no results found, return default object with null values
    if (!searchResults || searchResults.length === 0) {
      return {
        found: false,
        globalRank: null,
        countryRank: null,
        regionRank: null,
        country: null,
        steamId: null,
        steamAccountName: null,
        steamAccountAvatar: null,
        kovaaksPlusActive: false,
        rankChanges: null,
        allMatches: null
      };
    }
    
    // Get the first/best result (most relevant or highest ranked)
    const userInfo = searchResults[0];
    
    return {
      found: true,
      globalRank: userInfo?.rank ?? null,
      countryRank: userInfo?.countryRank ?? null,
      regionRank: userInfo?.regionRank ?? null,
      country: userInfo?.country ?? null,
      steamId: userInfo?.steamId ?? null,
      steamAccountName: userInfo?.steamAccountName ?? null,
      steamAccountAvatar: userInfo?.steamAccountAvatar ?? null,
      kovaaksPlusActive: userInfo?.kovaaksPlusActive ?? false,
      rankChanges: {
        global: userInfo?.rankChange ?? 0,
        country: userInfo?.countryRankChange ?? 0,
        region: userInfo?.regionRankChange ?? 0
      },
      // Include all matching players for advanced use cases
      allMatches: searchResults
    };
  }

  /**
   * Helper function to find the highest ranked player matching a username
   * @param username - Username to search for
   * @param forceRefresh - Whether to bypass cache
   * @returns Highest ranked player matching the username
   */
  async findHighestRankedPlayer(
    username: string,
    forceRefresh = false
  ): Promise<DirectUserSearchResponse | null> {
    try {
      const results = await this.searchUserByUsername(username, {
        sortBy: 'rank',
        sortOrder: 'asc',
        limit: 1,
        forceRefresh
      });
      
      // Check if we actually got results
      if (!results || results.length === 0) {
        return null;
      }
      
      // Use type assertion to ensure TypeScript understands this is not undefined
      return results[0] as DirectUserSearchResponse;
    } catch (error) {
      console.error('Error finding highest ranked player:', error);
      return null;
    }
  }

  /**
   * Get a user's regional positioning context
   * This combines the user's ranking data with country and region information
   * 
   * @param username - Username to get regional context for
   * @param forceRefresh - Whether to bypass cache and force fresh API calls
   * @returns User's regional positioning context
   */
  async getUserRegionalContext(username: string, forceRefresh = false): Promise<UserRegionalContext | null> {
    try {
      // Create a cache key
      const cacheKey = `user_regional_context_${username.toLowerCase()}`;
      
      // Check cache first
      if (!forceRefresh) {
        const cachedData = apiCache.get<UserRegionalContext>(cacheKey);
        if (cachedData) {
          return cachedData;
        }
      }
      
      // Get user's ranking information
      const userSearchResults = await this.searchUserByUsername(username, { forceRefresh });
      
      if (!userSearchResults || userSearchResults.length === 0) {
        return null;
      }
      
      // Find the exact match if there are multiple results
      const userInfo = userSearchResults.find(user => 
        (user.username && user.username.toLowerCase() === username.toLowerCase()) || 
        (user.steamAccountName && user.steamAccountName.toLowerCase() === username.toLowerCase())
      ) || userSearchResults[0];
      
      // Make sure userInfo is defined
      if (!userInfo) {
        return null;
      }
      
      // Get country leaderboard data
      const countryLeaderboard = userInfo.country 
        ? await this.getGlobalLeaderboard({ country: userInfo.country, page: 1, max: 10 })
        : null;
      
      // Get region leaderboard data
      // Determine the region from the country
      let regionName: string | null = null;
      
      if (userInfo.country) {
        regionName = this.getRegionFromCountry(userInfo.country);
      }
      
      // Get region leaderboard data
      const regionLeaderboard = await this.getRegionLeaderboard({ page: 1, max: 10 });
      
      // Find the user's region in the region leaderboard
      const userRegion = regionLeaderboard.data.find(region => 
        region.group === regionName
      );
      
      // Create the response object
      const regionalContext: UserRegionalContext = {
        username,
        steamAccountName: userInfo.steamAccountName || username,
        steamId: userInfo.steamId || '',
        playerRanking: {
          global: userInfo.rank ?? null,
          country: userInfo.countryRank ?? null,
          region: userInfo.regionRank ?? null,
          countryName: userInfo.country || null,
          regionName: regionName || null
        },
        countryContext: {
          countryName: userInfo.country || null,
          globalRank: countryLeaderboard?.data.find(c => 
            'group' in c ? c.group === userInfo.country : false
          )?.rank || null,
          totalPlayers: countryLeaderboard ? parseInt(countryLeaderboard.total.toString(), 10) : 0,
          topPlayers: (countryLeaderboard?.data || []).map(entry => {
            return {
              rank: entry.rank,
              rankChange: 0, // Default value
              steamId: '', // Default value
              webappUsername: null, // Default value
              steamAccountName: (entry as unknown as GroupLeaderboardEntry).group || '',
              points: (entry as unknown as GroupLeaderboardEntry).points || '0',
              scenariosCount: (entry as unknown as GroupLeaderboardEntry).scenarios_count || '0',
              completionsCount: parseInt((entry as unknown as GroupLeaderboardEntry).completions_count || '0', 10),
              kovaaksPlusActive: false, // Default value
              country: (entry as unknown as GroupLeaderboardEntry).group || ''
            } as LeaderboardEntry;
          })
        },
        regionContext: {
          regionName: regionName || null,
          globalRank: userRegion?.rank || null,
          totalPlayers: regionLeaderboard ? parseInt(regionLeaderboard.total.toString(), 10) : 0,
          topPlayers: (regionLeaderboard?.data || []).map(entry => {
            return {
              rank: entry.rank,
              rankChange: 0, // Default value
              steamId: '', // Default value
              webappUsername: null, // Default value
              steamAccountName: (entry as unknown as GroupLeaderboardEntry).group || '',
              points: (entry as unknown as GroupLeaderboardEntry).points || '0',
              scenariosCount: (entry as unknown as GroupLeaderboardEntry).scenarios_count || '0',
              completionsCount: parseInt((entry as unknown as GroupLeaderboardEntry).completions_count || '0', 10),
              kovaaksPlusActive: false, // Default value
              country: ''
            } as LeaderboardEntry;
          })
        }
      };
      
      // Cache the response
      apiCache.set(cacheKey, regionalContext, CACHE_TTL.GLOBAL_LEADERBOARD);
      
      return regionalContext;
    } catch (error) {
      console.error('Error getting user regional context:', error);
      return null;
    }
  }

  /**
   * Find a user's rank efficiently using the direct search endpoint
   * This method is more efficient than the paginated search methods
   * 
   * @param username - Username to find rank for
   * @returns Object containing the user's global, country, and region ranks
   */
  async findUserRankEfficient(username: string): Promise<{
    globalRank: number | null;
    countryRank: number | null;
    regionRank: number | null;
    country: string | null;
    region: string | null;
    username: string;
    steamId: string | null;
  } | null> {
    if (!username) {
      console.warn('Username is required for rank lookup');
      return null;
    }
    
    const cacheKey = `userRankEfficient:${username.toLowerCase()}`;
    const cached = apiCache.get<{
      globalRank: number | null;
      countryRank: number | null;
      regionRank: number | null;
      country: string | null;
      region: string | null;
      username: string;
      steamId: string | null;
    }>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    try {
      // First get the user profile to ensure we have their steamId and country
      const userProfile = await get<UserProfile>(
        this.client,
        '/webapp-backend/user/profile/by-username',
        { username }
      );
      
      if (!userProfile) {
        console.warn(`Profile not found for ${username}`);
        return null;
      }
      
      const steamId = userProfile.steamId;
      const country = userProfile.country;
      
      // Get search results to find the user's rank
      const searchResults = await this.searchUserByUsername(username);
      
      if (!searchResults || searchResults.length === 0) {
        console.warn(`No search results found for ${username}`);
        return null;
      }
      
      // Find the user in the search results (by steamId, username, or steamAccountName)
      let userData: DirectUserSearchResponse | undefined;
      
      if (steamId) {
        userData = searchResults.find(result => result.steamId === steamId);
      }
      
      if (!userData) {
        userData = searchResults.find(
          result => 
            (result.username && result.username.toLowerCase() === username.toLowerCase()) ||
            (result.steamAccountName && result.steamAccountName.toLowerCase() === username.toLowerCase())
        );
      }
      
      if (!userData) {
        // If still not found, just use the first result
        userData = searchResults[0];
      }
      
      if (!userData) {
        console.warn(`User data not found in search results for ${username}`);
        return null;
      }
      
      // Prepare the result
      const result: {
        globalRank: number | null;
        countryRank: number | null;
        regionRank: number | null;
        country: string | null;
        region: string | null;
        username: string;
        steamId: string | null;
      } = {
        globalRank: userData.rank || null,
        countryRank: userData.countryRank || null,
        regionRank: userData.regionRank || null,
        country: userData.country || country || null,
        region: null,
        username: userData.username || userData.steamAccountName || username,
        steamId: userData.steamId || steamId || null
      };
      
      // If we have a country but no country rank, try to get it
      if (result.country && (result.countryRank === null || result.regionRank === null)) {
        try {
          // Determine the user's region from their country
          result.region = this.getRegionFromCountry(result.country);
          
          // If country rank is null, try to calculate it
          if (result.countryRank === null && result.country) {
            // Find the user in the country leaderboard
            const countryLeaderboard = await this.getGlobalLeaderboard({ country: result.country, page: 0, max: 100 });
            const countryPlayers = countryLeaderboard.data;
            
            const playerInCountry = countryPlayers.find(player => 
              player.steamId === result.steamId || 
              (player.steamAccountName && player.steamAccountName.toLowerCase() === result.username.toLowerCase())
            );
            
            if (playerInCountry) {
              result.countryRank = countryPlayers.indexOf(playerInCountry) + 1;
            }
          }
          
          // If region rank is null and we know the region, try to calculate it
          if (result.regionRank === null && result.region) {
            // Get all players from the user's region
            const regionPlayers: LeaderboardEntry[] = [];
            const countries = this.getCountriesInRegion(result.region);
            
            for (const countryCode of countries) {
              const countryLeaderboard = await this.getGlobalLeaderboard({ country: countryCode, page: 0, max: 100 });
              regionPlayers.push(...countryLeaderboard.data);
            }
            
            // Sort by points - convert to number to ensure correct comparison
            regionPlayers.sort((a, b) => {
              const pointsA = typeof a.points === 'number' ? a.points : parseInt(String(a.points), 10) || 0;
              const pointsB = typeof b.points === 'number' ? b.points : parseInt(String(b.points), 10) || 0;
              return pointsB - pointsA; // Higher points first
            });
            
            const playerInRegion = regionPlayers.find(player => 
              player.steamId === result.steamId || 
              (player.steamAccountName && player.steamAccountName.toLowerCase() === result.username.toLowerCase())
            );
            
            if (playerInRegion) {
              result.regionRank = regionPlayers.indexOf(playerInRegion) + 1;
            }
          }
        } catch (error) {
          console.warn('Error calculating additional ranks:', error);
        }
      }
      
      apiCache.set(cacheKey, result, CACHE_TTL.GLOBAL_LEADERBOARD);
      return result;
    } catch (error) {
      console.error(`Error finding rank efficiently for ${username}:`, error);
      return null;
    }
  }
  
  /**
   * Find a user's global rank by searching the global leaderboard
   * 
   * @param username - Username to search for
   * @param options - Options for pagination and search
   * @returns Global rank or null if not found
   */
  async findUserGlobalRank(
    username: string,
    options: { page: number; max: number }
  ): Promise<number | null> {
    try {
      const { page, max } = options;
      const response = await this.getGlobalLeaderboard({ page, max });
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        return null;
      }
      
      const userEntry = response.data.find(entry => 
        entry.webappUsername?.toLowerCase() === username.toLowerCase() ||
        entry.steamAccountName?.toLowerCase() === username.toLowerCase()
      );
      
      return userEntry ? userEntry.rank : null;
    } catch (error) {
      console.error('Error finding user global rank:', error);
      return null;
    }
  }
  
  /**
   * Find a user's country rank by searching the country's leaderboard
   * 
   * @param username - Username to search for
   * @param country - Country code (e.g., 'US', 'GB')
   * @param options - Options for pagination and search
   * @returns Country rank or null if not found
   */
  async findCountryRank(
    username: string,
    country: string,
    options: { page: number; max: number }
  ): Promise<number | null> {
    try {
      const { page, max } = options;
      const response = await this.getGlobalLeaderboard({ 
        page, 
        max,
        country 
      });
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        return null;
      }
      
      const userEntry = response.data.find(entry => 
        entry.webappUsername?.toLowerCase() === username.toLowerCase() ||
        entry.steamAccountName?.toLowerCase() === username.toLowerCase()
      );
      
      // If user is found, their rank in this filtered list is their country rank
      if (userEntry) {
        // The index in the array + 1 represents their position in the country
        const position = response.data.indexOf(userEntry) + 1;
        return position;
      }
      
      return null;
    } catch (error) {
      console.error('Error finding user country rank:', error);
      return null;
    }
  }
  
  /**
   * Find a user's region rank by searching the region's players
   * 
   * @param username - Username to search for
   * @param region - Region name (e.g., 'North America', 'Europe')
   * @param options - Options for pagination and search
   * @returns Region rank or null if not found
   */
  async findRegionRank(
    username: string,
    region: string,
    options: { page: number; max: number }
  ): Promise<number | null> {
    try {
      // First get all countries in the region
      const regionLeaderboard = await this.getRegionLeaderboard({ 
        page: 1, 
        max: 50 
      });
      
      if (!regionLeaderboard || !regionLeaderboard.data) {
        return null;
      }
      
      // Filter to get only the countries in this region
      const countriesInRegion = regionLeaderboard.data
        .filter(entry => this.getRegionFromCountry(entry.group) === region)
        .map(entry => entry.group);
      
      if (countriesInRegion.length === 0) {
        return null;
      }
      
      // Now we need to search for the user in each country
      for (const countryCode of countriesInRegion) {
        const countryRank = await this.findCountryRank(
          username, 
          countryCode, 
          options
        );
        
        if (countryRank !== null) {
          // User found in this country, return the rank
          return countryRank;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error finding user region rank:', error);
      return null;
    }
  }
  
  /**
   * Get a user's complete ranking information including global, country, and region
   * 
   * @param username - Username to get complete ranking for
   * @param options - Pagination options for the search
   * @returns Complete ranking information for the user
   */
  async getUserCompleteRanking(
    username: string,
    options?: PaginationParams
  ): Promise<{
    globalRank: number | null;
    countryRank: number | null;
    regionRank: number | null;
    country: string | null;
    region: string | null;
  } | null> {
    try {
      // First try the efficient direct search
      const directResult = await this.findUserRankEfficient(username);
      if (directResult) {
        return directResult;
      }
      
      // If direct search failed, try the paginated search
      const page = options?.page || 1;
      const max = options?.max || 100;
      
      // Get user's profile to find their country
      const userProfile = await get<UserProfile>(
        this.client,
        '/webapp-backend/user/profile/by-username',
        { username }
      );
      
      if (!userProfile) {
        return null;
      }
      
      // Search global leaderboard
      const globalRank = await this.findUserGlobalRank(username, {
        page,
        max
      });
      
      // Search country leaderboard if country is available
      let countryRank = null;
      const country = userProfile.country;
      if (country) {
        countryRank = await this.findCountryRank(username, country, {
          page,
          max
        });
      }
      
      // Determine region from country and get region rank
      let regionRank = null;
      const region = this.getRegionFromCountry(country);
      if (region) {
        regionRank = await this.findRegionRank(username, region, {
          page,
          max
        });
      }
      
      return {
        globalRank,
        countryRank,
        regionRank,
        country,
        region
      };
    } catch (error) {
      console.error('Error getting complete ranking:', error);
      return null;
    }
  }
  
  /**
   * Get region name from country code using a simple mapping
   * 
   * @param countryCode - ISO country code (e.g., 'US', 'GB')
   * @returns Region name or null if not found
   */
  private getRegionFromCountry(countryCode: string | null): string | null {
    if (!countryCode) return null;
    
    // Convert country code to uppercase for consistent matching
    const upperCountryCode = countryCode.toUpperCase();
    
    // Simple mapping of countries to regions
    const regionMap: Record<string, string> = {
      // North America
      'US': 'North America',
      'CA': 'North America',
      'MX': 'North America',
      
      // Europe
      'GB': 'Europe',
      'UK': 'Europe', // Some APIs use UK instead of GB
      'DE': 'Europe',
      'FR': 'Europe',
      'IT': 'Europe',
      'ES': 'Europe',
      'NL': 'Europe',
      'SE': 'Europe',
      'NO': 'Europe',
      'DK': 'Europe',
      'FI': 'Europe',
      'PL': 'Europe',
      'CZ': 'Europe',
      'HU': 'Europe',
      'AT': 'Europe',
      'CH': 'Europe',
      'BE': 'Europe',
      'IE': 'Europe',
      'PT': 'Europe',
      'GR': 'Europe',
      
      // Asia
      'JP': 'Asia',
      'KR': 'Asia',
      'CN': 'Asia',
      'IN': 'Asia',
      'SG': 'Asia',
      'MY': 'Asia',
      'PH': 'Asia',
      'ID': 'Asia',
      'TH': 'Asia',
      'VN': 'Asia',
      'TW': 'Asia',
      'HK': 'Asia',
      
      // Oceania
      'AU': 'Oceania',
      'NZ': 'Oceania',
      
      // South America
      'BR': 'South America',
      'AR': 'South America',
      'CL': 'South America',
      'CO': 'South America',
      'PE': 'South America',
      'UY': 'South America',
      'VE': 'South America',
    };
    
    return regionMap[upperCountryCode] || null;
  }

  /**
   * Get the region mapping for all countries
   * 
   * @returns Object mapping country codes to region names
   */
  private getRegionMapping(): Record<string, string> {
    // Simple mapping of countries to regions
    return {
      // North America
      'US': 'North America',
      'CA': 'North America',
      'MX': 'North America',
      
      // Europe
      'GB': 'Europe',
      'DE': 'Europe',
      'FR': 'Europe',
      'IT': 'Europe',
      'ES': 'Europe',
      'NL': 'Europe',
      'SE': 'Europe',
      'NO': 'Europe',
      'DK': 'Europe',
      'FI': 'Europe',
      'PL': 'Europe',
      'CZ': 'Europe',
      'HU': 'Europe',
      'AT': 'Europe',
      'CH': 'Europe',
      'BE': 'Europe',
      'IE': 'Europe',
      'PT': 'Europe',
      'GR': 'Europe',
      
      // Asia
      'JP': 'Asia',
      'KR': 'Asia',
      'CN': 'Asia',
      'IN': 'Asia',
      'SG': 'Asia',
      'MY': 'Asia',
      'PH': 'Asia',
      'ID': 'Asia',
      'TH': 'Asia',
      'VN': 'Asia',
      'TW': 'Asia',
      'HK': 'Asia',
      
      // Oceania
      'AU': 'Oceania',
      'NZ': 'Oceania',
      
      // South America
      'BR': 'South America',
      'AR': 'South America',
      'CL': 'South America',
      'CO': 'South America',
      'PE': 'South America',
      'UY': 'South America',
      'VE': 'South America',
    };
  }

  /**
   * Get countries in a region
   * @private
   */
  private getCountriesInRegion(region: string): string[] {
    const regionMapping: Record<string, string> = {
      // North America
      'US': 'NA', 'CA': 'NA', 'MX': 'NA',
      
      // Europe
      'GB': 'EU', 'DE': 'EU', 'FR': 'EU', 'IT': 'EU', 'ES': 'EU', 'NL': 'EU', 'BE': 'EU', 
      'SE': 'EU', 'NO': 'EU', 'DK': 'EU', 'FI': 'EU', 'PL': 'EU', 'CZ': 'EU', 'AT': 'EU',
      'CH': 'EU', 'IE': 'EU', 'PT': 'EU', 'GR': 'EU', 'RO': 'EU', 'BG': 'EU', 'HR': 'EU',
      'HU': 'EU', 'SK': 'EU', 'SI': 'EU', 'EE': 'EU', 'LV': 'EU', 'LT': 'EU', 'CY': 'EU',
      'MT': 'EU', 'LU': 'EU',
      
      // Asia
      'JP': 'AS', 'CN': 'AS', 'KR': 'AS', 'IN': 'AS', 'SG': 'AS', 'MY': 'AS', 'ID': 'AS',
      'TH': 'AS', 'VN': 'AS', 'PH': 'AS', 'TW': 'AS', 'HK': 'AS',
      
      // Oceania
      'AU': 'OC', 'NZ': 'OC',
      
      // South America
      'BR': 'SA', 'AR': 'SA', 'CL': 'SA', 'CO': 'SA', 'PE': 'SA', 'VE': 'SA', 'UY': 'SA',
      'PY': 'SA', 'BO': 'SA', 'EC': 'SA',
      
      // Africa
      'ZA': 'AF', 'EG': 'AF', 'NG': 'AF', 'KE': 'AF', 'MA': 'AF', 'TN': 'AF', 'DZ': 'AF',
      'GH': 'AF', 'SN': 'AF',
      
      // Middle East
      'AE': 'ME', 'SA': 'ME', 'TR': 'ME', 'IL': 'ME', 'QA': 'ME', 'BH': 'ME', 'KW': 'ME',
      'OM': 'ME', 'JO': 'ME', 'LB': 'ME'
    };
    
    return Object.entries(regionMapping)
      .filter(([_country, regionCode]) => regionCode === region)
      .map(([country, _regionCode]) => country);
  }
} 