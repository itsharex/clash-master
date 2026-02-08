"use client";

import { useRef, useEffect } from "react";
import { Download, Upload, Globe, Activity, Server, Route } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  motion,
  useSpring,
  useTransform,
  useMotionValue,
} from "framer-motion";
import { formatBytes } from "@/lib/utils";
import type { StatsSummary } from "@clashmaster/shared";

interface StatsCardsProps {
  data: StatsSummary | null;
  error?: string | null;
}

// ---------- Animated number display ----------

const springConfig = { stiffness: 80, damping: 20, mass: 0.5 };

function AnimatedValue({
  value,
  formatter,
  className,
  title,
}: {
  value: number;
  formatter: (n: number) => string;
  className?: string;
  title?: string;
}) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, springConfig);
  const display = useTransform(spring, (v) => formatter(Math.round(v)));
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      // Jump to initial value instantly (no animation on mount)
      motionValue.jump(value);
      isFirstRender.current = false;
    } else {
      motionValue.set(value);
    }
  }, [value, motionValue]);

  return (
    <motion.span className={className} title={title}>
      {display}
    </motion.span>
  );
}

// ---------- Stat Card ----------

function StatCard({
  value,
  label,
  subvalue,
  icon: Icon,
  color,
}: {
  value: number | string;
  label: string;
  subvalue?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-xl p-4 border bg-card shadow-xs flex flex-col">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="flex-1">
        <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium truncate">
          {label}
        </p>
        <p className="text-xl font-bold mt-1 tabular-nums truncate" title={String(value)}>
          {value}
        </p>
        {subvalue && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {subvalue}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------- Animated Stat Card (for numeric values) ----------

function AnimatedStatCard({
  value,
  formatter,
  label,
  subvalue,
  icon: Icon,
  color,
}: {
  value: number;
  formatter: (n: number) => string;
  label: string;
  subvalue?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-xl p-4 border bg-card shadow-xs flex flex-col">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="flex-1">
        <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium truncate">
          {label}
        </p>
        <AnimatedValue
          value={value}
          formatter={formatter}
          className="text-xl font-bold mt-1 tabular-nums truncate block"
          title={formatter(value)}
        />
        {subvalue && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {subvalue}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------- Circular Progress Card ----------

function CircularProgressCard({
  value,
  max,
  icon: Icon,
  label,
  color,
}: {
  value: number;
  max: number;
  icon: React.ElementType;
  label: string;
  color: string;
}) {
  const radius = 28;
  const strokeWidth = 4;
  const circumference = radius * 2 * Math.PI;
  const size = 64;

  // Animated progress ring
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const targetOffset = circumference - (percentage / 100) * circumference;

  const motionOffset = useMotionValue(circumference);
  const springOffset = useSpring(motionOffset, springConfig);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      motionOffset.jump(targetOffset);
      isFirstRender.current = false;
    } else {
      motionOffset.set(targetOffset);
    }
  }, [targetOffset, motionOffset]);

  return (
    <div className="rounded-xl p-4 border bg-card shadow-xs flex flex-col">
      <div className="mb-3">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="transform -rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              fill="transparent"
              className="text-muted/15"
            />
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={color}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={springOffset}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
        </div>
      </div>
      <div className="flex-1">
        <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium truncate">
          {label}
        </p>
        <AnimatedValue
          value={value}
          formatter={formatBytes}
          className="text-xl font-bold mt-1 tabular-nums truncate block"
          title={formatBytes(value)}
        />
      </div>
    </div>
  );
}

// ---------- Today Card ----------

function TodayCard({
  download,
  upload,
  title,
  downloadLabel,
  uploadLabel,
}: {
  download: number;
  upload: number;
  title: string;
  downloadLabel: string;
  uploadLabel: string;
}) {
  return (
    <div className="rounded-xl p-4 border bg-card shadow-xs flex flex-col">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
        style={{ backgroundColor: "#10B98115" }}
      >
        <Activity className="w-5 h-5 text-emerald-500" />
      </div>
      <div className="flex-1">
        <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium">
          {title}
        </p>
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground truncate">{downloadLabel}</span>
            <AnimatedValue
              value={download}
              formatter={formatBytes}
              className="text-sm font-semibold tabular-nums truncate"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground truncate">{uploadLabel}</span>
            <AnimatedValue
              value={upload}
              formatter={formatBytes}
              className="text-sm font-semibold tabular-nums truncate"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Main ----------

export function StatsCards({ data }: StatsCardsProps) {
  const t = useTranslations("stats");
  const maxTraffic = Math.max(
    data?.totalDownload || 0,
    data?.totalUpload || 0,
    1
  );

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
      <CircularProgressCard
        value={data?.totalDownload || 0}
        max={maxTraffic * 1.2}
        icon={Download}
        label={t("totalDownload")}
        color="#3B82F6"
      />
      <CircularProgressCard
        value={data?.totalUpload || 0}
        max={maxTraffic * 1.2}
        icon={Upload}
        label={t("totalUpload")}
        color="#8B5CF6"
      />
      <TodayCard
        download={data?.todayDownload || 0}
        upload={data?.todayUpload || 0}
        title={t("today")}
        downloadLabel={t("download")}
        uploadLabel={t("upload")}
      />
      <AnimatedStatCard
        value={data?.totalDomains || 0}
        formatter={(n) => n.toLocaleString()}
        label={t("domains")}
        icon={Globe}
        color="#06B6D4"
      />
      <AnimatedStatCard
        value={data?.totalRules || 0}
        formatter={(n) => n.toLocaleString()}
        label={t("rules")}
        subvalue={t("tracked")}
        icon={Route}
        color="#F59E0B"
      />
      <AnimatedStatCard
        value={(data?.totalDownload || 0) + (data?.totalUpload || 0)}
        formatter={formatBytes}
        label={t("total")}
        subvalue={`${(data?.totalDomains || 0)} ${t("tracked")}`}
        icon={Server}
        color="#EC4899"
      />
    </div>
  );
}
