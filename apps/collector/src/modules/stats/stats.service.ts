/**
 * Stats Service - Business logic for statistics
 */

import type { StatsDatabase } from '../../db.js';
import type { RealtimeStore } from '../../realtime.js';
import type {
  SummaryResponse,
  GlobalSummary,
  PaginatedDomainStats,
  PaginatedIPStats,
  TrafficTrendPoint,
  TimeRange,
  CountryStats,
  DomainStats,
  IPStats,
  ProxyStats,
  RuleStats,
  HourlyStats,
  DeviceStats,
} from './stats.types.js';

interface PaginatedStatsOptions {
  offset?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
  search?: string;
  start?: string;
  end?: string;
}

export class StatsService {
  constructor(
    private db: StatsDatabase,
    private realtimeStore: RealtimeStore,
  ) {}

  /**
   * Resolve backend ID from query param or active backend fallback
   */
  resolveBackendId(rawBackendId?: string): number | null {
    if (rawBackendId) {
      const id = Number.parseInt(rawBackendId, 10);
      return Number.isNaN(id) ? null : id;
    }
    return this.db.getActiveBackend()?.id ?? null;
  }

  /**
   * Parse limit parameter with fallback and max
   */
  parseLimit(raw: string | undefined, fallback: number, max: number): number {
    if (raw === undefined || raw === null || raw === '') {
      return fallback;
    }
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.min(parsed, max);
  }

  /**
   * Check if realtime data should be included
   */
  shouldIncludeRealtime(timeRange: TimeRange): boolean {
    if (!timeRange.active) {
      return true;
    }
    if (!timeRange.end) {
      return false;
    }

    const endMs = new Date(timeRange.end).getTime();
    if (Number.isNaN(endMs)) {
      return false;
    }

    // For "latest window" queries (end close to now), keep merging in-memory deltas
    // so dashboard updates stay near real-time between DB flushes.
    const toleranceMs = parseInt(
      process.env.REALTIME_RANGE_END_TOLERANCE_MS || '120000',
      10,
    );
    const windowMs = Number.isFinite(toleranceMs)
      ? Math.max(10_000, toleranceMs)
      : 120_000;
    return endMs >= Date.now() - windowMs;
  }

  /**
   * Get summary statistics for a specific backend
   */
  getSummary(backendId: number, timeRange: TimeRange): SummaryResponse {
    const includeRealtime = this.shouldIncludeRealtime(timeRange);
    
    const backend = this.db.getBackend(backendId);
    if (!backend) {
      throw new Error('Backend not found');
    }

    const summary = this.db.getSummary(backendId, timeRange.start, timeRange.end);
    const summaryWithRealtime = includeRealtime
      ? this.realtimeStore.applySummaryDelta(backendId, summary)
      : summary;

    const dbTopDomains = this.db.getTopDomains(backendId, 10, timeRange.start, timeRange.end);
    const topDomains = includeRealtime
      ? this.realtimeStore.mergeTopDomains(backendId, dbTopDomains, 10)
      : dbTopDomains;

    const dbTopIPs = this.db.getTopIPs(backendId, 10, timeRange.start, timeRange.end);
    const topIPs = includeRealtime
      ? this.realtimeStore.mergeTopIPs(backendId, dbTopIPs, 10)
      : dbTopIPs;

    const dbProxyStats = this.db.getProxyStats(backendId, timeRange.start, timeRange.end);
    const proxyStats = includeRealtime
      ? this.realtimeStore.mergeProxyStats(backendId, dbProxyStats)
      : dbProxyStats;

    const dbRuleStats = this.db.getRuleStats(backendId, timeRange.start, timeRange.end);
    const ruleStats = includeRealtime
      ? this.realtimeStore.mergeRuleStats(backendId, dbRuleStats)
      : dbRuleStats;

    const hourlyStats = this.db.getHourlyStats(backendId, 24, timeRange.start, timeRange.end);
    const todayTraffic = this.db.getTrafficInRange(backendId, timeRange.start, timeRange.end);
    const todayDelta = includeRealtime
      ? this.realtimeStore.getTodayDelta(backendId)
      : { upload: 0, download: 0 };

    return {
      backend: {
        id: backend.id,
        name: backend.name,
        isActive: backend.is_active,
        listening: backend.listening,
      },
      totalConnections: summaryWithRealtime.totalConnections,
      totalUpload: summaryWithRealtime.totalUpload,
      totalDownload: summaryWithRealtime.totalDownload,
      totalDomains: summary.uniqueDomains,
      totalIPs: summary.uniqueIPs,
      totalRules: ruleStats.length,
      totalProxies: proxyStats.length,
      todayUpload: todayTraffic.upload + todayDelta.upload,
      todayDownload: todayTraffic.download + todayDelta.download,
      topDomains,
      topIPs,
      proxyStats,
      ruleStats,
      hourlyStats,
    };
  }

