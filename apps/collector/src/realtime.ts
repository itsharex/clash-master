import type {
  CountryStats,
  DomainStats,
  IPStats,
  ProxyStats,
  StatsSummary,
  TrafficTrendPoint,
} from '@clashmaster/shared';

type SummaryDelta = {
  upload: number;
  download: number;
  connections: number;
  lastUpdated: number;
};

type MinuteBucket = {
  upload: number;
  download: number;
  lastUpdated: number;
};

type ProxyDelta = {
  chain: string;
  totalUpload: number;
  totalDownload: number;
  totalConnections: number;
  lastSeen: string;
};

type CountryDelta = {
  country: string;
  countryName: string;
  continent: string;
  totalUpload: number;
  totalDownload: number;
  totalConnections: number;
  lastSeen: string;
};

type DomainDelta = {
  domain: string;
  totalUpload: number;
  totalDownload: number;
  totalConnections: number;
  lastSeen: string;
  ips: Set<string>;
  rules: Set<string>;
  chains: Set<string>;
};

type IPDelta = {
  ip: string;
  totalUpload: number;
  totalDownload: number;
  totalConnections: number;
  lastSeen: string;
  domains: Set<string>;
  chains: Set<string>;
};

export type TrafficMeta = {
  domain: string;
  ip: string;
  chains: string[];
  rule: string;
  rulePayload: string;
  upload: number;
  download: number;
};

function toMinuteKey(tsMs: number): string {
  const iso = new Date(tsMs).toISOString();
  return `${iso.slice(0, 16)}:00`;
}

function bucketMinuteKey(minuteKey: string, bucketMinutes: number): string {
  if (bucketMinutes <= 1) return minuteKey;
  const minute = parseInt(minuteKey.slice(14, 16), 10);
  const bucketMinute = Math.floor(minute / bucketMinutes) * bucketMinutes;
  return `${minuteKey.slice(0, 14)}${String(bucketMinute).padStart(2, '0')}:00`;
}

export class RealtimeStore {
  private summaryByBackend = new Map<number, SummaryDelta>();
  private minuteByBackend = new Map<number, Map<string, MinuteBucket>>();
  private domainByBackend = new Map<number, Map<string, DomainDelta>>();
  private ipByBackend = new Map<number, Map<string, IPDelta>>();
  private proxyByBackend = new Map<number, Map<string, ProxyDelta>>();
  private countryByBackend = new Map<number, Map<string, CountryDelta>>();
  private maxMinutes: number;

  constructor(maxMinutes = parseInt(process.env.REALTIME_MAX_MINUTES || '180', 10)) {
    this.maxMinutes = Number.isFinite(maxMinutes) ? Math.max(30, maxMinutes) : 180;
  }

