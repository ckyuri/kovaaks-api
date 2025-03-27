// Base Types for the Kovaaks API

// Auth Types
export interface AuthResponse {
  auth: {
    firebaseJWT: string;
    jwt: string;
    refreshToken: string;
    exp: number;
    emailVerified: boolean;
    steamAccountNameIds: Record<string, any>;
  };
  profile: UserProfile;
  redirect: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface TokenVerifyResponse {
  success: boolean;
}

// User Profile Types
export interface UserProfile {
  playerId: number;
  username: string;
  created: string;
  steamId: string;
  clientBuildVersion: string;
  lastAccess: string;
  webapp: {
    roles: {
      admin: boolean;
      coach: boolean;
      staff: boolean;
    };
    videos: any[];
    username: string;
    socialMedia: Record<string, any>;
    gameSettings: Record<string, any>;
    profileImage: string | null;
    profileViews: number;
    hasSubscribed: boolean;
    gamingPeripherals: Record<string, any>;
  };
  country: string;
  lowerWebappUsername: string;
  searchVector: string;
  steamAccountName: string;
  steamAccountAvatar: string;
  kovaaksPlusActive?: boolean;
  discord_id?: string;
  discord_username?: string;
  hideDiscord?: boolean;
  badges?: any[];
  followCounts?: {
    following: number;
    followers: number;
  };
  kovaaksPlus?: {
    active: boolean;
    expiration: string | null;
  };
  scenariosPlayed?: string;
  features?: {
    global_leaderboards: boolean;
    [key: string]: any;
  };
}

// User Activity Types
export interface UserActivity {
  timestamp: string;
  type: string;
  scenarioName: string;
  score: number;
  leaderboardId: number;
  username: string;
  webappUsername: string;
  steamId: string;
  steamAccountName: string;
  steamAccountAvatar: string;
  country: string;
  kovaaksPlus: boolean;
}

// Benchmark Types
export interface BenchmarkProgress {
  benchmark_progress: number;
  overall_rank: number;
  categories: {
    [categoryName: string]: {
      benchmark_progress: number;
      category_rank: number;
      rank_maxes: any[];
      scenarios: {
        [scenarioName: string]: {
          score: number;
          leaderboard_rank: number;
          scenario_rank: number;
          rank_maxes: any[];
        };
      };
    };
  };
  ranks: Array<{
    icon: string;
    name: string;
    color: string;
    frame: string;
    description: string;
    playercard_large: string;
    playercard_small: string;
  }>;
}

export interface BenchmarkSearchItem {
  benchmarkName: string;
  benchmarkId: number;
  benchmarkIcon: string;
  benchmarkAuthor: string;
  type: string;
  tintRanks: boolean;
  rankName: string;
  rankIcon: string;
  rankColor: string;
}

export interface BenchmarkSearchResponse {
  page: number;
  max: number;
  total: number;
  data: BenchmarkSearchItem[];
}

// Scenario Types
export interface ScenarioItem {
  rank: number;
  leaderboardId: number;
  scenarioName: string;
  scenario: {
    aimType: string | null;
    authors: any[];
    description: string;
  };
  counts: {
    plays: number;
    entries: number;
  };
  topScore: {
    score: number;
  };
}

export interface PopularScenariosResponse {
  page: number;
  max: number;
  total: number;
  data: ScenarioItem[];
}

export interface TrendingScenario {
  scenarioName: string;
  leaderboardId: number;
  webappUsername: string | null;
  steamAccountName: string;
  kovaaksPlusActive: boolean;
  entries: number;
  new: boolean;
}

export interface UserScenarioScore {
  leaderboardId: string;
  scenarioName: string;
  counts: {
    plays: number;
  };
  rank: number;
  score: number;
  attributes: {
    resolution: string;
    avg_fps: number;
    avg_ttk: number;
    sens_scale: string;
    horiz_sens: number;
    vert_sens: number;
    fov: number;
    challenge_start: string;
    score: number;
    kills: number;
    hash: string;
    fov_scale: string;
    sens_randomizer: string | null;
    accuracy_damage: number;
    scenario_version: string;
    cm360: number;
    client_build_version: string;
    epoch: number;
    [key: string]: any;
  };
  scenario: {
    aimType: string | null;
    authors: any[];
    description: string;
  };
}

export interface UserScenarioScoresResponse {
  page: number;
  max: number;
  total: number;
  data: UserScenarioScore[];
}

// Leaderboard Types
export interface LeaderboardEntry {
  rank: number;
  rankChange: number;
  steamId: string;
  webappUsername: string | null;
  steamAccountName: string;
  points: string;
  scenariosCount: string;
  completionsCount: number;
  kovaaksPlusActive: boolean;
  country: string;
}

export interface GlobalLeaderboardResponse {
  data: LeaderboardEntry[];
  total: string;
}

export interface GroupLeaderboardEntry {
  group: string;
  points: string;
  scenarios_count: string;
  completions_count: string;
  rank: number;
}

export interface GroupLeaderboardResponse {
  data: GroupLeaderboardEntry[];
  total: string | number;
}

export interface DirectUserSearchResponse {
  steamId: string;
  rank?: number;
  countryRank?: number;
  regionRank?: number;
  rankChange?: number;
  countryRankChange?: number;
  regionRankChange?: number;
  username?: string;
  steamAccountName?: string;
  steamAccountAvatar?: string;
  country?: string | null;
  kovaaksPlusActive?: boolean;
}

/**
 * Options for sorting and filtering user search results
 */
export interface UserSearchOptions {
  /**
   * Whether to bypass the cache and perform a fresh search
   */
  forceRefresh?: boolean;
  
