"use client"

import { useCallback } from 'react';
import { useEffect, useState, useRef } from 'react';

export interface LedStates {
  red: 'ON' | 'OFF';
  yellow: 'ON' | 'OFF';
  green: 'ON' | 'OFF';
  lamp: 'ON' | 'OFF';
}

export interface HardwarePinInfo {
  board_pin?: number;
  gpio?: number;
  active_low?: boolean;
  health?: {
    last_status?: string;
    ok?: boolean;
    verified?: boolean;
    timestamp?: string;
  };
}

export interface HardwareInfo {
  is_hardware_active: boolean;
  mode: 'hardware' | 'simulated';
  gpio_chip: string;
  error?: string | null;
  pins?: {
    red?: HardwarePinInfo;
    yellow?: HardwarePinInfo;
    green?: HardwarePinInfo;
    lamp?: HardwarePinInfo;
  };
}

export interface HardwareExecutionResult {
  success: boolean;
  mode: 'hardware' | 'simulated';
  pin?: number;
  written?: boolean;
  verified?: boolean;
  message?: string;
  error?: string;
}

interface UseLedWebSocketReturn {
  ledStates: LedStates;
  hardwareInfo: HardwareInfo | null;
  lastCommandResult: HardwareExecutionResult | null;
  isConnected: boolean;
  error: string | null;
  sendControlCommand: (color: string, action: string) => Promise<boolean>;
  sendPresetCommand: (mode: string) => Promise<boolean>;
}

/**
 * Custom hook for real-time LED & Lamp state synchronization via WebSocket with HTTP polling fallback.
 * Handles state updates, physical pin verification, and command sending.
 */
export function useLedWebSocket(): UseLedWebSocketReturn {
  const [ledStates, setLedStates] = useState<LedStates>(({
    red: 'OFF',
    yellow: 'OFF',
    green: 'OFF',
    lamp: 'OFF',
  }));
  const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo | null>(null);
  const [lastCommandResult, setLastCommandResult] = useState<HardwareExecutionResult | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fallback HTTP poller to ensure UI stays in sync if WebSocket is blocked or disconnected
  const syncStateViaHttp = useCallback(async () => {
    try {
      const res = await fetch('/api/led');
      if (res.ok) {
        const data = await res.json();
        if (data.states) setLedStates(data.states);
        if (data.hardware_info) setHardwareInfo(data.hardware_info);
      }
    } catch {}
  }, []);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      // When running on standard web port or localhost, connect to backend port 8000
      let wsHost = window.location.host;
      if (window.location.port === '3000') {
        wsHost = `${window.location.hostname}:8000`;
      }
      const url = process.env.NEXT_PUBLIC_WS_URL || `${protocol}://${wsHost}/ws/led`;
      
      const ws = new WebSocket(url);
      ws.onopen = () => {
        console.log('[LED WebSocket] Connected to', url);
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'led_state') {
            if (data.states) setLedStates(data.states);
            if (data.hardware) setHardwareInfo(data.hardware);
          } else if (data.type === 'command_response') {
            if (data.payload?.hardware) setLastCommandResult(data.payload.hardware);
          } else if (data.type === 'error') {
            console.warn('[LED WebSocket] Error message received:', data.message);
          }
        } catch (err) {
          console.error('[LED WebSocket] Parse error:', err);
        }
      };

      ws.onerror = () => {
        // WebSocket error events in browsers contain no textual details for security reasons
        console.warn(`[LED WebSocket] Connection failed to ${url}. Falling back to HTTP polling.`);
        setError('WebSocket offline (using HTTP fallback)');
        setIsConnected(false);
      };

      ws.onclose = () => {
        setIsConnected(false);

        // Auto-reconnect after 3 seconds
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };
      wsRef.current = ws;
    } catch (err: any) {
      console.warn('[LED WebSocket] Connection setup failed:', err?.message || err);
      setError('WebSocket unavailable');
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch to immediately load state
    syncStateViaHttp();

    // Start WebSocket
    connect();

    // Fallback polling interval: poll every 3s if disconnected
    pollIntervalRef.current = setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        syncStateViaHttp();
      }
    }, 3000);

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect, syncStateViaHttp]);

  const sendControlCommand = useCallback(
    async (color: string, action: string): Promise<boolean> => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        try {
          const res = await fetch('/api/led', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ color, action }),
          });
          const data = await res.json();
          if (data.states) {
            setLedStates(data.states);
          }
          if (data.hardware) {
            setLastCommandResult(data.hardware);
          }
          return res.ok;
        } catch (err) {
          console.error('[LED] HTTP fallback error:', err);
          return false;
        }
      }

      try {
        const payload =
          color === 'lamp'
            ? { type: 'control_lamp', action: 'control_lamp', state: action }
            : { type: 'control_led', action: 'control_led', color, state: action };

        wsRef.current.send(JSON.stringify(payload));
        return true;
      } catch (err) {
        console.error('[LED WebSocket] Failed to send message:', err);
        return false;
      }
    },
    []
  );

  const sendPresetCommand = useCallback(
    async (mode: string): Promise<boolean> => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        try {
          const res = await fetch('/api/led/preset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode }),
          });
          const data = await res.json();
          if (data.states) {
            setLedStates(data.states);
          }
          if (data.hardware) {
            setLastCommandResult(data.hardware);
          }
          return res.ok;
        } catch (err) {
          console.error('[LED] HTTP fallback error:', err);
          return false;
        }
      }

      try {
        wsRef.current.send(
          JSON.stringify({
            type: 'traffic_preset',
            action: 'traffic_preset',
            mode,
          })
        );
        return true;
      } catch (err) {
        console.error('[LED WebSocket] Failed to send preset message:', err);
        return false;
      }
    },
    []
  );

  return {
    ledStates,
    hardwareInfo,
    lastCommandResult,
    isConnected,
    error,
    sendControlCommand,
    sendPresetCommand,
  };
}
