"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import {
  LayoutDashboard,
  Globe,
  MapPin,
  Server,
  Route,
  Network,
  Settings,
  Menu,
  X,
  Info,
  ExternalLink,
  ArrowUpCircle,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BackendConfigDialog } from "./backend-config-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useVersionCheck } from "@/hooks/use-version-check";
import packageJson from "../package.json";

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const APP_VERSION = packageJson.version;
const GITHUB_URL = "https://github.com/foru17/clash-master";

const NAV_ITEMS = [
  { id: "overview", icon: LayoutDashboard },
  { id: "domains", icon: Globe },
  { id: "countries", icon: MapPin },
  { id: "proxies", icon: Server },
  { id: "rules", icon: Route },
  { id: "network", icon: Network },
];

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const t = useTranslations("nav");
  const headerT = useTranslations("header");
  const backendT = useTranslations("backend");
  const aboutT = useTranslations("about");
  const { latestVersion, hasUpdate, isChecking, stars, checkNow } =
    useVersionCheck(APP_VERSION);

  return (
    <>
      {/* Desktop Navigation - Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 border-r border-border/40 bg-background/80 backdrop-blur-md">
        {/* Logo */}
        <div className="flex items-center gap-3 p-6 border-b border-border/40">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden">
            <Image
              src="/clash-master.png"
              alt="Clash Master"
              width={40}
              height={40}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h1 className="font-bold text-lg">{headerT("title")}</h1>
            <p className="text-xs text-muted-foreground">
              {headerT("subtitle")}
            </p>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}>
                <Icon className="w-5 h-5" />
                {t(item.id)}
              </button>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-border/40 space-y-1">
          <button
            onClick={() => setAboutOpen(true)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all relative",
              "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}>
            <Info className="w-5 h-5" />
            {aboutT("title")}
            {hasUpdate && (
              <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                v{latestVersion}
              </span>
            )}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
              "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}>
            <Settings className="w-5 h-5" />
            {backendT("title")}
          </button>
        </div>
      </aside>

      {/* Mobile Navigation - Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
              <Image
                src="/clash-master.png"
                alt="Clash Master"
                width={32}
                height={32}
                className="w-full h-full object-cover"
              />
            </div>
            <h1 className="font-bold">{headerT("title")}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}>
              <Settings className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <nav className="absolute top-full left-0 right-0 bg-background border-b border-border/40 p-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary",
                  )}>
                  <Icon className="w-5 h-5" />
                  {t(item.id)}
                </button>
              );
            })}
          </nav>
        )}
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/80 backdrop-blur-md">
        <div className="flex items-center justify-around h-16 px-2">
          {NAV_ITEMS.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}>
                <Icon className={cn("w-5 h-5", isActive && "scale-110")} />
                <span className="text-[10px]">{t(item.id)}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Settings Dialog */}
      <BackendConfigDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        isFirstTime={false}
      />

      {/* About Dialog */}
      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              {aboutT("title")}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {/* App Info */}
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                <Image
                  src="/clash-master.png"
                  alt="Clash Master"
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h3 className="text-xl font-bold">{aboutT("projectName")}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {aboutT("description")}
                </p>
              </div>
            </div>

            {/* All card rows with consistent spacing */}
            <div className="space-y-2">
              {/* Current Version */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border/50">
                <span className="text-sm font-medium">
                  {aboutT("currentVersion")}
                </span>
                <span className="text-sm font-mono tabular-nums text-primary font-semibold">
                  v{APP_VERSION}
                </span>
              </div>

              {/* Latest Version / Update Status */}
              <div
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border min-h-[3rem]",
                  hasUpdate
                    ? "bg-emerald-500/5 border-emerald-500/20"
                    : "bg-secondary/50 border-border/50",
                )}>
                <span className="text-sm font-medium">
                  {aboutT("latestVersion")}
                </span>
                <div className="flex items-center gap-2 h-7 min-w-[5.5rem] justify-end">
                  {isChecking ? (
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      {aboutT("checkingUpdate")}
                    </span>
                  ) : hasUpdate && latestVersion ? (
                    <span className="text-sm font-mono tabular-nums text-emerald-500 font-semibold flex items-center gap-1.5">
                      <ArrowUpCircle className="w-4 h-4" />v{latestVersion}
                    </span>
                  ) : latestVersion ? (
                    <span className="text-sm text-muted-foreground">
                      ✓ {aboutT("upToDate")}
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={checkNow}>
                      <RefreshCw className="w-3 h-3 mr-1" />
                      {aboutT("checkNow")}
                    </Button>
                  )}
                </div>
              </div>

              {/* Update Available Banner */}
              <div
                className={cn(
                  "grid transition-all duration-200 ease-in-out",
                  hasUpdate && latestVersion
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0",
                )}>
                <div className="overflow-hidden">
                  <a
                    href={`${GITHUB_URL}/releases`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors group">
                    <ArrowUpCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        {aboutT("updateAvailable")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        v{APP_VERSION} → v{latestVersion}
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-emerald-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </a>
                </div>
              </div>

              {/* License */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border/50">
                <span className="text-sm font-medium">{aboutT("license")}</span>
                <span className="text-sm text-muted-foreground">MIT</span>
              </div>

              {/* GitHub Link */}
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border/50 hover:bg-secondary/80 hover:border-primary/30 transition-all group">
                <div className="flex items-center gap-3">
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5 fill-foreground shrink-0"
                    aria-hidden="true">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {aboutT("openSource")}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {GITHUB_URL}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full min-w-[3rem] justify-center h-6">
                    {stars !== null ? (
                      <>
                        <svg
                          viewBox="0 0 16 16"
                          className="w-3.5 h-3.5 fill-amber-500 shrink-0"
                          aria-hidden="true">
                          <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25z" />
                        </svg>
                        <span className="text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                          {stars >= 1000
                            ? `${(stars / 1000).toFixed(1)}k`
                            : stars}
                        </span>
                      </>
                    ) : (
                      <span className="w-8 h-4 bg-secondary/80 rounded animate-pulse" />
                    )}
                  </span>
                  <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
