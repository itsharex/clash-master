"use client";

import { useState, useEffect, useCallback, useMemo, useRef, useTransition } from "react";
import { useTranslations } from "next-intl";
import { TopDomainsSimple } from "./top-domains-simple";
import { TopProxiesSimple } from "./top-proxies-simple";
import { TopCountriesSimple } from "./top-countries-simple";
import { TrafficTrendChart } from "@/components/traffic-trend-chart";
import { api, type TimeRange } from "@/lib/api";
import type { DomainStats, ProxyStats, CountryStats, TrafficTrendPoint } from "@clashmaster/shared";

type TrendTimeRange = "30m" | "1h" | "24h";
type TrendGranularity = "minute" | "day";
type GlobalTimePreset =
  | "1m"
  | "5m"
  | "15m"
  | "30m"
  | "24h"
  | "7d"
  | "30d"
  | "today"
  | "custom";

interface OverviewTabProps {
  domains: DomainStats[];
  proxies: ProxyStats[];
  countries: CountryStats[];
  timeRange: TimeRange;
  timePreset: GlobalTimePreset;
  activeBackendId?: number;
  onNavigate?: (tab: string) => void;
  backendStatus?: "healthy" | "unhealthy" | "unknown";
}

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const REALTIME_END_TOLERANCE_MS = 2 * 60 * 1000;
const TREND_CACHE_TTL_MS = 60 * 1000;

type TrendCacheEntry = {
  data: TrafficTrendPoint[];
  granularity: TrendGranularity;
  expiresAt: number;
};

// Cache for historical trend data only.
const trendDataCache = new Map<string, TrendCacheEntry>();

function parseIsoDate(value: string): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function getMinuteBucket(durationMs: number): number {
  if (durationMs <= 2 * ONE_HOUR_MS) return 1;
  if (durationMs <= 6 * ONE_HOUR_MS) return 2;
  if (durationMs <= 12 * ONE_HOUR_MS) return 5;
  return 10;
}

function getTrendQuickOptions(durationMs: number): TrendTimeRange[] {
  const options: TrendTimeRange[] = [];
  if (durationMs >= THIRTY_MINUTES_MS) options.push("30m");
  if (durationMs >= ONE_HOUR_MS) options.push("1h");
  if (durationMs >= ONE_DAY_MS) options.push("24h");
  return options;
}

function getQuickRangeMinutes(range: TrendTimeRange): number {
  if (range === "30m") return 30;
  if (range === "1h") return 60;
  return 1440;
}

