"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { 
  Server, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Database,
  HardDrive,
  Trash,
  Settings,
  Radio,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn, formatBytes, formatNumber } from "@/lib/utils";
import { api } from "@/lib/api";

interface Backend {
  id: number;
  name: string;
  url: string;
  host: string;
  port: number;
  token: string;
  enabled: boolean;
  is_active: boolean;
  listening: boolean;
  hasToken?: boolean;
  created_at: string;
}

interface BackendConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isFirstTime?: boolean;
  onConfigComplete?: () => void;
  onBackendChange?: () => void;
}

interface DbStats {
  size: number;
  totalConnectionsCount: number;
}

// Parse URL to host and port
function parseUrl(url: string): { host: string; port: string; ssl: boolean } {
  try {
    const urlObj = new URL(url);
    return {
      host: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80'),
      ssl: urlObj.protocol === 'https:',
    };
  } catch {
    return { host: '', port: '9090', ssl: false };
  }
}

// Build URL from host, port, ssl
function buildUrl(host: string, port: string, ssl: boolean): string {
  const protocol = ssl ? 'https' : 'http';
  return `${protocol}://${host}:${port}`;
}

export function BackendConfigDialog({
  open,
  onOpenChange,
  isFirstTime = false,
  onConfigComplete,
  onBackendChange,
}: BackendConfigDialogProps) {
  const t = useTranslations("backend");
  const commonT = useTranslations("common");
  
  const [backends, setBackends] = useState<Backend[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'backends' | 'database'>('backends');
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [clearingLogs, setClearingLogs] = useState(false);
  
  // Alert Dialog States
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteBackendId, setDeleteBackendId] = useState<number | null>(null);
  const [clearLogsDialogOpen, setClearLogsDialogOpen] = useState(false);
  const [clearLogsDays, setClearLogsDays] = useState<number>(0);
  const [clearBackendDataDialogOpen, setClearBackendDataDialogOpen] = useState(false);
  const [clearDataBackendId, setClearDataBackendId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    host: "",
    port: "9090",
    ssl: false,
    token: "",
  });

  useEffect(() => {
    if (open) {
      loadBackends();
      loadDbStats();
    }
  }, [open]);

  const loadBackends = async () => {
    try {
      const data = await api.getBackends();
      // Parse URL to host/port for display
      const parsedData: Backend[] = data.map((b) => {
        const parsed = parseUrl(b.url);
        return { ...b, host: parsed.host, port: parseInt(parsed.port) || 9090 };
      });
      setBackends(parsedData);
    } catch (error) {
      console.error("Failed to load backends:", error);
    }
  };

  const loadDbStats = async () => {
    try {
      const stats = await api.getDbStats();
      setDbStats(stats);
    } catch (error) {
      console.error("Failed to load DB stats:", error);
    }
  };

  const handleAdd = async () => {
    if (!formData.name || !formData.host) return;
    
    setLoading(true);
    try {
      const url = buildUrl(formData.host, formData.port, formData.ssl);
      const result = await api.createBackend({ 
        name: formData.name, 
        url, 
        token: formData.token 
      });
      setFormData({ name: "", host: "", port: "9090", ssl: false, token: "" });
      await loadBackends();
      onBackendChange?.();
      
      // Show success message for first backend
      if (result.isActive) {
        setTestResult({ success: true, message: t("firstBackendAutoActive") });
        setTimeout(() => setTestResult(null), 3000);
      }
      
      if (isFirstTime && onConfigComplete) {
        onConfigComplete();
        onOpenChange(false);
      }
    } catch (error: any) {
      alert(error.message || "Failed to create backend");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: number) => {
    setLoading(true);
    try {
      const url = buildUrl(formData.host, formData.port, formData.ssl);
      await api.updateBackend(id, { 
        name: formData.name, 
        url, 
        token: formData.token || undefined 
      });
      setEditingId(null);
      setFormData({ name: "", host: "", port: "9090", ssl: false, token: "" });
      await loadBackends();
      onBackendChange?.();
    } catch (error: any) {
      alert(error.message || "Failed to update backend");
    } finally {
      setLoading(false);
    }
  };

  // Open delete confirmation dialog
  const openDeleteDialog = (id: number) => {
    setDeleteBackendId(id);
    setDeleteDialogOpen(true);
  };

  // Handle actual delete
  const handleDelete = async () => {
    if (!deleteBackendId) return;
    
    setLoading(true);
    try {
      await api.deleteBackend(deleteBackendId);
      await loadBackends();
      onBackendChange?.();
      setDeleteDialogOpen(false);
      setDeleteBackendId(null);
    } catch (error: any) {
      alert(error.message || "Failed to delete backend");
    } finally {
      setLoading(false);
    }
  };

  // Handle set active backend (for display)
  const handleSetActive = async (id: number) => {
    try {
      await api.setActiveBackend(id);
      await loadBackends();
      onBackendChange?.();
      // Show success message
      setTestResult({ success: true, message: t("switchSuccess") });
      // Clear success message after 3 seconds
      setTimeout(() => setTestResult(null), 3000);
    } catch (error: any) {
      alert(error.message || t("switchFailed"));
    }
  };

  // Handle toggle listening (data collection)
  const handleToggleListening = async (id: number, listening: boolean) => {
    try {
      await api.setBackendListening(id, listening);
      await loadBackends();
      onBackendChange?.();
    } catch (error: any) {
      alert(error.message || "Failed to update listening state");
    }
  };

  // Open clear backend data dialog
  const openClearBackendDataDialog = (id: number) => {
    setClearDataBackendId(id);
    setClearBackendDataDialogOpen(true);
  };

  // Handle clear backend data
  const handleClearBackendData = async () => {
    if (!clearDataBackendId) return;
    
    setLoading(true);
    try {
      await api.clearBackendData(clearDataBackendId);
      await loadDbStats();
      onBackendChange?.();
      setClearBackendDataDialogOpen(false);
      setClearDataBackendId(null);
    } catch (error: any) {
      alert(error.message || "Failed to clear backend data");
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async (backend: Backend) => {
    setTestingId(backend.id);
    setTestResult(null);
    try {
      const result = await api.testBackend(backend.url, backend.token);
      setTestResult(result);
    } catch (error: any) {
      setTestResult({ success: false, message: error.message || "Test failed" });
    } finally {
      setTestingId(null);
    }
  };

  // Open clear logs dialog
  const openClearLogsDialog = (days: number) => {
    setClearLogsDays(days);
    setClearLogsDialogOpen(true);
  };

  // Handle actual clear logs
  const handleClearLogs = async () => {
    setClearingLogs(true);
    try {
      await api.clearLogs(clearLogsDays);
      await loadDbStats();
      setClearLogsDialogOpen(false);
      alert(t("logsCleared"));
    } catch (error: any) {
      alert(error.message || "Failed to clear logs");
    } finally {
      setClearingLogs(false);
    }
  };

  const startEdit = (backend: Backend) => {
    setEditingId(backend.id);
    setFormData({
      name: backend.name,
      host: backend.host,
      port: String(backend.port || 9090),
      ssl: backend.url.startsWith('https'),
      token: "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ name: "", host: "", port: "9090", ssl: false, token: "" });
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              {isFirstTime ? t("firstTimeTitle") : t("title")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {isFirstTime ? t("firstTimeDescription") : t("description")}
            </p>
            
            {/* Tabs */}
            <div className="flex gap-2 mt-4">
              <Button
                variant={activeTab === 'backends' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('backends')}
              >
                <Server className="w-4 h-4 mr-2" />
                {t("backendsTab")}
              </Button>
              <Button
                variant={activeTab === 'database' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('database')}
              >
                <Database className="w-4 h-4 mr-2" />
                {t("databaseTab")}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {activeTab === 'backends' ? (
              // Backends Tab
              <div className="space-y-3">
                {backends.map((backend) => (
                  <div
                    key={backend.id}
                    className={cn(
                      "p-4 rounded-lg border transition-all",
                      backend.is_active
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card",
                      !backend.enabled && "opacity-60"
                    )}
                  >
                    {editingId === backend.id ? (
                      // Edit Mode
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium">{t("name")}</label>
                            <Input
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              placeholder={t("namePlaceholder")}
                              className="h-9 mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium">{t("host")}</label>
                            <Input
                              value={formData.host}
                              onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                              placeholder="192.168.1.1"
                              className="h-9 mt-1"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-xs font-medium">{t("port")}</label>
                            <Input
                              value={formData.port}
                              onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                              placeholder="9090"
                              className="h-9 mt-1"
                            />
                          </div>
                          <div className="col-span-2 flex items-center gap-2 pt-5">
                            <Switch
                              checked={formData.ssl}
                              onCheckedChange={(checked) => setFormData({ ...formData, ssl: checked })}
                            />
                            <label className="text-sm">{t("useSsl")}</label>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium">{t("token")}</label>
                          <Input
                            type="password"
                            value={formData.token}
                            onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                            placeholder={t("tokenPlaceholder")}
                            className="h-9 mt-1"
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" size="sm" onClick={cancelEdit}>
                            <X className="w-4 h-4 mr-1" />
                            {commonT("cancel")}
                          </Button>
                          <Button size="sm" onClick={() => handleUpdate(backend.id)} disabled={loading}>
                            <Check className="w-4 h-4 mr-1" />
                            {commonT("save")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate">{backend.name}</span>
                            {backend.is_active && (
                              <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs">
                                {t("displaying")}
                              </span>
                            )}
                            {backend.listening && (
                              <span className="px-2 py-0.5 rounded-full bg-green-500 text-white text-xs flex items-center gap-1">
                                <Radio className="w-3 h-3" />
                                {t("collecting")}
                              </span>
                            )}
                            {!backend.enabled && (
                              <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">
                                {t("disabled")}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground truncate mt-0.5">
                            {backend.host}:{backend.port}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 ml-4">
                          {/* Listening Toggle */}
                          <div className="flex items-center gap-2 mr-2 pr-2 border-r">
                            <Switch
                              checked={backend.listening}
                              onCheckedChange={(checked) => handleToggleListening(backend.id, checked)}
                              className="data-[state=checked]:bg-green-500"
                            />
                            <span className="text-xs text-muted-foreground hidden sm:inline">
                              {t("collect")}
                            </span>
                          </div>

                          {/* Set Active (Display) Button */}
                          {!backend.is_active && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleSetActive(backend.id)}
                              title={t("setActive")}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleTest(backend)}
                            disabled={testingId === backend.id}
                            title={t("testConnection")}
                          >
                            <RefreshCw className={cn("w-4 h-4", testingId === backend.id && "animate-spin")} />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => startEdit(backend)}
                            title={commonT("edit")}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => openDeleteDialog(backend.id)}
                            title={commonT("delete")}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Test Result */}
                {testResult && (
                  <div
                    className={cn(
                      "p-3 rounded-lg flex items-center gap-2 text-sm",
                      testResult.success
                        ? "bg-green-500/10 text-green-600 border border-green-500/20"
                        : "bg-destructive/10 text-destructive border border-destructive/20"
                    )}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    {testResult.message}
                  </div>
                )}

                {/* Add New Backend Form */}
                <div className="p-4 rounded-lg border border-dashed border-border bg-muted/50">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    {backends.length === 0 && isFirstTime ? t("firstTimeTitle") : t("addNew")}
                  </h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium">{t("name")} *</label>
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder={t("namePlaceholder")}
                          className="h-9 mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium">{t("host")} *</label>
                        <Input
                          value={formData.host}
                          onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                          placeholder="192.168.1.1"
                          className="h-9 mt-1"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-medium">{t("port")}</label>
                        <Input
                          value={formData.port}
                          onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                          placeholder="9090"
                          className="h-9 mt-1"
                        />
                      </div>
                      <div className="col-span-2 flex items-center gap-2 pt-5">
                        <Switch
                          checked={formData.ssl}
                          onCheckedChange={(checked) => setFormData({ ...formData, ssl: checked })}
                        />
                        <label className="text-sm">{t("useSsl")}</label>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium">{t("token")}</label>
                      <Input
                        type="password"
                        value={formData.token}
                        onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                        placeholder={t("tokenPlaceholder")}
                        className="h-9 mt-1"
                      />
                    </div>
                    <Button 
                      onClick={handleAdd} 
                      disabled={loading || !formData.name || !formData.host}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {isFirstTime && backends.length === 0 ? t("saveAndContinue") : t("addBackend")}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              // Database Tab
              <div className="space-y-6">
                {/* DB Stats */}
                <div className="p-4 rounded-lg border bg-card">
                  <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                    <HardDrive className="w-4 h-4" />
                    {t("databaseStats")}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-muted">
                      <div className="text-xs text-muted-foreground">{t("dbSize")}</div>
                      <div className="text-lg font-semibold">
                        {dbStats ? formatBytes(dbStats.size) : "--"}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted">
                      <div className="text-xs text-muted-foreground">{t("connectionsCount")}</div>
                      <div className="text-lg font-semibold">
                        {dbStats ? formatNumber(dbStats.totalConnectionsCount) : "--"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Clear Logs */}
                <div className="p-4 rounded-lg border bg-card">
                  <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                    <Trash className="w-4 h-4" />
                    {t("clearLogs")}
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t("clearLogsDescription")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openClearLogsDialog(1)}
                      disabled={clearingLogs}
                    >
                      {t("clear1Day")}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openClearLogsDialog(7)}
                      disabled={clearingLogs}
                    >
                      {t("clear7Days")}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openClearLogsDialog(30)}
                      disabled={clearingLogs}
                    >
                      {t("clear30Days")}
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => openClearLogsDialog(0)}
                      disabled={clearingLogs}
                    >
                      {t("clearAll")}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Close button for non-first-time */}
            {!isFirstTime && (
              <div className="flex justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  {commonT("close")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteBackendId(null)}>
              {commonT("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {commonT("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear Logs Confirmation Dialog */}
      <AlertDialog open={clearLogsDialogOpen} onOpenChange={setClearLogsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("clearLogs")}</AlertDialogTitle>
            <AlertDialogDescription>
              {clearLogsDays === 0 
                ? t("confirmClearAllLogs") 
                : t("confirmClearLogs", { days: clearLogsDays })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {commonT("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleClearLogs}
              className={clearLogsDays === 0 ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {commonT("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
