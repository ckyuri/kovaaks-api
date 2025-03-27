import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { ApiError, KovaaksClientConfig, KovaaksApiError } from '../types';
import { KovaaksErrorType } from '../types';

// Default API configuration
const DEFAULT_CONFIG: KovaaksClientConfig = {
  baseURL: 'https://kovaaks.com',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
};

// Request deduplication cache
interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
  expiresAt: number;
}

// In-memory cache of in-flight requests to avoid duplicates
const pendingRequests = new Map<string, PendingRequest>();

// Default TTL for pending requests (30 seconds)
const PENDING_REQUEST_TTL = 30000;

// Add higher-level method deduplication cache
interface PendingMethodCall {
  promise: Promise<any>;
  timestamp: number;
  expiresAt: number;
}

// In-memory cache of in-flight method calls to avoid duplicate method executions
// This is separate from HTTP request deduplication and works at a higher level
const pendingMethodCalls = new Map<string, PendingMethodCall>();

// Default TTL for pending method calls (2 minutes - longer than HTTP requests)
const PENDING_METHOD_CALL_TTL = 120000; // 2 minutes

// Default retry settings
interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  retryableStatusCodes: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 300,
  maxDelayMs: 10000,
  backoffFactor: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504]
};

/**
 * Helper function to deduplicate any async function call
 * This creates a wrapper that will return the same promise for duplicate calls
 * 
 * @param fn The function to deduplicate
 * @param options Optional configuration
 * @returns A wrapped function that deduplicates calls with the same arguments
 */
export function deduplicateRequests<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: {
    ttl?: number;
    keyGenerator?: (...args: Parameters<T>) => string;
  } = {}
): T {
  const ttl = options.ttl || PENDING_METHOD_CALL_TTL;
  
  // The wrapper function with the same signature as the original
  const wrapped = ((...args: Parameters<T>) => {
    // Generate a cache key from function name and args
    const cacheKey = options.keyGenerator 
      ? options.keyGenerator(...args)
      : `${fn.name}:${JSON.stringify(args)}`;
    
    // Check if this method call is already in-flight
    const pendingCall = pendingMethodCalls.get(cacheKey);
    if (pendingCall && Date.now() < pendingCall.expiresAt) {
      console.log(`Method call deduplication: returning existing promise for ${cacheKey}`);
      return pendingCall.promise;
    }
    
    // If not, execute the function
    const promise = fn(...args);
    
    // Store the promise and metadata
    pendingMethodCalls.set(cacheKey, {
      promise,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl
    });
    
    // Clean up the cache entry when the promise resolves or rejects
    promise.finally(() => {
      const pendingCall = pendingMethodCalls.get(cacheKey);
      if (pendingCall && pendingCall.promise === promise) {
        pendingMethodCalls.delete(cacheKey);
      }
    });
    
    return promise;
  }) as T;
  
  return wrapped;
}

/**
 * Cleans up expired pending method calls
 */
export const cleanupPendingMethodCalls = (): void => {
  const now = Date.now();
  
  for (const [key, call] of pendingMethodCalls.entries()) {
    if (now > call.expiresAt) {
      pendingMethodCalls.delete(key);
    }
  }
};

// Set up periodic cleanup for method call cache
setInterval(cleanupPendingMethodCalls, 60000); // Cleanup every minute

/**
 * Creates a request cache key from the request details
 */
export const createRequestCacheKey = (
  method: string,
  url: string,
  params?: Record<string, any>,
  data?: any
): string => {
  return `${method}:${url}:${JSON.stringify(params || {})}:${JSON.stringify(data || {})}`;
};

/**
 * Cleans up expired pending requests
 */
export const cleanupPendingRequests = (): void => {
  const now = Date.now();
  
  for (const [key, request] of pendingRequests.entries()) {
    if (now > request.expiresAt) {
      pendingRequests.delete(key);
    }
  }
};

/**
 * Categorize API errors into standardized error types
 */