function parseTrendPointTime(value: string): Date | null {
  const normalized = value.endsWith("Z") ? value : `${value}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function getTrendDataSpanMs(points: TrafficTrendPoint[]): number {
  if (points.length <= 1) return 0;
  let minTs = Number.POSITIVE_INFINITY;
  let maxTs = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    const date = parseTrendPointTime(point.time);
    if (!date) continue;
    const ts = date.getTime();
    if (ts < minTs) minTs = ts;
    if (ts > maxTs) maxTs = ts;
  }
  if (!Number.isFinite(minTs) || !Number.isFinite(maxTs)) return 0;
  return Math.max(0, maxTs - minTs);
}

export function OverviewTab({
  domains,
  proxies,
  countries,
  timeRange,
  timePreset,
  activeBackendId,
  onNavigate,
  backendStatus = "unknown",
}: OverviewTabProps) {
  const dashboardT = useTranslations("dashboard");
  const [domainSort, setDomainSort] = useState<"traffic" | "connections">("traffic");
  const [proxySort, setProxySort] = useState<"traffic" | "connections">("traffic");
  const [countrySort, setCountrySort] = useState<"traffic" | "connections">("traffic");

  // Traffic trend state
  const [trendData, setTrendData] = useState<TrafficTrendPoint[]>([]);
  const [trendGranularity, setTrendGranularity] = useState<TrendGranularity>("minute");
  const [trendTimeRange, setTrendTimeRange] = useState<TrendTimeRange>("24h");
  const [trendLoading, setTrendLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const initialLoadedRef = useRef(false);
  const requestIdRef = useRef(0);

  const parsedRange = useMemo(() => {
    const end = parseIsoDate(timeRange.end) ?? new Date();
    const start = parseIsoDate(timeRange.start) ?? new Date(end.getTime() - ONE_DAY_MS);
    if (start > end) {
      return { start: end, end };
    }
    return { start, end };
  }, [timeRange.end, timeRange.start]);

  const globalDurationMs = useMemo(
    () => Math.max(60 * 1000, parsedRange.end.getTime() - parsedRange.start.getTime()),
    [parsedRange.end, parsedRange.start],
  );

  const isLatestWindow = useMemo(
    () => parsedRange.end.getTime() >= Date.now() - REALTIME_END_TOLERANCE_MS,
    [parsedRange.end],
  );

  const canUseTrendSelector = useMemo(
    () =>
      timePreset !== "custom" &&
      isLatestWindow &&
      globalDurationMs >= THIRTY_MINUTES_MS &&
      globalDurationMs <= ONE_DAY_MS,
    [timePreset, isLatestWindow, globalDurationMs],
  );

  const trendTimeOptions = useMemo(
    () => (canUseTrendSelector ? getTrendQuickOptions(globalDurationMs) : []),
    [canUseTrendSelector, globalDurationMs],
  );

  useEffect(() => {
    if (!canUseTrendSelector) return;
    if (trendTimeOptions.includes(trendTimeRange)) return;
    const fallback = trendTimeOptions[trendTimeOptions.length - 1] ?? "30m";
    setTrendTimeRange(fallback);
  }, [canUseTrendSelector, trendTimeOptions, trendTimeRange]);

  const trendQuery = useMemo(() => {
    const queryEnd = parsedRange.end;
    let queryStart = parsedRange.start;

    if (canUseTrendSelector) {
      const minutes = getQuickRangeMinutes(trendTimeRange);
      queryStart = new Date(queryEnd.getTime() - minutes * 60 * 1000);
    }

    if (queryStart > queryEnd) {
      queryStart = queryEnd;
    }

    const durationMs = Math.max(60 * 1000, queryEnd.getTime() - queryStart.getTime());
    const granularity: TrendGranularity = durationMs > ONE_DAY_MS ? "day" : "minute";
    const bucketMinutes = granularity === "day" ? 24 * 60 : getMinuteBucket(durationMs);
    const minutes = Math.max(1, Math.ceil(durationMs / 60000));
    const realtime = queryEnd.getTime() >= Date.now() - REALTIME_END_TOLERANCE_MS;

    return {
      start: queryStart.toISOString(),
      end: queryEnd.toISOString(),
      durationMs,
      minutes,
      bucketMinutes,
      granularity,
      realtime,
      cacheKey: `${queryStart.toISOString()}-${queryEnd.toISOString()}-${bucketMinutes}`,
    };
  }, [parsedRange.end, parsedRange.start, canUseTrendSelector, trendTimeRange]);

  // Load traffic trend data with caching
  const loadTrendData = useCallback(async (showLoading = false) => {
    if (!activeBackendId) return;

    const baseCacheKey = `${activeBackendId}-${trendQuery.cacheKey}`;
    const fullCacheKey = `${baseCacheKey}-${trendQuery.granularity}-${trendQuery.bucketMinutes}`;
    const cached = trendDataCache.get(fullCacheKey);
    if (!trendQuery.realtime && cached && cached.expiresAt > Date.now()) {
      startTransition(() => {
        setTrendData(cached.data);
        setTrendGranularity(cached.granularity);
      });
      return;
    }

    if (showLoading) {
      setTrendLoading(true);
    }

    const requestId = ++requestIdRef.current;

    try {
      let resolvedGranularity: TrendGranularity = trendQuery.granularity;
      let resolvedBucketMinutes = trendQuery.bucketMinutes;

      let data = await api.getTrafficTrendAggregated(
        activeBackendId,
        trendQuery.minutes,
        resolvedBucketMinutes,
        { start: trendQuery.start, end: trendQuery.end },
      );

      if (requestId !== requestIdRef.current) {
        return;
      }

      // If user selected a long range but actual recorded data only spans
      // a short window, switch to minute-level rendering for better visibility.
      if (trendQuery.granularity === "day" && data.length > 0) {
        const spanMs = getTrendDataSpanMs(data);
        const shouldFallbackToMinute = data.length <= 2 && spanMs <= ONE_DAY_MS;
        if (shouldFallbackToMinute) {
          resolvedGranularity = "minute";
          resolvedBucketMinutes = getMinuteBucket(Math.max(60 * 1000, spanMs || ONE_HOUR_MS));
          const minuteCacheKey = `${baseCacheKey}-${resolvedGranularity}-${resolvedBucketMinutes}`;
          const minuteCached = trendDataCache.get(minuteCacheKey);
          if (!trendQuery.realtime && minuteCached && minuteCached.expiresAt > Date.now()) {
            data = minuteCached.data;
          } else {
            data = await api.getTrafficTrendAggregated(
              activeBackendId,
              trendQuery.minutes,
              resolvedBucketMinutes,
              { start: trendQuery.start, end: trendQuery.end },
            );
          }
          if (requestId !== requestIdRef.current) {
            return;
          }
        }
      }

      if (!trendQuery.realtime) {
        const finalCacheKey = `${baseCacheKey}-${resolvedGranularity}-${resolvedBucketMinutes}`;
        trendDataCache.set(finalCacheKey, {
          data,
          granularity: resolvedGranularity,
          expiresAt: Date.now() + TREND_CACHE_TTL_MS,
        });
      }

      startTransition(() => {
        setTrendData(data);
        setTrendGranularity(resolvedGranularity);
      });
    } catch (error) {
      console.error("Failed to load traffic trend:", error);
    } finally {
      setTrendLoading(false);
    }
  }, [
    activeBackendId,
    trendQuery.cacheKey,
    trendQuery.realtime,
    trendQuery.minutes,
    trendQuery.bucketMinutes,
    trendQuery.start,
    trendQuery.end,
  ]);

  // Initial load marker reset on backend switch.
  useEffect(() => {
    initialLoadedRef.current = false;
  }, [activeBackendId]);

  // Reload when backend/global range/trend selector changes.
  useEffect(() => {
    if (!activeBackendId) return;
    const showLoading = !initialLoadedRef.current || !trendQuery.realtime;
    loadTrendData(showLoading);
    initialLoadedRef.current = true;
  }, [activeBackendId, loadTrendData, trendQuery.realtime]);

  // Handle time range change with transition
  const handleTimeRangeChange = (range: TrendTimeRange) => {
    startTransition(() => {
      setTrendTimeRange(range);
    });
  };

  return (
    <div className="space-y-6">
      {/* Traffic Trend Chart - Full width */}
      <TrafficTrendChart 
        data={trendData}
        granularity={trendGranularity}
        timeRange={canUseTrendSelector ? trendTimeRange : undefined}
        timeRangeOptions={trendTimeOptions}
        onTimeRangeChange={canUseTrendSelector ? handleTimeRangeChange : undefined}
        isLoading={trendLoading || isPending}
        emptyHint={backendStatus === "unhealthy" ? dashboardT("backendUnavailableHint") : undefined}
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Domains */}
        <TopDomainsSimple 
          domains={domains} 
          sortBy={domainSort}
          onSortChange={setDomainSort}
          onViewAll={() => onNavigate?.("domains")}
        />
        
        {/* Top Proxies */}
        <TopProxiesSimple 
          proxies={proxies}
          sortBy={proxySort}
          onSortChange={setProxySort}
          onViewAll={() => onNavigate?.("proxies")}
        />
        
        {/* Top Countries */}
        <TopCountriesSimple 
          countries={countries}
          sortBy={countrySort}
          onSortChange={setCountrySort}
          onViewAll={() => onNavigate?.("countries")}
        />
      </div>
    </div>
  );
}