  /**
   * Get global summary across all backends
   */
  getGlobalSummary(): GlobalSummary {
    return this.db.getGlobalSummary();
  }

  /**
   * Get domain statistics for a specific backend (paginated)
   */
  getDomainStatsPaginated(backendId: number, timeRange: TimeRange, options: PaginatedStatsOptions): PaginatedDomainStats {
    const stats = this.db.getDomainStatsPaginated(backendId, {
      offset: options.offset,
      limit: options.limit,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
      search: options.search,
      start: timeRange.start,
      end: timeRange.end,
    });

    if (this.shouldIncludeRealtime(timeRange)) {
      return this.realtimeStore.mergeDomainStatsPaginated(backendId, stats, {
        offset: options.offset,
        limit: options.limit,
        sortBy: options.sortBy,
        sortOrder: options.sortOrder,
        search: options.search,
      });
    }
    return stats;
  }

  /**
   * Get IP statistics for a specific backend (paginated)
   */
  getIPStatsPaginated(backendId: number, timeRange: TimeRange, options: PaginatedStatsOptions): PaginatedIPStats {
    const stats = this.db.getIPStatsPaginated(backendId, {
      offset: options.offset,
      limit: options.limit,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
      search: options.search,
      start: timeRange.start,
      end: timeRange.end,
    });

    if (this.shouldIncludeRealtime(timeRange)) {
      return this.realtimeStore.mergeIPStatsPaginated(backendId, stats, {
        offset: options.offset,
        limit: options.limit,
        sortBy: options.sortBy,
        sortOrder: options.sortOrder,
        search: options.search,
      });
    }
    return stats;
  }

  /**
   * Get per-proxy traffic breakdown for a specific domain
   */
  getDomainProxyStats(
    backendId: number,
    domain: string,
    timeRange: TimeRange,
    sourceIP?: string,
    sourceChain?: string,
  ): any[] {
    return this.db.getDomainProxyStats(backendId, domain, timeRange.start, timeRange.end, sourceIP, sourceChain);
  }

  /**
   * Get IP details for a specific domain
   */
  getDomainIPDetails(
    backendId: number,
    domain: string,
    timeRange: TimeRange,
    limit: number,
    sourceIP?: string,
    sourceChain?: string,
  ): IPStats[] {
    return this.db.getDomainIPDetails(backendId, domain, timeRange.start, timeRange.end, limit, sourceIP, sourceChain);
  }

  /**
   * Get per-proxy traffic breakdown for a specific IP
   */
  getIPProxyStats(
    backendId: number,
    ip: string,
    timeRange: TimeRange,
    sourceIP?: string,
    sourceChain?: string,
  ): any[] {
    return this.db.getIPProxyStats(backendId, ip, timeRange.start, timeRange.end, sourceIP, sourceChain);
  }

  /**
   * Get domain details for a specific IP
   */
  getIPDomainDetails(
    backendId: number,
    ip: string,
    timeRange: TimeRange,
    limit: number,
    sourceIP?: string,
    sourceChain?: string,
  ): DomainStats[] {
    return this.db.getIPDomainDetails(backendId, ip, timeRange.start, timeRange.end, limit, sourceIP, sourceChain);
  }