export const categorizeError = (error: any): KovaaksErrorType => {
  // Check for network errors
  if (!error.status || error.status === 0) {
    if (error.message && (
      error.message.includes('timeout') ||
      error.message.includes('timed out')
    )) {
      return KovaaksErrorType.TIMEOUT;
    }
    return KovaaksErrorType.NETWORK_ERROR;
  }
  
  // Check for HTTP status code ranges
  const status = error.status;
  
  // 400 range errors
  if (status >= 400 && status < 500) {
    switch (status) {
      case 401:
        return KovaaksErrorType.AUTHENTICATION_ERROR;
      case 403:
        return KovaaksErrorType.AUTHORIZATION_ERROR;
      case 404:
        return KovaaksErrorType.NOT_FOUND;
      case 422:
        return KovaaksErrorType.VALIDATION_ERROR;
      case 429:
        return KovaaksErrorType.RATE_LIMITED;
      default:
        break;
    }
  }
  
  // 500 range errors
  if (status >= 500) {
    return KovaaksErrorType.SERVER_ERROR;
  }
  
  // Check error codes/messages for more specific categorization
  if (error.code === 'ECONNABORTED') {
    return KovaaksErrorType.TIMEOUT;
  }
  
  // Default to unknown error
  return KovaaksErrorType.UNKNOWN_ERROR;
};

/**
 * Format error with detailed information for better debugging
 */
export const formatDetailedError = (
  error: any,
  method?: string,
  url?: string,
  params?: Record<string, any>,
  retryAttempts?: number
): KovaaksApiError => {
  const errorType = categorizeError(error);
  
  const formattedError: KovaaksApiError = {
    message: error.message || 'Unknown error occurred',
    status: error.status,
    type: errorType,
    originalError: error
  };
  
  // Add request details if available
  if (method) formattedError.method = method;
  if (url) formattedError.url = url;
  if (params) formattedError.params = params;
  
  // Add response data if available
  if (error.data) formattedError.data = error.data;
  
  // Add retry information if available
  if (retryAttempts !== undefined) {
    formattedError.retryAttempts = retryAttempts;
    formattedError.retryable = [
      KovaaksErrorType.TIMEOUT,
      KovaaksErrorType.NETWORK_ERROR,
      KovaaksErrorType.SERVER_ERROR,
      KovaaksErrorType.RATE_LIMITED
    ].includes(errorType);
  }
  
  return formattedError;
};

/**
 * Creates a configured Axios instance for API requests
 */
export const createApiClient = (config: KovaaksClientConfig = {}): AxiosInstance => {
  const mergedConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    headers: {
      ...DEFAULT_CONFIG.headers,
      ...config.headers,
    }
  };

  const client = axios.create(mergedConfig);

  // Add response interceptor to handle errors consistently
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        const { data, status } = error.response;
        
        // Get the request information
        const method = error.config?.method?.toUpperCase() || 'UNKNOWN';
        const url = error.config?.url || 'unknown-url';
        const params = error.config?.params;
        
        // Create detailed error
        const detailedError = formatDetailedError(
          {
            status,
            data,
            message: data?.error?.[0]?.msg || 'An error occurred while processing your request'
          },
          method,
          url,
          params
        );
        
        return Promise.reject(detailedError);
      } else if (error.request) {
        // The request was made but no response was received
        const method = error.config?.method?.toUpperCase() || 'UNKNOWN';
        const url = error.config?.url || 'unknown-url';
        const params = error.config?.params;
        
        // Create detailed error
        const detailedError = formatDetailedError(
          {
            status: 0,
            message: 'No response received from server - the request may have timed out'
          },
          method,
          url,
          params
        );
        
        return Promise.reject(detailedError);
      } else {
        // Something happened in setting up the request that triggered an Error
        const detailedError = formatDetailedError({
          message: error.message || 'Error setting up request'
        });
        
        return Promise.reject(detailedError);
      }
    }
  );

  // Run cleanup on pending requests periodically
  setInterval(cleanupPendingRequests, 60000); // Cleanup every minute

  return client;
};

/**
 * Sets the authentication token for the API client
 */
