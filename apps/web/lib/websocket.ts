import { useEffect, useRef, useState, useCallback } from 'react';
import type { StatsSummary } from '@clashmaster/shared';
import type { TimeRange } from '@/lib/api';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface WebSocketMessage {
  type: 'stats' | 'ping' | 'pong';
  backendId?: number;
  data?: StatsSummary;
  timestamp: string;
}

interface UseStatsWebSocketOptions {
  backendId?: number;
  range?: TimeRange;
  includeTrend?: boolean;
  trendMinutes?: number;
  trendBucketMinutes?: number;
  includeDeviceDetails?: boolean;
  deviceSourceIP?: string;
  deviceDetailLimit?: number;
  includeProxyDetails?: boolean;
  proxyChain?: string;
  proxyDetailLimit?: number;
  includeRuleDetails?: boolean;
  ruleName?: string;
  ruleDetailLimit?: number;
  includeRuleChainFlow?: boolean;
  includeDomainsPage?: boolean;
  domainsPageOffset?: number;
  domainsPageLimit?: number;
  domainsPageSortBy?: string;
  domainsPageSortOrder?: "asc" | "desc";
  domainsPageSearch?: string;
  includeIPsPage?: boolean;
  ipsPageOffset?: number;
  ipsPageLimit?: number;
  ipsPageSortBy?: string;
  ipsPageSortOrder?: "asc" | "desc";
  ipsPageSearch?: string;
  enabled?: boolean;
  onMessage?: (data: StatsSummary) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

type RuntimeConfig = {
  WS_URL?: string;
  WS_PORT?: string | number;
  WS_HOST?: string;
};

function getRuntimeConfig(): RuntimeConfig | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as any).__RUNTIME_CONFIG__ as RuntimeConfig | undefined;
}

function getWsUrl(): string {
  const runtime = getRuntimeConfig();
  const wsPort = runtime?.WS_PORT || process.env.NEXT_PUBLIC_WS_PORT || '3002';
  if (runtime?.WS_URL) return runtime.WS_URL;
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (typeof window !== 'undefined') {
    return `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${runtime?.WS_HOST || window.location.hostname}:${wsPort}`;
  }
  return `ws://localhost:${wsPort}`;
}

export function useStatsWebSocket(options: UseStatsWebSocketOptions = {}) {
  const {
    backendId,
    range,
    includeTrend,
    trendMinutes,
    trendBucketMinutes,
    includeDeviceDetails,
    deviceSourceIP,
    deviceDetailLimit,
    includeProxyDetails,
    proxyChain,
    proxyDetailLimit,
    includeRuleDetails,
    ruleName,
    ruleDetailLimit,
    includeRuleChainFlow,
    includeDomainsPage,
    domainsPageOffset,
    domainsPageLimit,
    domainsPageSortBy,
    domainsPageSortOrder,
    domainsPageSearch,
    includeIPsPage,
    ipsPageOffset,
    ipsPageLimit,
    ipsPageSortBy,
    ipsPageSortOrder,
    ipsPageSearch,
    enabled = true,
  } = options;
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<StatsSummary | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPingTimeRef = useRef<number>(0);
  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectDelayMs = 30000;
  const onMessageRef = useRef(options.onMessage);
  const onConnectRef = useRef(options.onConnect);
  const onDisconnectRef = useRef(options.onDisconnect);
  const onErrorRef = useRef(options.onError);
  onMessageRef.current = options.onMessage;
  onConnectRef.current = options.onConnect;
  onDisconnectRef.current = options.onDisconnect;
  onErrorRef.current = options.onError;

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (wsRef.current) {
      // Nullify handlers BEFORE closing to prevent stale onclose/onerror
      // from overwriting status set by a newer connection
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) return;
    if (typeof window === 'undefined') return;

    setStatus('connecting');

    const wsUrl = getWsUrl();
    console.log('[WebSocket] Connecting to:', wsUrl);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connected successfully');
        setStatus('connected');
        reconnectAttemptsRef.current = 0;
        onConnectRef.current?.();

        // Start ping interval
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            lastPingTimeRef.current = Date.now();
            ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;

          if (message.type === 'stats' && message.data) {
            setLastMessage(message.data);
            onMessageRef.current?.(message.data);
          } else if (message.type === 'pong') {
            if (lastPingTimeRef.current > 0) {
              setLatency(Date.now() - lastPingTimeRef.current);
            }
          }
        } catch (err) {
          console.error('[WebSocket] Failed to parse message:', err);
        }
      };

      ws.onclose = (event) => {
        console.log(`[WebSocket] Disconnected. Code: ${event.code}, Reason: ${event.reason}`);
        setStatus('disconnected');
        onDisconnectRef.current?.();

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Auto reconnect with exponential backoff.
        const delay = Math.min(3000 * Math.pow(2, reconnectAttemptsRef.current), maxReconnectDelayMs);
        reconnectAttemptsRef.current++;
        console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Connection error. URL:', wsUrl);
        setStatus('error');
        onErrorRef.current?.(error);
      };
    } catch (err) {
      console.error('[WebSocket] Failed to create connection:', err);
      setStatus('error');
    }
  }, []);

  // Send subscribe message when backend/time-range changes or WS becomes connected.
  useEffect(() => {
    if (status !== 'connected') return;
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    if (backendId === undefined) return;

    console.log('[WebSocket] Subscribing to backend:', backendId);
    wsRef.current.send(JSON.stringify({
      type: 'subscribe',
      backendId,
      start: range?.start,
      end: range?.end,
      includeTrend,
      trendMinutes,
      trendBucketMinutes,
      includeDeviceDetails,
      deviceSourceIP,
      deviceDetailLimit,
      includeProxyDetails,
      proxyChain,
      proxyDetailLimit,
      includeRuleDetails,
      ruleName,
      ruleDetailLimit,
      includeRuleChainFlow,
      includeDomainsPage,
      domainsPageOffset,
      domainsPageLimit,
      domainsPageSortBy,
      domainsPageSortOrder,
      domainsPageSearch,
      includeIPsPage,
      ipsPageOffset,
      ipsPageLimit,
      ipsPageSortBy,
      ipsPageSortOrder,
      ipsPageSearch,
      timestamp: new Date().toISOString(),
    }));
  }, [
    backendId,
    range?.start,
    range?.end,
    includeTrend,
    trendMinutes,
    trendBucketMinutes,
    includeDeviceDetails,
    deviceSourceIP,
    deviceDetailLimit,
    includeProxyDetails,
    proxyChain,
    proxyDetailLimit,
    includeRuleDetails,
    ruleName,
    ruleDetailLimit,
    includeRuleChainFlow,
    includeDomainsPage,
    domainsPageOffset,
    domainsPageLimit,
    domainsPageSortBy,
    domainsPageSortOrder,
    domainsPageSearch,
    includeIPsPage,
    ipsPageOffset,
    ipsPageLimit,
    ipsPageSortBy,
    ipsPageSortOrder,
    ipsPageSearch,
    status,
  ]);

  const disconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    cleanup();
    setStatus('disconnected');
  }, [cleanup]);

  useEffect(() => {
    if (!enabled) {
      disconnect();
      return;
    }

    reconnectAttemptsRef.current = 0;
    connect();

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    status,
    lastMessage,
    latency,
    connect,
    disconnect,
  };
}
