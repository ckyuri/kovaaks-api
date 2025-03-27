# Kovaaks API Documentation

This documentation provides details on the Kovaaks API endpoints that allow you to interact with the Kovaaks FPS Aim Trainer web application.

## Base URL

```
https://kovaaks.com
```

## Authentication

Several endpoints require authentication. Authentication is handled using JWT tokens.

### Login

Authenticates a user and returns a JWT token for subsequent authenticated requests.

**Endpoint:** `POST /auth/webapp/login`

**Auth Type:** Basic Authentication

**Headers:**
- `Authorization: Basic <base64-encoded-credentials>`

**Response:**
```json
{
  "auth": {
    "firebaseJWT": "string",
    "jwt": "string",
    "refreshToken": "string",
    "exp": number,
    "emailVerified": boolean,
    "steamAccountNameIds": object
  },
  "profile": {
    "playerId": number,
    "username": "string",
    "created": "string",
    "steamId": "string",
    "clientBuildVersion": "string",
    "lastAccess": "string",
    "webapp": {
      "roles": {
        "admin": boolean,
        "coach": boolean,
        "staff": boolean
      },
      "videos": array,
      "username": "string",
      "socialMedia": object,
      "gameSettings": object,
      "profileImage": string | null,
      "profileViews": number,
      "hasSubscribed": boolean,
      "gamingPeripherals": object
    },
    "country": "string",
    "lowerWebappUsername": "string",
    "searchVector": "string",
    "steamAccountName": "string",
    "steamAccountAvatar": "string"
  },
  "redirect": boolean
}
```

### Verify Token

Verify if a JWT token is still valid.

**Endpoint:** `GET /auth/webapp/verify-token`

**Auth Type:** Bearer Token

**Headers:**
- `Authorization: Bearer <jwt-token>`

**Response:**
```json
{
  "success": true
}
```

## Profile Information

### Get Profile

Retrieve the profile information for the authenticated user.

**Endpoint:** `GET /webapp-backend/user/profile`

**Auth Type:** Bearer Token

**Headers:**
- `Authorization: Bearer <jwt-token>`

**Response:**
```json
{
  "playerId": number,
  "steamAccountName": "string",
  "steamAccountAvatar": "string",
  "created": "string",
  "steamId": "string",
  "clientBuildVersion": "string",
  "lastAccess": "string",
  "webapp": {
    "roles": object,
    "videos": array,
    "username": "string",
    "socialMedia": object,
    "gameSettings": object,
    "profileImage": string | null,
    "profileViews": number,
    "hasSubscribed": boolean,
    "gamingPeripherals": object
  },
  "country": "string",
  "kovaaksPlusActive": boolean,
  "discord_id": "string",
  "discord_username": "string",
  "hideDiscord": boolean,
  "badges": array,
  "followCounts": {
    "following": number,
    "followers": number
  },
  "kovaaksPlus": {
    "active": boolean,
    "expiration": string | null
  },
  "scenariosPlayed": "string",
  "features": {
    "global_leaderboards": boolean
  }
}
```

### Get Profile by Username

Retrieve profile information for any user by their username.

**Endpoint:** `GET /webapp-backend/user/profile/by-username`

**Query Parameters:**
- `username`: The username to look up

**Response:**
```json
{
  "playerId": number,
  "steamAccountName": "string",
  "steamAccountAvatar": "string",
  "created": "string",
  "steamId": "string",
  "clientBuildVersion": "string",
  "lastAccess": "string",
  "webapp": {
    "roles": object,
    "videos": array,
    "username": "string",
    "socialMedia": object,
    "gameSettings": object,
    "profileImage": string | null,
    "profileViews": number,
    "hasSubscribed": boolean,
    "gamingPeripherals": object
  },
  "country": "string",
  "kovaaksPlusActive": boolean,
  "badges": array,
  "followCounts": {
    "following": number,
    "followers": number
  },
  "kovaaksPlus": {
    "active": boolean,
    "expiration": string | null
  },
  "scenariosPlayed": "string"
}
```

