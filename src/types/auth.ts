// OAuth and Authentication Types

export interface OAuthSessionResponse {
  authenticated: boolean;
  provider: string;
  timestamp: string;
  session?: {
    accessToken: string;
    tokenType?: string;
    scope?: string;
    expiresAt?: string;
    isExpired?: boolean;
    expiresIn?: number | null;
    sessionId?: string;
  };
}

export interface SessionInfo {
  authenticated: boolean;
  provider?: string;
  timestamp?: string;
  tokenType?: string;
  scope?: string;
  expiresAt?: string;
  accessToken?: string;
  subscriptionKey?: string;
  user?: any;
  // Additional OAuth session fields
  isExpired?: boolean;
  expiresIn?: number | null;
  sessionId?: string;
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  data?: any;
  params?: any;
  retries?: boolean;
}

export interface ConstituentInfo {
  id: string;
  name?: string;
  first?: string;
  last?: string;
  middle?: string;
  former_name?: string;
  preferred_name?: string;
  suffix?: string;
  title?: string;
  lookup_id?: string;
  email?: {
    address: string;
    type?: string;
    primary?: boolean;
  };
  phone?: {
    number: string;
    type?: string;
    primary?: boolean;
  };
  address?: {
    address_lines?: string[];
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    type?: string;
    primary?: boolean;
  };
  birthdate?: {
    d?: number;
    m?: number;
    y?: number;
  };
  gender?: string;
  marital_status?: string;
  deceased?: boolean;
  date_added?: string;
  date_modified?: string;
  [key: string]: any;
}

// Helper type to convert OAuthSessionResponse to SessionInfo for backward compatibility
export type SessionInfoFromOAuth = OAuthSessionResponse & {
  // Additional fields that might be needed for backward compatibility
  subscriptionKey?: string;
  user?: any;
}; 