"use client";

import { useState, useEffect, useCallback, useRef, useTransition } from "react";
import { TopDomainsSimple } from "./top-domains-simple";
import { TopProxiesSimple } from "./top-proxies-simple";
import { TopCountriesSimple } from "./top-countries-simple";
import { TrafficTrendChart } from "@/components/traffic-trend-chart";
import { api } from "@/lib/api";
import type { DomainStats, ProxyStats, CountryStats, TrafficTrendPoint } from "@clashmaster/shared";

type TrendTimeRange = "30m" | "1h" | "24h";

interface OverviewTabProps {
  domains: DomainStats[];
  proxies: ProxyStats[];
  countries: CountryStats[];
  activeBackendId?: number;
  onNavigate?: (tab: string) => void;
}

// Cache for trend data: key = `${backendId}-${timeRange}`
const trendDataCache = new Map<string, TrafficTrendPoint[]>();

export function OverviewTab({ domains, proxies, countries, activeBackendId, onNavigate }: OverviewTabProps) {
  const [domainSort, setDomainSort] = useState<"traffic" | "connections">("traffic");
  const [proxySort, setProxySort] = useState<"traffic" | "connections">("traffic");
  const [countrySort, setCountrySort] = useState<"traffic" | "connections">("traffic");
  
  // Traffic trend state
  const [trendData, setTrendData] = useState<TrafficTrendPoint[]>([]);
  const [trendTimeRange, setTrendTimeRange] = useState<TrendTimeRange>("1h");
  const [trendLoading, setTrendLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const initialLoadedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load traffic trend data with caching
  const loadTrendData = useCallback(async (showLoading = false) => {
    if (!activeBackendId) return;
    
    const cacheKey = `${activeBackendId}-${trendTimeRange}`;
    
    // Check cache first
    const cached = trendDataCache.get(cacheKey);
    if (cached) {
      startTransition(() => {
        setTrendData(cached);
      });
      // Still fetch fresh data in background
    }
    
    if (showLoading && !cached) setTrendLoading(true);
    
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    try {
      let data: TrafficTrendPoint[];
      
      // Use aggregated API for large time ranges to reduce data volume
      if (trendTimeRange === "24h") {
        // For 24h, aggregate by 10-minute buckets
        data = await api.getTrafficTrendAggregated(activeBackendId, 1440, 10);
      } else if (trendTimeRange === "1h") {
        // For 1h, aggregate by 2-minute buckets  
        data = await api.getTrafficTrendAggregated(activeBackendId, 60, 2);
      } else {
        // For 30m, use raw data (1-minute buckets)
        data = await api.getTrafficTrendAggregated(activeBackendId, 30, 1);
      }
      
      // Update cache
      trendDataCache.set(cacheKey, data);
      
      // Update state with transition to avoid blocking UI
      startTransition(() => {
        setTrendData(data);
      });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error("Failed to load traffic trend:", error);
      }
    } finally {
      setTrendLoading(false);
    }
  }, [trendTimeRange, activeBackendId]);

  // Initial load
  useEffect(() => {
    if (!initialLoadedRef.current && activeBackendId) {
      loadTrendData(true);
      initialLoadedRef.current = true;
    }
  }, [loadTrendData, activeBackendId]);

  // Reload when time range or backend changes
  useEffect(() => {
    if (initialLoadedRef.current && activeBackendId) {
      loadTrendData(true);
    }
  }, [trendTimeRange, activeBackendId, loadTrendData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

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
        timeRange={trendTimeRange}
        onTimeRangeChange={handleTimeRangeChange}
        isLoading={trendLoading || isPending}
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