  /**
   * Property to sort results by
   */
  sortBy?: 'rank' | 'username' | 'country';
  
  /**
   * Sort order
   * - 'asc' = ascending (lower rank numbers first, alphabetical A-Z)
   * - 'desc' = descending (higher rank numbers first, alphabetical Z-A)
   */
  sortOrder?: 'asc' | 'desc';
  
  /**
   * Maximum number of results to return
   */
  limit?: number;
  
  /**
   * Filter results by country code (e.g., 'US', 'GB')
   */
  filterByCountry?: string;
  
  /**
   * Only include players with a defined country
   */
  onlyWithCountry?: boolean;
  
  /**
   * Only include players who have a ranked position
   */
  onlyRanked?: boolean;
}

/**
 * Parameters for getUserRanks method
 */
export interface GetUserRanksParams {
  /**
   * Username to search for
   */
  username?: string;
  
  /**
   * Steam ID to search for
   */
  steamId?: string;
  
  /**
   * Search options for filtering and sorting
   */
  searchOptions?: UserSearchOptions;
}

// API Error Types
export interface ApiError {
  error: Array<{
    value: string;
    msg: string;
    param: string;
    location: string;
  }>;
}

/**
 * Granular error types for better debugging and handling
 */
export interface KovaaksApiError {
  // Basic error properties
  message: string;
  status?: number;
  code?: string;
  
  // Request details
  url?: string;
  method?: string;
  params?: Record<string, any>;
  
  // Response details
  data?: any;
  
  // Error type classification
  type: KovaaksErrorType;
  
  // Original error
  originalError?: any;
  
  // Retry information (if retries were attempted)
  retryAttempts?: number;
  retryable?: boolean;
}

/**
 * Error type classification for more precise error handling
 */
export enum KovaaksErrorType {
  // Network errors
  NETWORK_ERROR = 'network_error',
  TIMEOUT = 'timeout',
  
  // Server errors
  SERVER_ERROR = 'server_error',
  RATE_LIMITED = 'rate_limited',
  
  // Client errors
  AUTHENTICATION_ERROR = 'authentication_error',
  AUTHORIZATION_ERROR = 'authorization_error',
  VALIDATION_ERROR = 'validation_error',
  NOT_FOUND = 'not_found',
  
  // SDK errors
  PARAMETER_ERROR = 'parameter_error',
  CONFIGURATION_ERROR = 'configuration_error',
  
  // Unknown/other errors
  UNKNOWN_ERROR = 'unknown_error'
}

// Client Configuration
export interface KovaaksClientConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  enableCaching?: boolean;
  [key: string]: any;
}

// Pagination Parameters
export interface PaginationParams {
  page?: number;
  max?: number;
}

// Combined Endpoint Types

/**
 * Combined user profile with complete ranking information
 */
export interface CompleteUserProfile extends Omit<UserProfile, 'scenariosPlayed'> {
  rankings: {
    global: number | null;
    country: number | null;
    region: number | null;
    countryName: string | null;
    regionName: string | null;
    rankChanges?: {
      global: number;
      country: number;
      region: number;
    };
  };
  kovaaksPlusActive: boolean;
  scenariosPlayed: number | string;
}

/**
 * User scenario performance details with metadata
 */
export interface UserScenarioPerformance {
  username: string;
  totalScenarios: number;
  scenarioDetails: Array<{
    leaderboardId: number;
    scenarioName: string;
    plays: number;
    bestScore: number;
    rank: number | null;
    dateLastPlayed: string;
    metadata: {
      popularity: number;
      totalPlays: number;
      aimType: string | null;
      authors: string[];
      description: string;
    };
  }>;
}

/**
 * User benchmark progress with category details
 */
export interface UserBenchmarkProgress {
  username: string;
  overallProgress: number;
  overallRank: number | null;
  categories: Record<string, {
    progress: number;
    rank: number | null;
    scenarios: Record<string, {
      score: number;
      leaderboardRank: number | null;
      scenarioRank: number | null;
    }>;
  }>;
  benchmarks: Array<{
    benchmarkName: string;
    benchmarkId: number;
    benchmarkIcon: string;
    progress: number;
  }>;
}

/**
 * User activity timeline with scenario details
 */
