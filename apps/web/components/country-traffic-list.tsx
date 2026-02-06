"use client";

import { useMemo } from "react";
import { Link2, ArrowDown, ArrowUp } from "lucide-react";
import { formatBytes, formatNumber } from "@/lib/utils";
import type { CountryStats } from "@clashmaster/shared";

interface CountryTrafficListProps {
  data: CountryStats[];
}

// Country flag emoji mapping
const COUNTRY_FLAGS: Record<string, string> = {
  US: "🇺🇸", CN: "🇨🇳", JP: "🇯🇵", SG: "🇸🇬", HK: "🇭🇰",
  TW: "🇹🇼", KR: "🇰🇷", GB: "🇬🇧", DE: "🇩🇪", FR: "🇫🇷",
  NL: "🇳🇱", CA: "🇨🇦", AU: "🇦🇺", IN: "🇮🇳", BR: "🇧🇷",
  RU: "🇷🇺", SE: "🇸🇪", CH: "🇨🇭", IL: "🇮🇱", LOCAL: "🏠",
  Unknown: "❓",
};

// Continent colors
const CONTINENT_COLORS: Record<string, string> = {
  AS: "#F59E0B", NA: "#3B82F6", EU: "#8B5CF6",
  SA: "#10B981", AF: "#EF4444", OC: "#06B6D4",
  LOCAL: "#6B7280", Unknown: "#9CA3AF",
};

function getCountryFlag(country: string): string {
  return COUNTRY_FLAGS[country] || COUNTRY_FLAGS[country.toUpperCase()] || "🌐";
}

function getContinentColor(continent: string): string {
  return CONTINENT_COLORS[continent] || CONTINENT_COLORS.Unknown;
}

export function CountryTrafficList({ data }: CountryTrafficListProps) {
  const countries = useMemo(() => {
    if (!data) return [];
    return data
      .filter(c => c.country !== "LOCAL" && c.country !== "Unknown")
      .map((country) => ({
        ...country,
        flag: getCountryFlag(country.country),
        color: getContinentColor(country.continent),
        total: country.totalDownload + country.totalUpload,
      }))
      .sort((a, b) => b.total - a.total);
  }, [data]);

  const totalTraffic = useMemo(() => {
    return countries.reduce((sum, c) => sum + c.total, 0);
  }, [countries]);

  if (countries.length === 0) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="p-3 rounded-xl border border-border/30 bg-muted/50 h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
      {countries.map((country) => {
        const percentage = totalTraffic > 0 ? (country.total / totalTraffic) * 100 : 0;
        
        return (
          <div
            key={country.country}
            className="p-3 rounded-xl border border-border/50 bg-card/30 hover:bg-card/60 transition-colors"
          >
            {/* Header: Flag + Name */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{country.flag}</span>
              <p className="font-medium text-sm truncate" title={country.countryName}>
                {country.countryName || country.country}
              </p>
            </div>

            {/* Traffic Stats */}
            <div className="space-y-1.5">
              {/* Total */}
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-bold tabular-nums">
                  {formatBytes(country.total)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {percentage.toFixed(1)}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${percentage}%`, backgroundColor: country.color }}
                />
              </div>

              {/* DL/UL row */}
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-0.5 text-blue-500">
                  <ArrowDown className="w-3 h-3" />
                  {formatBytes(country.totalDownload)}
                </span>
                <span className="flex items-center gap-0.5 text-purple-500">
                  <ArrowUp className="w-3 h-3" />
                  {formatBytes(country.totalUpload)}
                </span>
              </div>

              {/* Connections */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Link2 className="w-3 h-3" />
                <span>{formatNumber(country.totalConnections)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