  /**
   * Get domains for a specific proxy/chain
   */
  getProxyDomains(backendId: number, chain: string, timeRange: TimeRange, limit: number): DomainStats[] {
    const stats = this.db.getProxyDomains(backendId, chain, limit, timeRange.start, timeRange.end);
    if (this.shouldIncludeRealtime(timeRange)) {
      return this.realtimeStore.mergeProxyDomains(backendId, chain, stats, limit);
    }
    return stats;
  }

  /**
   * Get IPs for a specific proxy/chain
   */
  getProxyIPs(backendId: number, chain: string, timeRange: TimeRange, limit: number): IPStats[] {
    const stats = this.db.getProxyIPs(backendId, chain, limit, timeRange.start, timeRange.end);
    if (this.shouldIncludeRealtime(timeRange)) {
      return this.realtimeStore.mergeProxyIPs(backendId, chain, stats, limit);
    }
    return stats;
  }

  /**
   * Get proxy/chain statistics for a specific backend
   */
  getProxyStats(backendId: number, timeRange: TimeRange): ProxyStats[] {
    const stats = this.db.getProxyStats(backendId, timeRange.start, timeRange.end);
    if (this.shouldIncludeRealtime(timeRange)) {
      return this.realtimeStore.mergeProxyStats(backendId, stats);
    }
    return stats;
  }

  /**
   * Get rule statistics for a specific backend
   */
  getRuleStats(backendId: number, timeRange: TimeRange): RuleStats[] {
    const stats = this.db.getRuleStats(backendId, timeRange.start, timeRange.end);
    if (this.shouldIncludeRealtime(timeRange)) {
      return this.realtimeStore.mergeRuleStats(backendId, stats);
    }
    return stats;
  }

  /**
   * Get domains for a specific rule
   */
  getRuleDomains(backendId: number, rule: string, timeRange: TimeRange, limit: number): DomainStats[] {
    const stats = this.db.getRuleDomains(backendId, rule, limit, timeRange.start, timeRange.end);
    if (this.shouldIncludeRealtime(timeRange)) {
      return this.realtimeStore.mergeRuleDomains(backendId, rule, stats, limit);
    }
    return stats;
  }

  /**
   * Get IPs for a specific rule
   */
  getRuleIPs(backendId: number, rule: string, timeRange: TimeRange, limit: number): IPStats[] {
    const stats = this.db.getRuleIPs(backendId, rule, limit, timeRange.start, timeRange.end);
    if (this.shouldIncludeRealtime(timeRange)) {
      return this.realtimeStore.mergeRuleIPs(backendId, rule, stats, limit);
    }
    return stats;
  }

  /**
   * Get per-proxy traffic breakdown for a specific domain under a specific rule
   */
  getRuleDomainProxyStats(backendId: number, rule: string, domain: string, timeRange: TimeRange): any[] {
    return this.db.getRuleDomainProxyStats(backendId, rule, domain, timeRange.start, timeRange.end);
  }

  /**
   * Get IP details for a specific domain under a specific rule
   */
  getRuleDomainIPDetails(backendId: number, rule: string, domain: string, timeRange: TimeRange, limit: number): IPStats[] {
    return this.db.getRuleDomainIPDetails(backendId, rule, domain, timeRange.start, timeRange.end, limit);
  }

  /**
   * Get per-proxy traffic breakdown for a specific IP under a specific rule
   */
  getRuleIPProxyStats(backendId: number, rule: string, ip: string, timeRange: TimeRange): any[] {
    return this.db.getRuleIPProxyStats(backendId, rule, ip, timeRange.start, timeRange.end);
  }

  /**
   * Get domain details for a specific IP under a specific rule
   */
  getRuleIPDomainDetails(backendId: number, rule: string, ip: string, timeRange: TimeRange, limit: number): DomainStats[] {
    return this.db.getRuleIPDomainDetails(backendId, rule, ip, timeRange.start, timeRange.end, limit);
  }

