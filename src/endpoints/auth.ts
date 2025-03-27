import type { AxiosInstance } from 'axios';
import { 
  createBasicAuthHeader, 
  post, 
  get, 
  setAuthToken, 
  removeAuthToken 
} from '../utils/api';
import type { AuthResponse, LoginCredentials, TokenVerifyResponse } from '../types';

/**
 * Authentication API endpoints
 */
export class AuthAPI {
  private client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  /**
   * Login with username and password
   * 
   * @param credentials - Username and password
   * @returns Authentication response with tokens and profile information
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // Validate credentials
      if (!credentials.username || !credentials.password) {
        throw new Error('Username and password are required');
      }
      
      // Make a login request with basic auth
      const auth = btoa(`${credentials.username}:${credentials.password}`);
      
      const response = await this.client.post<AuthResponse>(
        '/auth/webapp/login', 
        null, 
        {
          headers: {
            Authorization: `Basic ${auth}`
          }
        }
      );
      
      // If the API call completed but response doesn't have auth data
      if (!response.data || !response.data.auth) {
        throw new Error('Invalid response from authentication server');
      }
      
      // Set the auth token for subsequent requests
      setAuthToken(this.client, response.data.auth.jwt);
      
      return response.data;
    } catch (error) {
      console.error('Authentication failed:', error);
      throw error;
    }
  }

  /**
   * Verify if current token is valid
   * 
   * @returns Whether the token is valid
   */
  async verifyToken(): Promise<boolean> {
    try {
      const response = await get<TokenVerifyResponse>(
        this.client, 
        '/auth/webapp/verify-token'
      );
      
      return response && response.success === true;
    } catch (error) {
      // If we get an error, token is likely invalid
      console.debug('Token verification failed:', error);
      return false;
    }
  }

  /**
   * Logout by removing the authentication token
   */
  logout(): void {
    removeAuthToken(this.client);
  }
} 