export interface UserActivityTimeline {
  username: string;
  totalActivities: number;
  activities: Array<{
    timestamp: string;
    scenarioName: string;
    score: number;
    leaderboardId: number;
    scenarioDetails: {
      aimType: string | null;
      authors: string[];
      description: string;
      popularity: number;
      totalPlays: number;
    };
  }>;
  // Optional filter state that was applied to this activity timeline
  appliedFilters?: {
    startDate?: string;
    endDate?: string;
    scenarioFilter?: string;
    scoreRange?: { min: number; max: number };
    aimType?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
  // Metadata about the activities, useful for filtering UIs
  metadata?: {
    dateRange: { earliest: string; latest: string };
    scoreRange: { min: number; max: number };
    uniqueScenarios: string[];
    uniqueAimTypes: string[];
  };
}

/**
 * Options for filtering and sorting activity timeline data
 * Since the Kovaaks API doesn't support filtering parameters for activity timeline,
 * these options are applied client-side after retrieving the data
 */
export interface ActivityTimelineOptions {
  /**
   * Maximum number of activities to retrieve (default: 20)
   */
  limit?: number;
  
  /**
   * Whether to bypass cache and force a fresh API call
   */
  forceRefresh?: boolean;
  
  /**
   * Filter activities by start date (inclusive)
   * Format: ISO date string or Date object
   */
  startDate?: Date | string;
  
  /**
   * Filter activities by end date (inclusive)
   * Format: ISO date string or Date object
   */
  endDate?: Date | string;
  
  /**
   * Filter activities by scenario name
   * Can be a partial match (case-insensitive)
   */
  scenarioFilter?: string;
  
  /**
   * Filter activities by aim type (e.g., 'tracking', 'click-timing')
   */
  aimType?: string;
  
  /**
   * Filter activities by minimum score
   */
  minScore?: number;
  
  /**
   * Filter activities by maximum score
   */
  maxScore?: number;
  
  /**
   * Property to sort by
   */
  sortBy?: 'date' | 'score' | 'scenarioName';
  
  /**
   * Sort order
   */
  sortOrder?: 'asc' | 'desc';
  
  /**
   * Whether to include metadata about the activities in the response
   * This is useful for building filtering UIs
   */
  includeMetadata?: boolean;
  
  /**
   * Whether to include the applied filters in the response
   */
  includeFilterState?: boolean;
  
  /**
   * Group activities by scenario name and include progress over time
   * This allows tracking improvement in specific scenarios
   */
  groupByScenario?: boolean;
}

/**
 * User regional positioning context
 */
export interface UserRegionalContext {
  username: string;
  steamAccountName: string;
  steamId: string;
  playerRanking: {
    global: number | null;
    country: number | null;
    region: number | null;
    countryName: string | null;
    regionName: string | null;
  };
  countryContext: {
    countryName: string | null;
    globalRank: number | null;
    totalPlayers: number;
    topPlayers: LeaderboardEntry[];
  };
  regionContext: {
    regionName: string | null;
    globalRank: number | null;
    totalPlayers: number;
    topPlayers: LeaderboardEntry[];
  };
}

/**
 * Options for fuzzy search of user profiles
 */
export interface ProfileSearchOptions {
  /**
   * Whether to bypass the cache and perform a fresh search
   */
  forceRefresh?: boolean;
  
  /**
   * How closely the search string must match the username or Steam account name
   * Higher values require closer matches (0.0 to 1.0)
   */
  threshold?: number;
  
  /**
   * Maximum number of results to return
   */
  limit?: number;
  
  /**
   * Whether to include partial matches
   */
  includePartialMatches?: boolean;
  
  /**
   * Include additional data with each profile
   */
  includeRankData?: boolean;
  
  /**
   * Include users that don't have any rank data
   */
  includeUnranked?: boolean;
  
  /**
   * Property to sort results by
   */
  sortBy?: 'relevance' | 'rank' | 'username' | 'lastActive';
  
  /**
   * Sort order
   */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Search result for user profiles with relevance score
 */
export interface ProfileSearchResult {
  /**
   * User profile data
   */
  profile: UserProfile;
  
  /**
   * Match relevance score (0.0 to 1.0)
   */
  relevance: number;
  
  /**
   * Ranking data if requested
   */
  rankData?: {
    global: number | null;
    country: number | null;
    region: number | null;
    rankChanges?: {
      global: number;
      country: number; 
      region: number;
    };
  };
}

/**
 * Historical rank data for a user
 */
export interface RankHistory {
  /**
   * Global rank history entries
   */
  global: Array<{
    date: string | undefined;
    rank: number;
  }>;
  
  /**
   * Country rank history entries
   */
  country: Array<{
    date: string | undefined;
    rank: number;
    country: string | undefined;
  }>;
  
  /**
   * Region rank history entries
   */
  region: Array<{
    date: string | undefined;
    rank: number;
    region: string | undefined;
  }>;
}

/**
 * Extended user profile with historical rank data
 */
export interface ExtendedUserProfile extends CompleteUserProfile {
  /**
   * Historical rank data
   */
  rankHistory?: RankHistory;
  
  /**
   * Percentile information in various rankings
   */
  percentiles?: {
    global?: number;
    country?: number;
    region?: number;
  };
  
  /**
   * First tracked appearance in rankings
   */
  firstTracked?: string;
  
  /**
   * Last rank update timestamp
   */
  lastRankUpdate?: string;
} 