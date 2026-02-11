/**
 * Backend module type definitions
 */

export interface BackendConfig {
  id: number;
  name: string;
  url: string;
  token: string;
  enabled: boolean;
  is_active: boolean;
  listening: boolean;
  created_at: string;
  updated_at: string;
}

// Re-export from db.ts for compatibility
export type { BackendConfig as BackendConfigFromDb } from '../../db.js';

export interface CreateBackendInput {
  name: string;
  url: string;
  token?: string;
}

export interface UpdateBackendInput {
  name?: string;
  url?: string;
  token?: string;
  enabled?: boolean;
  listening?: boolean;
}

export interface BackendResponse {
  id: number;
  name: string;
  url: string;
  enabled: boolean;
  is_active: boolean;
  listening: boolean;
  created_at: string;
  updated_at: string;
  hasToken: boolean;
}

export interface TestConnectionInput {
  url: string;
  token?: string;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
}

export interface BackendActivationResult {
  message: string;
}

export interface BackendListeningResult {
  message: string;
}

export interface ClearDataResult {
  message: string;
}

export interface CreateBackendResult {
  id: number;
  isActive: boolean;
  message: string;
}
