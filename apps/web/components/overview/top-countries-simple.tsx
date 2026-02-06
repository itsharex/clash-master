"use client";

import React, { useMemo } from "react";
import { Globe, ArrowRight, BarChart3, Link2 } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatBytes, formatNumber, cn } from "@/lib/utils";
import type { CountryStats } from "@clashmaster/shared";

interface TopCountriesSimpleProps {
  countries: CountryStats[];
  sortBy: "traffic" | "connections";
  onSortChange: (mode: "traffic" | "connections") => void;
  onViewAll?: () => void;
}

// Country code to flag emoji mapping
const countryFlags: Record<string, string> = {
  "CN": "🇨🇳", "US": "🇺🇸", "JP": "🇯🇵", "HK": "🇭🇰", "TW": "🇹🇼",
  "SG": "🇸🇬", "KR": "🇰🇷", "DE": "🇩🇪", "GB": "🇬🇧", "FR": "🇫🇷",
  "NL": "🇳🇱", "CA": "🇨🇦", "AU": "🇦🇺", "IN": "🇮🇳", "RU": "🇷🇺",
  "BR": "🇧🇷", "TR": "🇹🇷", "VN": "🇻🇳", "TH": "🇹🇭", "ID": "🇮🇩",
  "MY": "🇲🇾", "PH": "🇵🇭", "SE": "🇸🇪", "CH": "🇨🇭", "IT": "🇮🇹",
  "ES": "🇪🇸", "PT": "🇵🇹", "PL": "🇵🇱", "UA": "🇺🇦", "MX": "🇲🇽",
  "AR": "🇦🇷", "CL": "🇨🇱", "CO": "🇨🇴", "ZA": "🇿🇦", "EG": "🇪🇬",
  "AE": "🇦🇪", "SA": "🇸🇦", "IL": "🇮🇱", "FI": "🇫🇮", "NO": "🇳🇴",
  "DK": "🇩🇰", "AT": "🇦🇹", "BE": "🇧🇪", "CZ": "🇨🇿", "HU": "🇭🇺",
  "RO": "🇷🇴", "BG": "🇧🇬", "HR": "🇭🇷", "RS": "🇷🇸", "SK": "🇸🇰",
  "SI": "🇸🇮", "LT": "🇱🇹", "LV": "🇱🇻", "EE": "🇪🇪", "IE": "🇮🇪",
  "NZ": "🇳🇿", "BD": "🇧🇩", "PK": "🇵🇰", "LK": "🇱🇰", "NP": "🇳🇵",
  "MM": "🇲🇲", "KH": "🇰🇭", "LA": "🇱🇦", "MN": "🇲🇳", "KZ": "🇰🇿",
  "UZ": "🇺🇿", "AZ": "🇦🇿", "GE": "🇬🇪", "AM": "🇦🇲", "MD": "🇲🇩",
  "BY": "🇧🇾", "KG": "🇰🇬", "TJ": "🇹🇯", "TM": "🇹🇲", "AF": "🇦🇫",
  "IQ": "🇮🇶", "IR": "🇮🇷", "JO": "🇯🇴", "LB": "🇱🇧", "SY": "🇸🇾",
  "YE": "🇾🇪", "OM": "🇴🇲", "QA": "🇶🇦", "BH": "🇧🇭", "KW": "🇰🇼",
  "LOCAL": "🏠", "UNKNOWN": "🌐", "PRIVATE": "🔒",
};

const countryNamesEn: Record<string, string> = {
  "CN": "China", "US": "United States", "JP": "Japan", "HK": "Hong Kong", "TW": "Taiwan",
  "SG": "Singapore", "KR": "South Korea", "DE": "Germany", "GB": "United Kingdom", "FR": "France",
  "NL": "Netherlands", "CA": "Canada", "AU": "Australia", "IN": "India", "RU": "Russia",
  "BR": "Brazil", "TR": "Turkey", "VN": "Vietnam", "TH": "Thailand", "ID": "Indonesia",
  "MY": "Malaysia", "PH": "Philippines", "SE": "Sweden", "CH": "Switzerland", "IT": "Italy",
  "ES": "Spain", "PT": "Portugal", "PL": "Poland", "UA": "Ukraine", "MX": "Mexico",
  "AR": "Argentina", "CL": "Chile", "ZA": "South Africa", "AE": "UAE", "SA": "Saudi Arabia",
  "LOCAL": "Local", "UNKNOWN": "Unknown", "PRIVATE": "Private",
};

