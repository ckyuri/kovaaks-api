# Kovaaks API Wrapper

A modern TypeScript wrapper for the [Kovaaks.com](https://kovaaks.com) API. This comprehensive wrapper makes it easy to retrieve and analyze data from the Kovaaks API with robust error handling and advanced features.

## Features

- **Complete TypeScript Support** - Full type definitions for all API responses
- **Leaderboard Data** - Access global, country, and region leaderboards
- **User Profiles and Statistics** - Comprehensive player data
- **Performance Analysis** - Track improvements and trends over time
- **User Comparisons** - Compare players' performance across scenarios
- **Benchmark Details** - Track progress across benchmark categories
- **Scenario Information** - Access scenario metadata and leaderboards
- **Robust Error Handling** - Detailed error types with fallback mechanisms
- **Username Handling** - Support for special Unicode characters and Steam/webapp username resolution
- **Built-in Caching System** - Configurable memory cache for improved performance
- **Request Deduplication** - Avoid duplicate concurrent API calls
- **Configurable Timeout** - Longer timeouts (60s default) for handling large data requests
- **Advanced Search** - Filtering, sorting, and Steam ID lookup
- **Combined Endpoints** - Comprehensive data from multiple sources in single calls
- **Zero Dependencies** (except axios)

## Installation

```bash
npm install kovaaks-ts-wrapper
```

Or if you're using Yarn:

```bash
yarn add kovaaks-ts-wrapper
```

## Basic Usage

```typescript
import { KovaaksClient } from 'kovaaks-ts-wrapper';

// Create a new client
const client = new KovaaksClient();

// Search for a user
const searchResults = await client.leaderboards.searchUserByUsername('firefly');

// Get a user's complete ranking information
const userRanks = await client.leaderboards.getUserRanks({
  username: 'firefly',
  searchOptions: {
    sortBy: 'rank',
    sortOrder: 'asc'
  }
});

// Find the highest ranked player with a name
const topPlayer = await client.leaderboards.findHighestRankedPlayer('firefly');
console.log(`Best player: ${topPlayer.steamAccountName} (Rank #${topPlayer.rank})`);
```

## Advanced Features

### User Comparison

Compare two players' performance across scenarios:

```typescript
// Compare two players
const comparison = await client.combined.compareUsers('your-username', 'pro-player');

// Output the comparison summary
console.log(`Comparing ${comparison.userProfile.username} with ${comparison.comparedToProfile.username}`);
console.log(`Global rank difference: ${comparison.summary.globalRankDifference}`);
console.log(`Better scenarios: ${comparison.summary.betterScenarios}`);
console.log(`Worse scenarios: ${comparison.summary.worseScenarios}`);
console.log(`Average score difference: ${comparison.summary.averageScoreDifference.toFixed(2)}%`);

// If the player can't be found, it will attempt to find a similar rank player
const comparisonWithFallback = await client.combined.compareUsers('your-username', 'unknown-player', {
  fallbackToSimilarRank: true  // Will find someone of similar rank if player isn't found
});
```

### Performance Trends

Analyze a player's improvement over time:

```typescript
// Get performance trends for a player
const trends = await client.combined.calculatePerformanceTrends('username', {
  timeRange: {
    startDate: new Date('2023-01-01'),
    endDate: new Date()
  },
  minSamples: 5  // Minimum number of plays to include a scenario
});

// Show improvement for each scenario
trends.forEach(trend => {
  const { scenarioName, trends } = trend;
  const { firstScore, latestScore, percentImprovement } = trends.overall;
  
  console.log(`${scenarioName}: ${percentImprovement.toFixed(2)}% improvement`);
  console.log(`  First score: ${firstScore} → Latest score: ${latestScore}`);
  
  if (trends.timeWindows.last30Days) {
    console.log(`  Last 30 days: ${trends.timeWindows.last30Days.percentChange.toFixed(2)}% change`);
  }
});
```

### Username Handling

The wrapper now intelligently handles different username formats and special characters:

```typescript
// Handles usernames with Unicode characters like "𝘽⁧⁧ 𝙇𝙊𝙊𝘿"
const specialCharUser = await client.leaderboards.searchUserByUsername('𝘽⁧⁧ 𝙇𝙊𝙊𝘿');

// Resolves differences between Steam usernames and Kovaaks webapp usernames
const completeProfile = await client.combined.getCompleteProfile('Prismatix');
console.log(`Steam name: ${completeProfile.steamAccountName}`);
console.log(`Webapp name: ${completeProfile.username}`);
```

## API Reference

### Client Configuration

```typescript
const client = new KovaaksClient({
  timeout: 60000,  // 1 minute (default: 60000ms / 60 seconds)
  headers: {
    'User-Agent': 'My Custom User Agent'
  },
  enableCaching: true  // default: true
});
```

## Comprehensive Examples

For complete usage examples, see the [examples/usage-example.ts](./examples/usage-example.ts) file, which demonstrates:

- Global leaderboard queries with pagination
- Regional and country rankings
- User search and profile lookups
- Scenario performance analysis
- Benchmark progress tracking
- Authentication and error handling
- User comparison features
- Performance trend analysis
- Activity timeline filtering

Example of comparing users:

```typescript
// Compare two users
const comparison = await client.combined.compareUsers('player1', 'player2');

// Get detailed report
console.log(`Player 1 global rank: ${comparison.player1.rankings.global}`);
console.log(`Player 2 global rank: ${comparison.player2.rankings.global}`);

// Check who has higher ranking
if (comparison.comparison.globalRankDifference > 0) {
  console.log(`${comparison.player1.username} is ranked ${comparison.comparison.globalRankDifference} positions higher`);
} else {
  console.log(`${comparison.player2.username} is ranked ${Math.abs(comparison.comparison.globalRankDifference)} positions higher`);
}
```

### Leaderboard Endpoints

#### Global Leaderboard
```typescript
// Get global leaderboard
const globalRanks = await client.leaderboards.getGlobalLeaderboard();
// Returns: { data: LeaderboardEntry[], total: string }

// With pagination
const page2 = await client.leaderboards.getGlobalLeaderboard({ 
  page: 2, 
  max: 20 
});

// With country filter
const usRanks = await client.leaderboards.getGlobalLeaderboard({ 
  country: 'US' 
});
```

The `getGlobalLeaderboard` method returns:

```typescript
{
  // Array of leaderboard entries
  data: Array<{
    rank: number;                   // Global rank
    rankChange: number;             // Rank change since last update
    steamId: string;                // Steam ID
    webappUsername: string | null;  // Kovaaks webapp username
    steamAccountName: string;       // Steam profile name
    points: string;                 // Total points
    scenariosCount: string;         // Number of scenarios played
    completionsCount: number;       // Number of total completions
    kovaaksPlusActive: boolean;     // Whether user has Kovaak's+
    country: string;                // Country code (e.g., 'US', 'GB')
  }>;
  
  // Total number of entries
  total: string;
}
```

#### User Search and Ranking
```typescript
// Search by username
const users = await client.leaderboards.searchUserByUsername('firefly', {
  filterByCountry: 'US',    // Optional: filter by country
  onlyWithCountry: true,    // Optional: only players with country set
  onlyRanked: true,         // Optional: only ranked players
  sortBy: 'rank',           // Optional: 'rank', 'username', 'country'
  sortOrder: 'asc',         // Optional: 'asc' or 'desc'
  limit: 5                  // Optional: limit results
});
```

The `searchUserByUsername` method returns:

```typescript
// Array of user search results
Array<{
  steamId: string;                    // Steam ID
  rank?: number;                      // Global rank (may be null)
  countryRank?: number;               // Country rank (may be null)
  regionRank?: number;                // Region rank (may be null)
  rankChange?: number;                // Global rank change
  countryRankChange?: number;         // Country rank change
  regionRankChange?: number;          // Region rank change
  username?: string;                  // Kovaaks webapp username (may be null)
  steamAccountName?: string;          // Steam profile name
  steamAccountAvatar?: string;        // Steam avatar URL
  country?: string | null;            // Country code
  kovaaksPlusActive?: boolean;        // Whether user has Kovaak's+
}>
```

#### Search by Steam ID
```typescript
// Search by Steam ID
const userBySteamId = await client.leaderboards.searchUserBySteamId('76561198123456789');
```

The `searchUserBySteamId` method returns the same type as `searchUserByUsername` but for a single user:

```typescript
{
  steamId: string;                    // Steam ID
  rank?: number;                      // Global rank (may be null)
  countryRank?: number;               // Country rank (may be null)
  regionRank?: number;                // Region rank (may be null)
  rankChange?: number;                // Global rank change
  countryRankChange?: number;         // Country rank change
  regionRankChange?: number;          // Region rank change
  username?: string;                  // Kovaaks webapp username (may be null)
  steamAccountName?: string;          // Steam profile name
  steamAccountAvatar?: string;        // Steam avatar URL
  country?: string | null;            // Country code
  kovaaksPlusActive?: boolean;        // Whether user has Kovaak's+
}
```

#### Fast and efficient rank lookup (avoids pagination)
```typescript
// Fast and efficient rank lookup (avoids pagination)
const efficientRank = await client.leaderboards.findUserRankEfficient('username');
```

The `findUserRankEfficient` method returns:

```typescript
{
  globalRank: number | null;       // Global rank
  countryRank: number | null;      // Country rank
  regionRank: number | null;       // Region rank
  country: string | null;          // Country code
  region: string | null;           // Region name
  username: string;                // Username
  steamId: string | null;          // Steam ID
}
```

#### Get comprehensive ranking information
```typescript
// Get comprehensive ranking information
const completeRanking = await client.leaderboards.getUserCompleteRanking('username');
```

The `getUserCompleteRanking` method returns:

```typescript
{
  globalRank: number | null;       // Global rank
  countryRank: number | null;      // Country rank
  regionRank: number | null;       // Region rank
  country: string | null;          // Country code
  region: string | null;           // Region name
}
```

#### Regional Context
```typescript
// Get user's regional positioning context
const regionalContext = await client.leaderboards.getUserRegionalContext('username');
```

The `getUserRegionalContext` method returns:

```typescript
{
  username: string;
  steamAccountName: string;
  steamId: string;
  
  // Player's ranking information
  playerRanking: {
    global: number | null;          // Global rank
    country: number | null;         // Country rank
    region: number | null;          // Region rank
    countryName: string | null;     // Country code
    regionName: string | null;      // Region name (e.g., 'North America')
  };
  
  // Country context
  countryContext: {
    countryName: string | null;     // Country code
    globalRank: number | null;      // Country's global rank
    totalPlayers: number;           // Total players in country
    // Top players in the country
    topPlayers: Array<LeaderboardEntry>;
  };
  
  // Regional context
  regionContext: {
    regionName: string | null;      // Region name
    globalRank: number | null;      // Region's global rank
    totalPlayers: number;           // Total players in region
    // Top players in the region
    topPlayers: Array<LeaderboardEntry>;
  };
}
```

### User Endpoints

#### Profile Information
```typescript
// Get user profile
const profile = await client.user.getProfile('76561198123456789');
// Returns: UserProfile

// Get recent activity
const activity = await client.user.getRecentActivity('username');
// Returns: UserActivity[]

// Get ALL scenario scores (handles pagination automatically)
const allScores = await client.combined.getAllScenarioScores('username', {
  maxPages: 5,      // Maximum pages to fetch
  pageSize: 100,    // Scores per page
  forceRefresh: false  // Bypass cache
});
```

### Advanced Performance Analysis

```typescript
// Get overall performance trends across all scenarios
const allTrends = await client.combined.calculatePerformanceTrends('username', {
  timeRange: {
    startDate: new Date('2023-01-01'),
    endDate: new Date()
  },
  minSamples: 5  // Minimum number of plays to include a scenario
});

// Analyze performance trends for a specific scenario
const scenarioTrends = await client.combined.calculatePerformanceTrendsForScenario(
  'username',
  'VoxTargetSwitch',
  {
    timeRange: {
      startDate: new Date('2023-01-01'),
      endDate: new Date()
    }
  }
);
// Returns detailed trend analysis for a single scenario including:
// - Score history over time
// - Improvement percentage
// - Recent time windows (7/30/90 day trends)
// - Moving averages
// - Consistency metrics

// Compare user with top players
const topCompare = await client.combined.getCompareWithTopPlayers('username', {
  useGlobalRanks: true,    // Compare with global top players
  countryFilter: 'US',     // Or filter by country
  scenarioLimit: 10,       // Limit to top N scenarios
  forceRefresh: false
});
// Returns comparison with top players for each scenario the user has played
```

### Benchmark Endpoints

```typescript
// Get benchmarks
const benchmarks = await client.benchmarks.search({ 
  page: 1, 
  max: 10 
});
// Returns: { page: number, max: number, total: number, data: Benchmark[] }

// Get user benchmark progress (simplified with automatic lookup)
const progress = await client.combined.findBenchmarkProgress('username');
// Returns: UserBenchmarkProgress with normalized progress values
```

### Scenario Endpoints

```typescript
// Get popular scenarios
const popular = await client.scenarios.getPopular({ 
  page: 1, 
  max: 10 
});
```

The `getPopular` method returns:

```typescript
{
  page: number;      // Current page number
  max: number;       // Max results per page
  total: number;     // Total number of scenarios
  data: Array<{      // Array of scenario items
    id: number;      // Scenario ID
    name: string;    // Scenario name
    description: string; // Scenario description
    authors: string[]; // List of authors
    created: string; // Creation date (ISO format)
    aimType: string | null; // Type of aim (tracking, clicking, etc.)
    tag: string;     // Scenario tag
    popularity: number; // Popularity score
    plays: number;   // Number of plays
  }>;
}
```

```typescript
// Get trending scenarios
const trending = await client.scenarios.getTrending();
```

The `getTrending` method returns:

```typescript
Array<{
  id: number;        // Scenario ID
  name: string;      // Scenario name
  description: string; // Scenario description
  authors: string[]; // List of authors
  created: string;   // Creation date (ISO format)
  aimType: string | null; // Type of aim (tracking, clicking, etc.)
  tag: string;       // Scenario tag
  popularity: number; // Popularity score
  plays: number;     // Number of plays
  recentPlays: number; // Number of recent plays
  trendFactor: number; // Trending score
}>
```

```typescript
// Get user scenario scores
const scores = await client.scenarios.getUserScores('username', {
  page: 1,
  max: 10,
  sortParam: ['count']
});
```

The `getUserScores` method returns:

```typescript
{
  data: Array<{
    leaderboardId: number; // Leaderboard ID
    scenarioId: number;    // Scenario ID
    name: string;          // Scenario name
    plays: number;         // Number of plays by the user
    score: number;         // User's best score
    rank: number | null;   // User's rank
    created: string;       // First play date (ISO format)
    lastPlayed: string;    // Last play date (ISO format)
  }>;
  page: number;            // Current page
  max: number;             // Results per page
  total: number;           // Total scores
}
```

### Performance Analysis

```typescript
// Get scenario performance with detailed metadata
const scenarioData = await client.combined.getScenarioPerformance('username');
```

The `getScenarioPerformance` method returns:

```typescript
{
  username: string;        // Username
  totalScenarios: number;  // Number of scenarios played
  scenarioDetails: Array<{
    leaderboardId: number; // Leaderboard ID
    scenarioName: string;  // Scenario name
    plays: number;         // Number of plays
    bestScore: number;     // Best score
    rank: number | null;   // Rank on the leaderboard
    dateLastPlayed: string; // Last played date (ISO format)
    metadata: {            // Additional scenario metadata
      popularity: number;  // Popularity score
      totalPlays: number;  // Total plays across all users
      aimType: string | null; // Type of aim (tracking, clicking, etc.)
      authors: string[];   // List of authors
      description: string; // Scenario description
    };
  }>;
}
```

```typescript
// Get activity timeline with detailed filtering
const activityTimeline = await client.combined.getActivityTimeline('username', {
  limit: 20,
  sortBy: 'date',
  sortOrder: 'desc',
  includeMetadata: true
});
```

The `getActivityTimeline` method returns:

```typescript
{
  username: string;        // Username
  totalActivities: number; // Total number of activities
  activities: Array<{
    timestamp: string;     // Activity date (ISO format)
    scenarioName: string;  // Scenario name
    score: number;         // Score achieved
    leaderboardId: number; // Leaderboard ID
    scenarioDetails: {     // Additional scenario details
      aimType: string | null; // Type of aim
      authors: string[];   // List of authors
      description: string; // Scenario description
      popularity: number;  // Popularity score
      totalPlays: number;  // Total number of plays
    };
  }>;
  // Optional metadata for filtering UIs
  metadata?: {
    dateRange: {
      earliest: string;   // Earliest activity date
      latest: string;     // Latest activity date
    };
    scoreRange: {
      min: number;        // Minimum score
      max: number;        // Maximum score
    };
    uniqueScenarios: string[]; // List of unique scenario names
    uniqueAimTypes: string[];  // List of unique aim types
  };
  // Applied filters that were used (if includeFilterState was true)
  appliedFilters?: {
    startDate?: string;
    endDate?: string;
    scenarioFilter?: string;
    scoreRange?: { min: number; max: number };
    aimType?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
}
```

```typescript
// Get benchmark progress
const benchmarkProgress = await client.combined.findBenchmarkProgress('username');
```

The `findBenchmarkProgress` method returns:

```typescript
{
  username: string;        // Username
  overallProgress: number; // Overall progress (0-100 percentage)
  overallRank: number | null; // Overall benchmark rank
  // Progress by category
  categories: Record<string, {
    progress: number;     // Category progress (0-100 percentage)
    rank: number | null;  // Category rank
    // Progress by scenario within this category
    scenarios: Record<string, {
      score: number;      // User's best score
      leaderboardRank: number | null; // Rank on the leaderboard
      scenarioRank: number | null;    // Rank for this scenario
    }>;
  }>;
  // List of benchmarks
  benchmarks: Array<{
    benchmarkName: string; // Benchmark name
    benchmarkId: number;   // Benchmark ID
    benchmarkIcon: string; // Benchmark icon URL
    progress: number;      // Progress (0-100 percentage)
  }>;
}
```

### Game Settings Endpoints

```typescript
// Get game settings including sensitivity conversion data
const gameSettings = await client.gameSettings.getGameSettings();

// Access sensitivity conversion data for different games
if (gameSettings && gameSettings.SensitivityAndFov) {
  // Find specific game settings
  const valorantSettings = gameSettings.SensitivityAndFov.find(
    g => g.ScaleName === 'Valorant'
  );
  
  // Convert sensitivity between games
  if (valorantSettings && valorantSettings.Sens) {
    console.log(`Valorant sens formula: ${valorantSettings.Sens.InchesFormula}`);
    console.log(`Typical cm/360 range: ${valorantSettings.Sens.TypicalMinCM} - ${valorantSettings.Sens.TypicalMaxCM}`);
  }
  
  // List all supported games
  const supportedGames = gameSettings.SensitivityAndFov.map(g => g.ScaleName);
  console.log(`Supported games: ${supportedGames.join(', ')}`);
}
```

### Authentication Endpoints

```typescript
// Login with username and password
const loginResponse = await client.auth.login({
  username: 'your_username',
  password: 'your_password'
});
// Returns tokens and user profile information

// Verify if current token is valid
const isValid = await client.auth.verifyToken();
console.log(`Token is valid: ${isValid}`);

// Logout - removes the authentication token
client.auth.logout();
```

### Combined Endpoints

#### Complete User Profile
```typescript
const completeProfile = await client.combined.getCompleteProfile('username');
```

The `getCompleteProfile` method returns:

```typescript
{
  playerId: number;                // User ID in the Kovaaks system
  username: string;                // Webapp username
  steamId: string;                 // Steam ID
  steamAccountName: string;        // Steam profile name
  steamAccountAvatar: string;      // Steam avatar URL
  country: string | null;          // Country code
  created: string;                 // Account creation date (ISO format)
  lastAccess: string;              // Last login date (ISO format)
  
  // Webapp-specific information
  webapp: {
    username: string;
    roles: {
      admin: boolean;
      coach: boolean;
      staff: boolean;
    };
    profileImage: string | null;
    profileViews: number;
    hasSubscribed: boolean;
    socialMedia: Record<string, string>;
    gamingPeripherals: Record<string, any>;
    // Other webapp fields...
  };
  
  // Ranking information
  rankings: {
    global: number | null;         // Global rank
    country: number | null;        // Country rank
    region: number | null;         // Region rank
    countryName: string | null;    // Country code
    regionName: string | null;     // Region name
    
    // Rank changes since last update
    rankChanges?: {
      global: number;
      country: number;
      region: number;
    };
  };
  
  kovaaksPlusActive: boolean;      // Whether user has Kovaak's+
  scenariosPlayed: number | string; // Number of scenarios played
}
```

#### Scenario Performance
```typescript
const scenarioData = await client.combined.getScenarioPerformance('username');
// Returns detailed scenario performance with metadata
```

#### Get All User Data
```typescript
// Get EVERYTHING about a user in one call
const userData = await client.combined.getAllUserData('username', {
  includeScenarioDetails: true,
  includeBenchmarkDetails: true,
  includeActivityLimit: 50,
  includeMonthlyStats: true,
  compareWithTopPlayers: true
});
```

The `getAllUserData` method returns a comprehensive object containing:

```typescript
{
  // Basic profile information
  profile: {
    playerId: number;
    username: string;
    steamId: string;
    steamAccountName: string;
    steamAccountAvatar: string;
    country: string | null;
    created: string;        // ISO date
    webapp: { ... };        // Additional webapp information
    kovaaksPlusActive: boolean;
    rankings: {             // Global and regional rankings
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
    scenariosPlayed: number | string;
  },
  
  // Authentication status (optional)
  authStatus?: { 
    authenticated: boolean; 
    tokenExpiry?: Date | null 
  },
  
  // Performance data
  scenarioPerformance: {
    username: string;
    totalScenarios: number;
    scenarioDetails: Array<{
      leaderboardId: number;
      scenarioName: string;
      plays: number;
      bestScore: number;
      rank: number | null;
      dateLastPlayed: string;  // ISO date
      metadata: {
        popularity: number;
        totalPlays: number;
        aimType: string | null;
        authors: string[];
        description: string;
      };
    }>;
  },
  
  // Benchmark progress data
  benchmarkProgress: {
    username: string;
    overallProgress: number;  // 0-100 percentage
    overallRank: number | null;
    categories: Record<string, {  // Key is category name
      progress: number;           // 0-100 percentage
      rank: number | null;
      scenarios: Record<string, { // Key is scenario name
        score: number;
        leaderboardRank: number | null;
        scenarioRank: number | null;
      }>;
    }>;
    benchmarks: Array<{
      benchmarkName: string;
      benchmarkId: number;
      benchmarkIcon: string;
      progress: number;          // 0-100 percentage
    }>;
  },
  
  // Activity timeline data
  activityTimeline: {
    username: string;
    totalActivities: number;
    activities: Array<{
      timestamp: string;        // ISO date
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
    metadata?: {               // Activity filtering metadata
      dateRange: { earliest: string; latest: string };
      scoreRange: { min: number; max: number };
      uniqueScenarios: string[];
      uniqueAimTypes: string[];
    };
  },
  
  // Regional context data
  regionalContext: {
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
      topPlayers: LeaderboardEntry[];  // Top players in country
    };
    regionContext: {
      regionName: string | null;
      globalRank: number | null;
      totalPlayers: number;
      topPlayers: LeaderboardEntry[];  // Top players in region
    };
  },
  
  // Additional data (depending on options)
  followData?: { following: number; followers: number } | null;
  badges?: any[] | null;
  socialMedia?: Record<string, string> | null;
  peripherals?: Record<string, any> | null;
  kovaaksPlusDetails?: { active: boolean; expiration: string | null } | null;
  monthlyActiveUsers?: number;
  gameSettingsGlobal?: any;    // Game settings including sensitivity conversion
  
  // Performance comparisons (when requested)
  topPlayerComparisons?: Array<{
    scenarioName: string;
    userScore: number;
    userRank: number | null;
    topScore: number;
    difference: number;       // Percentage difference
    percentOfTop: number;     // How close to top score (0-100)
  }>;
  
  // Calculated percentiles
  globalPercentile?: number;   // 0-100, higher is better
  countryPercentile?: number;
  regionPercentile?: number;
  
  // Historical data
  rankHistory?: {
    global?: Array<{ date: string; rank: number }>;
    country?: Array<{ date: string; rank: number; country: string }>;
    region?: Array<{ date: string; rank: number; region: string }>;
  };
}
```

This method delivers the most comprehensive data about a user available through the API, combining multiple endpoints for convenience. The options parameter allows you to customize exactly what data to include.

## Caching and Performance

The wrapper includes an in-memory cache and request deduplication system to improve performance.

### Cache Duration
- User search results: 15 minutes
- Leaderboard data: 1 hour
- Country and region rankings: 1 hour
- User profiles: 15 minutes

### Cache Control
```typescript
// Disable caching globally
const client = new KovaaksClient({ enableCaching: false });

// Runtime control
client.setCaching(false);  // disable
client.setCaching(true);   // enable
const isEnabled = client.isCachingEnabled();

// Bypass cache for specific requests
await client.leaderboards.getUserRanks({
  username: 'firefly',
  searchOptions: { 
    forceRefresh: true 
  }
});
```

## Error Handling

The Kovaaks API wrapper includes comprehensive error handling with detailed error types:

```typescript
try {
  // Attempt an API operation
  const profile = await client.user.getProfile('nonexistent-user');
} catch (error) {
  // Check the error type
  if (error.type === 'not_found') {
    console.log('User not found');
  } else if (error.type === 'authentication_error') {
    console.log('Authentication required');
  } else if (error.type === 'network_error') {
    console.log(`Network issue: ${error.message}`);
  }
  
  // Error object includes detailed information
  console.log(`Status: ${error.status}`);
  console.log(`Message: ${error.message}`);
  console.log(`URL: ${error.url}`);
  
  // Check if the error is retryable
  if (error.retryable) {
    console.log(`This request can be retried (attempted ${error.retryAttempts} times)`);
  }
}
```

Available error types:
- `network_error`: Connection issues
- `timeout`: Request timeout
- `server_error`: 5xx server errors
- `rate_limited`: API rate limiting (429)
- `authentication_error`: Authentication required (401)
- `authorization_error`: Permission denied (403)
- `validation_error`: Invalid parameters (422)
- `not_found`: Resource not found (404)
- `parameter_error`: Invalid SDK parameters
- `configuration_error`: SDK configuration issues
- `unknown_error`: Unclassified errors

## Types

The wrapper includes comprehensive TypeScript types for all responses and parameters. Key types include:

- `UserProfile` & `ExtendedUserProfile`
- `LeaderboardEntry`
- `BenchmarkProgress`
- `ScenarioData`
- `UserActivity`
- `TrendingScenario`
- `UserScenarioScore`
- `UserComparison`
- `PerformanceTrend`
- `UserRegionalContext`

## Utility Functions

The wrapper exposes several utility functions that you might find useful for your own implementation:

```typescript
import { 
  deduplicateRequests, 
  getRegionFromCountry, 
  sanitizeUsername,
  calculatePercentile,
  prioritizeValidProfiles
} from 'kovaaks-ts-wrapper/utils';

// Deduplicate concurrent API calls with the same parameters
const debouncedFetch = deduplicateRequests(async (id) => {
  // This function will only be called once for identical parameters
  return await expensiveOperation(id);
});

// Get region from country code
const region = getRegionFromCountry('US'); // Returns 'North America'

// Clean up usernames with special characters
const clean = sanitizeUsername('𝘽⁧⁧ 𝙇𝙊𝙊𝘿'); // Returns a safe version for API calls

// Calculate percentile rank
const percentile = calculatePercentile(150, 10000); // If rank 150 out of 10000
// Returns 98.5 (top 1.5%)

// Prioritize profiles by completeness
const bestProfile = prioritizeValidProfiles(profiles, searchTerm);
// Returns profiles sorted by completeness and relevance
```

### Region Helpers

```typescript
import { 
  getRegionMapping, 
  getCountriesInRegion 
} from 'kovaaks-ts-wrapper/utils';

// Get complete mapping of countries to regions
const regionMap = getRegionMapping();
// Returns: { 'US': 'North America', 'GB': 'Europe', ... }

// Get all countries in a region
const countries = getCountriesInRegion('NA');
// Returns: ['US', 'CA', 'MX', ...]
```

## Persistent Caching

The Kovaaks API wrapper now includes a persistent caching system that saves API responses to disk, ensuring cache data persists between application restarts.

### Basic Caching

Caching is enabled by default and requires no configuration:

```typescript
// Create client with default caching (enabled, saved to ~/.kovaaks-api-cache)
const client = new KovaaksClient();

// Enable/disable caching programmatically
client.setCaching(true);  // Enable
client.setCaching(false); // Disable
```

### Advanced Caching Configuration

For more control over caching behavior:

```typescript
// Configure custom caching options
const client = new KovaaksClient({
  enableCaching: true,
  cacheOptions: {
    // Custom directory for cache files
    cacheDir: '/path/to/cache/directory',
    
    // Custom cache filename
    cacheFile: 'kovaaks-cache.json',
    
    // Default TTL for cached items (10 minutes)
    defaultTTL: 10 * 60 * 1000,
    
    // Auto-save interval (disable with 0)
    autoSaveInterval: 0 // Only save on exit
  }
});
```

### Cache Behavior

- Cache is loaded from disk when the client is initialized
- New responses are automatically cached in memory
- Cache is periodically saved to disk (default: every 5 minutes)
- Cache is always saved when the application exits normally
- Expired items are automatically removed
- Each API endpoint has appropriate TTL values

This persistent caching system significantly improves performance for repeated API calls, even across different application runs.

## License

MIT

## Documentation

You can generate detailed API documentation from the source code using [TypeDoc](https://typedoc.org/).

### Generating Documentation

1. Install TypeDoc:
```bash
npm install --save-dev typedoc
```

2. Add the following script to your `package.json`:
```json
"scripts": {
  "docs": "typedoc --out docs src/index.ts"
}
```

3. Generate the documentation:
```bash
npm run docs
```

This will create a `docs` folder with complete HTML documentation of all classes, methods, interfaces, and types.

### Documentation Structure

The generated documentation includes:
- Class hierarchies
- Method signatures with parameters and return types
- Interface definitions
- Type declarations
- README integration

## Contributing

Contributions to the Kovaaks API Wrapper are welcome! Here are some guidelines:

### Development Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/kovaaks-ts-wrapper.git
cd kovaaks-ts-wrapper
```

2. Install dependencies:
```bash
npm install
```

3. Make your changes

4. Run tests:
```bash
npm test
```

### Contribution Guidelines

- Follow the existing code style
- Add TypeScript type definitions for all new features
- Document all public methods and classes with JSDoc comments
- Write unit tests for new functionality
- Update the README.md with examples for significant new features
- Submit a pull request with a clear description of the changes and their purpose

### Feature Requests and Bug Reports

Please use the GitHub issues page to report bugs or request new features.

## Configuration Options

When initializing the client, you can provide configuration options:

```typescript
// Create client with default configuration
const client = new KovaaksClient();

// Create client with custom configuration
const clientWithConfig = new KovaaksClient({
  // Base URL for all API requests (default: 'https://kovaaks.com')
  baseURL: 'https://kovaaks.com',
  
  // Request timeout in milliseconds (default: 60000 - 1 minute)
  timeout: 60000,
  
  // Custom headers for all requests
  headers: {
    'User-Agent': 'My Custom App'
  },
  
  // Enable/disable API response caching (default: true)
  enableCaching: true
});
```
