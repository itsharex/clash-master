/**
 * Legacy compatibility entry.
 *
 * The API implementation was migrated to `app.ts`.
 * Keep this file as a thin re-export to avoid duplicate route definitions
 * and to preserve old import paths.
 */

export { createApp, APIServer } from './app.js';
export { default } from './app.js';