  /**
   * Get rule chain flow for a specific rule
   */
  getRuleChainFlow(backendId: number, rule: string, timeRange: TimeRange): any {
    return this.db.getRuleChainFlow(backendId, rule, timeRange.start, timeRange.end);
  }

  /**
   * Get all rule chain flows merged into unified DAG
   */
  getAllRuleChainFlows(backendId: number, timeRange: TimeRange): any {
    return this.db.getAllRuleChainFlows(backendId, timeRange.start, timeRange.end);
  }

  /**
   * Get rule to proxy mapping for a specific backend
   */
  getRuleProxyMap(backendId: number): any {
    return this.db.getRuleProxyMap(backendId);
  }

  /**
   * Get country traffic statistics for a specific backend
   */
  getCountryStats(backendId: number, timeRange: TimeRange, limit: number): CountryStats[] {
    const stats = this.db.getCountryStats(backendId, limit, timeRange.start, timeRange.end);
    if (this.shouldIncludeRealtime(timeRange)) {
      return this.realtimeStore.mergeCountryStats(backendId, stats);
    }
    return stats;
  }

  /**
   * Get device statistics for a specific backend
   */
  getDeviceStats(backendId: number, timeRange: TimeRange, limit: number): DeviceStats[] {
    const stats = this.db.getDevices(backendId, limit, timeRange.start, timeRange.end);
    if (this.shouldIncludeRealtime(timeRange)) {
      return this.realtimeStore.mergeDeviceStats(backendId, stats, limit);
    }
    return stats;
  }

  /**
   * Get domains for a specific device
   */
  getDeviceDomains(backendId: number, sourceIP: string, timeRange: TimeRange, limit: number): DomainStats[] {
    if (!sourceIP) return [];
    const stats = this.db.getDeviceDomains(backendId, sourceIP, limit, timeRange.start, timeRange.end);
    if (this.shouldIncludeRealtime(timeRange)) {
      return this.realtimeStore.mergeDeviceDomains(backendId, sourceIP, stats, limit);
    }
    return stats;
  }

  /**
   * Get IPs for a specific device
   */
  getDeviceIPs(backendId: number, sourceIP: string, timeRange: TimeRange, limit: number): IPStats[] {
    if (!sourceIP) return [];
    const stats = this.db.getDeviceIPs(backendId, sourceIP, limit, timeRange.start, timeRange.end);
    if (this.shouldIncludeRealtime(timeRange)) {
      return this.realtimeStore.mergeDeviceIPs(backendId, sourceIP, stats, limit);
    }
    return stats;
  }

  /**
   * Get hourly statistics for a specific backend
   */
  getHourlyStats(backendId: number, timeRange: TimeRange, hours: number): HourlyStats[] {
    return this.db.getHourlyStats(backendId, hours, timeRange.start, timeRange.end);
  }

  /**
   * Get traffic trend for a specific backend
   */
  getTrafficTrend(backendId: number, timeRange: TimeRange, minutes: number): TrafficTrendPoint[] {
    const base = this.db.getTrafficTrend(backendId, minutes, timeRange.start, timeRange.end);
    if (!this.shouldIncludeRealtime(timeRange)) {
      return base;
    }
    return this.realtimeStore.mergeTrend(backendId, base, minutes, 1);
  }

  /**
   * Get traffic trend aggregated by time buckets for chart display
   */
  getTrafficTrendAggregated(
    backendId: number,
    timeRange: TimeRange,
    minutes: number,
    bucketMinutes: number,
  ): TrafficTrendPoint[] {
    const base = this.db.getTrafficTrendAggregated(backendId, minutes, bucketMinutes, timeRange.start, timeRange.end);
    if (!this.shouldIncludeRealtime(timeRange)) {
      return base;
    }
    return this.realtimeStore.mergeTrend(backendId, base, minutes, bucketMinutes);
  }

  /**
   * Get recent connections for a specific backend
   */
  getRecentConnections(backendId: number, limit: number): any[] {
    return this.db.getRecentConnections(backendId, limit);
  }
}