### Get Recent User Activity

Retrieve recent activities for a user by username.

**Endpoint:** `GET /webapp-backend/user/activity/recent`

**Query Parameters:**
- `username`: The username to look up

**Response:**
```json
[
  {
    "timestamp": "string",
    "type": "string",
    "scenarioName": "string",
    "score": number,
    "leaderboardId": number,
    "username": "string",
    "webappUsername": "string",
    "steamId": "string",
    "steamAccountName": "string",
    "steamAccountAvatar": "string",
    "country": "string",
    "kovaaksPlus": boolean
  }
]
```

## Benchmark Data

### Get User Benchmark Progress

Retrieves benchmark progress data for a specific user.

**Endpoint:** `GET /webapp-backend/benchmarks/player-progress-rank-benchmark`

**Query Parameters:**
- `benchmarkId`: The ID of the benchmark
- `steamId`: The Steam ID of the user
- `page`: Page number for pagination
- `max`: Maximum number of results per page

**Response:**
```json
{
  "benchmark_progress": number,
  "overall_rank": number,
  "categories": {
    "Category Name": {
      "benchmark_progress": number,
      "category_rank": number,
      "rank_maxes": array,
      "scenarios": {
        "Scenario Name": {
          "score": number,
          "leaderboard_rank": number,
          "scenario_rank": number,
          "rank_maxes": array
        }
      }
    }
  },
  "ranks": [
    {
      "icon": "string",
      "name": "string",
      "color": "string",
      "frame": "string",
      "description": "string",
      "playercard_large": "string",
      "playercard_small": "string"
    }
  ]
}
```

### Search User Benchmarks

Search for benchmarks that a user has participated in.

**Endpoint:** `GET /webapp-backend/benchmarks/player-progress-rank`

**Query Parameters:**
- `username`: The username to search for
- `page`: Page number for pagination
- `max`: Maximum number of results per page

**Response:**
```json
{
  "page": number,
  "max": number,
  "total": number,
  "data": [
    {
      "benchmarkName": "string",
      "benchmarkId": number,
      "benchmarkIcon": "string",
      "benchmarkAuthor": "string",
      "type": "string",
      "tintRanks": boolean,
      "rankName": "string",
      "rankIcon": "string",
      "rankColor": "string"
    }
  ]
}
```

## Scenario Information

### Get Popular Scenarios

Retrieves a list of popular scenarios.

**Endpoint:** `GET /webapp-backend/scenario/popular`

**Query Parameters:**
- `page`: Page number for pagination
- `max`: Maximum number of results per page
- `scenarioNameSearch` (optional): Filter results by scenario name

**Response:**
```json
{
  "page": number,
  "max": number,
  "total": number,
  "data": [
    {
      "rank": number,
      "leaderboardId": number,
      "scenarioName": "string",
      "scenario": {
        "aimType": string | null,
        "authors": array,
        "description": "string"
      },
      "counts": {
        "plays": number,
        "entries": number
      },
      "topScore": {
        "score": number
      }
    }
  ]
}
```

### Get Trending Scenarios

Retrieves a list of trending scenarios.

**Endpoint:** `GET /webapp-backend/scenario/trending`

**Response:**
```json
[
  {
    "scenarioName": "string",
    "leaderboardId": number,
    "webappUsername": string | null,
    "steamAccountName": "string",
    "kovaaksPlusActive": boolean,
    "entries": number,
    "new": boolean
  }
]
```

### Get User Scenario Leaderboard Scores

Retrieves a user's scores for various scenarios.

**Endpoint:** `GET /webapp-backend/user/scenario/total-play`

**Query Parameters:**
- `username`: The username to look up
- `page`: Page number for pagination
- `max`: Maximum number of results per page
- `sort_param[]`: Parameter to sort by (e.g., "count")

