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

export interface AgentCommandOptions {
  command: string;
  engineMode?: string;
  ollamaModel?: string;
  history?: any[];
  onStreamStart?: (requestId: string) => void;
  onStreamChunk?: (chunk: string, accumulated: string) => void;
  onActionTaken?: (action: string, payload: any) => void;
}

export interface AgentCommandResult {
  success: boolean;
  response?: string;
  reply?: string;
  text?: string;
  actionTaken?: string;
  toolPayload?: any;
  payload?: any;
  result?: any;
  model?: string;
  modelUsed?: string;
  timestamp?: string;
  error?: string;
  message?: string;
}

interface PendingAgentRequest {
  resolve: (res: AgentCommandResult) => void;
  reject: (err: any) => void;
  timer: NodeJS.Timeout;
  options: AgentCommandOptions;
  accumulated: string;
}

interface UseLedWebSocketReturn {
  ledStates: LedStates;
  hardwareInfo: HardwareInfo | null;
  lastCommandResult: HardwareExecutionResult | null;
  isConnected: boolean;
  error: string | null;
  sendControlCommand: (color: string, action: string) => Promise<boolean>;
  sendPresetCommand: (mode: string) => Promise<boolean>;
  sendAgentCommand: (options: AgentCommandOptions) => Promise<AgentCommandResult>;
}

/**
 * Custom hook for real-time LED & Lamp state synchronization and streaming AI agent commands over WebSocket.
 */
export function useLedWebSocket(): UseLedWebSocketReturn {
  const [ledStates, setLedStates] = useState<LedStates>({
    red: 'OFF',
    yellow: 'OFF',
    green: 'OFF',
    lamp: 'OFF',
  });
  const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo | null>(null);
  const [lastCommandResult, setLastCommandResult] = useState<HardwareExecutionResult | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingRequestsRef = useRef<Map<string, PendingAgentRequest>>(new Map());

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
          const reqId = data.requestId;
          const pending = reqId ? pendingRequestsRef.current.get(reqId) : null;

          if (data.type === 'led_state') {
            if (data.states) setLedStates(data.states);
            if (data.hardware) setHardwareInfo(data.hardware);
          } else if (data.type === 'command_response') {
            if (data.payload?.hardware) setLastCommandResult(data.payload.hardware);
          } else if (data.type === 'agent_stream_start') {
            if (pending?.options?.onStreamStart) {
              pending.options.onStreamStart(reqId);
            }
          } else if (data.type === 'agent_stream_chunk') {
            if (pending) {
              pending.accumulated += data.chunk || '';
              if (pending.options?.onStreamChunk) {
                pending.options.onStreamChunk(data.chunk, pending.accumulated);
              }
            }
          } else if (data.type === 'agent_action') {
            if (pending?.options?.onActionTaken) {
              pending.options.onActionTaken(data.actionTaken, data.toolPayload);
            }
          } else if (data.type === 'agent_response') {
            if (pending) {
              clearTimeout(pending.timer);
              pendingRequestsRef.current.delete(reqId);
              pending.resolve(data);
            }
          } else if (data.type === 'error') {
            console.warn('[LED WebSocket] Error message received:', data.message);
          }
        } catch (err) {
          console.error('[LED WebSocket] Parse error:', err);
        }
      };

      ws.onerror = () => {
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

  const sendAgentCommand = useCallback(
    async (options: AgentCommandOptions): Promise<AgentCommandResult> => {
      const requestId = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      // If WebSocket is open and connected -> use ws.send() with real-time stream callbacks!
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        return new Promise<AgentCommandResult>((resolve, reject) => {
          const timer = setTimeout(() => {
            if (pendingRequestsRef.current.has(requestId)) {
              pendingRequestsRef.current.delete(requestId);
              // Timeout fallback to HTTP if WebSocket took too long
              fetch('/api/agent/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(options),
              })
                .then((r) => r.json())
                .then(resolve)
                .catch(reject);
            }
          }, 35000);

          pendingRequestsRef.current.set(requestId, {
            resolve,
            reject,
            timer,
            options,
            accumulated: '',
          });

          try {
            console.log(
              '%c[WebSocket ws.send()] Streaming Agent Command:',
              'color: #38bdf8; font-weight: bold;',
              options.command
            );
            wsRef.current?.send(
              JSON.stringify({
                type: 'agent_command',
                requestId,
                command: options.command,
                engineMode: options.engineMode || 'ollama',
                ollamaModel: options.ollamaModel,
                history: options.history,
              })
            );
          } catch (err) {
            clearTimeout(timer);
            pendingRequestsRef.current.delete(requestId);
            // Fallback to HTTP
            fetch('/api/agent/command', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(options),
            })
              .then((r) => r.json())
              .then(resolve)
              .catch(reject);
          }
        });
      }

      // If WebSocket not ready -> HTTP fallback
      console.log('[Agent Command] WebSocket offline -> using HTTP POST fallback');
      const res = await fetch('/api/agent/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });
      const data = await res.json();
      return data;
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
    sendAgentCommand,
  };
}
