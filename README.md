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
npm install kovaaks-api-wrapper
```

Or if you're using Yarn:

```bash
yarn add kovaaks-api-wrapper
```

## Basic Usage

```typescript
import { KovaaksClient } from 'kovaaks-api-wrapper';

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

#### User Search and Ranking
```typescript
// Search by username
const user = await client.leaderboards.searchUserByUsername('firefly', {
  filterByCountry: 'US',    // Optional: filter by country
  onlyWithCountry: true,    // Optional: only players with country set
  onlyRanked: true,         // Optional: only ranked players
  sortBy: 'rank',           // Optional: 'rank', 'username', 'country'
  sortOrder: 'asc',         // Optional: 'asc' or 'desc'
  limit: 5                  // Optional: limit results
});

// Search by Steam ID
const userBySteamId = await client.leaderboards.searchUserBySteamId('76561198123456789');

// Fast and efficient rank lookup (avoids pagination)
const efficientRank = await client.leaderboards.findUserRankEfficient('username');
// Returns: { globalRank, countryRank, regionRank, country, region, username, steamId }

// Get comprehensive ranking information
const completeRanking = await client.leaderboards.getUserCompleteRanking('username');
// Returns global, country, and region ranks with region name
```

#### Regional Context
```typescript
// Get user's regional positioning context
const regionalContext = await client.leaderboards.getUserRegionalContext('username');
// Returns detailed information about user's standings in their country and region
// including top players in country/region and total player counts

// Or use the combined API for more convenience
const context = await client.combined.getRegionalContext('username');
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

// Get trending scenarios
const trending = await client.scenarios.getTrending();

// Get user scenario scores
const scores = await client.scenarios.getUserScores('username', {
  page: 1,
  max: 10,
  sortParam: ['count']
});
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
// Returns comprehensive profile including rankings, Steam info and metadata
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
} from 'kovaaks-api-wrapper/utils';

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
} from 'kovaaks-api-wrapper/utils';

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
git clone https://github.com/yourusername/kovaaks-api-wrapper.git
cd kovaaks-api-wrapper
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