  recordTraffic(
    backendId: number,
    meta: TrafficMeta,
    connections = 1,
    timestamp = Date.now()
  ): void {
    if (meta.upload <= 0 && meta.download <= 0) return;

    const summary = this.summaryByBackend.get(backendId) || {
      upload: 0,
      download: 0,
      connections: 0,
      lastUpdated: 0,
    };
    summary.upload += meta.upload;
    summary.download += meta.download;
    summary.connections += connections;
    summary.lastUpdated = timestamp;
    this.summaryByBackend.set(backendId, summary);

    const minuteKey = toMinuteKey(timestamp);
    let minuteMap = this.minuteByBackend.get(backendId);
    if (!minuteMap) {
      minuteMap = new Map();
      this.minuteByBackend.set(backendId, minuteMap);
    }
    const bucket = minuteMap.get(minuteKey) || { upload: 0, download: 0, lastUpdated: 0 };
    bucket.upload += meta.upload;
    bucket.download += meta.download;
    bucket.lastUpdated = timestamp;
    minuteMap.set(minuteKey, bucket);

    this.pruneOldBuckets(minuteMap, timestamp);

    const ruleName =
      meta.chains.length > 1
        ? meta.chains[meta.chains.length - 1]
        : meta.rulePayload
          ? `${meta.rule}(${meta.rulePayload})`
          : meta.rule;
    const fullChain = meta.chains.join(' > ');
    const lastSeen = new Date(timestamp).toISOString();

    if (meta.domain) {
      let domainMap = this.domainByBackend.get(backendId);
      if (!domainMap) {
        domainMap = new Map();
        this.domainByBackend.set(backendId, domainMap);
      }

      const domainDelta = domainMap.get(meta.domain) || {
        domain: meta.domain,
        totalUpload: 0,
        totalDownload: 0,
        totalConnections: 0,
        lastSeen,
        ips: new Set<string>(),
        rules: new Set<string>(),
        chains: new Set<string>(),
      };

      domainDelta.totalUpload += meta.upload;
      domainDelta.totalDownload += meta.download;
      domainDelta.totalConnections += connections;
      domainDelta.lastSeen = lastSeen;
      if (meta.ip) domainDelta.ips.add(meta.ip);
      if (ruleName) domainDelta.rules.add(ruleName);
      if (fullChain) domainDelta.chains.add(fullChain);
      domainMap.set(meta.domain, domainDelta);
    }

    if (meta.ip) {
      let ipMap = this.ipByBackend.get(backendId);
      if (!ipMap) {
        ipMap = new Map();
        this.ipByBackend.set(backendId, ipMap);
      }

      const ipDelta = ipMap.get(meta.ip) || {
        ip: meta.ip,
        totalUpload: 0,
        totalDownload: 0,
        totalConnections: 0,
        lastSeen,
        domains: new Set<string>(),
        chains: new Set<string>(),
      };

      ipDelta.totalUpload += meta.upload;
      ipDelta.totalDownload += meta.download;
      ipDelta.totalConnections += connections;
      ipDelta.lastSeen = lastSeen;
      const ipDomain = meta.domain || 'unknown';
      if (ipDomain) ipDelta.domains.add(ipDomain);
      if (fullChain) ipDelta.chains.add(fullChain);
      ipMap.set(meta.ip, ipDelta);
    }

    const proxyChain = meta.chains[0] || 'DIRECT';
    let proxyMap = this.proxyByBackend.get(backendId);
    if (!proxyMap) {
      proxyMap = new Map();
      this.proxyByBackend.set(backendId, proxyMap);
    }

    const proxyDelta = proxyMap.get(proxyChain) || {
      chain: proxyChain,
      totalUpload: 0,
      totalDownload: 0,
      totalConnections: 0,
      lastSeen,
    };

    proxyDelta.totalUpload += meta.upload;
    proxyDelta.totalDownload += meta.download;
    proxyDelta.totalConnections += connections;
    proxyDelta.lastSeen = lastSeen;
    proxyMap.set(proxyChain, proxyDelta);
  }

  recordCountryTraffic(
    backendId: number,
    geo: { country: string; country_name: string; continent: string },
    upload: number,
    download: number,
    connections = 1,
    timestamp = Date.now(),
  ): void {
    if (upload <= 0 && download <= 0) return;

    const lastSeen = new Date(timestamp).toISOString();
    let countryMap = this.countryByBackend.get(backendId);
    if (!countryMap) {
      countryMap = new Map();
      this.countryByBackend.set(backendId, countryMap);
    }

    const key = geo.country || 'Unknown';
    const countryDelta = countryMap.get(key) || {
      country: key,
      countryName: geo.country_name || geo.country || 'Unknown',
      continent: geo.continent || 'Unknown',
      totalUpload: 0,
      totalDownload: 0,
      totalConnections: 0,
      lastSeen,
    };

    countryDelta.totalUpload += upload;
    countryDelta.totalDownload += download;
    countryDelta.totalConnections += connections;
    countryDelta.lastSeen = lastSeen;
    countryMap.set(key, countryDelta);
  }

  getSummaryDelta(backendId: number): SummaryDelta {
    return this.summaryByBackend.get(backendId) || {
      upload: 0,
      download: 0,
      connections: 0,
      lastUpdated: 0,
    };
  }

  getTodayDelta(backendId: number, nowMs = Date.now()): { upload: number; download: number } {
    const minuteMap = this.minuteByBackend.get(backendId);
    if (!minuteMap || minuteMap.size === 0) return { upload: 0, download: 0 };

    const todayPrefix = new Date(nowMs).toISOString().slice(0, 10);
    let upload = 0;
    let download = 0;

    for (const [minuteKey, bucket] of minuteMap) {
      if (minuteKey.startsWith(todayPrefix)) {
        upload += bucket.upload;
        download += bucket.download;
      }
    }

    return { upload, download };
  }

