import { config } from 'dotenv';
config();

import { StatsDatabase, BackendConfig } from './db.js';
import { createCollector, OpenClashCollector } from './collector.js';
import { StatsWebSocketServer } from './websocket.js';

let wsServer: StatsWebSocketServer;

import { APIServer } from './api.js';
import { GeoIPService } from './geo-service.js';
import path from 'path';

const COLLECTOR_WS_PORT = parseInt(process.env.COLLECTOR_WS_PORT || '3002');
const API_PORT = parseInt(process.env.API_PORT || '3001');
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'stats.db');

// Map of backend connections: backendId -> OpenClashCollector
const collectors = new Map<number, OpenClashCollector>();
let db: StatsDatabase;

let apiServer: APIServer;
let geoService: GeoIPService;

// Track last known backend configs to detect changes
let lastBackendConfigs: Map<number, BackendConfig> = new Map();

async function main() {
  console.log('[Main] Starting collector service...');

  // Initialize database
  console.log('[Main] Initializing database at:', DB_PATH);
  db = new StatsDatabase(DB_PATH);

  // Initialize GeoIP service
  geoService = new GeoIPService(db);

  // Initialize WebSocket server for real-time updates
  console.log('[Main] Starting WebSocket server on port', COLLECTOR_WS_PORT);
  wsServer = new StatsWebSocketServer(COLLECTOR_WS_PORT, db);
  wsServer.start();

  // Initialize API server
  console.log('[Main] Starting API server on port', API_PORT);
  apiServer = new APIServer(API_PORT, db);
  apiServer.start();

  // Start backend management loop
  console.log('[Main] Starting backend management loop...');
  manageBackends();

  // Check for backend config changes every 5 seconds
  setInterval(manageBackends, 5000);

  // Auto-cleanup: enforce data retention policy
  function runAutoCleanup() {
    try {
      const config = db.getRetentionConfig();
      if (!config.autoCleanup) return;

      const connCutoff = new Date(Date.now() - config.connectionLogsDays * 86400000).toISOString();
      const hourlyCutoff = new Date(Date.now() - config.hourlyStatsDays * 86400000).toISOString();

      const deletedLogs = db.deleteOldMinuteStats(connCutoff);
      const deletedHourly = db.deleteOldHourlyStats(hourlyCutoff);

      if (deletedLogs > 0 || deletedHourly > 0) {
        console.log(`[Cleanup] Deleted ${deletedLogs} connection logs, ${deletedHourly} hourly stats`);
      }
    } catch (err) {
      console.error('[Cleanup] Auto-cleanup failed:', err);
    }
  }

  // First cleanup 30 seconds after startup, then every 6 hours
  setTimeout(runAutoCleanup, 30000);
  setInterval(runAutoCleanup, 6 * 60 * 60 * 1000);

  // Handle graceful shutdown
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Manage backend connections based on database configuration
async function manageBackends() {
  try {
    // Get current backend configs from database
    const backends = db.getAllBackends();
    const currentConfigs = new Map(backends.map(b => [b.id, b]));

    // Find backends that need to be started (listening=true but not connected)
    for (const backend of backends) {
      const existingCollector = collectors.get(backend.id);
      const lastConfig = lastBackendConfigs.get(backend.id);

      // Check if we need to start or restart this backend connection
      const needsStart = backend.listening && backend.enabled && !existingCollector;
      const needsRestart = existingCollector && lastConfig && (
        lastConfig.url !== backend.url ||
        lastConfig.token !== backend.token ||
        lastConfig.listening !== backend.listening ||
        lastConfig.enabled !== backend.enabled
      );

      if (needsRestart) {
        console.log(`[Backends] Restarting collector for backend "${backend.name}" (ID: ${backend.id}) due to config change`);
        stopCollector(backend.id);
      }

      if (needsStart || needsRestart) {
        if (backend.listening && backend.enabled) {
          startCollector(backend);
        }
      }

      // Stop collectors for backends that are no longer listening or disabled
      if (existingCollector && (!backend.listening || !backend.enabled)) {
        console.log(`[Backends] Stopping collector for backend "${backend.name}" (ID: ${backend.id}) - listening=${backend.listening}, enabled=${backend.enabled}`);
        stopCollector(backend.id);
      }
    }

    // Stop collectors for deleted backends
    for (const [id, collector] of collectors) {
      if (!currentConfigs.has(id)) {
        console.log(`[Backends] Stopping collector for deleted backend (ID: ${id})`);
        stopCollector(id);
      }
    }

    // Update last known configs
    lastBackendConfigs = currentConfigs;
  } catch (error) {
    console.error('[Backends] Error managing backends:', error);
  }
}

// Start a collector for a specific backend
function startCollector(backend: BackendConfig) {
  if (collectors.has(backend.id)) {
    console.log(`[Collector] Backend "${backend.name}" (ID: ${backend.id}) already has a collector running`);
    return;
  }

  console.log(`[Collector] Starting collector for backend "${backend.name}" (ID: ${backend.id}) at ${backend.url}`);

  // Convert HTTP URL to WebSocket URL
  let wsUrl = backend.url.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://');
  if (!wsUrl.endsWith('/connections')) {
    wsUrl = `${wsUrl}/connections`;
  }

  // Create and start collector
  const collector = createCollector(
    db,
    wsUrl,
    backend.token || undefined,
    geoService,
    () => {
      // Broadcast stats update via WebSocket when new data arrives
      wsServer.broadcastStats(backend.id);
    },
    backend.id // Pass backend ID for data isolation
  );

  collectors.set(backend.id, collector);
  collector.connect();
}

// Stop a collector for a specific backend
function stopCollector(backendId: number) {
  const collector = collectors.get(backendId);
  if (collector) {
    console.log(`[Collector] Stopping collector for backend ID: ${backendId}`);
    collector.disconnect();
    collectors.delete(backendId);
  }
}

// Graceful shutdown
function shutdown() {
  console.log('[Main] Shutting down...');

  // Stop all collectors
  for (const [id, collector] of collectors) {
    console.log(`[Main] Disconnecting collector for backend ID: ${id}`);
    collector.disconnect();
  }
  collectors.clear();

  // Stop servers
  wsServer?.stop();
  apiServer?.stop();

  // Close database
  db?.close();

  console.log('[Main] Shutdown complete');
  process.exit(0);
}

main().catch(console.error);