export const setAuthToken = (client: AxiosInstance, token: string): void => {
  client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

/**
 * Removes the authentication token from the API client
 */
export const removeAuthToken = (client: AxiosInstance): void => {
  delete client.defaults.headers.common['Authorization'];
};

/**
 * Creates the Basic Auth header value
 */
export const createBasicAuthHeader = (username: string, password: string): string => {
  const credentials = `${username}:${password}`;
  const encodedCredentials = Buffer.from(credentials).toString('base64');
  return `Basic ${encodedCredentials}`;
};

/**
 * Wait for the specified number of milliseconds
 */
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate the delay for a retry attempt using exponential backoff
 */
const calculateRetryDelay = (
  attempt: number, 
  { initialDelayMs, maxDelayMs, backoffFactor }: RetryConfig
): number => {
  // Exponential backoff formula: initialDelay * (backoffFactor ^ attemptNumber)
  const exponentialDelay = initialDelayMs * Math.pow(backoffFactor, attempt);
  
  // Add some jitter (±20%) to avoid all clients retrying at the same time
  const jitter = 0.8 + (Math.random() * 0.4); // 0.8 to 1.2
  
  // Apply jitter and cap at maximum delay
  return Math.min(exponentialDelay * jitter, maxDelayMs);
};

/**
 * Helper function to make authenticated requests with deduplication and retry logic
 */
export const makeAuthenticatedRequest = async <T>(
  client: AxiosInstance,
  method: string,
  url: string,
  data?: any,
  config?: AxiosRequestConfig & { 
    skipDeduplication?: boolean;
    retry?: boolean | Partial<RetryConfig>;
  }
): Promise<T> => {
  // Extract retry and deduplication config
  const skipDeduplication = config?.skipDeduplication || false;
  const retryConfig = config?.retry === false 
    ? false 
    : (typeof config?.retry === 'object' 
      ? { ...DEFAULT_RETRY_CONFIG, ...config.retry } 
      : DEFAULT_RETRY_CONFIG);
  
  // Remove custom properties from axios config
  const axiosConfig = { ...config };
  delete (axiosConfig as any).skipDeduplication;
  delete (axiosConfig as any).retry;

  // Create cache key for deduplication
  const cacheKey = createRequestCacheKey(method, url, axiosConfig?.params, data);

  // Apply request deduplication (unless explicitly skipped)
  if (!skipDeduplication) {
    // Clean up expired items first
    cleanupPendingRequests();
    
    // Check if this request is already in-flight
    const pendingRequest = pendingRequests.get(cacheKey);
    if (pendingRequest) {
      // If the request is already in-flight, return the existing promise
      return pendingRequest.promise as Promise<T>;
    }
  }

  // Prepare the actual request function that will be executed (potentially multiple times)
  const executeRequest = async (retryAttempt = 0): Promise<T> => {
    try {
      const response: AxiosResponse<T> = await client.request({
        method,
        url,
        data,
        ...axiosConfig,
      });
      return response.data;
    } catch (error: any) {
      // Handle 404 errors specifically for scenarios that don't exist
      if (
        error.type === KovaaksErrorType.NOT_FOUND && 
        (error.data === "Invalid Route" || url.includes('/webapp-backend/scenario'))
      ) {
        // Don't log 404s - they're expected for missing scenarios
        return null as T;
      }
      
      // If retry is disabled or we've reached the maximum retries, throw the error
      if (
        retryConfig === false || 
        retryAttempt >= retryConfig.maxRetries || 
        !retryConfig.retryableStatusCodes.includes(error.status || 0)
      ) {
        // Add retry attempt info to the error
        if (error.type) {
          // If it's already a KovaaksApiError, just add the retry attempts
          error.retryAttempts = retryAttempt;
        } else {
          // Otherwise, create a detailed error
          error = formatDetailedError(
            error,
            method,
            url,
            axiosConfig?.params,
            retryAttempt
          );
        }
        
        throw error;
      }
      
      // Calculate delay for next retry
      const retryDelay = calculateRetryDelay(retryAttempt, retryConfig);
      
      // Log the retry with error type if available
      const errorType = error.type || categorizeError(error);
      console.warn(`API request failed (${errorType}: ${error.status || 'unknown error'}), retrying in ${Math.round(retryDelay)}ms (attempt ${retryAttempt + 1}/${retryConfig.maxRetries})`);
      
      // Wait before retrying
      await delay(retryDelay);
      
      // Retry the request with incremented retry count
      return executeRequest(retryAttempt + 1);
    }
  };

  // Create the promise for this request
  const requestPromise = executeRequest();
  
  // Add to pending requests if deduplication is enabled
  if (!skipDeduplication) {
    pendingRequests.set(cacheKey, {
      promise: requestPromise,
      timestamp: Date.now(),
      expiresAt: Date.now() + PENDING_REQUEST_TTL
    });
    
    // Cleanup the pending request when it resolves or rejects
    requestPromise
      .finally(() => {
        const pendingRequest = pendingRequests.get(cacheKey);
        if (pendingRequest && pendingRequest.promise === requestPromise) {
          pendingRequests.delete(cacheKey);
        }
      });
  }

  return requestPromise;
};

/**
 * Generic GET request with deduplication and retry support
 */
export const get = async <T>(
  client: AxiosInstance,
  url: string, 
  params?: Record<string, any>,
  config?: AxiosRequestConfig & { 
    skipDeduplication?: boolean;
    retry?: boolean | Partial<RetryConfig>;
  }
): Promise<T> => {
  return makeAuthenticatedRequest<T>(client, 'GET', url, undefined, { 
    ...config, 
    params 
  });
};

/**
 * Wrapper for GET requests to handle username-related errors better
 * This wrapper specifically targets endpoints that have username parameters
 * to improve error handling for special characters and long usernames
 */
export const getUserByUsername = async <T>(
  client: AxiosInstance,
  endpoint: string,
  username: string,
  additionalParams?: Record<string, any>,
  config?: AxiosRequestConfig
): Promise<T> => {
  try {
    // First try with original username
    return await get<T>(client, endpoint, { 
      username,
      ...additionalParams
    }, config);
  } catch (error: any) {
    // Check if it's a username-related error
    if (error?.status === 400 && 
        error?.data?.error?.includes('username') && 
        error?.data?.error?.includes('length')) {
      
      console.warn(`Username error detected with "${username}". Attempting simplified version...`);
      
      // Create simplified version of the username
      let simplifiedUsername = username;
      
      // Remove special characters and shorten
      if (/[^\x00-\x7F]/.test(username)) {
        // For usernames with Unicode, create a simplified alphanumeric version
        simplifiedUsername = username.replace(/[^\w\s]/g, '')  // Remove non-alphanumeric
                                    .replace(/\s+/g, '_')      // Replace spaces with underscores
                                    .substring(0, 20);         // Keep it short
        
        console.log(`Trying with simplified username: "${simplifiedUsername}"`);
        
        // Try again with the simplified username
        return await get<T>(client, endpoint, {
          username: simplifiedUsername,
          ...additionalParams
        }, config);
      }
      
      // If the username doesn't contain special characters but is still too long
      if (username.length > 30) {
        simplifiedUsername = username.substring(0, 30);
        
        console.log(`Username too long, trying with truncated version: "${simplifiedUsername}"`);
        
        // Try again with the truncated username
        return await get<T>(client, endpoint, {
          username: simplifiedUsername,
          ...additionalParams
        }, config);
      }
    }
    
    // If it's not a username error or the retry failed, rethrow
    throw error;
  }
};

/**
 * Generic POST request with deduplication and retry support
 */
export const post = async <T>(
  client: AxiosInstance, 
  url: string, 
  data?: any,
  config?: AxiosRequestConfig & { 
    skipDeduplication?: boolean;
    retry?: boolean | Partial<RetryConfig>;
  }
): Promise<T> => {
  return makeAuthenticatedRequest<T>(client, 'POST', url, data, config);
};

/**
 * Helper function to build query parameters
 */
export const buildQueryParams = (params: Record<string, any>): string => {
  const query = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        // Handle array parameters like sort_param[]
        return value.map(v => `${encodeURIComponent(key)}[]=${encodeURIComponent(v)}`).join('&');
      }
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
    .join('&');
    
  return query ? `?${query}` : '';
};