  applySummaryDelta<T extends { totalUpload: number; totalDownload: number; totalConnections: number }>(
    backendId: number,
    base: T,
  ): T {
    const delta = this.getSummaryDelta(backendId);
    if (delta.upload === 0 && delta.download === 0 && delta.connections === 0) {
      return base;
    }

    return {
      ...base,
      totalUpload: base.totalUpload + delta.upload,
      totalDownload: base.totalDownload + delta.download,
      totalConnections: base.totalConnections + delta.connections,
    };
  }

  mergeTrend(
    backendId: number,
    basePoints: TrafficTrendPoint[],
    minutes: number,
    bucketMinutes = 1,
    nowMs = Date.now(),
  ): TrafficTrendPoint[] {
    const minuteMap = this.minuteByBackend.get(backendId);
    if (!minuteMap || minuteMap.size === 0) return basePoints;

    const cutoffKey = toMinuteKey(nowMs - minutes * 60 * 1000);
    const deltaMap = new Map<string, { upload: number; download: number }>();

    for (const [minuteKey, bucket] of minuteMap) {
      if (minuteKey < cutoffKey) continue;
      const bucketKey = bucketMinuteKey(minuteKey, bucketMinutes);
      const existing = deltaMap.get(bucketKey);
      if (existing) {
        existing.upload += bucket.upload;
        existing.download += bucket.download;
      } else {
        deltaMap.set(bucketKey, { upload: bucket.upload, download: bucket.download });
      }
    }

    if (deltaMap.size === 0) return basePoints;

    const merged = new Map<string, { upload: number; download: number }>();
    for (const point of basePoints) {
      merged.set(point.time, { upload: point.upload, download: point.download });
    }

    for (const [time, delta] of deltaMap) {
      const existing = merged.get(time);
      if (existing) {
        existing.upload += delta.upload;
        existing.download += delta.download;
      } else {
        merged.set(time, { upload: delta.upload, download: delta.download });
      }
    }

    return Array.from(merged.entries())
      .map(([time, data]) => ({ time, upload: data.upload, download: data.download }))
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  mergeTopDomains(backendId: number, base: DomainStats[], limit: number): DomainStats[] {
    const domainMap = this.domainByBackend.get(backendId);
    if (!domainMap || domainMap.size === 0) return base;

    const merged = new Map<string, DomainStats>();
    for (const item of base) {
      merged.set(item.domain, { ...item });
    }

    for (const [domain, delta] of domainMap) {
      const existing = merged.get(domain);
      if (existing) {
        existing.totalUpload += delta.totalUpload;
        existing.totalDownload += delta.totalDownload;
        existing.totalConnections += delta.totalConnections;
        if (delta.lastSeen > existing.lastSeen) {
          existing.lastSeen = delta.lastSeen;
        }
        if (delta.ips.size > 0) {
          const ips = new Set(existing.ips || []);
          for (const ip of delta.ips) ips.add(ip);
          existing.ips = Array.from(ips);
        }
        if (delta.rules.size > 0) {
          const rules = new Set(existing.rules || []);
          for (const rule of delta.rules) rules.add(rule);
          existing.rules = Array.from(rules);
        }
        if (delta.chains.size > 0) {
          const chains = new Set(existing.chains || []);
          for (const chain of delta.chains) chains.add(chain);
          existing.chains = Array.from(chains);
        }
      } else {
        merged.set(domain, {
          domain,
          totalUpload: delta.totalUpload,
          totalDownload: delta.totalDownload,
          totalConnections: delta.totalConnections,
          lastSeen: delta.lastSeen,
          ips: Array.from(delta.ips),
          rules: Array.from(delta.rules),
          chains: Array.from(delta.chains),
        });
      }
    }

    return Array.from(merged.values())
      .sort((a, b) => (b.totalDownload + b.totalUpload) - (a.totalDownload + a.totalUpload))
      .slice(0, limit);
  }

  mergeTopIPs(backendId: number, base: IPStats[], limit: number): IPStats[] {
    const ipMap = this.ipByBackend.get(backendId);
    if (!ipMap || ipMap.size === 0) return base;

    const merged = new Map<string, IPStats>();
    for (const item of base) {
      merged.set(item.ip, { ...item });
    }

    for (const [ip, delta] of ipMap) {
      const existing = merged.get(ip);
      if (existing) {
        existing.totalUpload += delta.totalUpload;
        existing.totalDownload += delta.totalDownload;
        existing.totalConnections += delta.totalConnections;
        if (delta.lastSeen > existing.lastSeen) {
          existing.lastSeen = delta.lastSeen;
        }
        if (delta.domains.size > 0) {
          const domains = new Set(existing.domains || []);
          for (const domain of delta.domains) domains.add(domain);
          existing.domains = Array.from(domains);
        }
        if (delta.chains.size > 0) {
          const chains = new Set(existing.chains || []);
          for (const chain of delta.chains) chains.add(chain);
          existing.chains = Array.from(chains);
        }
      } else {
        merged.set(ip, {
          ip,
          totalUpload: delta.totalUpload,
          totalDownload: delta.totalDownload,
          totalConnections: delta.totalConnections,
          lastSeen: delta.lastSeen,
          domains: Array.from(delta.domains),
          chains: Array.from(delta.chains),
        });
      }
    }

    return Array.from(merged.values())
      .sort((a, b) => (b.totalDownload + b.totalUpload) - (a.totalDownload + a.totalUpload))
      .slice(0, limit);
  }

  mergeProxyStats(backendId: number, base: ProxyStats[]): ProxyStats[] {
    const proxyMap = this.proxyByBackend.get(backendId);
    if (!proxyMap || proxyMap.size === 0) return base;

    const merged = new Map<string, ProxyStats>();
    for (const item of base) {
      merged.set(item.chain, { ...item });
    }

    for (const [chain, delta] of proxyMap) {
      const existing = merged.get(chain);
      if (existing) {
        existing.totalUpload += delta.totalUpload;
        existing.totalDownload += delta.totalDownload;
        existing.totalConnections += delta.totalConnections;
        if (delta.lastSeen > existing.lastSeen) {
          existing.lastSeen = delta.lastSeen;
        }
      } else {
        merged.set(chain, {
          chain,
          totalUpload: delta.totalUpload,
          totalDownload: delta.totalDownload,
          totalConnections: delta.totalConnections,
          lastSeen: delta.lastSeen,
        });
      }
    }

    return Array.from(merged.values()).sort(
      (a, b) => (b.totalDownload + b.totalUpload) - (a.totalDownload + a.totalUpload),
    );
  }

  mergeCountryStats(backendId: number, base: CountryStats[]): CountryStats[] {
    const countryMap = this.countryByBackend.get(backendId);
    if (!countryMap || countryMap.size === 0) return base;

    const merged = new Map<string, CountryStats>();
    for (const item of base) {
      merged.set(item.country, { ...item });
    }

    for (const [country, delta] of countryMap) {
      const existing = merged.get(country);
      if (existing) {
        existing.totalUpload += delta.totalUpload;
        existing.totalDownload += delta.totalDownload;
        existing.totalConnections += delta.totalConnections;
        if (!existing.countryName && delta.countryName) {
          existing.countryName = delta.countryName;
        }
        if (!existing.continent && delta.continent) {
          existing.continent = delta.continent;
        }
        if (delta.lastSeen && (!existing.lastSeen || delta.lastSeen > existing.lastSeen)) {
          existing.lastSeen = delta.lastSeen;
        }
      } else {
        merged.set(country, {
          country,
          countryName: delta.countryName,
          continent: delta.continent,
          totalUpload: delta.totalUpload,
          totalDownload: delta.totalDownload,
          totalConnections: delta.totalConnections,
          lastSeen: delta.lastSeen,
        });
      }
    }

    return Array.from(merged.values()).sort(
      (a, b) => (b.totalDownload + b.totalUpload) - (a.totalDownload + a.totalUpload),
    );
  }

  clearTraffic(backendId: number): void {
    this.summaryByBackend.delete(backendId);
    this.minuteByBackend.delete(backendId);
    this.domainByBackend.delete(backendId);
    this.ipByBackend.delete(backendId);
    this.proxyByBackend.delete(backendId);
  }

  clearCountries(backendId: number): void {
    this.countryByBackend.delete(backendId);
  }

  clearBackend(backendId: number): void {
    this.clearTraffic(backendId);
    this.clearCountries(backendId);
  }

  private pruneOldBuckets(minuteMap: Map<string, MinuteBucket>, nowMs: number): void {
    const cutoffKey = toMinuteKey(nowMs - this.maxMinutes * 60 * 1000);
    for (const key of minuteMap.keys()) {
      if (key < cutoffKey) {
        minuteMap.delete(key);
      }
    }
  }
}

export const realtimeStore = new RealtimeStore();