**Response:**
```json
{
  "page": number,
  "max": number,
  "total": number,
  "data": [
    {
      "leaderboardId": "string",
      "scenarioName": "string",
      "counts": {
        "plays": number
      },
      "rank": number,
      "score": number,
      "attributes": {
        "resolution": "string",
        "avg_fps": number,
        "avg_ttk": number,
        "sens_scale": "string",
        "horiz_sens": number,
        "vert_sens": number,
        "fov": number,
        "challenge_start": "string",
        "score": number,
        "kills": number,
        "hash": "string",
        "fov_scale": "string",
        "sens_randomizer": string | null,
        "accuracy_damage": number,
        "scenario_version": "string",
        "cm360": number,
        "client_build_version": "string",
        "epoch": number
      },
      "scenario": {
        "aimType": string | null,
        "authors": array,
        "description": "string"
      }
    }
  ]
}
```

## Leaderboards

### Get Global Leaderboards

Retrieves global player rankings.

**Endpoint:** `GET /webapp-backend/leaderboard/global/scores`

**Query Parameters:**
- `page`: Page number for pagination
- `max`: Maximum number of results per page

**Response:**
```json
{
  "data": [
    {
      "rank": number,
      "rankChange": number,
      "steamId": "string",
      "webappUsername": string | null,
      "steamAccountName": "string",
      "points": "string",
      "scenariosCount": "string",
      "completionsCount": number,
      "kovaaksPlusActive": boolean,
      "country": "string"
    }
  ],
  "total": "string"
}
```

### Search Global Leaderboard by Username

Searches for a specific user in the global leaderboard.

**Endpoint:** `GET /webapp-backend/leaderboard/global/search/account-names`

**Query Parameters:**
- `username`: The username to search for

**Response:**
```json
[
  {
    "steamId": "string",
    "rank": number,
    "countryRank": number,
    "regionRank": number,
    "rankChange": number,
    "countryRankChange": number,
    "regionRankChange": number,
    "username": "string",
    "steamAccountName": "string",
    "steamAccountAvatar": "string",
    "country": "string",
    "kovaaksPlusActive": boolean
  }
]
```

### Get Country Leaderboards

Retrieves rankings by country.

**Endpoint:** `GET /webapp-backend/leaderboard/global/scores`

**Query Parameters:**
- `page`: Page number for pagination
- `max`: Maximum number of results per page
- `group`: "country"

**Response:**
```json
{
  "data": [
    {
      "group": "string",
      "points": "string",
      "scenarios_count": "string",
      "completions_count": "string",
      "rank": number
    }
  ],
  "total": "string"
}
```

### Get Region Leaderboards

Retrieves rankings by region.

**Endpoint:** `GET /webapp-backend/leaderboard/global/scores`

**Query Parameters:**
- `page`: Page number for pagination
- `max`: Maximum number of results per page
- `group`: "region"

**Response:**
```json
{
  "data": [
    {
      "group": "string",
      "points": "string",
      "scenarios_count": "string",
      "completions_count": "string",
      "rank": number
    }
  ],
  "total": number
}
```

## Game Settings

### Get Game Settings

Retrieves available game settings information.

**Endpoint:** `GET /webapp-backend/game-settings`

**Response:**
Contains information about game settings, including sensitivity conversion parameters.

## Statistics

### Get Monthly Players Count

Get the count of monthly active players.

**Endpoint:** `GET /webapp-backend/user/monthly-players`

**Response:**
```json
{
  "count": number
}
```

## Error Handling

The API returns appropriate HTTP status codes and error messages in case of failures:

- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Authenticated user does not have access to the requested resource
- `404 Not Found`: Requested resource not found
- `500 Internal Server Error`: Server-side error

Error responses typically follow this format:
```json
{
  "error": [
    {
      "value": "string",
      "msg": "string",
      "param": "string",
      "location": "string"
    }
  ]
}
```