const countryNamesZh: Record<string, string> = {
  "CN": "中国", "US": "美国", "JP": "日本", "HK": "中国香港", "TW": "中国台湾",
  "SG": "新加坡", "KR": "韩国", "DE": "德国", "GB": "英国", "FR": "法国",
  "NL": "荷兰", "CA": "加拿大", "AU": "澳大利亚", "IN": "印度", "RU": "俄罗斯",
  "BR": "巴西", "TR": "土耳其", "VN": "越南", "TH": "泰国", "ID": "印度尼西亚",
  "MY": "马来西亚", "PH": "菲律宾", "SE": "瑞典", "CH": "瑞士", "IT": "意大利",
  "ES": "西班牙", "PT": "葡萄牙", "PL": "波兰", "UA": "乌克兰", "MX": "墨西哥",
  "AR": "阿根廷", "CL": "智利", "ZA": "南非", "AE": "阿联酋", "SA": "沙特阿拉伯",
  "LOCAL": "本地", "UNKNOWN": "未知", "PRIVATE": "私有",
};

function getCountryFlag(countryCode: string): string {
  return countryFlags[countryCode.toUpperCase()] || "🌐";
}

function getCountryName(code: string, locale: string): string {
  const names = locale === "zh" ? countryNamesZh : countryNamesEn;
  return names[code.toUpperCase()] || code;
}

export const TopCountriesSimple = React.memo(function TopCountriesSimple({
  countries,
  sortBy,
  onSortChange,
  onViewAll,
}: TopCountriesSimpleProps) {
  const t = useTranslations("topCountries");
  const locale = useLocale();

  const sortedCountries = useMemo(() => {
    if (!countries?.length) return [];
    return [...countries]
      .sort((a, b) => {
        if (sortBy === "traffic") {
          return (b.totalDownload + b.totalUpload) - (a.totalDownload + a.totalUpload);
        }
        return b.totalConnections - a.totalConnections;
      })
      .slice(0, 6);
  }, [countries, sortBy]);

  const maxTotal = useMemo(() => {
    if (!sortedCountries.length) return 1;
    return Math.max(...sortedCountries.map(c => c.totalDownload + c.totalUpload));
  }, [sortedCountries]);

  const totalTraffic = useMemo(() => {
    if (!countries?.length) return 1;
    return countries.reduce((sum, c) => sum + c.totalDownload + c.totalUpload, 0);
  }, [countries]);

  return (
    <div className="space-y-3 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Globe className="w-4 h-4" />
          {t("title")}
        </h3>
        
        {/* Sort toggle */}
        <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 rounded-md transition-all",
              sortBy === "traffic" 
                ? "bg-background shadow-sm text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onSortChange("traffic")}
            title={t("sortByTraffic")}
          >
            <BarChart3 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 rounded-md transition-all",
              sortBy === "connections" 
                ? "bg-background shadow-sm text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onSortChange("connections")}
            title={t("sortByConnections")}
          >
            <Link2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2 flex-1">
        {sortedCountries.map((country, index) => {
          const total = country.totalDownload + country.totalUpload;
          const barPercent = (total / maxTotal) * 100;
          const sharePercent = (total / totalTraffic) * 100;
          const badgeColor = index === 0
            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            : index === 1
            ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            : index === 2
            ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
            : "bg-muted text-muted-foreground";

          return (
            <div
              key={country.country}
              className="p-2.5 rounded-xl border border-border/50 bg-card/50 hover:bg-card transition-colors"
            >
              {/* Row 1: Rank + Flag + Name + Total */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className={cn(
                  "w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center shrink-0",
                  badgeColor
                )}>
                  {index + 1}
                </span>
                <span className="text-sm leading-none shrink-0">{getCountryFlag(country.country)}</span>
                <span className="flex-1 text-sm font-medium truncate" title={getCountryName(country.country, locale)}>
                  {getCountryName(country.country, locale)}
                </span>
                <span className="text-sm font-bold tabular-nums shrink-0">
                  {formatBytes(total)}
                </span>
              </div>

              {/* Row 2: Progress bar with download/upload breakdown */}
              <div className="pl-7 space-y-1.5">
                {/* Progress bar */}
                <div className="h-1.5 rounded-full bg-muted overflow-hidden flex">
                  <div 
                    className="h-full bg-blue-500 dark:bg-blue-400" 
                    style={{ width: `${(country.totalDownload / total) * barPercent}%` }}
                  />
                  <div 
                    className="h-full bg-purple-500 dark:bg-purple-400" 
                    style={{ width: `${(country.totalUpload / total) * barPercent}%` }}
                  />
                </div>
                {/* Stats */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-500 dark:text-blue-400">↓ {formatBytes(country.totalDownload)}</span>
                    <span className="text-purple-500 dark:text-purple-400">↑ {formatBytes(country.totalUpload)}</span>
                    <span className="flex items-center gap-1 tabular-nums">
                      <Link2 className="w-3 h-3" />
                      {formatNumber(country.totalConnections)}
                    </span>
                  </div>
                  <span className="tabular-nums">{sharePercent.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="pt-2 border-t border-border/30">
        <Button variant="ghost" size="sm" className="w-full h-9 text-xs" onClick={onViewAll}>
          {t("viewAll")}
          <ArrowRight className="w-3 h-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    JSON.stringify(prev.countries) === JSON.stringify(next.countries) &&
    prev.sortBy === next.sortBy
  );
});
