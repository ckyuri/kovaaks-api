import KovaaksClient from '../src';
import { writeFileSync } from 'fs';

// Initialize the client with default options
const kovaaksAPI = new KovaaksClient({
  enableCaching: true, // Improves performance for repeated queries
  // Optional: Custom configuration
  // baseURL: 'https://api.kovaaks.com',
  // timeout: 10000,
});

// Helper functions for pretty output
const hr = () => console.log('--------------------------------------------------');
const section = (title: string) => {
  console.log('\n==================================================');
  console.log(`   ${title}`);
  console.log('==================================================');
};

// Save results to JSON file for further inspection
const saveToFile = (data: any, filename: string) => {
  try {
    writeFileSync(`./examples/output/${filename}.json`, JSON.stringify(data, null, 2));
    console.log(`✅ Data saved to examples/output/${filename}.json`);
  } catch (error) {
    console.error(`❌ Error saving data to file: ${error}`);
  }
};

/**
 * Comprehensive demonstration of the Kovaaks API Wrapper
 * This example shows all the main features and how to use them effectively
 */
async function demonstrateAPIWrapper() {
  try {
    console.log('🎯 KOVAAKS API WRAPPER DEMONSTRATION 🎯\n');
    console.log('This example will walk through all the major features of the API wrapper.');
    console.log('Each section demonstrates different endpoints and use cases.\n');

    // =====================================================================
    // SECTION 1: GLOBAL LEADERBOARDS
    // =====================================================================
    section('1️⃣ GLOBAL LEADERBOARDS');
    
    try {
      console.log('Fetching global leaderboard (top 10 players)...');
      
      // NOTE: Global leaderboard uses 0-indexed pagination (unlike other endpoints)
      const globalLeaderboard = await kovaaksAPI.leaderboards.getGlobalLeaderboard({
        page: 0, // First page (0-indexed!)
        max: 10, // Number of results per page
      });
      
      console.log(`Found ${globalLeaderboard.total} players in the global leaderboard`);
      console.log('Top 10 Players:');
      
      globalLeaderboard.data.forEach((player, index) => {
        console.log(`  ${index + 1}. ${player.steamAccountName || 'Unknown'} (${player.country || '??'}) - Rank: ${player.rank}`);
      });
      
      // Save data for further inspection
      saveToFile(globalLeaderboard, 'global_leaderboard');
      
      // Demonstrate country filtering
      console.log('\nFetching players from a specific country (US)...');
      const usLeaderboard = await kovaaksAPI.leaderboards.getGlobalLeaderboard({
        page: 0,
        max: 100,
        country: 'US'
      });
      
      console.log('Top 5 US Players:');
      usLeaderboard.data.forEach((player, index) => {
        console.log(`  ${index + 1}. ${player.steamAccountName || 'Unknown'} - Rank: ${player.rank}`);
      });
    } catch (error) {
      console.error('❌ Error fetching global leaderboard:', error);
    }
    
    hr();
    
    // =====================================================================
    // SECTION 2: REGIONAL RANKINGS
    // =====================================================================
    section('2️⃣ REGIONAL RANKINGS');
    
    try {
      // Country leaderboard (ranked by total points)
      console.log('Fetching country leaderboard...');
      const countryLeaderboard = await kovaaksAPI.leaderboards.getCountryLeaderboard({
        page: 1, // Note: 1-indexed pagination (unlike global leaderboard)
        max: 5,
      });
      
      console.log('Top 5 Countries by Points:');
      countryLeaderboard.data.forEach((country, index) => {
        console.log(`  ${index + 1}. ${country.group} - ${country.points.toLocaleString()} points (${country.completions_count || 0} completions)`);
      });
      
      // Region leaderboard
      console.log('\nFetching region leaderboard...');
      const regionLeaderboard = await kovaaksAPI.leaderboards.getRegionLeaderboard({
        page: 1, // 1-indexed pagination
        max: 5,
      });
      
      console.log('Top 5 Regions by Points:');
      regionLeaderboard.data.forEach((region, index) => {
        console.log(`  ${index + 1}. ${region.group} - ${region.points.toLocaleString()} points`);
      });
    } catch (error) {
      console.error('❌ Error fetching regional rankings:', error);
    }
    
    hr();
    
    // =====================================================================
    // SECTION 3: USER SEARCH & LOOKUP
    // =====================================================================
    section('3️⃣ USER SEARCH & LOOKUP');
    
    // Define search parameters - feel free to modify these
    const usernameToSearch = 'xrageblaze@gmail.com';
    const steamIdToSearch = '76561197977736539'; // Known Steam ID for reliable lookup
    
    try {
      // Search by username
      console.log(`Searching for user by username: "${usernameToSearch}"...`);
      
      const userSearchResults = await kovaaksAPI.leaderboards.searchUserByUsername(
        usernameToSearch, 
        {
          sortBy: 'rank',
          sortOrder: 'asc', // Show highest ranks first
          onlyRanked: false, // Include unranked players
        }
      );
      
      if (userSearchResults && userSearchResults.length > 0) {
        console.log(`Found ${userSearchResults.length} results for "${usernameToSearch}"`);
        console.log('Top 3 matches:');
        
        userSearchResults.slice(0, 3).forEach((user, index) => {
          console.log(`  ${index + 1}. ${user.username || user.steamAccountName || 'Unknown'}`);
          console.log(`     Global Rank: ${user.rank || 'Unranked'}`);
          console.log(`     Country: ${user.country || 'Unknown'}`);
          console.log(`     Steam ID: ${user.steamId || 'Unknown'}`);
        });
        
        // Save search results
        saveToFile(userSearchResults, 'username_search');
      } else {
        console.log(`No results found for username "${usernameToSearch}"`);
      }
      
      // Search by Steam ID
      console.log(`\nSearching for user by Steam ID: ${steamIdToSearch}...`);
      
      try {
        // Note: API requires a username even when searching by Steam ID
        const steamIdUser = await kovaaksAPI.leaderboards.searchUserBySteamId(
          steamIdToSearch,
          usernameToSearch // Provide a username to satisfy API requirements
        );
        
        if (steamIdUser) {
          console.log('Found user by Steam ID:');
          console.log(`  Username: ${steamIdUser.username || steamIdUser.steamAccountName || 'Unknown'}`);
          console.log(`  Global Rank: ${steamIdUser.rank || 'Unranked'}`);
          console.log(`  Country: ${steamIdUser.country || 'Unknown'}`);
          console.log(`  Steam ID: ${steamIdUser.steamId || 'Unknown'}`);
          
          // Remember username for later use
          const usernameFromSteamId = steamIdUser.username || 
                                    steamIdUser.steamAccountName || 
                                    usernameToSearch;
          
          // Get user's complete profile
          console.log('\nFetching complete user profile...');
          const completeProfile = await kovaaksAPI.combined.getCompleteProfile(usernameFromSteamId);
          
          if (completeProfile) {
            console.log('Complete profile information:');
            console.log(`  Player ID: ${completeProfile.playerId}`);
            console.log(`  Steam ID: ${completeProfile.steamId || 'Unknown'}`);
            console.log(`  Country: ${completeProfile.country || 'Unknown'}`);
            console.log(`  Kovaak's+: ${completeProfile.kovaaksPlusActive ? 'Active' : 'Inactive'}`);
            console.log(`  Scenarios Played: ${completeProfile.scenariosPlayed || 0}`);
            
            if (completeProfile.rankings) {
              console.log('  Rankings:');
              console.log(`    Global: ${completeProfile.rankings.global || 'Unranked'}`);
              console.log(`    Country: ${completeProfile.rankings.country || 'Unranked'} (${completeProfile.rankings.countryName || 'Unknown'})`);
              console.log(`    Region: ${completeProfile.rankings.region || 'Unranked'} (${completeProfile.rankings.regionName || 'Unknown'})`);
            }
            
            // Save profile data
            saveToFile(completeProfile, 'complete_profile');
          } else {
            console.log(`Could not retrieve complete profile for "${usernameFromSteamId}"`);
          }
          
          // Get regional context
          console.log('\nFetching user regional context...');
          const regionalContext = await kovaaksAPI.leaderboards.getUserRegionalContext(usernameFromSteamId);
          
          if (regionalContext) {
            console.log('User regional positioning:');
            console.log(`  Country: ${regionalContext.playerRanking.countryName || 'Unknown'}`);
            console.log(`  Country Rank: ${regionalContext.playerRanking.country || 'Unranked'}`);
            console.log(`  Region: ${regionalContext.playerRanking.regionName || 'Unknown'}`);
            console.log(`  Region Rank: ${regionalContext.playerRanking.region || 'Unranked'}`);
            
            // More detailed country information
            if (regionalContext.countryContext.countryName) {
              console.log(`\n  ${regionalContext.countryContext.countryName} statistics:`);
              console.log(`    Global Rank: ${regionalContext.countryContext.globalRank || 'Unranked'}`);
              console.log(`    Total Players: ${regionalContext.countryContext.totalPlayers.toLocaleString()}`);
            }
            
            // More detailed region information
            if (regionalContext.regionContext.regionName) {
              console.log(`\n  ${regionalContext.regionContext.regionName} statistics:`);
              console.log(`    Global Rank: ${regionalContext.regionContext.globalRank || 'Unranked'}`);
              console.log(`    Total Players: ${regionalContext.regionContext.totalPlayers.toLocaleString()}`);
            }
            
            // Save regional context
            saveToFile(regionalContext, 'regional_context');
          } else {
            console.log(`Could not retrieve regional context for "${usernameFromSteamId}"`);
          }
        } else {
          console.log(`No user found with Steam ID ${steamIdToSearch}`);
        }
      } catch (steamIdError) {
        console.error('❌ Error searching by Steam ID:', steamIdError);
        console.log('Falling back to username search for further examples...');
      }
    } catch (error) {
      console.error('❌ Error in user search section:', error);
    }
    
    hr();
    
    // =====================================================================
    // SECTION 4: SCENARIO PERFORMANCE
    // =====================================================================
    section('4️⃣ SCENARIO PERFORMANCE');
    
    try {
      // Let's use the username we found earlier or fall back to our original search
      const username = usernameToSearch;
      
      console.log(`Fetching scenario performance for "${username}"...`);
      const scenarioPerformance = await kovaaksAPI.combined.getScenarioPerformance(username);
      
      if (scenarioPerformance && scenarioPerformance.scenarioDetails.length > 0) {
        console.log(`Found ${scenarioPerformance.totalScenarios} scenarios played by ${username}`);
        console.log('Top 5 scenarios by plays:');
        
        // Sort by number of plays
        const sortedScenarios = [...scenarioPerformance.scenarioDetails]
          .sort((a, b) => b.plays - a.plays)
          .slice(0, 5);
        
        sortedScenarios.forEach((scenario, index) => {
          console.log(`  ${index + 1}. ${scenario.scenarioName}`);
          console.log(`     Plays: ${scenario.plays}`);
          console.log(`     Best Score: ${scenario.bestScore}`);
          console.log(`     Rank: ${scenario.rank || 'Unranked'}`);
          console.log(`     Aim Type: ${scenario.metadata.aimType || 'Unknown'}`);
          if (scenario.metadata.authors && scenario.metadata.authors.length > 0) {
            const author = scenario.metadata.authors[0] as any;
            console.log(`     Author: ${author && typeof author === 'object' ? author.username || 'Unknown' : 'Unknown'}`);
          }
        });
        
        // Save scenario data
        saveToFile(scenarioPerformance, 'scenario_performance');
      } else {
        console.log(`No scenario performance data found for "${username}"`);
      }
      
      // Get popular scenarios
      console.log('\nFetching popular scenarios...');
      const popularScenarios = await kovaaksAPI.scenarios.getPopularScenarios({
        page: 1, // 1-indexed pagination
        max: 5,
      });
      
      if (popularScenarios && popularScenarios.data.length > 0) {
        console.log('Top 5 popular scenarios:');
        popularScenarios.data.forEach((scenario, index) => {
          console.log(`  ${index + 1}. ${scenario.scenarioName}`);
          console.log(`     Plays: ${scenario.counts?.plays || 0}`);
          console.log(`     Entries: ${scenario.counts?.entries || 0}`);
        });
      } else {
        console.log('Could not retrieve popular scenarios');
      }
      
      // Get trending scenarios
      console.log('\nFetching trending scenarios...');
      const trendingScenarios = await kovaaksAPI.scenarios.getTrendingScenarios();
      
      if (trendingScenarios && trendingScenarios.length > 0) {
        console.log('Top 5 trending scenarios:');
        trendingScenarios.slice(0, 5).forEach((scenario, index) => {
          console.log(`  ${index + 1}. ${scenario.scenarioName}`);
        });
      } else {
        console.log('Could not retrieve trending scenarios');
      }
    } catch (error) {
      console.error('❌ Error in scenario performance section:', error);
    }
    
    hr();
    
    // =====================================================================
    // SECTION 5: BENCHMARK PROGRESS
    // =====================================================================
    section('5️⃣ BENCHMARK PROGRESS');
    
    try {
      // Use our known username
      const username = usernameToSearch;
      
      console.log(`Finding benchmark progress for "${username}" using helper method...`);
      console.log('(This automatically locates the Steam ID and benchmark ID for you)');
      
      const benchmarkProgress = await kovaaksAPI.combined.findBenchmarkProgress(username);
      
      if (benchmarkProgress) {
        console.log('Benchmark progress found:');
        console.log(`  Overall Progress: ${(benchmarkProgress.overallProgress * 100).toFixed(2)}%`);
        console.log(`  Overall Rank: ${benchmarkProgress.overallRank || 'Not ranked'}`);
        
        // Show categories
        if (benchmarkProgress.categories && Object.keys(benchmarkProgress.categories).length > 0) {
          console.log('\nCategories:');
          Object.entries(benchmarkProgress.categories).forEach(([categoryName, category]) => {
            console.log(`  ${categoryName}:`);
            console.log(`    Progress: ${(category.progress * 100).toFixed(2)}%`);
            console.log(`    Rank: ${category.rank || 'Not ranked'}`);
            
            // Show top 3 scenarios in this category if available
            if (category.scenarios && Object.keys(category.scenarios).length > 0) {
              console.log('    Top scenarios:');
              Object.entries(category.scenarios)
                .slice(0, 3)
                .forEach(([scenarioName, scenario]) => {
                  console.log(`      ${scenarioName} - Score: ${scenario.score}`);
                });
            }
          });
        }
        
        // Save benchmark data
        saveToFile(benchmarkProgress, 'benchmark_progress');
      } else {
        console.log(`No benchmark progress found for "${username}"`);
        
        // Search for benchmarks the user has participated in
        console.log('\nSearching for benchmarks user has participated in...');
        const benchmarkSearch = await kovaaksAPI.benchmarks.searchPlayerBenchmarks(username);
        
        if (benchmarkSearch && benchmarkSearch.data && benchmarkSearch.data.length > 0) {
          console.log(`Found ${benchmarkSearch.data.length} benchmarks:`);
          benchmarkSearch.data.slice(0, 3).forEach((benchmark, index) => {
            console.log(`  ${index + 1}. ${benchmark.benchmarkName || 'Unknown'} (ID: ${benchmark.benchmarkId})`);
          });
        } else {
          console.log(`No benchmarks found for "${username}"`);
        }
      }
    } catch (error) {
      console.error('❌ Error in benchmark progress section:', error);
    }
    
    hr();
    
    // =====================================================================
    // SECTION 6: USER ACTIVITY TIMELINE
    // =====================================================================
    section('6️⃣ USER ACTIVITY TIMELINE');
    
    try {
      // Use our known username
      const username = usernameToSearch;
      
      console.log(`Fetching activity timeline for "${username}"...`);
      
      // First get a basic activity timeline
      const basicTimeline = await kovaaksAPI.combined.getActivityTimeline(username, {
        limit: 50, // Get more activities to demonstrate filtering
        includeMetadata: true // Include metadata for stats
      });
      
      if (basicTimeline && basicTimeline.activities.length > 0) {
        console.log(`Found ${basicTimeline.totalActivities} recent activities`);
        
        // Show metadata if available
        if (basicTimeline.metadata) {
          const meta = basicTimeline.metadata;
          console.log('\nActivity Statistics:');
          console.log(`  Date Range: ${new Date(meta.dateRange.earliest).toLocaleDateString()} to ${new Date(meta.dateRange.latest).toLocaleDateString()}`);
          console.log(`  Score Range: ${meta.scoreRange.min.toFixed(1)} to ${meta.scoreRange.max.toFixed(1)}`);
          console.log(`  Unique Scenarios: ${meta.uniqueScenarios.length}`);
          console.log(`  Aim Types: ${meta.uniqueAimTypes.join(', ') || 'None detected'}`);
        }
        
        console.log('\nMost recent activities:');
        
        basicTimeline.activities.slice(0, 5).forEach((activity, index) => {
          // Format the date nicely
          const date = new Date(activity.timestamp);
          const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
          
          console.log(`  ${index + 1}. ${activity.scenarioName}`);
          console.log(`     Score: ${activity.score}`);
          console.log(`     Date: ${formattedDate}`);
          
          // Show scenario details if available
          if (activity.scenarioDetails) {
            if (activity.scenarioDetails.aimType) {
              console.log(`     Aim Type: ${activity.scenarioDetails.aimType}`);
            }
            if (activity.scenarioDetails.popularity) {
              console.log(`     Popularity: ${activity.scenarioDetails.popularity.toLocaleString()} plays`);
            }
          }
        });
        
        // Demonstrate filtering and sorting capabilities
        console.log('\nDemonstrating filtering and sorting capabilities:');
        
        // Filter by date range (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        console.log('\n1. Filtering by date range (last 30 days):');
        const recentActivities = await kovaaksAPI.combined.getActivityTimeline(username, {
          startDate: thirtyDaysAgo,
          sortBy: 'date',
          sortOrder: 'desc',
          limit: 5
        });
        
        if (recentActivities && recentActivities.activities.length > 0) {
          console.log(`  Found ${recentActivities.totalActivities} activities in the last 30 days`);
          recentActivities.activities.slice(0, 3).forEach((activity, index) => {
            console.log(`  ${index + 1}. ${activity.scenarioName} - ${new Date(activity.timestamp).toLocaleDateString()}`);
          });
        } else {
          console.log('  No activities found in the last 30 days');
        }
        
        // Filter by scenario name
        console.log('\n2. Filtering by scenario name (containing "1wall"):');
        const scenarioFiltered = await kovaaksAPI.combined.getActivityTimeline(username, {
          scenarioFilter: '1wall',
          sortBy: 'score',
          sortOrder: 'desc', // Highest scores first
          limit: 10
        });
        
        if (scenarioFiltered && scenarioFiltered.activities.length > 0) {
          console.log(`  Found ${scenarioFiltered.totalActivities} activities for scenarios containing "1wall"`);
          console.log('  Top 3 scores:');
          scenarioFiltered.activities.slice(0, 3).forEach((activity, index) => {
            console.log(`  ${index + 1}. ${activity.scenarioName} - Score: ${activity.score}`);
          });
        } else {
          console.log('  No matching scenarios found');
        }
        
        // Filter by aim type (if available)
        if (basicTimeline.metadata && basicTimeline.metadata.uniqueAimTypes.length > 0) {
          const aimTypeToFilter = basicTimeline.metadata.uniqueAimTypes[0];
          console.log(`\n3. Filtering by aim type (${aimTypeToFilter}):`);
          
          const aimTypeFiltered = await kovaaksAPI.combined.getActivityTimeline(username, {
            aimType: aimTypeToFilter,
            sortBy: 'date',
            sortOrder: 'desc',
            limit: 10
          });
          
          if (aimTypeFiltered && aimTypeFiltered.activities.length > 0) {
            console.log(`  Found ${aimTypeFiltered.totalActivities} ${aimTypeToFilter} activities`);
            aimTypeFiltered.activities.slice(0, 3).forEach((activity, index) => {
              console.log(`  ${index + 1}. ${activity.scenarioName} - Score: ${activity.score}`);
            });
          }
        }
        
        // Group by scenario to track progress
        console.log('\n4. Tracking progress by grouping activities by scenario:');
        const groupedActivities = await kovaaksAPI.combined.getActivityTimeline(username, {
          groupByScenario: true,
          limit: 30,
          sortBy: 'date',
          sortOrder: 'asc' // Oldest first to see progression
        });
        
        if (groupedActivities && groupedActivities.activities.length > 0) {
          // Get unique scenario names to show progression
          const uniqueScenarios = new Set(groupedActivities.activities.map(a => a.scenarioName));
          
          // Take one scenario as an example to show progression
          if (uniqueScenarios.size > 0) {
            const exampleScenario = Array.from(uniqueScenarios)[0];
            const scenarioActivities = groupedActivities.activities.filter(
              a => a.scenarioName === exampleScenario
            );
            
            if (scenarioActivities.length >= 2) {
              console.log(`  Progress for "${exampleScenario}":`);
              
              // Show first play
              const firstPlay = scenarioActivities[0];
              const lastPlay = scenarioActivities[scenarioActivities.length - 1];
              
              if (firstPlay && lastPlay) {
                console.log(`  First play: Score ${firstPlay.score} on ${new Date(firstPlay.timestamp).toLocaleDateString()}`);
                console.log(`  Latest play: Score ${lastPlay.score} on ${new Date(lastPlay.timestamp).toLocaleDateString()}`);
                
                // Calculate improvement
                const improvement = ((lastPlay.score - firstPlay.score) / firstPlay.score) * 100;
                console.log(`  Improvement: ${improvement.toFixed(2)}%`);
              }
            }
          }
        }
        
        // Save activity data
        saveToFile(basicTimeline, 'activity_timeline');
      } else {
        console.log(`No activity timeline found for "${username}"`);
      }
    } catch (error) {
      console.error('❌ Error in activity timeline section:', error);
    }
    
    hr();
    
    // =====================================================================
    // SECTION 7: COMPREHENSIVE USER DATA
    // =====================================================================
    section('7️⃣ COMPREHENSIVE USER DATA');
    
    try {
      // Use our known username
      const username = usernameToSearch;
      
      console.log(`Retrieving ALL available data for "${username}" in a single call...`);
      console.log('This combines data from multiple endpoints in parallel for maximum efficiency.');
      
      const allUserData = await kovaaksAPI.combined.getAllUserData(username, {
        forceRefresh: false,
        includeScenarioDetails: true,
        includeActivityLimit: 20,
        includeBenchmarkDetails: true,
        includeAllBenchmarks: true, // Get all benchmarks the user has participated in
        includeMonthlyStats: true, // Include monthly player statistics
        includeGameSettings: true, // Include game settings data
        includeScenarioHistory: true, // Include detailed scenario history
        includeTrendingScenarios: true, // Include trending scenarios
        includePopularScenarios: true, // Include popular scenarios
        includeSystemStats: true, // Include system performance data
        includeAuthStatus: true, // Check authentication status
        maxPaginationDepth: 2, // Fetch up to 2 pages of paginated data
        compareWithTopPlayers: true, // Compare with top players
        compareWithSimilarPlayers: true, // Compare with similar rank players
        includeComparisonLimit: 5, // Number of players to compare with
        skipAuthRequiredCalls: true // Skip endpoints that require authentication to avoid errors
      });
      
      console.log('\nNOTE: Some API endpoints require authentication. Without login credentials:');
      console.log('- Auth status will always show as "Not Authenticated"');
      console.log('- Certain profile-specific data might be limited');
      console.log('- To access all features, use kovaaksAPI.auth.login() with valid credentials first');
      
      console.log('\nData retrieval summary:');
      console.log(`  Profile: ${allUserData.profile ? '✅' : '❌'}`);
      console.log(`  Scenario Performance: ${allUserData.scenarioPerformance ? '✅' : '❌'}`);
      console.log(`  Benchmark Progress: ${allUserData.benchmarkProgress ? '✅' : '❌'}`);
      console.log(`  All Benchmarks: ${allUserData.allBenchmarks && allUserData.allBenchmarks.length > 0 ? `✅ (${allUserData.allBenchmarks.length} found)` : '❌'}`);
      console.log(`  Activity Timeline: ${allUserData.activityTimeline ? '✅' : '❌'}`);
      console.log(`  Regional Context: ${allUserData.regionalContext ? '✅' : '❌'}`);
      console.log(`  Social/Community Data: ${allUserData.followData || allUserData.socialMedia ? '✅' : '❌'}`);
      console.log(`  Additional Metadata: ${allUserData.badges || allUserData.kovaaksPlusDetails || allUserData.peripherals ? '✅' : '❌'}`);
      console.log(`  Monthly Stats: ${allUserData.monthlyActiveUsers ? '✅' : '❌'}`);
      console.log(`  Game Settings: ${allUserData.gameSettingsGlobal ? '✅' : '❌'}`);
      console.log(`  User Game Settings: ${allUserData.userGameSettings ? '✅' : '❌'}`);
      console.log(`  Trending Scenarios: ${allUserData.trendingScenarios ? '✅' : '❌'}`);
      console.log(`  Popular Scenarios: ${allUserData.popularScenarios ? '✅' : '❌'}`);
      console.log(`  System Stats: ${allUserData.systemStats ? '✅' : '❌'}`);
      console.log(`  Auth Status: ${allUserData.authStatus ? '✅' : '❌'}`);
      console.log(`  Top Player Comparisons: ${allUserData.topPlayerComparisons ? '✅' : '❌'}`);
      console.log(`  Similar Rank Comparisons: ${allUserData.similarRankComparisons ? '✅' : '❌'}`);
      console.log(`  Percentiles: ${allUserData.globalPercentile !== undefined ? '✅' : '❌'}`);
      console.log(`  Rank History: ${allUserData.rankHistory ? '✅' : '❌'}`);
      
      // Show a comprehensive summary of the user
      if (allUserData.profile) {
        console.log('\nUser Summary:');
        console.log(`  Username: ${allUserData.profile.username}`);
        console.log(`  Player ID: ${allUserData.profile.playerId}`);
        console.log(`  Steam ID: ${allUserData.profile.steamId || 'Unknown'}`);
        console.log(`  Country: ${allUserData.profile.country || 'Unknown'}`);
        
        // Show social information if available
        if (allUserData.followData) {
          console.log(`  Community: ${allUserData.followData.followers || 0} followers, following ${allUserData.followData.following || 0}`);
        }
        
        // Show subscription status
        console.log(`  Kovaak's+: ${allUserData.kovaaksPlusDetails?.active || allUserData.profile.kovaaksPlusActive ? 'Active' : 'Inactive'}`);
        if (allUserData.kovaaksPlusDetails?.expiration) {
          console.log(`    Expires: ${new Date(allUserData.kovaaksPlusDetails.expiration).toLocaleDateString()}`);
        }
        
        // Show badges if available
        if (allUserData.badges && allUserData.badges.length > 0) {
          console.log('  Badges:');
          allUserData.badges.slice(0, 3).forEach((badge: any) => {
            console.log(`    • ${badge.name || badge.type || 'Unknown badge'}`);
          });
          if (allUserData.badges.length > 3) {
            console.log(`    • ... and ${allUserData.badges.length - 3} more`);
          }
        }
        
        if (allUserData.profile.rankings) {
          console.log('  Rankings:');
          console.log(`    Global: ${allUserData.profile.rankings.global || 'Unranked'}`);
          console.log(`    Country: ${allUserData.profile.rankings.country || 'Unranked'}`);
          console.log(`    Region: ${allUserData.profile.rankings.region || 'Unranked'}`);
          
          // Display rank changes if available
          if (allUserData.profile.rankings.rankChanges) {
            const changes = allUserData.profile.rankings.rankChanges;
            console.log('  Rank Changes:');
            console.log(`    Global: ${changes.global > 0 ? '▼' : '▲'} ${Math.abs(changes.global || 0)}`);
            console.log(`    Country: ${changes.country > 0 ? '▼' : '▲'} ${Math.abs(changes.country || 0)}`);
            console.log(`    Region: ${changes.region > 0 ? '▼' : '▲'} ${Math.abs(changes.region || 0)}`);
          }
          
          // Show full rank history if available
          if (allUserData.rankHistory) {
            console.log('  Rank History:');
            
            if (allUserData.rankHistory.global && allUserData.rankHistory.global.length > 0) {
              console.log('    Global Rank History:');
              allUserData.rankHistory.global.forEach(entry => {
                console.log(`      ${entry.date}: ${entry.rank}`);
              });
            }
            
            if (allUserData.rankHistory.country && allUserData.rankHistory.country.length > 0) {
              console.log('    Country Rank History:');
              allUserData.rankHistory.country.forEach(entry => {
                console.log(`      ${entry.date}: ${entry.rank}`);
              });
            }
          }
        }
        
        // Show percentiles if available
        if (allUserData.globalPercentile !== undefined || 
            allUserData.countryPercentile !== undefined || 
            allUserData.regionPercentile !== undefined) {
          console.log('  Percentiles:');
          if (allUserData.globalPercentile !== undefined) {
            console.log(`    Global: ${allUserData.globalPercentile.toFixed(2)}%`);
          }
          if (allUserData.countryPercentile !== undefined) {
            console.log(`    Country: ${allUserData.countryPercentile.toFixed(2)}%`);
          }
          if (allUserData.regionPercentile !== undefined) {
            console.log(`    Region: ${allUserData.regionPercentile.toFixed(2)}%`);
          }
        }
        
        // Show scenario percentiles if available
        if (allUserData.scenarioPercentiles && Object.keys(allUserData.scenarioPercentiles).length > 0) {
          console.log('  Scenario Percentiles:');
          Object.entries(allUserData.scenarioPercentiles)
            .sort(([_, a], [__, b]) => b - a) // Sort by percentile value, highest first
            .slice(0, 3) // Show top 3
            .forEach(([scenario, percentile]) => {
              console.log(`    ${scenario}: ${percentile.toFixed(2)}%`);
            });
        }
        
        if (allUserData.regionalContext?.playerRanking) {
          const ranking = allUserData.regionalContext.playerRanking;
          console.log('  Regional Context:');
          console.log(`    Country: ${ranking.countryName || 'Unknown'} (Rank: ${ranking.country || 'Unranked'})`);
          console.log(`    Region: ${ranking.regionName || 'Unknown'} (Rank: ${ranking.region || 'Unranked'})`);
        }
        
        // Show system stats if available
        if (allUserData.systemStats) {
          console.log('\nSystem Performance:');
          if (allUserData.systemStats.averageFps) {
            console.log(`  Average FPS: ${allUserData.systemStats.averageFps.toFixed(2)}`);
          }
          if (allUserData.systemStats.resolutions && allUserData.systemStats.resolutions.length > 0) {
            console.log(`  Resolutions Used: ${allUserData.systemStats.resolutions.join(', ')}`);
          }
          if (allUserData.systemStats.hardwareInfo) {
            console.log('  Hardware Info:');
            const hardware = allUserData.systemStats.hardwareInfo;
            
            // Display some key hardware information if available
            const hardwareDisplayMap: Record<string, string> = {
              'gpu': 'GPU',
              'cpu': 'CPU',
              'ram': 'RAM',
              'os': 'Operating System'
            };
            
            Object.entries(hardwareDisplayMap).forEach(([key, label]) => {
              if (hardware[key]) {
                console.log(`    ${label}: ${hardware[key]}`);
              }
            });
          }
        }
        
        // Show scenario statistics if available
        if (allUserData.scenarioPerformance) {
          console.log('\nScenario Statistics:');
          console.log(`  Total Scenarios Played: ${allUserData.scenarioPerformance.totalScenarios}`);
          
          if (allUserData.scenarioPerformance.scenarioDetails.length > 0) {
            // Find the scenario with the highest rank
            const bestRankedScenario = [...allUserData.scenarioPerformance.scenarioDetails]
              .filter(s => s.rank !== null && s.rank !== undefined)
              .sort((a, b) => (a.rank || 999999) - (b.rank || 999999))[0];
              
            if (bestRankedScenario) {
              console.log('  Best Ranked Scenario:');
              console.log(`    ${bestRankedScenario.scenarioName} - Rank: ${bestRankedScenario.rank}`);
            }
            
            // Find the most played scenario
            const mostPlayedScenario = [...allUserData.scenarioPerformance.scenarioDetails]
              .sort((a, b) => b.plays - a.plays)[0];
              
            if (mostPlayedScenario) {
              console.log('  Most Played Scenario:');
              console.log(`    ${mostPlayedScenario.scenarioName} - ${mostPlayedScenario.plays} plays`);
            }
          }
        }
        
        // Show trending scenarios if available
        if (allUserData.trendingScenarios && allUserData.trendingScenarios.length > 0) {
          console.log('\nTrending Scenarios:');
          allUserData.trendingScenarios.slice(0, 3).forEach((scenario: any, index: number) => {
            console.log(`  ${index + 1}. ${scenario.scenarioName}`);
          });
        }
        
        // Show popular scenarios if available
        if (allUserData.popularScenarios && allUserData.popularScenarios.length > 0) {
          console.log('\nPopular Scenarios:');
          allUserData.popularScenarios.slice(0, 3).forEach((scenario: any, index: number) => {
            console.log(`  ${index + 1}. ${scenario.scenarioName} - ${scenario.counts?.plays || 0} plays`);
          });
        }
        
        // Show benchmark progress if available
        if (allUserData.benchmarkProgress) {
          console.log('\nBenchmark Progress:');
          console.log(`  Overall Progress: ${(allUserData.benchmarkProgress.overallProgress * 100).toFixed(2)}%`);
          console.log(`  Overall Rank: ${allUserData.benchmarkProgress.overallRank || 'Not ranked'}`);
          
          // Count completed categories
          if (allUserData.benchmarkProgress.categories) {
            const categories = Object.entries(allUserData.benchmarkProgress.categories);
            const completedCategories = categories.filter(([_, cat]) => cat.progress >= 0.9).length;
            
            console.log(`  Categories: ${completedCategories} completed of ${categories.length} total`);
          }
        }
        
        // Show player comparisons if available
        if (allUserData.topPlayerComparisons && allUserData.topPlayerComparisons.length > 0) {
          console.log('\nTop Player Comparisons:');
          allUserData.topPlayerComparisons.slice(0, 3).forEach((player: any, index: number) => {
            console.log(`  ${index + 1}. ${player.username} - Rank #${player.rank}`);
            console.log(`     Points: ${player.points.toLocaleString()}`);
            console.log(`     Difference: ${player.pointsDifference > 0 ? '+' : ''}${player.pointsDifference.toLocaleString()} points`);
            if (player.percentageDifference !== null) {
              console.log(`     Percentage: ${player.percentageDifference > 0 ? '+' : ''}${player.percentageDifference.toFixed(2)}%`);
            }
          });
        }
        
        if (allUserData.similarRankComparisons && allUserData.similarRankComparisons.length > 0) {
          console.log('\nSimilar Rank Comparisons:');
          allUserData.similarRankComparisons.slice(0, 3).forEach((player: any, index: number) => {
            console.log(`  ${index + 1}. ${player.username} - Rank #${player.rank}`);
            console.log(`     Rank Difference: ${player.rankDifference > 0 ? '+' : ''}${player.rankDifference}`);
            console.log(`     Points: ${player.points.toLocaleString()}`);
            console.log(`     Point Difference: ${player.pointsDifference > 0 ? '+' : ''}${player.pointsDifference.toLocaleString()}`);
          });
        }
        
        // Show all benchmarks if available
        if (allUserData.allBenchmarks && allUserData.allBenchmarks.length > 0) {
          console.log('\nAll Benchmarks:');
          console.log(`  Participated in ${allUserData.allBenchmarks.length} benchmarks`);
          
          // Show the first few benchmarks
          allUserData.allBenchmarks.slice(0, 3).forEach((benchmark: any, index: number) => {
            console.log(`  ${index + 1}. ${benchmark.benchmarkName || 'Unknown'}`);
            if (benchmark.rankName) {
              console.log(`     Rank: ${benchmark.rankName}`);
            }
          });
          
          if (allUserData.allBenchmarks.length > 3) {
            console.log(`  ... and ${allUserData.allBenchmarks.length - 3} more benchmarks`);
          }
        }
        
        // Show gaming peripherals/setup if available
        if (allUserData.peripherals && Object.keys(allUserData.peripherals).length > 0) {
          console.log('\nGaming Setup:');
          const peripherals = allUserData.peripherals;
          
          const setupItems = [
            { key: 'mouse', label: 'Mouse' },
            { key: 'keyboard', label: 'Keyboard' },
            { key: 'mousepad', label: 'Mousepad' },
            { key: 'monitor', label: 'Monitor' },
            { key: 'headset', label: 'Headset' }
          ];
          
          setupItems.forEach(item => {
            if (peripherals[item.key]) {
              console.log(`  ${item.label}: ${peripherals[item.key]}`);
            }
          });
        }
        
        // Show recent activity if available
        if (allUserData.activityTimeline && allUserData.activityTimeline.activities.length > 0) {
          console.log('\nRecent Activity:');
          allUserData.activityTimeline.activities.slice(0, 3).forEach((activity, index) => {
            const date = new Date(activity.timestamp);
            const formattedDate = `${date.toLocaleDateString()}`;
            
            console.log(`  ${index + 1}. ${activity.scenarioName} - Score: ${activity.score} (${formattedDate})`);
          });
        }
        
        // Show monthly players if available
        if (allUserData.monthlyActiveUsers) {
          console.log(`\nMonthly Active Players: ${allUserData.monthlyActiveUsers.toLocaleString()}`);
        }
        
        // Show authentication status if available
        if (allUserData.authStatus) {
          console.log(`\nAuthentication Status: ${allUserData.authStatus.authenticated ? 'Authenticated' : 'Not Authenticated'}`);
          if (allUserData.authStatus.tokenExpiry) {
            console.log(`  Token Expires: ${allUserData.authStatus.tokenExpiry}`);
          }
        }
      }
      
      // Save all user data
      saveToFile(allUserData, 'all_user_data');
    } catch (error) {
      console.error('❌ Error in comprehensive user data section:', error);
    }
    
    hr();
    
    // =====================================================================
    // SECTION 8: GAME SETTINGS
    // =====================================================================
    section('8️⃣ GAME SETTINGS');
    
    try {
      console.log('Fetching game settings data...');
      const gameSettings = await kovaaksAPI.gameSettings.getGameSettings();
      
      if (gameSettings) {
        console.log('Game settings retrieved successfully');
        
        // Show supported games for sensitivity conversion if available
        if (gameSettings.games && Array.isArray(gameSettings.games)) {
          console.log(`\nSupported Games for Sensitivity Conversion (${gameSettings.games.length}):`);
          gameSettings.games.slice(0, 10).forEach((game: any) => {
            console.log(`  • ${game.name || 'Unknown'}`);
          });
          
          if (gameSettings.games.length > 10) {
            console.log(`  • ... and ${gameSettings.games.length - 10} more`);
          }
        }
        
        // Save game settings
        saveToFile(gameSettings, 'game_settings');
      } else {
        console.log('Could not retrieve game settings');
      }
    } catch (error) {
      console.error('❌ Error in game settings section:', error);
    }
    
    // =====================================================================
    // SECTION 8: PERFORMANCE ANALYSIS & USER COMPARISON
    // =====================================================================
    section('8️⃣ PERFORMANCE ANALYSIS & USER COMPARISON');
    
    try {
      // Use our known username
      const username = usernameToSearch;
      console.log(`Analyzing performance trends for "${username}"...`);
      
      // Demonstrate the performance trends feature
      const performanceTrends = await kovaaksAPI.combined.calculatePerformanceTrends(username, {
        forceRefresh: false,
        minSamples: 2, // Require at least 2 samples to show trends
        includeBenchmarkScenarios: true,
        timeRange: {
          // Analyze the last 90 days
          startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        }
      });
      
      if (performanceTrends && performanceTrends.length > 0) {
        console.log(`Found performance trends for ${performanceTrends.length} scenarios`);
        
        // Display a few trends
        const topTrends = performanceTrends.slice(0, 3);
        
        topTrends.forEach((trend, index) => {
          console.log(`\n${index + 1}. ${trend.scenarioName}`);
          console.log(`   Samples: ${trend.scoreHistory.length}`);
          console.log(`   First Score: ${trend.trends.overall.firstScore.toFixed(1)}`);
          console.log(`   Latest Score: ${trend.trends.overall.latestScore.toFixed(1)}`);
          console.log(`   Best Score: ${trend.trends.overall.highestScore.toFixed(1)}`);
          console.log(`   Improvement: ${trend.trends.overall.percentImprovement.toFixed(2)}%`);
          console.log(`   Consistency: ${(trend.trends.consistency * 100).toFixed(2)}% (lower is better)`);
          
          // Show time windows if available
          if (trend.trends.timeWindows.last30Days) {
            console.log(`   Last 30 Days: ${trend.trends.timeWindows.last30Days.percentChange.toFixed(2)}% change`);
          }
          
          console.log(`   Moving Average (last 3): ${trend.trends.movingAverages.last3Scores.toFixed(1)}`);
        });
        
        // Save the trends data
        saveToFile(performanceTrends, 'performance_trends');
      } else {
        console.log(`No performance trends found for "${username}" - need more data samples`);
      }
      
      // Demonstrate the user comparison feature
      console.log('\nComparing users...');
      
      // Use a top player from the global leaderboard for comparison
      let comparisonUsername = '';
      try {
        // Get a top player to compare with
        const topPlayers = await kovaaksAPI.leaderboards.getGlobalLeaderboard({
          page: 0,
          max: 10
        });
        
        if (topPlayers && topPlayers.data && topPlayers.data.length > 0) {
          // Pick a random player from the top 10 to compare with
          const randomIndex = Math.floor(Math.random() * Math.min(topPlayers.data.length, 5));
          const selectedPlayer = topPlayers.data[randomIndex];
          comparisonUsername = selectedPlayer?.steamAccountName || 
                             selectedPlayer?.webappUsername || 
                             'bardoz';
          
          console.log(`Comparing "${username}" with "${comparisonUsername}"...`);
          
          const comparison = await kovaaksAPI.combined.compareUsers(username, comparisonUsername, {
            forceRefresh: false,
            limitToCommonScenarios: true,
            minScenarios: 3,
            includeRecommendations: true,
            fallbackToSimilarRank: true // Enable fallback to a similar rank player if the chosen player can't be found
          });
          
          if (comparison) {
            console.log('\nComparison Results:');
            console.log(`  Common Scenarios: ${comparison.summary.totalScenarioCount}`);
            console.log(`  Scenarios Better: ${comparison.summary.betterScenarios}`);
            console.log(`  Scenarios Worse: ${comparison.summary.worseScenarios}`);
            console.log(`  Similar Scenarios: ${comparison.summary.similarScenarios}`);
            console.log(`  Average Difference: ${comparison.summary.averageScoreDifference.toFixed(2)}%`);
            
            if (comparison.summary.globalRankDifference !== null) {
              console.log(`  Global Rank Difference: ${comparison.summary.globalRankDifference}`);
            }
            
            // Show strengths and weaknesses
            if (comparison.strengthsAndWeaknesses.userStrengths.length > 0) {
              console.log('\n  Strengths:');
              comparison.strengthsAndWeaknesses.userStrengths.slice(0, 3).forEach((scenario, i) => {
                console.log(`    ${i + 1}. ${scenario}`);
              });
            }
            
            if (comparison.strengthsAndWeaknesses.userWeaknesses.length > 0) {
              console.log('\n  Areas for Improvement:');
              comparison.strengthsAndWeaknesses.userWeaknesses.slice(0, 3).forEach((scenario, i) => {
                console.log(`    ${i + 1}. ${scenario}`);
              });
            }
            
            // Show recommendations
            if (comparison.recommendations.length > 0) {
              console.log('\n  Training Recommendations:');
              comparison.recommendations.forEach((rec, i) => {
                console.log(`    ${i + 1}. ${rec}`);
              });
            }
            
            // Save comparison data
            saveToFile(comparison, 'user_comparison');
          } else {
            console.log(`Could not compare users - not enough common scenarios or similar rank players found`);
            
            // Try a different approach - compare with a similar rank player directly
            console.log('\nTrying to compare with a similar rank player instead...');
            
            // Get the user's rank
            const userProfile = await kovaaksAPI.combined.getCompleteProfile(username);
            if (userProfile && userProfile.rankings && userProfile.rankings.global) {
              const userRank = userProfile.rankings.global;
              const rankRange = 100; // Look in a wider range this time
              
              // Get players near the user's rank
              const nearbyPlayers = await kovaaksAPI.leaderboards.getGlobalLeaderboard({
                page: Math.max(0, Math.floor((userRank - rankRange/2) / 100)),
                max: 100
              });
              
              if (nearbyPlayers && nearbyPlayers.data) {
                // Find a player with similar rank that isn't the user
                const similarPlayers = nearbyPlayers.data.filter(player => 
                  player.rank !== userRank &&
                  Math.abs(player.rank - userRank) < rankRange &&
                  player.steamAccountName
                );
                
                if (similarPlayers.length > 0) {
                  // Pick one at random
                  const randomSimilarPlayer = similarPlayers[Math.floor(Math.random() * similarPlayers.length)];
                  if (randomSimilarPlayer) {
                    const similarUsername = randomSimilarPlayer.webappUsername || randomSimilarPlayer.steamAccountName;
                    if (similarUsername) {
                      console.log(`Found similar rank player: ${similarUsername} (Rank: ${randomSimilarPlayer.rank})`);
                      
                      // Try compare again
                      const secondComparison = await kovaaksAPI.combined.compareUsers(username, similarUsername, {
                        limitToCommonScenarios: true,
                        minScenarios: 2, // Lower the requirement to increase chances of success
                        includeRecommendations: true
                      });
                      
                      if (secondComparison) {
                        console.log('\nComparison Results:');
                        console.log(`  Comparing with: ${similarUsername}`);
                        console.log(`  Common Scenarios: ${secondComparison.summary.totalScenarioCount}`);
                        console.log(`  Average Difference: ${secondComparison.summary.averageScoreDifference.toFixed(2)}%`);
                        
                        // Save the successful comparison data
                        saveToFile(secondComparison, 'user_comparison_similar_rank');
                      } else {
                        console.log('Could not compare with similar rank player either.');
                      }
                    }
                  }
                } else {
                  console.log('No suitable similar rank players found for comparison.');
                }
              }
            }
          }
        } else {
          console.log('Could not retrieve top players for comparison');
        }
      } catch (error) {
        console.error('❌ Error comparing users:', error);
      }
      
      // Demonstrate error handling and retry logic
      console.log('\nDemonstrating error handling and request deduplication:');
      
      // Make two identical requests to showcase deduplication
      console.log('Making multiple identical requests to showcase deduplication...');
      
      console.time('First request');
      const request1 = kovaaksAPI.leaderboards.getGlobalLeaderboard({
        page: 0,
        max: 5
      });
      console.timeEnd('First request');
      
      console.time('Duplicate request (should be instant)');
      const request2 = kovaaksAPI.leaderboards.getGlobalLeaderboard({
        page: 0,
        max: 5
      });
      console.timeEnd('Duplicate request (should be instant)');
      
      // Wait for both requests to complete
      const [result1, result2] = await Promise.all([request1, request2]);
      
      // Check if we got the same object reference (true deduplication)
      console.log(`Request deduplication successful: ${result1 === result2}`);
      
      // Try an invalid API call to demonstrate error handling
      console.log('\nTrying an invalid API call to demonstrate error handling...');
      try {
        // @ts-ignore - Intentionally make a bad request to showcase error handling
        await kovaaksAPI.leaderboards.searchUserByUsername('', {
          // @ts-ignore - Using invalid field to trigger error
          sortBy: 'invalid_field' // This should cause an error
        });
      } catch (error: any) {
        console.log('Error caught successfully:');
        console.log(`  Type: ${error.type || 'Unknown'}`);
        console.log(`  Message: ${error.message || 'Unknown error'}`);
        console.log(`  Status: ${error.status || 'N/A'}`);
        
        // Show retry information if available
        if (error.retryAttempts !== undefined) {
          console.log(`  Retry Attempts: ${error.retryAttempts}`);
          console.log(`  Retryable: ${error.retryable ? 'Yes' : 'No'}`);
        }
      }
    } catch (error) {
      console.error('❌ Error in performance analysis section:', error);
    }
    
    hr();
    
    // =====================================================================
    // CONCLUSION
    // =====================================================================
    section('🏁 DEMONSTRATION COMPLETE');
    
    console.log('You have now seen all the major features of the Kovaaks API wrapper!');
    console.log('All output files have been saved to the examples/output/ directory.');
    console.log('\nNext Steps:');
    console.log('  1. Review the saved JSON files for complete data');
    console.log('  2. Explore the API documentation for more details');
    console.log('  3. Customize the examples for your specific use case');
    console.log('\nThank you for using the Kovaaks API Wrapper! 🎯');
  } catch (error) {
    console.error('❌ FATAL ERROR in API demonstration:', error);
  }
}

// Run the demonstration
demonstrateAPIWrapper().catch(console.error);

// Export the initialized client for reuse
export { kovaaksAPI }; 