/**
 * Batch multiple API calls into a single process for efficiency
 * This helps reduce the overhead of multiple separate API calls
 * 
 * @param calls An array of function calls to execute in optimized batches
 * @param options Options for controlling batch execution
 * @returns Results from all calls in the same order
 */
export async function batchApiCalls<T>(
  calls: (() => Promise<T>)[],
  options: {
    concurrency?: number;
    delay?: number;
    cancelSignal?: AbortSignal;
  } = {}
): Promise<T[]> {
  const { 
    concurrency = 3,
    delay = 200,
    cancelSignal
  } = options;
  
  const results: T[] = new Array(calls.length);
  
  // Process in batches based on concurrency
  for (let i = 0; i < calls.length; i += concurrency) {
    // Check for cancellation
    if (cancelSignal?.aborted) {
      console.warn('Batch API call operation was canceled');
      break;
    }
    
    const batch = calls.slice(i, i + concurrency);
    const batchPromises = batch.map((call, batchIndex) => 
      call().then(result => {
        // Store result in the correct position
        results[i + batchIndex] = result;
        return result;
      })
    );
    
    // Wait for current batch to complete
    await Promise.all(batchPromises);
    
    // Add delay between batches to avoid overloading the API
    if (i + concurrency < calls.length) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return results;
} 